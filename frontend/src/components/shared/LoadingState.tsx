import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The one spinner. Async surfaces should use this rather than inventing
 * their own, so waiting feels the same everywhere in the app.
 */
export function LoadingState({
  label = 'Loading…',
  className,
  fullPage = false,
}: {
  label?: string
  className?: string
  fullPage?: boolean
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-2.5 text-sm text-muted-foreground',
        fullPage ? 'min-h-dvh' : 'py-12',
        className,
      )}
    >
      <Loader2 aria-hidden className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  )
}
