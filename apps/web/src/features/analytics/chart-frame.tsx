import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Card + title + a FIXED-height content slot. Both the skeleton and the
 * loaded chart render inside the same frame, so the box never resizes and
 * there is no layout shift when data arrives (the recharts
 * `ResponsiveContainer` renders nothing on its first measure).
 */
export function ChartFrame({
  title,
  caption,
  action,
  height = 'h-64',
  className,
  children,
}: {
  title: string
  caption?: string
  action?: React.ReactNode
  /** Tailwind height (or aspect) class for the plot area. */
  height?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>
        <div className={cn('w-full', height)}>{children}</div>
      </CardContent>
    </Card>
  )
}

/**
 * Screen-reader fallback for a chart — the same numbers as a plain table,
 * visually hidden. Charts wrap their SVG in aria-hidden and render this
 * alongside.
 */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: string[]
  rows: (string | number)[][]
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
