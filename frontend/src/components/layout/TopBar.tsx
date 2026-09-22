import { FileText, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'

/** Persistent header for signed-in pages. */
export function TopBar({ children }: { children?: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const email = user?.email ?? ''
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? ''
  const initial = (fullName || email || '?').charAt(0).toUpperCase()

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      toast.error('Could not sign out. Please try again.')
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          to="/dashboard"
          className="flex shrink-0 items-center gap-2 rounded-sm font-medium tracking-tight"
        >
          <FileText aria-hidden className="size-4 text-primary" />
          <span className="hidden sm:inline">PRD Drafter</span>
        </Link>

        {/* Page-specific controls (save indicator, search) slot in here. */}
        <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full bg-secondary text-xs font-medium"
              aria-label="Account menu"
            >
              {initial}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              {fullName && <p className="truncate text-sm font-medium">{fullName}</p>}
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <SettingsIcon aria-hidden className="size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut aria-hidden className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
