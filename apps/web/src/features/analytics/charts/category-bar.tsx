import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import type { CategoryBreakdown } from '@travel/validation'
import { ChartTooltip } from './chart-tooltip'
import { formatCompact } from '@/lib/format'

const RAMP = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

/** Rank → ramp step, so colour reads as position in the list. */
function rampFor(index: number, total: number) {
  if (total <= 1) return RAMP[0]
  return RAMP[Math.min(RAMP.length - 1, Math.floor((index / (total - 1)) * (RAMP.length - 1)))]
}

export function CategoryBar({ data }: { data: CategoryBreakdown[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 0, right: 44, bottom: 0, left: 0 }}
        barCategoryGap={6}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={96}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-secondary)', opacity: 0.5 }}
          content={<ChartTooltip format={(v) => `${v} product${v === 1 ? '' : 's'}`} />}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={rampFor(i, data.length)} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            className="fill-muted-foreground"
            style={{ fontSize: 12 }}
            formatter={(v) => formatCompact(Number(v ?? 0))}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
