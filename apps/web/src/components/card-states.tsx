import { AlertTriangle, RotateCcw, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Compact empty/error states for use *inside* a Card's content area.
 * Page-level equivalents (larger, with their own panel) live alongside the
 * pages that own them.
 */

export function CardEmpty({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

export function CardError({
  onRetry,
  message = "Couldn't load this list.",
}: {
  onRetry: () => void
  message?: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw />
        Retry
      </Button>
    </div>
  )
}
