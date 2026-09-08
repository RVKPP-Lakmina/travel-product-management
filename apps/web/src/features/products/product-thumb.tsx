import type { ProductResponse } from '@travel/validation'
import { cn } from '@/lib/utils'

/**
 * Product image, or a category-initials fallback when there's no image yet.
 * One definition shared by the table row, the mobile card, and the
 * dashboard list.
 */
export function ProductThumb({
  product,
  className,
}: {
  product: Pick<ProductResponse, 'imageUrl' | 'category'>
  className?: string
}) {
  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt=""
        className={cn('shrink-0 rounded-md object-cover', className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-medium text-muted-foreground',
        className,
      )}
      aria-hidden="true"
    >
      {product.category.slice(0, 2).toUpperCase()}
    </div>
  )
}
