import { Link } from 'react-router-dom'

import { SystemStatus } from '@/components/shared/SystemStatus'
import { Button } from '@/components/ui/button'

/**
 * Phase 1 placeholder. The real landing page - hero, three-step explainer,
 * sample PRD preview - is built once the design plan is approved.
 */
export default function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          PRD Drafter
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          Turn a rough product idea into a structured PRD.
        </h1>
        <p className="prose-reading text-muted-foreground">
          Answer a short set of guided questions. Get back a complete product
          requirements document written entirely from your own answers — with
          every inference the AI made listed explicitly, instead of passed off
          as fact.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/signup">Get started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Local setup check
        </h2>
        <SystemStatus />
      </div>
    </main>
  )
}
