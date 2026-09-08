import { Badge } from '@/components/ui/badge'
import { daysUntil } from '@/lib/format'

interface StatusBadgeProps {
  status: 'active' | 'inactive'
  validUntil: string
  isExpired: boolean
}

/**
 * Status and expiry are independent (see supabase/migrations/
 * 0003_views.sql) — this badge shows one priority-ordered summary state
 * per row: Expired always wins (regardless of the status field), then
 * Inactive, then an "expiring soon" warning within 7 days, then Active.
 * Colour is never the only signal — every state pairs a dot with a text
 * label.
 */
export function StatusBadge({ status, validUntil, isExpired }: StatusBadgeProps) {
  if (isExpired) {
    return (
      <Badge variant="expired">
        <Dot />
        Expired
      </Badge>
    )
  }
  if (status === 'inactive') {
    return (
      <Badge variant="inactive">
        <Dot />
        Inactive
      </Badge>
    )
  }
  const days = daysUntil(validUntil)
  if (days <= 7) {
    return (
      <Badge variant="expiring">
        <Dot />
        Expiring in {days}d
      </Badge>
    )
  }
  return (
    <Badge variant="active">
      <Dot />
      Active
    </Badge>
  )
}

function Dot() {
  return <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
}
