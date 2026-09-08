import { CATEGORY_LABELS, type CategorySlug } from '@travel/validation'
import { cn } from '@/lib/utils'

/**
 * Low-saturation per-category tint (tokens in index.css). Status badges own
 * the saturated colours + the dot; this is quiet wayfinding, and the label
 * text always carries the meaning.
 */
const CATEGORY_CLASS: Record<CategorySlug, string> = {
  dining: 'bg-cat-dining-bg text-cat-dining-fg',
  excursion: 'bg-cat-excursion-bg text-cat-excursion-fg',
  safari: 'bg-cat-safari-bg text-cat-safari-fg',
  accommodation: 'bg-cat-accommodation-bg text-cat-accommodation-fg',
  transport: 'bg-cat-transport-bg text-cat-transport-fg',
  family: 'bg-cat-family-bg text-cat-family-fg',
  wellness: 'bg-cat-wellness-bg text-cat-wellness-fg',
  cultural: 'bg-cat-cultural-bg text-cat-cultural-fg',
  adventure: 'bg-cat-adventure-bg text-cat-adventure-fg',
  shopping: 'bg-cat-shopping-bg text-cat-shopping-fg',
}

export function CategoryPill({ category, className }: { category: CategorySlug; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium',
        CATEGORY_CLASS[category],
        className,
      )}
    >
      {CATEGORY_LABELS[category]}
    </span>
  )
}
