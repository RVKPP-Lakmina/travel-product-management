/**
 * Recharts renders its default tooltip as inline-styled DOM seeded from JS
 * props — it doesn't follow our tokens and doesn't re-theme on a `.dark`
 * toggle. This replacement is plain token-driven markup, so light/dark just
 * work. Pass it to `<Tooltip content={<ChartTooltip format={…} />} />`.
 */
interface ChartTooltipProps {
  active?: boolean
  label?: string | number
  payload?: { name?: string | number; value?: string | number }[]
  format?: (value: number) => string
}

export function ChartTooltip({ active, payload, label, format = (v) => String(v) }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
      {label != null && label !== '' && <p className="mb-0.5 font-medium">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2 tabular-nums">
          {entry.name != null && entry.name !== '' && (
            <span className="text-muted-foreground">{entry.name}</span>
          )}
          <span className="font-medium">{format(Number(entry.value ?? 0))}</span>
        </p>
      ))}
    </div>
  )
}
