import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, health, NotAuthenticatedError, request } from '@/lib/api'

vi.mock('@/lib/supabase', () => ({
  getAccessToken: vi.fn(),
}))

const { getAccessToken } = await import('@/lib/supabase')
const mockGetAccessToken = vi.mocked(getAccessToken)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api request wrapper', () => {
  beforeEach(() => {
    mockGetAccessToken.mockResolvedValue('test-token')
    vi.stubGlobal('fetch', vi.fn())
  })

  it('attaches the current JWT as a bearer token', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }))

    await request('/api/prds')

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const headers = init?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })

  it('does not attach auth when auth is disabled', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 'ok' }))

    await request('/api/health', { auth: false })

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect((init?.headers as Headers).has('Authorization')).toBe(false)
    expect(mockGetAccessToken).not.toHaveBeenCalled()
  })

  it('throws NotAuthenticatedError before fetching when signed out', async () => {
    mockGetAccessToken.mockResolvedValue(null)

    await expect(request('/api/prds')).rejects.toBeInstanceOf(NotAuthenticatedError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('unwraps the backend error envelope into a typed ApiError', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'PRD_NOT_FOUND',
            message: "Not found, or you don't have access to it.",
            details: {},
          },
        },
        404,
      ),
    )

    const error = await request('/api/prds/abc').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.code).toBe('PRD_NOT_FOUND')
    expect(apiError.status).toBe(404)
    expect(apiError.isNotFound).toBe(true)
  })

  it('exposes retry_after from a rate-limit response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many generations.',
            details: { retry_after: 900 },
          },
        },
        429,
      ),
    )

    const error = (await request('/api/prds/abc/generate', { method: 'POST' }).catch(
      (e: unknown) => e,
    )) as ApiError

    expect(error.retryAfter).toBe(900)
  })

  it('exposes the correlation id from a server error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong on our end.',
            details: { correlation_id: 'abc-123' },
          },
        },
        500,
      ),
    )

    const error = (await request('/api/prds').catch((e: unknown) => e)) as ApiError
    expect(error.correlationId).toBe('abc-123')
  })

  it('reports a reachable message when the network fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    const error = (await request('/api/prds').catch((e: unknown) => e)) as ApiError

    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toMatch(/backend is running/i)
  })

  it('handles a non-JSON error body without crashing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    )

    const error = (await request('/api/prds').catch((e: unknown) => e)) as ApiError

    expect(error.code).toBe('UNEXPECTED_RESPONSE')
    expect(error.message).not.toContain('<html>')
  })

  it('returns undefined for a 204', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await expect(request('/api/prds/abc')).resolves.toBeUndefined()
  })

  it('builds health URLs against the configured API base', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 'ok', latency_ms: 12 }))

    await health.db()

    const [url] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://localhost:8000/api/health/db')
  })
})
