import { Plus } from 'lucide-react'
import { useState } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { EmptyState, NoSearchResults } from '@/components/dashboard/EmptyState'
import { PrdList, PrdListSkeleton } from '@/components/dashboard/PrdList'
import { SearchBar } from '@/components/dashboard/SearchBar'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import {
  useCreatePrd,
  useDeletePrd,
  useDuplicatePrd,
  usePrdList,
  useRenamePrd,
} from '@/hooks/usePrd'
import { pluralize } from '@/lib/format'
import type { PrdSummary } from '@/lib/types'

export default function Dashboard() {
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PrdSummary | null>(null)

  const listQuery = usePrdList({ search: search || undefined, limit: 50 })
  const createPrd = useCreatePrd()
  const renamePrd = useRenamePrd()
  const duplicatePrd = useDuplicatePrd()
  const deletePrd = useDeletePrd()

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const isSearching = search.trim().length > 0

  // Distinguishes "no PRDs at all" from "no matches" - they need different
  // copy, and showing the onboarding pitch after a failed search is wrong.
  const hasNoPrdsAtAll = !isSearching && items.length === 0

  return (
    <AppShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your PRDs</h1>
          {listQuery.isSuccess && total > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {isSearching
                ? `${pluralize(total, 'match', 'matches')} for "${search}"`
                : pluralize(total, 'document')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(items.length > 0 || isSearching) && (
            <SearchBar value={search} onChange={setSearch} resultCount={total} />
          )}
          <Button
            onClick={() => createPrd.mutate(undefined)}
            disabled={createPrd.isPending}
            className="shrink-0"
          >
            <Plus aria-hidden className="size-4" />
            <span className="hidden sm:inline">
              {createPrd.isPending ? 'Creating…' : 'New PRD'}
            </span>
            <span className="sr-only sm:hidden">New PRD</span>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        {listQuery.isPending && <PrdListSkeleton />}

        {listQuery.isError && (
          <ErrorState
            title="Couldn't load your PRDs"
            error={listQuery.error}
            onRetry={() => void listQuery.refetch()}
          />
        )}

        {listQuery.isSuccess && hasNoPrdsAtAll && (
          <EmptyState
            onCreate={() => createPrd.mutate(undefined)}
            isCreating={createPrd.isPending}
          />
        )}

        {listQuery.isSuccess && isSearching && items.length === 0 && (
          <NoSearchResults query={search} onClear={() => setSearch('')} />
        )}

        {listQuery.isSuccess && items.length > 0 && (
          <PrdList
            items={items}
            onRename={(id, title) => renamePrd.mutate({ id, title })}
            onDuplicate={(id) => duplicatePrd.mutate(id)}
            onDelete={setPendingDelete}
          />
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete "${pendingDelete?.title ?? ''}"?`}
        description={
          <p>
            This permanently deletes the PRD and its version history. There is
            no way to recover it.
          </p>
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (pendingDelete) await deletePrd.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}
