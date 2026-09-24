import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MAX_FIELD_CHARS, type PrdInputField, type PrdInputs } from '@/lib/types'
import type { WizardStep } from '@/lib/wizard'
import { cn } from '@/lib/utils'

/** Renders one step's fields from the declarative table. */
export function StepFields({
  step,
  values,
  onChange,
  showRequiredWarnings,
}: {
  step: WizardStep
  values: PrdInputs
  onChange: (name: PrdInputField, value: string) => void
  showRequiredWarnings: boolean
}) {
  return (
    <div className="space-y-8">
      {step.fields.map((field) => {
        const value = (values[field.name] as string) ?? ''
        const isEmpty = !value.trim()
        // Only warn after an attempt to move on. Marking a field red before
        // it has been touched is nagging, not helping.
        const showWarning = showRequiredWarnings && field.required && isEmpty
        const nearLimit = value.length > MAX_FIELD_CHARS * 0.9
        const helpId = `${field.name}-help`

        return (
          <div key={field.name} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor={field.name} className="text-sm">
                {field.label}
                {field.required && (
                  <span className="ml-1 text-muted-foreground" title="Required">
                    *
                  </span>
                )}
              </Label>
              {!field.required && isEmpty && (
                <span className="text-xs text-muted-foreground">Optional</span>
              )}
            </div>

            {field.control === 'input' ? (
              <Input
                id={field.name}
                value={value}
                onChange={(e) => onChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                maxLength={MAX_FIELD_CHARS}
                aria-describedby={field.help ? helpId : undefined}
                aria-invalid={showWarning || undefined}
                className={cn(showWarning && 'border-destructive')}
              />
            ) : (
              <Textarea
                id={field.name}
                value={value}
                onChange={(e) => onChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                rows={field.rows ?? 4}
                maxLength={MAX_FIELD_CHARS}
                aria-describedby={field.help ? helpId : undefined}
                aria-invalid={showWarning || undefined}
                className={cn('resize-y leading-relaxed', showWarning && 'border-destructive')}
              />
            )}

            <div className="flex items-start justify-between gap-3">
              {field.help && (
                <p id={helpId} className="text-xs leading-relaxed text-muted-foreground">
                  {field.help}
                </p>
              )}
              {nearLimit && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {value.length.toLocaleString()} / {MAX_FIELD_CHARS.toLocaleString()}
                </span>
              )}
            </div>

            {showWarning && (
              <p role="alert" className="text-xs text-destructive">
                This one is needed before you can generate.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
