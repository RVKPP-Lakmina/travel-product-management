import { X, Sparkles } from 'lucide-react'
import type { SearchFilter } from '@travel/validation'
import { CATEGORY_LABELS } from '@travel/validation'
import { formatLKR } from '@/lib/format'

interface Chip {
  label: string
  patch: Partial<SearchFilter>
}

function buildChips(filter: SearchFilter): Chip[] {
  const chips: Chip[] = []

  for (const dest of filter.destinations) {
    chips.push({
      label: `Destination: ${dest}`,
      patch: { destinations: filter.destinations.filter((d) => d !== dest) },
    })
  }
  for (const cat of filter.categories) {
    chips.push({
      label: `Category: ${CATEGORY_LABELS[cat]}`,
      patch: { categories: filter.categories.filter((c) => c !== cat) },
    })
  }
  if (filter.status !== 'any') {
    chips.push({ label: `Status: ${filter.status === 'active' ? 'Active' : 'Inactive'}`, patch: { status: 'any' } })
  }
  if (filter.price?.min != null) {
    chips.push({ label: `Above ${formatLKR(filter.price.min)}`, patch: { price: { ...filter.price, min: null } } })
  }
  if (filter.price?.max != null) {
    chips.push({ label: `Under ${formatLKR(filter.price.max)}`, patch: { price: { ...filter.price, max: null } } })
  }
  if (filter.validOn) {
    chips.push({ label: `Valid on ${filter.validOn}`, patch: { validOn: null } })
  }
  for (const kw of filter.keywords) {
    chips.push({ label: `"${kw}"`, patch: { keywords: filter.keywords.filter((k) => k !== kw) } })
  }

  return chips
}

interface FilterChipsProps {
  filter: SearchFilter
  source: 'ai' | 'heuristic'
  explanation: string
  onRemove: (patch: Partial<SearchFilter>) => void
  onClear: () => void
}

export function FilterChips({ filter, source, explanation, onRemove, onClear }: FilterChipsProps) {
  const chips = buildChips(filter)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {source === 'ai' ? (
          <Sparkles className="size-3.5 shrink-0 text-amber-500" />
        ) : (
          <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
        )}
        <span className="truncate">{source === 'ai' ? explanation : 'Interpreted without AI'}</span>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onRemove(chip.patch)}
              className="group flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 py-1 pl-3 pr-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              {chip.label}
              <X className="size-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
