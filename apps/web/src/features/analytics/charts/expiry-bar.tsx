import { EXPIRY_BUCKET_LABELS, type ProductAnalytics, type ExpiryBucket } from '@travel/validation'
import { cn } from '@/lib/utils'

/**
 * A segmented meter, not a chart — one stacked row from most urgent
 * (danger) to comfortably valid (success), with a legend of counts. Reads
 * as "how much of the catalog needs attention" at a glance.
 */
const SEGMENT: Record<ExpiryBucket, { color: string; dot: string }> = {
  expired: { color: 'bg-danger', dot: 'bg-danger' },
  d7: { color: 'bg-warning', dot: 'bg-warning' },
  d30: { color: 'bg-primary/70', dot: 'bg-primary/70' },
  d90: { color: 'bg-primary/40', dot: 'bg-primary/40' },
  later: { color: 'bg-success/60', dot: 'bg-success/60' },
}

export function ExpiryBar({ data }: { data: ProductAnalytics['expiry'] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary" role="img" aria-hidden="true">
        {data.map((d) =>
          d.count === 0 ? null : (
            <div
              key={d.bucket}
              className={cn('h-full', SEGMENT[d.bucket].color)}
              style={{ width: `${total === 0 ? 0 : (d.count / total) * 100}%` }}
            />
          ),
        )}
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
        {data.map((d) => (
          <li key={d.bucket} className="flex items-center gap-2">
            <span className={cn('size-2.5 shrink-0 rounded-sm', SEGMENT[d.bucket].dot)} aria-hidden="true" />
            <span className="min-w-0 truncate text-muted-foreground">{EXPIRY_BUCKET_LABELS[d.bucket]}</span>
            <span className="ml-auto font-medium tabular-nums">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
