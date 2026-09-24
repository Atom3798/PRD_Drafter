import { ArrowRight, ListChecks, PencilLine, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

const STEPS = [
  {
    icon: PencilLine,
    title: 'Answer a few questions',
    body: 'Seven short steps. Only four answers are required — you can be through in about two minutes.',
  },
  {
    icon: Sparkles,
    title: 'Get a structured draft',
    body: 'Twenty-one sections written from your answers alone. No invented statistics, ever.',
  },
  {
    icon: ListChecks,
    title: 'Edit and regenerate',
    body: 'Rewrite any section by hand, or regenerate just that one with an instruction.',
  },
]

/**
 * First-run state.
 *
 * Deliberately not just "No PRDs yet". Someone landing here for the first
 * time needs to know what the product does before a Create button means
 * anything to them.
 */
export function EmptyState({
  onCreate,
  isCreating,
}: {
  onCreate: () => void
  isCreating: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-6 py-10 sm:px-10 sm:py-14">
      <div className="mx-auto max-w-lg text-center">
        <h2 className="text-xl font-semibold tracking-tight">
          Turn an idea into a PRD
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          You don&rsquo;t have any product requirements documents yet. Start with
          a rough idea — the guided interview does the structuring.
        </p>
      </div>

      <ol className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, index) => (
          <li key={title} className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-medium tabular-nums text-secondary-foreground">
                {index + 1}
              </span>
              <Icon aria-hidden className="size-4 text-primary" />
            </div>
            <h3 className="mt-3 text-sm font-medium">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex justify-center">
        <Button onClick={onCreate} disabled={isCreating} size="lg">
          {isCreating ? 'Creating…' : 'Create your first PRD'}
          <ArrowRight aria-hidden className="size-4" />
        </Button>
      </div>
    </div>
  )
}

/** Shown when a search matches nothing — distinct from having no PRDs at all. */
export function NoSearchResults({
  query,
  onClear,
}: {
  query: string
  onClear: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
      <p className="text-sm font-medium">No PRDs match &ldquo;{query}&rdquo;</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Search looks at titles only. Try a shorter word, or clear the search to
        see everything.
      </p>
      <Button variant="outline" size="sm" onClick={onClear} className="mt-5">
        Clear search
      </Button>
    </div>
  )
}
