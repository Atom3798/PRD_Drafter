import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Dashboard from '@/pages/Dashboard'
import { ApiError } from '@/lib/api'
import type { PrdListResponse, PrdSummary } from '@/lib/types'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    prds: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      duplicate: vi.fn(),
    },
  }
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: { access_token: 't' },
    user: { email: 'user@example.com', user_metadata: { full_name: 'Ada' } },
    isLoading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

const { prds } = await import('@/lib/api')
const mockList = vi.mocked(prds.list)

function makePrd(overrides: Partial<PrdSummary> = {}): PrdSummary {
  return {
    id: 'prd-1',
    title: 'Recipe sharing for home cooks',
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    section_count: 0,
    ...overrides,
  }
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function listResponse(items: PrdSummary[]): PrdListResponse {
  return { items, total: items.length }
}

describe('Dashboard', () => {
  beforeEach(() => {
    mockList.mockReset()
  })

  it('shows a loading state while the list is in flight', () => {
    mockList.mockReturnValue(new Promise(() => {}))

    renderDashboard()

    expect(screen.getByRole('status', { name: /loading your prds/i })).toBeInTheDocument()
  })

  it('explains the product when the user has no PRDs', async () => {
    mockList.mockResolvedValue(listResponse([]))

    renderDashboard()

    // Not just "no PRDs" - a first-time user needs to know what this does.
    expect(await screen.findByText(/turn an idea into a prd/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create your first prd/i })).toBeInTheDocument()
    expect(screen.getByText(/answer a few questions/i)).toBeInTheDocument()
  })

  it('renders the list when PRDs exist', async () => {
    mockList.mockResolvedValue(
      listResponse([
        makePrd(),
        makePrd({ id: 'prd-2', title: 'Design system rollout', status: 'generated' }),
      ]),
    )

    renderDashboard()

    expect(await screen.findByText('Recipe sharing for home cooks')).toBeInTheDocument()
    expect(screen.getByText('Design system rollout')).toBeInTheDocument()
    expect(screen.getByText('2 documents')).toBeInTheDocument()
  })

  it('shows a retryable error when the list fails', async () => {
    mockList.mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', "Couldn't reach the server."),
    )

    renderDashboard()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/couldn't load your prds/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('never shows a raw stack trace on failure', async () => {
    mockList.mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong on our end.', {
        correlation_id: 'abc-123',
      }),
    )

    renderDashboard()

    await screen.findByRole('alert')
    // The id is shown so a bug report can be traced; internals are not.
    expect(screen.getByText(/abc-123/)).toBeInTheDocument()
    expect(screen.queryByText(/at Object\./)).not.toBeInTheDocument()
  })

  it('shows a distinct message when a search matches nothing', async () => {
    mockList.mockImplementation((params) =>
      Promise.resolve(
        listResponse(params?.search ? [] : [makePrd()]),
      ),
    )

    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('Recipe sharing for home cooks')

    await user.type(screen.getByLabelText(/search your prds/i), 'zzzz')

    // The onboarding pitch would be wrong here - they do have PRDs.
    expect(await screen.findByText(/no prds match/i)).toBeInTheDocument()
    expect(screen.queryByText(/turn an idea into a prd/i)).not.toBeInTheDocument()
  })

  it('renders section progress once a PRD has content', async () => {
    mockList.mockResolvedValue(listResponse([makePrd({ section_count: 7 })]))

    renderDashboard()

    expect(await screen.findByText(/7 sections of 21/i)).toBeInTheDocument()
  })

  it('asks for confirmation before deleting', async () => {
    mockList.mockResolvedValue(listResponse([makePrd()]))
    const user = userEvent.setup()

    renderDashboard()
    await screen.findByText('Recipe sharing for home cooks')

    await user.click(screen.getByRole('button', { name: /actions for/i }))
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }))

    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveTextContent(/no way to recover/i),
    )
    expect(vi.mocked(prds.remove)).not.toHaveBeenCalled()
  })
})
