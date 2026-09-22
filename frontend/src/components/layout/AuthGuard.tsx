import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { LoadingState } from '@/components/shared/LoadingState'
import { useAuth } from '@/hooks/useAuth'

/**
 * Gate for routes that need a signed-in user.
 *
 * The intended destination is stashed in location state so that signing in
 * returns you where you were headed, rather than dumping you on the dashboard
 * and making you navigate again.
 */
export function AuthGuard() {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  // Render nothing decisive until the stored session has been read back,
  // otherwise a refresh on a protected page flashes the login screen.
  if (isLoading) return <LoadingState fullPage label="Checking your session…" />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

/**
 * The inverse: login and signup should not be reachable while signed in.
 */
export function GuestOnly() {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingState fullPage label="Checking your session…" />

  if (session) {
    const from = (location.state as { from?: Location } | null)?.from
    return <Navigate to={from?.pathname ?? '/dashboard'} replace />
  }

  return <Outlet />
}
