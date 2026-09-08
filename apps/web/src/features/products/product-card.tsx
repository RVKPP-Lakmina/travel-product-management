import { Link } from 'react-router'
import { MoreVertical, Pencil, ImagePlus, Trash2 } from 'lucide-react'
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
import { formatLKR, formatDate } from '@/lib/format'

interface ProductCardProps {
  product: ProductResponse
  selected: boolean
  onToggleSelect: () => void
  onDelete: () => void
  onGenerateImage: () => void
}

export function ProductCard({ product, selected, onToggleSelect, onDelete, onGenerateImage }: ProductCardProps) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
      <Checkbox
        checked={selected}
        onCheckedChange={onToggleSelect}
        aria-label={`Select ${product.name}`}
        className="mt-1"
      />
      {product.imageUrl ? (
        <img src={product.imageUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-medium text-muted-foreground">
          {product.category.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/products/${product.id}/edit`} className="block truncate text-sm font-medium hover:underline">
              {product.name}
            </Link>
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
          <span className="text-xs text-muted-foreground">Valid until {formatDate(product.validUntil)}</span>
        </div>
      </div>
    </div>
  )
}
