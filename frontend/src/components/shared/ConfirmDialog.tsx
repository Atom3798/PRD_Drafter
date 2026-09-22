import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Confirmation for a destructive action.
 *
 * `confirmPhrase` adds a type-to-confirm step. Reserve it for things that
 * genuinely cannot be undone — using it everywhere trains people to type
 * through the warning without reading it.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmPhrase,
  destructive = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  confirmPhrase?: string
  destructive?: boolean
  onConfirm: () => Promise<void> | void
}) {
  const [typed, setTyped] = useState('')
  const [isWorking, setIsWorking] = useState(false)

  const canConfirm = !confirmPhrase || typed.trim() === confirmPhrase

  async function handleConfirm() {
    if (!canConfirm) return
    setIsWorking(true)
    try {
      await onConfirm()
      onOpenChange(false)
      setTyped('')
    } finally {
      setIsWorking(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) setTyped('')
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
          </DialogDescription>
        </DialogHeader>

        {confirmPhrase && (
          <div className="space-y-2">
            <Label htmlFor="confirm-phrase">
              Type <span className="font-mono text-foreground">{confirmPhrase}</span> to
              confirm
            </Label>
            <Input
              id="confirm-phrase"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!canConfirm || isWorking}
          >
            {isWorking && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
