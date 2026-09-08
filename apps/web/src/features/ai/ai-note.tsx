import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Token-only amber callout for AI-authored context (assumptions, notes).
 * Replaces ad-hoc `bg-amber-50 dark:bg-amber-950/30` blocks so light/dark
 * stay balanced (see /ui-architecture.md §5).
 */
export function AiNote({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex gap-2 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-foreground',
        className,
      )}
    >
      <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="mb-1 font-medium">{title}</p>}
        {children}
      </div>
    </div>
  )
}
