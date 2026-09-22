import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AppShell } from '@/components/layout/AppShell'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import { profile as profileApi } from '@/lib/api'

export default function Settings() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // null means "untouched, show whatever the server has". Deriving the
  // displayed value this way avoids syncing state in an effect, which would
  // clobber an in-progress edit on a background refetch.
  const [draftName, setDraftName] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: ({ signal }) => profileApi.get(signal),
  })

  const serverName = profileQuery.data?.full_name ?? ''
  const fullName = draftName ?? serverName

  const updateName = useMutation({
    mutationFn: (name: string) => profileApi.update({ full_name: name }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile'], updated)
      setDraftName(null)
      toast.success('Name updated.')
    },
    onError: () => toast.error('Could not save your name. Please try again.'),
  })

  const deleteData = useMutation({
    mutationFn: () => profileApi.deleteAllData(),
    onSuccess: (result) => {
      queryClient.removeQueries({ queryKey: ['prds'] })
      toast.success(
        result.deleted_prd_count === 1
          ? 'Deleted 1 PRD.'
          : `Deleted ${result.deleted_prd_count} PRDs.`,
      )
      navigate('/dashboard')
    },
    onError: () => toast.error('Could not delete your data. Please try again.'),
  })

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      toast.error('Could not sign out. Please try again.')
    }
  }

  const isDirty = draftName !== null && draftName.trim() !== serverName.trim()

  return (
    <AppShell className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {profileQuery.isPending && <LoadingState label="Loading your profile…" />}

      {profileQuery.isError && (
        <ErrorState
          className="mt-6"
          title="Could not load your profile"
          error={profileQuery.error}
          onRetry={() => void profileQuery.refetch()}
        />
      )}

      {profileQuery.isSuccess && (
        <div className="mt-8 space-y-10">
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-medium">Profile</h2>
              <p className="text-sm text-muted-foreground">
                How you appear in the app.
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (isDirty) updateName.mutate(fullName.trim())
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setDraftName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profileQuery.data.email}
                  readOnly
                  disabled
                  aria-describedby="email-hint"
                />
                <p id="email-hint" className="text-xs text-muted-foreground">
                  Changing your email goes through a confirmation flow, which is
                  not built yet.
                </p>
              </div>

              <Button type="submit" disabled={!isDirty || updateName.isPending}>
                {updateName.isPending && (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                )}
                Save changes
              </Button>
            </form>
          </section>

          <Separator />

          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-medium">Session</h2>
              <p className="text-sm text-muted-foreground">
                Sign out on this device.
              </p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              Sign out
            </Button>
          </section>

          <Separator />

          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
              <p className="text-sm text-muted-foreground">
                Permanently delete every PRD on this account, including version
                history. This cannot be undone.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Your sign-in account itself stays active — removing it needs an
                admin key this app deliberately does not hold. Email us if you
                want the account itself removed.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={deleteData.isPending}
            >
              Delete all my PRDs
            </Button>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete all your PRDs?"
        description={
          <>
            <p>
              Every PRD on this account will be permanently deleted, along with
              all version history. There is no way to recover them.
            </p>
            <p>Your sign-in account will remain active.</p>
          </>
        }
        confirmLabel="Delete everything"
        confirmPhrase="delete"
        destructive
        onConfirm={async () => {
          await deleteData.mutateAsync()
        }}
      />
    </AppShell>
  )
}
