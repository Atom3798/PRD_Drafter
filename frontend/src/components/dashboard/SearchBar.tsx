import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const DEBOUNCE_MS = 250

/**
 * Title search.
 *
 * Keeps its own immediate value so typing stays responsive, and reports
 * upward on a debounce so we are not issuing a request per keystroke.
 */
export function SearchBar({
  value,
  onChange,
  resultCount,
}: {
  value: string
  onChange: (next: string) => void
  resultCount?: number
}) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  // Held in a ref and assigned in an effect (never during render) so an
  // inline arrow from the parent does not restart the debounce every render.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChangeRef.current(draft), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, value])

  // "/" focuses search, the way it does in most document tools.
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      if (event.key === '/' && !typing) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function clear() {
    setDraft('')
    onChangeRef.current('')
    inputRef.current?.focus()
  }

  return (
    <div className="relative w-full sm:max-w-xs">
      <label htmlFor="prd-search" className="sr-only">
        Search your PRDs by title
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id="prd-search"
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && clear()}
        placeholder="Search PRDs…"
        className="pl-9 pr-9"
        autoComplete="off"
        aria-describedby={resultCount === undefined ? undefined : 'prd-search-count'}
      />
      {draft && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
        >
          <X aria-hidden className="size-3.5" />
        </Button>
      )}
      {resultCount !== undefined && (
        <p id="prd-search-count" className="sr-only" aria-live="polite">
          {resultCount} matching PRDs
        </p>
      )}
    </div>
  )
}
