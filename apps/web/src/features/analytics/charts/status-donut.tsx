import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { ProductAnalytics } from '@travel/validation'
import { ChartTooltip } from './chart-tooltip'

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'var(--color-status-active)' },
  expired: { label: 'Expired', color: 'var(--color-status-expired)' },
  inactive: { label: 'Inactive', color: 'var(--color-status-inactive)' },
}

export function StatusDonut({
  data,
  total,
}: {
  data: ProductAnalytics['byStatus']
  total: number
}) {
  const rows = data.map((d) => ({ ...d, ...STATUS_META[d.key] }))

  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative h-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="count"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="var(--color-card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {rows.map((r) => (
                <Cell key={r.key} fill={r.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip format={(v) => `${v} product${v === 1 ? '' : 's'}`} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-stat font-semibold tabular-nums leading-none">{total}</span>
          <span className="text-xs text-muted-foreground">products</span>
        </div>
      </div>
      <ul className="flex shrink-0 flex-col gap-2 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: r.color }} aria-hidden="true" />
            <span className="text-muted-foreground">{r.label}</span>
            <span className="ml-auto font-medium tabular-nums">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
