import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface StatTileProps {
  label: string
  value: number | undefined
  accent: 'primary' | 'active' | 'expired' | 'inactive'
  caption?: string
}

const ACCENT_BAR: Record<StatTileProps['accent'], string> = {
  primary: 'bg-primary',
  active: 'bg-[var(--color-status-active)]',
  expired: 'bg-[var(--color-status-expired)]',
  inactive: 'bg-[var(--color-status-inactive)]',
}

export function StatTile({ label, value, accent, caption }: StatTileProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm">
      <span className={cn('absolute inset-y-0 left-0 w-1', ACCENT_BAR[accent])} aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
      {value === undefined ? (
        <Skeleton className="mt-2 h-9 w-16" />
      ) : (
        <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      )}
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
    </div>
  )
}
