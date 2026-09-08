import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The single AI marker used across the app (see /ui-architecture.md §5):
 * a warm-amber sparkle SVG + short label. Never a text emoji.
 */
export function AiBadge({ label = 'AI', className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300',
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden="true" />
      {label}
    </span>
  )
}

/**
 * Bare inline marker for AI provenance next to a product name in dense
 * lists, where the full <AiBadge> would be too loud.
 */
export function AiSparkle({ className }: { className?: string }) {
  return (
    <Sparkles
      className={cn('inline size-3.5 shrink-0 text-amber-500', className)}
      aria-label="AI-generated"
    />
  )
}
