import { useContext } from 'react'

import { AuthContext, type AuthContextValue } from '@/lib/auth-context'

/** Auth state and actions. Throws if used outside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}
