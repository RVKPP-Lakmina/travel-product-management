import { Link } from 'react-router'
import { MoreVertical, Eye, Pencil, ImagePlus, Trash2 } from 'lucide-react'
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
import { ProductThumb } from './product-thumb'
import { ValidUntil } from './valid-until'
import { AiSparkle } from '@/features/ai/ai-badge'
import { formatAmount } from '@/lib/format'

interface ProductRowProps {
  product: ProductResponse
  selectable?: boolean
  selected: boolean
  onToggleSelect: () => void
  onDelete: () => void
  onGenerateImage: () => void
  onPeek: () => void
}

export function ProductRow({
  product,
  selectable = true,
  selected,
  onToggleSelect,
  onDelete,
  onGenerateImage,
  onPeek,
}: ProductRowProps) {
  return (
    <TableRow>
      {selectable && (
        <TableCell className="w-10">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={`Select ${product.name}`} />
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-3">
          <ProductThumb product={product} className="size-10" />
          <div className="min-w-0">
            <span className="flex items-center gap-1.5">
              <Link
                to={`/products/${product.id}/edit`}
                className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {product.name}
              </Link>
              {product.aiGenerated && <AiSparkle />}
            </span>
            <p className="truncate text-xs text-muted-foreground">{product.destination}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <CategoryPill category={product.category} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatAmount(product.price)}</TableCell>
      <TableCell className="hidden text-right tabular-nums lg:table-cell">{product.inventoryCount}</TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        <ValidUntil iso={product.validUntil} isExpired={product.isExpired} />
      </TableCell>
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
      </TableCell>
    </TableRow>
  )
}
