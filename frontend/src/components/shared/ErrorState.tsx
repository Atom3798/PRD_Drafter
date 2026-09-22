import { AlertCircle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * A failed async surface.
 *
 * Shows the message the backend wrote for humans, plus a correlation id when
 * one is present so a bug report can be traced. Never a stack trace.
 */
export function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
  className,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  className?: string
}) {
  const apiError = error instanceof ApiError ? error : null
  const message =
    apiError?.message ??
    (error instanceof Error ? error.message : 'An unexpected error occurred.')

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>

      {apiError?.correlationId && (
        <p className="pl-7 font-mono text-xs text-muted-foreground">
          Reference: {apiError.correlationId}
        </p>
      )}

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="ml-7">
          <RefreshCw aria-hidden className="size-3.5" />
          Try again
        </Button>
      )}
    </div>
  )
}
