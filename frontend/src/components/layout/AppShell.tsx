import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/lib/utils'

/** Standard frame for signed-in pages: top bar plus a constrained body. */
export function AppShell({
  children,
  topBarContent,
  className,
  /** The editor manages its own width, so it opts out of the max-width. */
  fullWidth = false,
}: {
  children: React.ReactNode
  topBarContent?: React.ReactNode
  className?: string
  fullWidth?: boolean
}) {
  return (
    <div className="min-h-dvh bg-background">
      <TopBar>{topBarContent}</TopBar>
      <main
        className={cn(
          fullWidth ? 'w-full' : 'mx-auto max-w-6xl px-4 py-8 sm:px-6',
          className,
        )}
      >
        {children}
      </main>
    </div>
  )
}
