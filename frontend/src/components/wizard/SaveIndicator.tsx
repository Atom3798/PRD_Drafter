import { AlertCircle, Check, Loader2 } from 'lucide-react'

import type { SaveStatus } from '@/hooks/useAutosave'
import { cn } from '@/lib/utils'

/**
 * Autosave status.
 *
 * Shown because "is my work safe?" is a real question in a long form, and an
 * invisible autosave answers it with nothing.
 */
export function SaveIndicator({
  status,
  className,
}: {
  status: SaveStatus
  className?: string
}) {
  if (status === 'idle') return null

  const config = {
    unsaved: { icon: null, text: 'Unsaved changes', tone: 'text-muted-foreground' },
    saving: { icon: Loader2, text: 'Saving…', tone: 'text-muted-foreground' },
    saved: { icon: Check, text: 'Saved', tone: 'text-muted-foreground' },
    error: {
      icon: AlertCircle,
      text: "Couldn't save — retrying",
      tone: 'text-destructive',
    },
  }[status]

  const Icon = config.icon

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-1.5 text-xs', config.tone, className)}
    >
      {Icon && (
        <Icon aria-hidden className={cn('size-3.5', status === 'saving' && 'animate-spin')} />
      )}
      {config.text}
    </span>
  )
}
