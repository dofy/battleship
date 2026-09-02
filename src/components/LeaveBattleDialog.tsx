import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Button } from './ui/button'

interface LeaveBattleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  opponentName?: string
}

export default function LeaveBattleDialog({
  open,
  onOpenChange,
  onConfirm,
  opponentName,
}: LeaveBattleDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="battle-dialog-overlay fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
        <AlertDialog.Content className="battle-dialog-content fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-800 bg-red-950 text-xl" aria-hidden="true">
              ⚑
            </div>
            <div>
              <AlertDialog.Title className="text-lg font-bold text-zinc-100">
                Forfeit this battle?
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-1.5 text-sm leading-6 text-zinc-300">
                {opponentName || 'Your opponent'} will win and this room will close. This cannot be undone.
              </AlertDialog.Description>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button
                autoFocus
                variant="secondary"
              >
                Keep playing
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                onClick={onConfirm}
                variant="destructive"
                className="border-red-600 bg-red-700 text-white hover:bg-red-600"
              >
                Forfeit battle
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
