import { Link } from 'react-router'
import { MoreVertical, Eye, Pencil, ImagePlus, Trash2 } from 'lucide-react'
import type { ProductResponse } from '@travel/validation'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { StatusBadge } from './status-badge'
import { CategoryPill } from './category-pill'
import { ProductThumb } from './product-thumb'
import { ValidUntil } from './valid-until'
import { AiSparkle } from '@/features/ai/ai-badge'
import { formatLKR } from '@/lib/format'

interface ProductCardProps {
  product: ProductResponse
  selectable?: boolean
  selected: boolean
  onToggleSelect: () => void
  onDelete: () => void
  onGenerateImage: () => void
  onPeek: () => void
}

export function ProductCard({
  product,
  selectable = true,
  selected,
  onToggleSelect,
  onDelete,
  onGenerateImage,
  onPeek,
}: ProductCardProps) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
      {selectable && (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label={`Select ${product.name}`}
          className="mt-1"
        />
      )}
      <ProductThumb product={product} className="size-16" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="flex items-center gap-1.5">
              <Link
                to={`/products/${product.id}/edit`}
                className="truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {product.name}
              </Link>
              {product.aiGenerated && <AiSparkle />}
            </span>
            <p className="truncate text-xs text-muted-foreground">{product.destination}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-1 -mt-1 size-8 shrink-0">
                <MoreVertical className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onPeek}>
                <Eye className="size-4" />
                Quick view
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/products/${product.id}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onGenerateImage}>
                <ImagePlus className="size-4" />
                Generate image
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <CategoryPill category={product.category} />
          <StatusBadge status={product.status} validUntil={product.validUntil} isExpired={product.isExpired} />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="font-semibold tabular-nums">{formatLKR(product.price)}</span>
          <span className="text-xs text-muted-foreground">
            Valid until <ValidUntil iso={product.validUntil} isExpired={product.isExpired} />
          </span>
        </div>
      </div>
    </div>
  )
}
