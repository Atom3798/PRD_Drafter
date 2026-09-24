import { Check } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  FORMAT_SECTIONS,
  sectionsForFormat,
  type DetailLevel,
  type DocumentAudience,
  type DocumentFormat,
} from '@/lib/types'
import { getSectionLabel } from '@/lib/sections'
import { pluralize } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * How the document should be written.
 *
 * Format is not a style setting — it decides which sections get generated, so
 * each option states its section count and lists what you will actually get.
 * Choosing "lean one-pager" and receiving 21 sections would make the choice a
 * lie.
 *
 * These live on the review step rather than up front because "how should this
 * read?" is a question you can only answer once you know what you have said.
 */

const FORMAT_OPTIONS: {
  value: DocumentFormat
  label: string
  description: string
}[] = [
  {
    value: 'comprehensive',
    label: 'Comprehensive PRD',
    description:
      'The full document. Best when engineering, design and leadership all work from the same source.',
  },
  {
    value: 'lean_onepager',
    label: 'Lean one-pager',
    description:
      'Problem first, ruthlessly short. Good for early ideas and getting buy-in before committing.',
  },
  {
    value: 'working_backwards',
    label: 'Working backwards',
    description:
      "Amazon's PR/FAQ approach — customer value stated before any requirement exists.",
  },
  {
    value: 'technical_spec',
    label: 'Technical specification',
    description:
      'Requirements and constraints carry the weight. For a team that already agrees on the why.',
  },
]

const DETAIL_OPTIONS: { value: DetailLevel; label: string; hint: string }[] = [
  { value: 'concise', label: 'Concise', hint: 'Short, scannable sections' },
  { value: 'standard', label: 'Standard', hint: 'A balanced amount of detail' },
  { value: 'detailed', label: 'Detailed', hint: 'Thorough, more sub-points' },
]

const AUDIENCE_OPTIONS: { value: DocumentAudience; label: string; hint: string }[] = [
  { value: 'mixed', label: 'Mixed', hint: 'Readable by the whole team' },
  { value: 'engineering', label: 'Engineering', hint: 'More precise and technical' },
  { value: 'leadership', label: 'Leadership', hint: 'Outcome and impact first' },
]

export function DocumentOptions({
  format,
  detail,
  audience,
  onChange,
}: {
  format: DocumentFormat
  detail: DetailLevel
  audience: DocumentAudience
  onChange: (
    patch: Partial<{
      document_format: DocumentFormat
      detail_level: DetailLevel
      document_audience: DocumentAudience
    }>,
  ) => void
}) {
  const sections = sectionsForFormat(format)

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="text-sm font-medium">Document format</legend>
        <p className="mt-1 text-sm text-muted-foreground">
          This decides which sections get written, not just how long they are.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FORMAT_OPTIONS.map((option) => {
            const isSelected = option.value === format
            const count = FORMAT_SECTIONS[option.value].length

            return (
              <label
                key={option.value}
                className={cn(
                  'relative flex cursor-pointer flex-col gap-1.5 rounded-lg border p-4 transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-input hover:bg-accent/50',
                )}
              >
                <input
                  type="radio"
                  name="document_format"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onChange({ document_format: option.value })}
                  className="sr-only"
                />
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{option.label}</span>
                  {isSelected && (
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                  )}
                </div>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {option.description}
                </span>
                <span className="mt-1 text-xs font-medium tabular-nums text-muted-foreground">
                  {pluralize(count, 'section')}
                </span>
              </label>
            )
          })}
        </div>

        <details className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
          <summary className="cursor-pointer text-xs font-medium">
            What&rsquo;s in a {FORMAT_OPTIONS.find((o) => o.value === format)?.label}?
          </summary>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {sections.map((key) => (
              <li
                key={key}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
              >
                {getSectionLabel(key)}
              </li>
            ))}
          </ul>
        </details>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <RadioGroup
          legend="Level of detail"
          name="detail_level"
          options={DETAIL_OPTIONS}
          value={detail}
          onSelect={(value) => onChange({ detail_level: value as DetailLevel })}
        />
        <RadioGroup
          legend="Written for"
          name="document_audience"
          options={AUDIENCE_OPTIONS}
          value={audience}
          onSelect={(value) =>
            onChange({ document_audience: value as DocumentAudience })
          }
        />
      </div>
    </div>
  )
}

function RadioGroup({
  legend,
  name,
  options,
  value,
  onSelect,
}: {
  legend: string
  name: string
  options: { value: string; label: string; hint: string }[]
  value: string
  onSelect: (value: string) => void
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-3 space-y-2">
        {options.map((option) => {
          const id = `${name}-${option.value}`
          const isSelected = option.value === value
          return (
            <div key={option.value} className="flex items-center gap-2.5">
              <input
                type="radio"
                id={id}
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onSelect(option.value)}
                className="size-4 shrink-0 accent-[var(--primary)]"
              />
              <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
                {option.label}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {option.hint}
                </span>
              </Label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
