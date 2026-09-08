import { Link } from 'react-router'
import { MoreVertical, Pencil, ImagePlus, Trash2 } from 'lucide-react'
import type { ProductResponse } from '@travel/validation'
import { TableRow, TableCell } from '@/components/ui/table'
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

interface ProductRowProps {
  product: ProductResponse
  selected: boolean
  onToggleSelect: () => void
  onDelete: () => void
  onGenerateImage: () => void
}

export function ProductRow({ product, selected, onToggleSelect, onDelete, onGenerateImage }: ProductRowProps) {
  return (
    <TableRow>
      <TableCell className="w-10">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={`Select ${product.name}`} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-medium text-muted-foreground">
              {product.category.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <Link to={`/products/${product.id}/edit`} className="block truncate font-medium hover:underline">
              {product.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{product.destination}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <CategoryPill category={product.category} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatLKR(product.price)}</TableCell>
      <TableCell className="tabular-nums">{product.inventoryCount}</TableCell>
      <TableCell className="whitespace-nowrap">{formatDate(product.validUntil)}</TableCell>
      <TableCell>
        <StatusBadge status={product.status} validUntil={product.validUntil} isExpired={product.isExpired} />
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
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
      </TableCell>
    </TableRow>
  )
}
