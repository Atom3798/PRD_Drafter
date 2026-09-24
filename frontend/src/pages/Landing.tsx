import {
  ArrowRight,
  FileText,
  ListChecks,
  PencilLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { SamplePrdPreview } from '@/components/landing/SamplePrdPreview'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { SECTION_ORDER } from '@/lib/types'

const STEPS = [
  {
    icon: PencilLine,
    title: 'Answer the interview',
    body: 'Seven short steps covering the idea, the problem, users, features, goals and constraints. Only four answers are required.',
  },
  {
    icon: Sparkles,
    title: 'Generate the document',
    body: `All ${SECTION_ORDER.length} sections are written in four parallel passes — usually under a minute — from your answers alone.`,
  },
  {
    icon: ListChecks,
    title: 'Edit what you disagree with',
    body: 'Rewrite any section by hand, or regenerate just that one with an instruction like "make this more technical".',
  },
]

export default function Landing() {
  const { session, isLoading } = useAuth()

  /** Someone already signed in wants their dashboard, not a sales pitch. */
  const primaryHref = session ? '/dashboard' : '/signup'
  const primaryLabel = session ? 'Go to your PRDs' : 'Start writing'

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2 font-medium tracking-tight">
            <FileText aria-hidden className="size-4 text-primary" />
            PRD Drafter
          </span>
          {!isLoading && (
            <div className="flex items-center gap-2">
              {session ? (
                <Button asChild size="sm">
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/signup">Get started</Link>
                  </Button>
                </>
              )}
            </div>
          )}
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
            <div>
              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
                Turn a rough idea into a PRD you can hand to engineers.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
                Answer a short guided interview. Get back a structured product
                requirements document — problem, personas, user stories,
                requirements, metrics and risks — written entirely from what
                you said.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to={primaryHref}>
                    {primaryLabel}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </Button>
                {!session && (
                  <Button asChild variant="outline" size="lg">
                    <Link to="/login">Sign in</Link>
                  </Button>
                )}
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                Four required questions. About two minutes to your first draft.
              </p>
            </div>

            <div className="lg:pl-4">
              <SamplePrdPreview />
            </div>
          </div>
        </section>

        {/* The actual differentiator */}
        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            {/* Editorial two-column: claim on the left, argument on the right.
                A single narrow column here left the right half of the section
                visibly empty. */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
              <div className="flex flex-col gap-4">
                <ShieldCheck aria-hidden className="size-6 text-primary" />
                <h2 className="text-2xl font-semibold leading-tight tracking-tight text-balance sm:text-3xl">
                  It will not make up numbers to sound convincing.
                </h2>
              </div>

              <div className="flex flex-col gap-4 lg:pt-10">
                <p className="leading-relaxed text-muted-foreground">
                  Most AI writing tools fill gaps with confident-sounding
                  invention — a market size here, a percentage there. A PRD full
                  of fake statistics is worse than no PRD, because someone will
                  eventually act on one.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  This one is built the other way round. Every claim traces back
                  to something you wrote. When the model has to infer to finish
                  a section, it records that inference as an explicit assumption
                  and flags it for you to confirm. If you never gave a target
                  for a metric, the target stays empty.
                </p>
              </div>
            </div>

            <dl className="mt-12 grid gap-8 sm:grid-cols-3">
              {[
                ['Never invented', 'Market sizes, percentages, revenue figures, user counts, competitor names.'],
                ['Always recorded', 'Every inference the model makes, listed in one panel, grouped by section.'],
                ['Left empty instead', 'A metric with no target you supplied stays blank rather than guessing.'],
              ].map(([term, description]) => (
                <div key={term}>
                  <dt className="text-sm font-medium">{term}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>

          <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <li key={title}>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-medium tabular-nums text-secondary-foreground">
                    {index + 1}
                  </span>
                  <Icon aria-hidden className="size-4 text-primary" />
                </div>
                <h3 className="mt-4 font-medium tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-20">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Write your first PRD
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Start from an idea in a sentence. Edit everything afterwards.
              </p>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link to={primaryHref}>
                {primaryLabel}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-2">
            <FileText aria-hidden className="size-3.5" />
            PRD Drafter
          </span>
          <span>A university software engineering project.</span>
        </div>
      </footer>
    </div>
  )
}
