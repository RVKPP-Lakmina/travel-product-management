import { formatDate, daysUntil } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The validity date, tinted by urgency. This is deliberately redundant with
 * the row's StatusBadge — which always spells the state out in words — so
 * the colour here is reinforcement, never the only signal.
 */
export function ValidUntil({ iso, isExpired }: { iso: string; isExpired: boolean }) {
  const days = daysUntil(iso)
  const tone = isExpired
    ? 'text-danger'
    : days <= 7
      ? 'text-warning'
      : 'text-foreground'
  return <span className={cn('tabular-nums', tone)}>{formatDate(iso)}</span>
}
