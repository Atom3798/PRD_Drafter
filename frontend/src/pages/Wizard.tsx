import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AppShell } from '@/components/layout/AppShell'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { ReviewStep } from '@/components/wizard/ReviewStep'
import { SaveIndicator } from '@/components/wizard/SaveIndicator'
import { StepFields } from '@/components/wizard/StepFields'
import { StepNav } from '@/components/wizard/StepNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAutosave } from '@/hooks/useAutosave'
import { useCreatePrd, usePrd, useUpdatePrd } from '@/hooks/usePrd'
import { prds } from '@/lib/api'
import {
  emptyPrdInputs,
  isReadyToGenerate,
  missingRequiredFields,
  type PrdInputField,
  type PrdInputs,
} from '@/lib/types'
import { clampStep, FIRST_STEP, getStep, LAST_STEP, REVIEW_STEP } from '@/lib/wizard'

export default function Wizard() {
  const { id } = useParams<{ id: string }>()

  // `/prds/new` has no id yet - create a draft, then redirect to its URL.
  if (!id) return <CreateDraftAndRedirect />
  return <WizardForm prdId={id} />
}

/**
 * `/prds/new` creates a draft immediately.
 *
 * Creating server-side before the first keystroke is what makes autosave
 * possible at all - there is always a row to save into, so nothing typed can
 * be stranded in local state.
 */
function CreateDraftAndRedirect() {
  const createPrd = useCreatePrd()
  const startedRef = useRef(false)

  useEffect(() => {
    // StrictMode double-invokes effects in development; without this guard
    // every visit would create two drafts.
    if (startedRef.current) return
    startedRef.current = true
    createPrd.mutate(undefined)
  }, [createPrd])

  if (createPrd.isError) {
    return (
      <AppShell className="max-w-2xl">
        <ErrorState
          title="Couldn't start a new PRD"
          error={createPrd.error}
          onRetry={() => createPrd.mutate(undefined)}
        />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <LoadingState label="Setting up your PRD…" />
    </AppShell>
  )
}

function WizardForm({ prdId }: { prdId: string }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const prdQuery = usePrd(prdId)
  const updatePrd = useUpdatePrd(prdId)

  const [inputs, setInputs] = useState<PrdInputs | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [step, setStep] = useState<number | null>(null)
  const [showRequiredWarnings, setShowRequiredWarnings] = useState(false)

  const autosave = useAutosave<{ inputs?: Partial<PrdInputs>; title?: string }>({
    onSave: (payload) => prds.update(prdId, payload),
    // Without this, answering two questions inside one debounce window would
    // save only the second one.
    merge: (pending, next) => ({
      ...pending,
      ...next,
      inputs: { ...pending.inputs, ...next.inputs },
    }),
  })

  // Seed local state once from the server, then own it. Re-seeding on every
  // refetch would fight the user's typing.
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current || !prdQuery.data) return
    seededRef.current = true

    const prd = prdQuery.data
    setInputs({ ...emptyPrdInputs(), ...prd.inputs })
    setTitle(prd.title)

    // A ?step= in the URL wins (back button, shared link); otherwise resume
    // wherever they left off.
    const fromUrl = Number(searchParams.get('step'))
    setStep(clampStep(fromUrl || prd.wizard_step))
  }, [prdQuery.data, searchParams])

  /** Furthest step reached, so completed steps stay clickable. */
  const furthestStep = Math.max(step ?? FIRST_STEP, prdQuery.data?.wizard_step ?? 1)

  const handleFieldChange = useCallback(
    (name: PrdInputField, value: string) => {
      setInputs((current) => {
        if (!current) return current
        const next = { ...current, [name]: value }
        autosave.schedule({ inputs: { [name]: value } })
        return next
      })
    },
    [autosave],
  )

  const handleOptionsChange = useCallback(
    (patch: Partial<PrdInputs>) => {
      setInputs((current) => (current ? { ...current, ...patch } : current))
      autosave.schedule({ inputs: patch })
    },
    [autosave],
  )

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value)
      autosave.schedule({ title: value })
    },
    [autosave],
  )

  /** Step changes flush immediately - never leave a step with unsaved text. */
  const goToStep = useCallback(
    async (next: number) => {
      const target = clampStep(next)
      await autosave.flush()
      setStep(target)
      setShowRequiredWarnings(false)
      setSearchParams({ step: String(target) }, { replace: true })
      await updatePrd.mutateAsync({ wizard_step: target }).catch(() => {
        // The answers are already saved; only the bookmark failed.
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [autosave, setSearchParams, updatePrd],
  )

  const currentStep = step ?? FIRST_STEP
  const stepConfig = useMemo(() => getStep(currentStep), [currentStep])

  function handleNext() {
    const missingOnThisStep = stepConfig.fields.filter(
      (field) => field.required && !(inputs?.[field.name] as string)?.trim(),
    )
    if (missingOnThisStep.length > 0) {
      setShowRequiredWarnings(true)
      toast.error('Please answer the required question before continuing.')
      return
    }
    void goToStep(currentStep + 1)
  }

  // Cmd/Ctrl+S forces a save, as it does in every other editor.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void autosave.flush()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [autosave])

  if (prdQuery.isPending || !inputs || step === null) {
    return (
      <AppShell>
        <LoadingState label="Loading your draft…" />
      </AppShell>
    )
  }

  if (prdQuery.isError) {
    return (
      <AppShell className="max-w-2xl">
        <ErrorState
          title="Couldn't load this PRD"
          error={prdQuery.error}
          onRetry={() => void prdQuery.refetch()}
        />
      </AppShell>
    )
  }

  const isReview = currentStep === REVIEW_STEP
  const canGenerate = isReadyToGenerate(inputs)
  const missing = missingRequiredFields(inputs)

  return (
    <AppShell
      className="max-w-3xl"
      topBarContent={<SaveIndicator status={autosave.status} className="ml-auto" />}
    >
      <div className="mb-8">
        <label htmlFor="prd-title" className="sr-only">
          PRD title
        </label>
        <Input
          id="prd-title"
          value={title ?? ''}
          onChange={(e) => handleTitleChange(e.target.value)}
          onBlur={() => void autosave.flush()}
          placeholder="Untitled PRD"
          className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
        />
      </div>

      <StepNav
        currentStep={currentStep}
        furthestStep={furthestStep}
        onSelect={(next) => void goToStep(next)}
      />

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">{stepConfig.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{stepConfig.subtitle}</p>

        <div className="mt-8">
          {isReview ? (
            <ReviewStep
              inputs={inputs}
              onEditStep={(target) => void goToStep(target)}
              onOptionsChange={handleOptionsChange}
            />
          ) : (
            <StepFields
              step={stepConfig}
              values={inputs}
              onChange={handleFieldChange}
              showRequiredWarnings={showRequiredWarnings}
            />
          )}
        </div>
      </div>

      <div className="mt-12 flex items-center justify-between gap-3 border-t border-border pt-6">
        <Button
          variant="ghost"
          onClick={() => void goToStep(currentStep - 1)}
          disabled={currentStep === FIRST_STEP}
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          <SaveIndicator status={autosave.status} className="hidden sm:flex" />

          {isReview ? (
            <Button
              size="lg"
              disabled={!canGenerate}
              title={
                canGenerate
                  ? undefined
                  : `Still missing: ${missing.join(', ')}`
              }
              onClick={async () => {
                await autosave.flush()
                // Generation lands in Phase 6; the editor is Phase 7.
                toast.info(
                  'Generation is not wired up yet — your answers are saved.',
                )
                navigate(`/prds/${prdId}`)
              }}
            >
              <Sparkles aria-hidden className="size-4" />
              Generate PRD
            </Button>
          ) : (
            <Button onClick={handleNext}>
              {currentStep === LAST_STEP - 1 ? 'Review' : 'Continue'}
              <ArrowRight aria-hidden className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {isReview && !canGenerate && (
        <p className="mt-3 text-right text-xs text-destructive">
          Still missing: {missing.join(', ')}
        </p>
      )}
    </AppShell>
  )
}
