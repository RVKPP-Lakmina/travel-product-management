import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number // zero-based
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/** Compact page-number model: 1 … c-1 c c+1 … N, always including 1 and N. */
function pageItems(current: number, last: number): (number | 'gap')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const items: (number | 'gap')[] = [1]
  const lo = Math.max(2, current - 1)
  const hi = Math.min(last - 1, current + 1)
  if (lo > 2) items.push('gap')
  for (let p = lo; p <= hi; p++) items.push(p)
  if (hi < last - 1) items.push('gap')
  items.push(last)
  return items
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const current = page + 1
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)

  const arrow =
    'inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40'

  return (
    <div className="flex flex-col-reverse items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
      <span className="tabular-nums">
        Showing {from}–{to} of {total}
      </span>

      {lastPage > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            className={arrow}
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>

          {pageItems(current, lastPage).map((item, i) =>
            item === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-muted-foreground/60">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item - 1)}
                aria-current={item === current ? 'page' : undefined}
                className={cn(
                  'inline-flex size-8 items-center justify-center rounded-md border text-sm tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  item === current
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border text-foreground hover:bg-secondary',
                )}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            className={arrow}
            onClick={() => onPageChange(page + 1)}
            disabled={current >= lastPage}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  )
}
