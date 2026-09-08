import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface StatTileProps {
  label: string
  value: number | string | undefined
  accent: 'primary' | 'active' | 'expired' | 'inactive'
  caption?: string
  /** Optional "?" affordance next to the label with an explanatory tooltip. */
  info?: string
}

const ACCENT_BAR: Record<StatTileProps['accent'], string> = {
  primary: 'bg-primary',
  active: 'bg-[var(--color-status-active)]',
  expired: 'bg-[var(--color-status-expired)]',
  inactive: 'bg-[var(--color-status-inactive)]',
}

export function StatTile({ label, value, accent, caption, info }: StatTileProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm">
      <span className={cn('absolute inset-y-0 left-0 w-1', ACCENT_BAR[accent])} aria-hidden="true" />
      <div className="flex items-center gap-1.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        {info && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-full text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="size-3.5" />
                <span className="sr-only">About “{label}”</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{info}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {value === undefined ? (
        <Skeleton className="mt-2 h-10 w-20" />
      ) : (
        <p className="mt-1 truncate text-stat font-semibold tabular-nums">{value}</p>
      )}
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
    </div>
  )
}
