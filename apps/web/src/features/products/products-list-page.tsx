import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, FileSpreadsheet, ChevronDown, Trash2, PackageSearch, PackageX } from 'lucide-react'
import { searchFilterSchema, type SearchFilter, type ProductResponse } from '@travel/validation'
import { useProducts, useProductsByFilter, useDeleteProduct, useGenerateProductImage } from './hooks'
import { useAiSearch } from '@/features/ai/hooks'
import { useExportExcel } from '@/features/export/hooks'
import { AiSearchBar } from '@/features/ai/ai-search-bar'
import { FilterChips } from '@/features/ai/filter-chips'
import { GenerateProductDialog } from '@/features/ai/generate-product-dialog'
import { ProductRow } from './product-row'
import { ProductCard } from './product-card'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableHeader, TableBody, TableRow, TableHead } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'

const PAGE_SIZE = 20

export function ProductsListPage() {
  const [aiFilter, setAiFilter] = useState<SearchFilter | null>(null)
  const [aiMeta, setAiMeta] = useState<{ source: 'ai' | 'heuristic'; explanation: string } | null>(null)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<ProductResponse | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const navigate = useNavigate()
  const aiSearch = useAiSearch()
  const deleteProduct = useDeleteProduct()
  const exportExcel = useExportExcel()
  const generateImage = useGenerateProductImage()

  const active = aiFilter !== null

  const plain = useProducts({
    sort: 'created_desc',
    status: 'any',
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })
  const filteredQuery: SearchFilter | null = useMemo(
    () => (aiFilter ? { ...aiFilter, limit: PAGE_SIZE, offset: page * PAGE_SIZE } : null),
    [aiFilter, page],
  )
  const filtered = useProductsByFilter(filteredQuery)

  const query = active ? filtered : plain
  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function handleSearch(q: string) {
    setPage(0)
    try {
      const res = await aiSearch.mutateAsync(q)
      setAiFilter(res.filter)
      setAiMeta({ source: res.source, explanation: res.explanation })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Search failed. Please try again.')
    }
  }

  function handleRemoveChip(patch: Partial<SearchFilter>) {
    setPage(0)
    setAiFilter((f) => (f ? searchFilterSchema.parse({ ...f, ...patch }) : f))
  }

  function handleClearSearch() {
    setPage(0)
    setAiFilter(null)
    setAiMeta(null)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((p) => p.id))))
  }

  async function handleBulkDelete() {
    await Promise.all([...selected].map((id) => deleteProduct.mutateAsync(id)))
    setSelected(new Set())
    setBulkDeleteOpen(false)
    toast.success('Selected products deleted.')
  }

  async function handleGenerateImage(product: ProductResponse) {
    toast.promise(generateImage.mutateAsync(product.id), {
      loading: `Generating an image for ${product.name}…`,
      success: 'Image generated.',
      error: (err) => (err instanceof ApiError ? err.message : 'Image generation failed.'),
    })
  }

  function currentExportFilter(): SearchFilter {
    return aiFilter ?? searchFilterSchema.parse({ sort: 'created_desc' })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your travel product catalog</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GenerateProductDialog
            onApply={(draft, meta) => navigate('/products/new', { state: { draft, meta } })}
          />
          <Button asChild variant="secondary">
            <Link to="/products/new">
              <Plus />
              Add Product
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Export
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => exportExcel.mutate(currentExportFilter())}
                disabled={exportExcel.isPending}
              >
                <FileSpreadsheet className="size-4" />
                Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <AiSearchBar onSearch={handleSearch} onClear={handleClearSearch} loading={aiSearch.isPending} active={active} />
        {active && aiFilter && aiMeta && (
          <FilterChips
            filter={aiFilter}
            source={aiMeta.source}
            explanation={aiMeta.explanation}
            onRemove={handleRemoveChip}
            onClear={handleClearSearch}
          />
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="size-3.5" />
            Delete Selected
          </Button>
          <button
            type="button"
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {query.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState active={active} />
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size > 0 && selected.size === items.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    selected={selected.has(product.id)}
                    onToggleSelect={() => toggleSelect(product.id)}
                    onDelete={() => setDeleteTarget(product)}
                    onGenerateImage={() => handleGenerateImage(product)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selected={selected.has(product.id)}
                onToggleSelect={() => toggleSelect(product.id)}
                onDelete={() => setDeleteTarget(product)}
                onGenerateImage={() => handleGenerateImage(product)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        productName={deleteTarget?.name ?? null}
        loading={deleteProduct.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteProduct.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
          toast.success('Product deleted.')
        }}
      />
      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        productName={null}
        count={selected.size}
        loading={deleteProduct.isPending}
        onConfirm={handleBulkDelete}
      />
    </div>
  )
}

function EmptyState({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      {active ? <PackageSearch className="size-8 text-muted-foreground" /> : <PackageX className="size-8 text-muted-foreground" />}
      <div>
        <p className="font-medium">{active ? 'Nothing matched' : 'No products yet'}</p>
        <p className="text-sm text-muted-foreground">
          {active ? 'Try removing a filter or searching for something else.' : 'Create your first product to get started.'}
        </p>
      </div>
      {!active && (
        <Button asChild>
          <Link to="/products/new">
            <Plus />
            Add Product
          </Link>
        </Button>
      )}
    </div>
  )
}
