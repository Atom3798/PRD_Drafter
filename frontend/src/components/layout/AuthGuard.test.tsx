import type { Session } from '@supabase/supabase-js'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthGuard, GuestOnly } from '@/components/layout/AuthGuard'
import type { AuthContextValue } from '@/lib/auth-context'

const mockUseAuth = vi.fn<() => AuthContextValue>()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

function authState(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    session: null,
    user: null,
    isLoading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  }
}

const FAKE_SESSION = { access_token: 'token', user: { id: 'u1' } } as unknown as Session

/** Renders a small app: one protected route, one public login route. */
function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AuthGuard />}>
          <Route path="/dashboard" element={<p>Dashboard content</p>} />
          <Route path="/prds/:id" element={<p>Editor content</p>} />
        </Route>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<p>Login form</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthGuard', () => {
  it('redirects an unauthenticated user to the login page', () => {
    mockUseAuth.mockReturnValue(authState({ session: null }))

    renderAt('/dashboard')

    expect(screen.getByText('Login form')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument()
  })

  it('renders the protected route for an authenticated user', () => {
    mockUseAuth.mockReturnValue(authState({ session: FAKE_SESSION }))

    renderAt('/dashboard')

    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
  })

  it('shows a waiting state instead of deciding while the session loads', () => {
    // Deciding early is what makes a refresh flash the login screen.
    mockUseAuth.mockReturnValue(authState({ session: null, isLoading: true }))

    renderAt('/dashboard')

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Login form')).not.toBeInTheDocument()
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument()
  })

  it('protects deep links, not just the dashboard', () => {
    mockUseAuth.mockReturnValue(authState({ session: null }))

    renderAt('/prds/abc-123')

    expect(screen.queryByText('Editor content')).not.toBeInTheDocument()
  })
})

describe('GuestOnly', () => {
  it('shows the login form when signed out', () => {
    mockUseAuth.mockReturnValue(authState({ session: null }))

    renderAt('/login')

    expect(screen.getByText('Login form')).toBeInTheDocument()
  })

  it('sends an already-signed-in user to the dashboard', () => {
    mockUseAuth.mockReturnValue(authState({ session: FAKE_SESSION }))

    renderAt('/login')

    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
    expect(screen.queryByText('Login form')).not.toBeInTheDocument()
  })
})
