import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
  {
    variants: {
      variant: {
        default: 'bg-sky-700 text-white shadow-sm shadow-sky-950/40 hover:bg-sky-600 active:bg-sky-800',
        secondary: 'bg-zinc-800 text-zinc-100 shadow-sm hover:bg-zinc-700 active:bg-zinc-600',
        outline: 'border border-zinc-700 bg-zinc-950/30 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800',
        ghost: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
        destructive: 'border border-red-800 bg-red-950 text-red-300 hover:bg-red-900 hover:text-red-100',
        tactical: 'border border-sky-700 bg-sky-950 text-sky-200 hover:border-sky-500 hover:bg-sky-900',
      },
      size: {
        default: 'px-4 py-2.5',
        sm: 'min-h-9 rounded-md px-3 py-1.5 text-xs',
        lg: 'min-h-12 px-6 py-3',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
