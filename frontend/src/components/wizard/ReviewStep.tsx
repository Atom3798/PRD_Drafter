import { AlertTriangle, CheckCircle2, Pencil } from 'lucide-react'

import { DocumentOptions } from '@/components/wizard/DocumentOptions'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getSectionLabel, sectionsAtRisk } from '@/lib/sections'
import { pluralize, truncate } from '@/lib/format'
import {
  missingRequiredFields,
  sectionsForFormat,
  type DetailLevel,
  type DocumentAudience,
  type DocumentFormat,
  type PrdInputs,
} from '@/lib/types'
import { WIZARD_STEPS } from '@/lib/wizard'

/**
 * The final step: what you said, what will be thin, and how to write it.
 *
 * The "sections that will be thin" warning is the important part. Telling
 * someone up front that they gave nothing about metrics is far better than
 * letting them discover an empty section after waiting a minute for
 * generation.
 */
export function ReviewStep({
  inputs,
  onEditStep,
  onOptionsChange,
}: {
  inputs: PrdInputs
  onEditStep: (step: number) => void
  onOptionsChange: (
    patch: Partial<{
      document_format: DocumentFormat
      detail_level: DetailLevel
      document_audience: DocumentAudience
    }>,
  ) => void
}) {
  const missing = missingRequiredFields(inputs)
  const plannedSections = sectionsForFormat(inputs.document_format)
  const planned = new Set(plannedSections)

  // Only warn about sections this format will actually produce.
  const atRisk = sectionsAtRisk(inputs).filter((section) => planned.has(section.key))

  const answeredSteps = WIZARD_STEPS.filter((step) => step.fields.length > 0)

  return (
    <div className="space-y-10">
      {/* What you'll get */}
      <section>
        <h3 className="text-sm font-medium">Your answers</h3>
        <div className="mt-4 space-y-6">
          {answeredSteps.map((step) => {
            const answered = step.fields.filter((field) =>
              (inputs[field.name] as string)?.trim(),
            )

            return (
              <div key={step.id}>
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    {step.title}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditStep(step.id)}
                    className="h-7 text-xs"
                  >
                    <Pencil aria-hidden className="size-3" />
                    Edit
                  </Button>
                </div>

                {answered.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nothing answered here.
                  </p>
                ) : (
                  <dl className="mt-2 space-y-3">
                    {answered.map((field) => (
                      <div key={field.name}>
                        <dt className="text-xs text-muted-foreground">
                          {field.label}
                        </dt>
                        <dd className="mt-0.5 whitespace-pre-line text-sm leading-relaxed">
                          {truncate((inputs[field.name] as string).trim(), 320)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <Separator />

      {/* Expectation setting, before the wait rather than after it */}
      <section>
        <h3 className="text-sm font-medium">What to expect</h3>

        {missing.length > 0 && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
          >
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm">
              {pluralize(missing.length, 'required answer is', 'required answers are')}{' '}
              still missing. Go back and fill {missing.length === 1 ? 'it' : 'them'} in
              before generating.
            </p>
          </div>
        )}

        {atRisk.length === 0 ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-status-generated" />
            <p className="text-sm text-muted-foreground">
              Every section in this format has something to work from.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-clarify-border bg-clarify-surface p-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-clarify" />
              <div>
                <p className="text-sm font-medium text-clarify-foreground">
                  {pluralize(atRisk.length, 'section')} will be thin
                </p>
                <p className="mt-1 text-sm leading-relaxed text-clarify-foreground/90">
                  You didn&rsquo;t give anything these could be built from. They
                  will be written as best we can and flagged as needing
                  clarification — nothing will be invented to fill them.
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {atRisk.map((section) => (
                    <li
                      key={section.key}
                      className="rounded-full border border-clarify-border bg-background/60 px-2 py-0.5 text-xs text-clarify-foreground"
                    >
                      {getSectionLabel(section.key)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <p className="mt-3 text-sm text-muted-foreground">
          {pluralize(plannedSections.length, 'section')} will be written, in four
          parallel passes.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="text-sm font-medium">How should it be written?</h3>
        <div className="mt-4">
          <DocumentOptions
            format={inputs.document_format}
            detail={inputs.detail_level}
            audience={inputs.document_audience}
            onChange={onOptionsChange}
          />
        </div>
      </section>
    </div>
  )
}
