import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        That URL doesn&rsquo;t match anything in the app.
      </p>
      <div>
        <Button asChild variant="outline">
          <Link to="/">Back to start</Link>
        </Button>
      </div>
    </main>
  )
}
