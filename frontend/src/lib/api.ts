import { env } from '@/lib/env'
import { getAccessToken } from '@/lib/supabase'

/**
 * The one way the app talks to FastAPI.
 *
 * Responsibilities: attach the current JWT, unwrap the backend's error
 * envelope into a typed ApiError, and keep every caller from hand-rolling
 * fetch. Typed per-endpoint helpers are layered on top of this in Phase 2.
 */

/** Matches `core/errors.py`'s envelope exactly. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** Seconds to wait, when the backend rate-limited us. */
  get retryAfter(): number | null {
    const value = this.details.retry_after
    return typeof value === 'number' ? value : null
  }

  /** Correlation id to quote in a bug report, for server-side failures. */
  get correlationId(): string | null {
    const value = this.details.correlation_id
    return typeof value === 'string' ? value : null
  }

  get isAuthError(): boolean {
    return this.status === 401
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

/** Raised before a request is even attempted, when there is no session. */
export class NotAuthenticatedError extends ApiError {
  constructor() {
    super(401, 'UNAUTHENTICATED', 'You are not signed in.')
    this.name = 'NotAuthenticatedError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Set false for endpoints that take no auth, e.g. health checks. */
  auth?: boolean
  signal?: AbortSignal
  /** Overrides the default timeout. Generation needs a long one. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 30_000

async function buildHeaders(auth: boolean, hasBody: boolean): Promise<Headers> {
  const headers = new Headers()
  if (hasBody) headers.set('Content-Type', 'application/json')

  if (auth) {
    const token = await getAccessToken()
    if (!token) throw new NotAuthenticatedError()
    headers.set('Authorization', `Bearer ${token}`)
  }
  return headers
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    // Non-JSON failure: a proxy error page, or the backend being down.
    return new ApiError(
      response.status,
      'UNEXPECTED_RESPONSE',
      response.status >= 500
        ? "The server isn't responding properly. Please try again."
        : `Request failed (${response.status}).`,
    )
  }

  const envelope = body as Partial<ApiErrorBody>
  if (envelope?.error?.code) {
    return new ApiError(
      response.status,
      envelope.error.code,
      envelope.error.message,
      envelope.error.details ?? {},
    )
  }

  return new ApiError(response.status, 'UNEXPECTED_RESPONSE', 'Request failed.')
}

export async function request<T>(
  path: string,
  { method = 'GET', body, auth = true, signal, timeoutMs }: RequestOptions = {},
): Promise<T> {
  const headers = await buildHeaders(auth, body !== undefined)

  // Compose the caller's signal with our own timeout so either can abort.
  const timeout = AbortSignal.timeout(timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const composed = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: composed,
    })
  } catch (cause) {
    if (signal?.aborted) throw cause
    if (cause instanceof DOMException && cause.name === 'TimeoutError') {
      throw new ApiError(408, 'TIMEOUT', 'That took too long. Please try again.')
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      "Couldn't reach the server. Check your connection and that the backend is running.",
    )
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T

  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) {
    return (await response.text()) as T
  }
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}

// ---- health ---------------------------------------------------------------

export interface HealthResponse {
  status: string
  version: string
  environment: string
}

export interface DbHealthResponse {
  status: string
  latency_ms: number
  detail?: string
}

export const health = {
  api: () => api.get<HealthResponse>('/api/health', { auth: false, timeoutMs: 5_000 }),
  db: () => api.get<DbHealthResponse>('/api/health/db', { auth: false, timeoutMs: 10_000 }),
}
