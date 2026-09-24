import { Copy, FileText, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { absoluteTime, pluralize, relativeTime } from '@/lib/format'
import type { PrdSummary } from '@/lib/types'
import { SECTION_ORDER } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * One PRD in the dashboard list.
 *
 * A row rather than a card: these are documents, and a list scans far better
 * than a grid of identical boxes once there are more than a handful.
 */
export function PrdCard({
  prd,
  onRename,
  onDuplicate,
  onDelete,
}: {
  prd: PrdSummary
  onRename: (id: string, title: string) => void
  onDuplicate: (id: string) => void
  onDelete: (prd: PrdSummary) => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState(prd.title)

  /** A draft goes back to the wizard; a generated PRD opens in the editor. */
  const href = prd.status === 'draft' ? `/prds/${prd.id}/edit` : `/prds/${prd.id}`

  function commitRename() {
    const next = draftTitle.trim()
    if (next && next !== prd.title) onRename(prd.id, next)
    setIsRenaming(false)
  }

  if (isRenaming) {
    return (
      <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
        <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            commitRename()
          }}
        >
          <label htmlFor={`rename-${prd.id}`} className="sr-only">
            PRD title
          </label>
          <Input
            id={`rename-${prd.id}`}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDraftTitle(prd.title)
                setIsRenaming(false)
              }
            }}
            autoFocus
            className="h-8"
          />
          <Button type="submit" size="sm">
            Save
          </Button>
        </form>
      </li>
    )
  }

  return (
    <li className="group border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/60">
        <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <Link
            to={href}
            className="block truncate rounded-sm font-medium tracking-tight hover:underline underline-offset-4"
          >
            {prd.title}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <time dateTime={prd.updated_at} title={absoluteTime(prd.updated_at)}>
              Edited {relativeTime(prd.updated_at)}
            </time>
            {prd.section_count > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {pluralize(prd.section_count, 'section')} of {SECTION_ORDER.length}
                </span>
              </>
            )}
          </p>
        </div>

        <StatusBadge status={prd.status} className="hidden shrink-0 sm:inline-flex" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${prd.title}`}
              className={cn(
                'size-8 shrink-0',
                // Visible on hover, on focus, and always on touch where there
                // is no hover to reveal it.
                'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
              )}
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onSelect={() => {
                setDraftTitle(prd.title)
                setIsRenaming(true)
              }}
            >
              <Pencil aria-hidden className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDuplicate(prd.id)}>
              <Copy aria-hidden className="size-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onDelete(prd)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 aria-hidden className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}
