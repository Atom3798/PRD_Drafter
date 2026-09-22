import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

/**
 * Auth state shared across the app.
 *
 * The context object lives in its own module so the provider file can export
 * only a component — otherwise react-refresh loses the ability to hot-reload
 * it.
 */
export interface AuthContextValue {
  session: Session | null
  user: User | null
  /** True until the initial session lookup settles. Guards render on refresh. */
  isLoading: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export interface SignUpResult {
  /**
   * True when Supabase created the account but is waiting on a confirmation
   * email, so there is no session yet. The signup page shows a "check your
   * inbox" state rather than redirecting to a dashboard that would bounce.
   */
  needsEmailConfirmation: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Turn a Supabase auth error into something worth showing a person.
 *
 * Supabase's own strings are terse and occasionally leak implementation
 * detail; these are written for the user. Anything unrecognised falls through
 * to a generic message rather than surfacing a raw error.
 */
export function friendlyAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const message = raw.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'That email and password combination does not match an account.'
  }
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email address first — check your inbox.'
  }
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'An account with that email already exists. Try signing in instead.'
  }
  if (message.includes('password should be at least')) {
    return 'Please choose a password of at least 6 characters.'
  }
  if (message.includes('unable to validate email') || message.includes('invalid email')) {
    return 'That does not look like a valid email address.'
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Could not reach the authentication service. Check your connection.'
  }
  return 'Something went wrong signing you in. Please try again.'
}
