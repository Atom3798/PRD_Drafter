import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

import { health } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Phase 1 scaffolding: proves the browser can reach FastAPI and that FastAPI
 * can reach Supabase. Kept because a broken local setup is otherwise a
 * confusing silent failure for a new teammate.
 */
export function SystemStatus({ className }: { className?: string }) {
  const apiQuery = useQuery({
    queryKey: ['health', 'api'],
    queryFn: health.api,
    retry: false,
  })

  const dbQuery = useQuery({
    queryKey: ['health', 'db'],
    queryFn: health.db,
    retry: false,
    enabled: apiQuery.isSuccess,
  })

  return (
    <div className={cn('space-y-2 text-sm', className)}>
      <Row
        label="Backend API"
        pending={apiQuery.isPending}
        ok={apiQuery.isSuccess}
        detail={
          apiQuery.isSuccess
            ? `v${apiQuery.data.version} · ${apiQuery.data.environment}`
            : 'Not reachable - is uvicorn running on :8000?'
        }
      />
      <Row
        label="Database"
        pending={dbQuery.isPending && apiQuery.isSuccess}
        ok={dbQuery.isSuccess && dbQuery.data.status === 'ok'}
        detail={
          dbQuery.isSuccess
            ? `${dbQuery.data.latency_ms}ms`
            : 'Not reachable - check SUPABASE_URL and that migrations ran.'
        }
      />
    </div>
  )
}

function Row({
  label,
  pending,
  ok,
  detail,
}: {
  label: string
  pending: boolean
  ok: boolean
  detail: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      {pending ? (
        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
      ) : ok ? (
        <CheckCircle2 aria-hidden className="size-4 shrink-0 text-status-generated" />
      ) : (
        <XCircle aria-hidden className="size-4 shrink-0 text-destructive" />
      )}
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">
        {pending ? 'checking…' : detail}
      </span>
    </div>
  )
}
