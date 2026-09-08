import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * AI "thinking" state — shimmer bars + status text, never a spinner
 * (see /ui-architecture.md §5).
 */
export function AiThinking({ label = 'Analyzing…', className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn('flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4', className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
        <Sparkles className="size-4 animate-pulse" aria-hidden="true" />
        {label}
      </div>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="ai-shimmer h-2.5 w-11/12 rounded-sm bg-accent/10" />
        <div className="ai-shimmer h-2.5 w-3/4 rounded-sm bg-accent/10" />
        <div className="ai-shimmer h-2.5 w-4/5 rounded-sm bg-accent/10" />
      </div>
    </div>
  )
}
