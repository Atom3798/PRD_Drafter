import { AlertTriangle, CheckCircle2, FileEdit, Loader2 } from 'lucide-react'

import type { PrdStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The status of a PRD.
 *
 * Each status gets its own muted colour. None of them is amber - that is
 * reserved for "needs clarification" and must not be diluted here.
 */
const STATUS_CONFIG: Record<
  PrdStatus,
  { label: string; icon: typeof FileEdit; className: string }
> = {
  draft: {
    label: 'Draft',
    icon: FileEdit,
    className: 'text-status-draft border-status-draft/25 bg-status-draft/8',
  },
  generating: {
    label: 'Generating',
    icon: Loader2,
    className:
      'text-status-generating border-status-generating/30 bg-status-generating/10',
  },
  generated: {
    label: 'Ready',
    icon: CheckCircle2,
    className:
      'text-status-generated border-status-generated/30 bg-status-generated/10',
  },
  failed: {
    label: 'Failed',
    icon: AlertTriangle,
    className: 'text-status-failed border-status-failed/30 bg-status-failed/10',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: PrdStatus
  className?: string
}) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn('size-3', status === 'generating' && 'animate-spin')}
      />
      {config.label}
    </span>
  )
}
