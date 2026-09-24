import { Check } from 'lucide-react'

import { WIZARD_STEPS } from '@/lib/wizard'
import { cn } from '@/lib/utils'

/**
 * Progress across the seven steps.
 *
 * Completed steps are clickable so going back to fix an answer is one click.
 * Steps ahead stay reachable too — nothing is validated hard enough to
 * justify trapping someone on a step.
 */
export function StepNav({
  currentStep,
  furthestStep,
  onSelect,
}: {
  currentStep: number
  furthestStep: number
  onSelect: (step: number) => void
}) {
  return (
    <nav aria-label="Progress" className="w-full">
      {/* Compact bar on small screens; the full rail needs room to breathe. */}
      <div className="flex items-center justify-between sm:hidden">
        <span className="text-sm font-medium">
          Step {currentStep} of {WIZARD_STEPS.length}
        </span>
        <span className="text-sm text-muted-foreground">
          {WIZARD_STEPS[currentStep - 1]?.title}
        </span>
      </div>
      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary sm:hidden"
        role="presentation"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${(currentStep / WIZARD_STEPS.length) * 100}%` }}
        />
      </div>

      <ol className="hidden items-center gap-1 sm:flex">
        {WIZARD_STEPS.map((step, index) => {
          const isCurrent = step.id === currentStep
          const isComplete = step.id < furthestStep
          const isReachable = step.id <= furthestStep

          return (
            <li key={step.id} className="flex flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'group flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                  isCurrent && 'bg-secondary',
                  !isCurrent && isReachable && 'hover:bg-accent',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium tabular-nums',
                    isCurrent && 'border-primary bg-primary text-primary-foreground',
                    isComplete &&
                      !isCurrent &&
                      'border-primary/40 bg-primary/10 text-primary',
                    !isCurrent &&
                      !isComplete &&
                      'border-border text-muted-foreground',
                  )}
                >
                  {isComplete && !isCurrent ? (
                    <Check aria-hidden className="size-3" />
                  ) : (
                    step.id
                  )}
                </span>
                <span
                  className={cn(
                    'truncate text-xs',
                    isCurrent ? 'font-medium' : 'text-muted-foreground',
                  )}
                >
                  {step.title}
                </span>
              </button>
              {index < WIZARD_STEPS.length - 1 && (
                <span aria-hidden className="h-px w-2 shrink-0 bg-border" />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
