import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ProductAnalytics } from '@travel/validation'
import { ChartTooltip } from './chart-tooltip'

type Row = ProductAnalytics['createdByMonth'][number]

/** "2026-09" → "Sep". Year only shown on January to keep the axis quiet. */
function tickLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  const name = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' })
  return m === 1 ? `${name} ’${String(y).slice(2)}` : name
}

export function MonthColumns({ data }: { data: Row[] }) {
  const empty = data.every((d) => d.count === 0)
  if (empty) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No products added in the last 12 months.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
        <XAxis
          dataKey="month"
          tickFormatter={tickLabel}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={8}
          tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
        />
        <YAxis
          allowDecimals={false}
          width={32}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-secondary)', opacity: 0.5 }}
          content={<ChartTooltip format={(v) => `${v} added`} />}
          labelFormatter={(l) => tickLabel(String(l))}
        />
        <Bar
          dataKey="count"
          fill="var(--color-chart-3)"
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
