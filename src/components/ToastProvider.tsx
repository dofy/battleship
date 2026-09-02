import { createContext, useCallback, useContext } from 'react'
import type { ReactNode } from 'react'
import { Toaster, toast } from 'sonner'

type ToastVariant = 'error' | 'info'

interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
}

type ShowToast = (notification: ToastInput) => void

const ToastContext = createContext<ShowToast | null>(null)

export function useToast() {
  const showToast = useContext(ToastContext)
  if (!showToast) throw new Error('useToast must be used within ToastProvider')
  return showToast
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = useCallback<ShowToast>(({ title, description, variant = 'error' }) => {
    const options = { description, duration: 5000 }
    if (variant === 'error') toast.error(title, options)
    else toast.info(title, options)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <Toaster
        theme="dark"
        position="top-right"
        closeButton
        visibleToasts={3}
        toastOptions={{
          classNames: {
            toast: 'battle-toast !border-zinc-700 !bg-zinc-900 !pr-10 !text-zinc-100 !shadow-2xl',
            title: '!font-semibold !text-zinc-100',
            description: '!text-zinc-300',
            closeButton: '!left-auto !right-2 !top-2 !translate-x-0 !translate-y-0 !border-zinc-700 !bg-zinc-800 !text-zinc-300 hover:!bg-zinc-700',
          },
        }}
      />
    </ToastContext.Provider>
  )
}
