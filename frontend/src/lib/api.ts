import { env } from '@/lib/env'
import { getAccessToken, supabase } from '@/lib/supabase'
import type {
  CreatePrdRequest,
  GenerationResultResponse,
  GenerationStatusResponse,
  Prd,
  PrdListResponse,
  PrdStatus,
  RegenerateSectionRequest,
  RegenerateSectionResponse,
  SectionKey,
  UpdatePrdRequest,
  VersionListResponse,
} from '@/lib/types'

/**
 * The one way the app talks to FastAPI.
 *
 * Responsibilities: attach the current JWT, unwrap the backend's error
 * envelope into a typed ApiError, and keep every caller from hand-rolling
 * fetch. The typed per-endpoint helpers at the bottom are the surface the
 * rest of the app should use; `request` itself is the escape hatch.
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

  if (!response.ok) {
    const error = await toApiError(response)
    // A 401 from our API means the token is no longer good, whatever the
    // client thinks. Clearing the session lets AuthProvider notice and
    // AuthGuard redirect, rather than leaving the user on a dead page.
    if (error.status === 401) void supabase.auth.signOut()
    throw error
  }
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

// ---- PRDs -----------------------------------------------------------------

export interface ListPrdsParams {
  search?: string
  status?: PrdStatus
  limit?: number
  offset?: number
}

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}

export const prds = {
  list: (params: ListPrdsParams = {}, signal?: AbortSignal) =>
    api.get<PrdListResponse>(`/api/prds${queryString({ ...params })}`, { signal }),

  get: (id: string, signal?: AbortSignal) => api.get<Prd>(`/api/prds/${id}`, { signal }),

  create: (body: CreatePrdRequest = {}) => api.post<Prd>('/api/prds', body),

  /** Autosave. The backend merges, so a partial body is safe. */
  update: (id: string, body: UpdatePrdRequest, signal?: AbortSignal) =>
    api.patch<Prd>(`/api/prds/${id}`, body, { signal }),

  remove: (id: string) => api.delete(`/api/prds/${id}`),

  duplicate: (id: string) => api.post<Prd>(`/api/prds/${id}/duplicate`),
}

// ---- Generation -----------------------------------------------------------

/** Generation runs 30-90s, well past the default request timeout. */
const GENERATION_TIMEOUT_MS = 180_000

export const generation = {
  start: (id: string, signal?: AbortSignal) =>
    api.post<GenerationResultResponse>(`/api/prds/${id}/generate`, undefined, {
      signal,
      timeoutMs: GENERATION_TIMEOUT_MS,
    }),

  /** For a client that reconnects while generation is still running. */
  status: (id: string, signal?: AbortSignal) =>
    api.get<GenerationStatusResponse>(`/api/prds/${id}/generation-status`, { signal }),

  regenerateSection: (
    id: string,
    sectionKey: SectionKey,
    body: RegenerateSectionRequest = {},
    signal?: AbortSignal,
  ) =>
    api.post<RegenerateSectionResponse>(
      `/api/prds/${id}/sections/${sectionKey}/regenerate`,
      body,
      { signal, timeoutMs: GENERATION_TIMEOUT_MS },
    ),
}

// ---- Versions -------------------------------------------------------------

export const versions = {
  list: (id: string, signal?: AbortSignal) =>
    api.get<VersionListResponse>(`/api/prds/${id}/versions`, { signal }),

  /** Restoring appends a new version; history is never destroyed. */
  restore: (id: string, versionId: string) =>
    api.post<Prd>(`/api/prds/${id}/versions/${versionId}/restore`),
}

// ---- Export ---------------------------------------------------------------

export const exportPrd = {
  markdown: (id: string, signal?: AbortSignal) =>
    api.get<string>(`/api/prds/${id}/export?format=markdown`, { signal }),
}

// ---- Profile --------------------------------------------------------------

export interface Profile {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

export interface DeleteAccountDataResponse {
  deleted_prd_count: number
  /** Always false: removing the auth record needs an admin key we do not use. */
  auth_account_removed: boolean
}

export const profile = {
  get: (signal?: AbortSignal) => api.get<Profile>('/api/profile', { signal }),

  update: (body: { full_name: string }) => api.patch<Profile>('/api/profile', body),

  /** Irreversible. Deletes every PRD; leaves the auth account in place. */
  deleteAllData: () => api.delete<DeleteAccountDataResponse>('/api/profile/data'),
}
