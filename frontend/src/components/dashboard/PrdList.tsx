import { PrdCard } from '@/components/dashboard/PrdCard'
import { Skeleton } from '@/components/ui/skeleton'
import type { PrdSummary } from '@/lib/types'

/** The populated list. Loading, empty and error states live in Dashboard. */
export function PrdList({
  items,
  onRename,
  onDuplicate,
  onDelete,
}: {
  items: PrdSummary[]
  onRename: (id: string, title: string) => void
  onDuplicate: (id: string) => void
  onDelete: (prd: PrdSummary) => void
}) {
  return (
    <ul className="overflow-hidden rounded-lg border border-border bg-card">
      {items.map((prd) => (
        <PrdCard
          key={prd.id}
          prd={prd}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}

/**
 * Loading placeholder shaped like the real rows.
 *
 * Matching the final layout stops the page jumping when data lands, which
 * reads as much faster than a centred spinner even at the same latency.
 */
export function PrdListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-card"
      role="status"
      aria-label="Loading your PRDs"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          <Skeleton className="size-4 shrink-0 rounded" />
          <div className="flex-1 space-y-2">
            {/* Varied widths so it reads as content, not a loading bar. */}
            <Skeleton
              className="h-4 rounded"
              style={{ width: `${[45, 62, 38, 55][index % 4]}%` }}
            />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
          <Skeleton className="hidden h-5 w-16 shrink-0 rounded-full sm:block" />
        </div>
      ))}
    </div>
  )
}
