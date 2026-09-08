import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import type { ProductAnalytics } from '@travel/validation'
import { ChartTooltip } from './chart-tooltip'

type Row = ProductAnalytics['topDestinations'][number]

export function DestinationsBar({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
        barCategoryGap={8}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="destination"
          width={104}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-secondary)', opacity: 0.5 }}
          content={<ChartTooltip format={(v) => `${v} product${v === 1 ? '' : 's'}`} />}
        />
        <Bar
          dataKey="count"
          fill="var(--color-chart-2)"
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="count"
            position="right"
            className="fill-muted-foreground"
            style={{ fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
