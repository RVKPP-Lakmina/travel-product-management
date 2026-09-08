import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        primary: 'bg-primary/10 text-primary',
        ai: 'bg-accent/15 text-amber-700 dark:text-amber-300',
        active: 'bg-[var(--color-status-active-bg)] text-[var(--color-status-active)]',
        expiring: 'bg-[var(--color-status-expiring-bg)] text-[var(--color-status-expiring)]',
        expired: 'bg-[var(--color-status-expired-bg)] text-[var(--color-status-expired)]',
        inactive: 'bg-[var(--color-status-inactive-bg)] text-[var(--color-status-inactive)]',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

interface BadgeProps extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
}

export { Badge, badgeVariants }
