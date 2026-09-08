import { CATEGORY_LABELS, type CategorySlug } from '@travel/validation'
import { Badge } from '@/components/ui/badge'

export function CategoryPill({ category }: { category: CategorySlug }) {
  return <Badge variant="primary">{CATEGORY_LABELS[category]}</Badge>
}
