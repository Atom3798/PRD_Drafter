import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AuthContext, type SignUpResult } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

/**
 * Holds the Supabase session and keeps it in sync.
 *
 * Two things happen here that are easy to get wrong:
 *
 * - `getSession()` runs once on mount so a page refresh restores the session
 *   from storage instead of flashing the login screen. `isLoading` guards
 *   render until that settles.
 * - `onAuthStateChange` keeps us current afterwards, including the silent
 *   token refresh Supabase performs before expiry.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)

      // Cached PRDs belong to the previous user. Dropping them on sign-out
      // stops one account's data flashing up under another on a shared
      // machine.
      if (event === 'SIGNED_OUT') queryClient.clear()
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [queryClient])

  const signUp = useCallback(
    async (email: string, password: string, fullName: string): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Read by the handle_new_user() trigger to populate profiles.full_name.
        options: { data: { full_name: fullName.trim() } },
      })
      if (error) throw error

      return { needsEmailConfirmation: !data.session }
    },
    [],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    queryClient.clear()
  }, [queryClient])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signUp,
      signIn,
      signOut,
    }),
    [session, isLoading, signUp, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
