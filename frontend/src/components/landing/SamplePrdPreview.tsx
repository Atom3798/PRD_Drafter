import { AlertTriangle } from 'lucide-react'

/**
 * A static excerpt of a generated PRD, shown on the landing page.
 *
 * This is the argument for the product, so it has to demonstrate the
 * anti-fabrication rule rather than just assert it:
 *
 * - the metric has no target, because the (fictional) user never gave a
 *   number — that empty cell is the feature
 * - the flagged assumption shows what happens when the model has to infer
 *
 * Nothing here is a real statistic, which is the point. Keep it that way if
 * you edit this file.
 */
export function SamplePrdPreview() {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <figcaption className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </span>
        <span className="ml-1 truncate text-xs font-medium text-muted-foreground">
          Recipe sharing for home cooks — excerpt
        </span>
      </figcaption>

      <div className="space-y-6 p-5 text-sm sm:p-6">
        <section>
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Problem statement
          </h3>
          <p className="mt-2 leading-relaxed">
            Home cooks collect recipes across screenshots, bookmarks and
            handwritten cards. When they want to cook something they made
            before, they often cannot find it, and family recipes are lost
            when the person who wrote them down is gone.
          </p>
        </section>

        <section>
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Functional requirements
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[22rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">ID</th>
                  <th className="py-1.5 pr-3 font-medium">Requirement</th>
                  <th className="py-1.5 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {[
                  ['FR-01', 'Capture a recipe from a photo or pasted text', 'must'],
                  ['FR-02', 'Organise recipes into collections', 'must'],
                  ['FR-03', 'Share a collection with named family members', 'should'],
                ].map(([id, text, priority]) => (
                  <tr key={id} className="border-b border-border/60 last:border-b-0">
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                      {id}
                    </td>
                    <td className="py-2 pr-3">{text}</td>
                    <td className="py-2 text-muted-foreground">{priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Success metrics
          </h3>
          <dl className="mt-2 space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <dt className="font-medium">Recipes saved per active user</dt>
              <dd className="text-muted-foreground">
                target:{' '}
                <span className="italic">not specified — you didn&rsquo;t give one</span>
              </dd>
            </div>
          </dl>
        </section>

        {/* The differentiator, rendered exactly as the editor renders it. */}
        <aside className="flex items-start gap-2.5 rounded-lg border border-clarify-border bg-clarify-surface p-3">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-clarify" />
          <div>
            <p className="text-xs font-medium text-clarify-foreground">
              Assumption — needs clarification
            </p>
            <p className="mt-1 text-xs leading-relaxed text-clarify-foreground/90">
              You didn&rsquo;t mention a platform, so requirements were written
              for mobile first. Confirm before building.
            </p>
          </div>
        </aside>
      </div>
    </figure>
  )
}
