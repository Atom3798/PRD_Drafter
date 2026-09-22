import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

/** Shared frame for the login and signup pages. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col justify-center bg-background px-4 py-12">
      <div className="mx-auto w-full max-w-sm">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 rounded-sm text-sm font-medium tracking-tight"
        >
          <FileText aria-hidden className="size-4 text-primary" />
          PRD Drafter
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

        <div className="mt-8">{children}</div>

        <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
      </div>
    </div>
  )
}
