import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, AlertTriangle, RotateCcw } from 'lucide-react'
import {
  createProductSchema,
  CATEGORY_SLUGS,
  CATEGORY_LABELS,
  type CreateProductInput,
  type AiGenerateProductResponse,
} from '@travel/validation'
import { useProduct, useCreateProduct, useUpdateProduct } from './hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { TagListInput } from './tag-list-input'
import { ProductImagePanel } from './product-image-panel'
import { AiBadge } from '@/features/ai/ai-badge'
import { AiNote } from '@/features/ai/ai-note'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'

const EMPTY_VALUES: CreateProductInput = {
  name: '',
  destination: '',
  category: 'excursion',
  description: '',
  price: 0,
  inventoryCount: 0,
  validFrom: new Date().toISOString().slice(0, 10),
  validUntil: new Date().toISOString().slice(0, 10),
  status: 'active',
  highlights: [],
  inclusions: [],
  tags: [],
  aiGenerated: false,
}

function AiLabel({ text, isAi }: { text: string; isAi: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {text}
      {isAi && <AiBadge />}
    </span>
  )
}

// AI-uncertain field: subtle amber ring, never a hard error ring
// (see /ui-architecture.md §5).
const NEEDS_INPUT_CLS = 'ring-1 ring-accent/60 bg-accent/5'

function NeedsInput({ show }: { show: boolean }) {
  if (!show) return null
  return <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Needs your input</p>
}

function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('text-sm font-semibold text-foreground', className)}>{children}</h2>
}

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const location = useLocation()
  const draftState = location.state as { draft?: AiGenerateProductResponse['draft']; meta?: AiGenerateProductResponse['meta'] } | null

  const [aiFields, setAiFields] = useState<Set<string>>(new Set())
  const [needsInput] = useState<Set<string>>(new Set(draftState?.meta?.unresolvedFields ?? []))
  const [assumptions] = useState<string[]>(draftState?.meta?.assumptions ?? [])

  const existing = useProduct(id)
  const create = useCreateProduct()
  const update = useUpdateProduct(id ?? '')

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createProductSchema),
    defaultValues: EMPTY_VALUES,
  })

  // Apply an AI-generated draft passed via router state (from the
  // dashboard or products list "Generate with AI" dialog).
  useEffect(() => {
    if (!draftState?.draft) return
    const draft = draftState.draft
    const applied = new Set<string>()
    if (draft.name) {
      setValue('name', draft.name, { shouldDirty: true })
      applied.add('name')
    }
    if (draft.description) {
      setValue('description', draft.description, { shouldDirty: true })
      applied.add('description')
    }
    if (draft.destination) {
      setValue('destination', draft.destination, { shouldDirty: true })
      applied.add('destination')
    }
    if (draft.category) {
      setValue('category', draft.category, { shouldDirty: true })
      applied.add('category')
    }
    if (draft.price != null) {
      setValue('price', draft.price, { shouldDirty: true })
      applied.add('price')
    }
    if (draft.validFrom) {
      setValue('validFrom', draft.validFrom, { shouldDirty: true })
      applied.add('validFrom')
    }
    if (draft.validUntil) {
      setValue('validUntil', draft.validUntil, { shouldDirty: true })
      applied.add('validUntil')
    }
    if (draft.highlights.length) {
      setValue('highlights', draft.highlights, { shouldDirty: true })
      applied.add('highlights')
    }
    if (draft.inclusions.length) {
      setValue('inclusions', draft.inclusions, { shouldDirty: true })
      applied.add('inclusions')
    }
    if (draft.tags.length) {
      setValue('tags', draft.tags, { shouldDirty: true })
      applied.add('tags')
    }
    // Provenance: this product started as an AI draft. Create-only —
    // updateProductSchema doesn't accept it (stripped in onSubmit below).
    if (applied.size > 0) setValue('aiGenerated', true, { shouldDirty: true })
    setAiFields(applied)
    // Only apply once — the location.state object identity is stable for
    // the lifetime of this navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Populate the form when editing an existing product.
  useEffect(() => {
    if (existing.data) {
      reset({
        name: existing.data.name,
        destination: existing.data.destination,
        category: existing.data.category,
        description: existing.data.description,
        price: existing.data.price,
        inventoryCount: existing.data.inventoryCount,
        validFrom: existing.data.validFrom,
        validUntil: existing.data.validUntil,
        status: existing.data.status,
        highlights: existing.data.highlights,
        inclusions: existing.data.inclusions,
        tags: existing.data.tags,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.data])

  async function onSubmit(values: CreateProductInput) {
    try {
      if (isEdit) {
        // aiGenerated is create-only provenance; updateProductSchema is a
        // strictObject and rejects unknown keys.
        const patch: Partial<CreateProductInput> = { ...values }
        delete patch.aiGenerated
        await update.mutateAsync(patch)
        toast.success('Product updated.')
      } else {
        const created = await create.mutateAsync(values)
        toast.success('Product created.')
        navigate(`/products/${created.id}/edit`, { replace: true })
        return
      }
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        toast.error('Please check the highlighted fields.')
        return
      }
      toast.error(err instanceof ApiError ? err.message : 'Save failed. Please try again.')
    }
  }

  if (isEdit && existing.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-md" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Skeleton className="h-128 w-full rounded-lg xl:col-span-2" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (isEdit && existing.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-medium">Couldn't load this product</p>
          <p className="text-sm text-muted-foreground">It may have been deleted, or the link is wrong.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/products')}>
            Back to products
          </Button>
          <Button type="button" variant="outline" onClick={() => existing.refetch()}>
            <RotateCcw />
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const status = watch('status')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 pb-20">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/products')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{isEdit ? 'Edit Product' : 'Create New Travel Product'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update the details below.' : 'Fill in the details or generate them with AI.'}
          </p>
        </div>
      </div>

      {isEdit && existing.data?.isExpired && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          This product's validity period has ended — it won't appear in listings or search until you update its dates.
        </div>
      )}

      {assumptions.length > 0 && (
        <AiNote title="AI assumptions">
          <ul className="list-disc space-y-0.5 pl-4">
            {assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </AiNote>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 xl:col-span-2">
          <SectionHeading>Basics</SectionHeading>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">
              <AiLabel text="Product Name" isAi={aiFields.has('name')} />
            </Label>
            <Input
              id="name"
              {...register('name')}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className={needsInput.has('name') ? NEEDS_INPUT_CLS : undefined}
            />
            <NeedsInput show={needsInput.has('name')} />
            {errors.name && <p id="name-error" className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">
                <AiLabel text="Category" isAi={aiFields.has('category')} />
              </Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_SLUGS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="destination">
                <AiLabel text="Destination" isAi={aiFields.has('destination')} />
              </Label>
              <Input
                id="destination"
                {...register('destination')}
                aria-invalid={!!errors.destination}
                aria-describedby={errors.destination ? 'destination-error' : undefined}
                className={needsInput.has('destination') ? NEEDS_INPUT_CLS : undefined}
              />
              <NeedsInput show={needsInput.has('destination')} />
              {errors.destination && (
                <p id="destination-error" className="text-xs text-destructive">{errors.destination.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">
              <AiLabel text="Description" isAi={aiFields.has('description')} />
            </Label>
            <Textarea
              id="description"
              rows={4}
              {...register('description')}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'description-error' : undefined}
            />
            {errors.description && (
              <p id="description-error" className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <SectionHeading className="border-t border-border pt-5">Pricing &amp; inventory</SectionHeading>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price">
                <AiLabel text="Price (LKR)" isAi={aiFields.has('price')} />
              </Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                {...register('price', { valueAsNumber: true })}
                aria-invalid={!!errors.price}
                aria-describedby={errors.price ? 'price-error' : undefined}
                className={needsInput.has('price') ? NEEDS_INPUT_CLS : undefined}
              />
              <NeedsInput show={needsInput.has('price')} />
              {errors.price && <p id="price-error" className="text-xs text-destructive">{errors.price.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inventoryCount">
                <AiLabel text="Inventory Count" isAi={aiFields.has('inventoryCount')} />
              </Label>
              <Input
                id="inventoryCount"
                type="number"
                min={0}
                step="1"
                {...register('inventoryCount', { valueAsNumber: true })}
                aria-invalid={!!errors.inventoryCount}
                aria-describedby={errors.inventoryCount ? 'inventoryCount-error' : undefined}
                className={needsInput.has('inventoryCount') ? NEEDS_INPUT_CLS : undefined}
              />
              <NeedsInput show={needsInput.has('inventoryCount')} />
              {errors.inventoryCount && (
                <p id="inventoryCount-error" className="text-xs text-destructive">{errors.inventoryCount.message}</p>
              )}
            </div>
          </div>

          <SectionHeading className="border-t border-border pt-5">Validity</SectionHeading>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validFrom">
                <AiLabel text="Valid From" isAi={aiFields.has('validFrom')} />
              </Label>
              <Input
                id="validFrom"
                type="date"
                {...register('validFrom')}
                aria-invalid={!!errors.validFrom}
                aria-describedby={errors.validFrom ? 'validFrom-error' : undefined}
                className={needsInput.has('validFrom') ? NEEDS_INPUT_CLS : undefined}
              />
              <NeedsInput show={needsInput.has('validFrom')} />
              {errors.validFrom && (
                <p id="validFrom-error" className="text-xs text-destructive">{errors.validFrom.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validUntil">
                <AiLabel text="Valid Until" isAi={aiFields.has('validUntil')} />
              </Label>
              <Input
                id="validUntil"
                type="date"
                {...register('validUntil')}
                aria-invalid={!!errors.validUntil}
                aria-describedby={errors.validUntil ? 'validUntil-error' : undefined}
                className={needsInput.has('validUntil') ? NEEDS_INPUT_CLS : undefined}
              />
              <NeedsInput show={needsInput.has('validUntil')} />
              {errors.validUntil && (
                <p id="validUntil-error" className="text-xs text-destructive">{errors.validUntil.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-muted-foreground">
                {status === 'active' ? 'Visible in listings' : 'Hidden from listings'}
              </p>
            </div>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Switch checked={field.value === 'active'} onCheckedChange={(c) => field.onChange(c ? 'active' : 'inactive')} />
              )}
            />
          </div>

          <SectionHeading className="border-t border-border pt-5">Content</SectionHeading>

          <Controller
            control={control}
            name="highlights"
            render={({ field }) => (
              <TagListInput
                label="Highlights"
                values={field.value}
                onChange={field.onChange}
                placeholder="Add a highlight and press Enter"
                aiPopulated={aiFields.has('highlights')}
              />
            )}
          />
          <Controller
            control={control}
            name="inclusions"
            render={({ field }) => (
              <TagListInput
                label="Inclusions"
                values={field.value}
                onChange={field.onChange}
                placeholder="Add an inclusion and press Enter"
                aiPopulated={aiFields.has('inclusions')}
              />
            )}
          />
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <TagListInput
                label="Tags"
                values={field.value}
                onChange={field.onChange}
                placeholder="Add a tag and press Enter"
                aiPopulated={aiFields.has('tags')}
              />
            )}
          />
        </div>

        <div className="xl:col-span-1">
          <ProductImagePanel productId={id} imageUrl={existing.data?.imageUrl ?? null} />
        </div>
      </div>

      {/* Tracks the sidebar rail via the inherited --sidebar-w set by
          AppLayout — a fixed element still inherits custom properties from
          its DOM ancestors, so this stays aligned when the rail collapses. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 px-4 py-3 backdrop-blur transition-[padding] duration-200 sm:px-6 md:pl-(--sidebar-w)">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/products')}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save &amp; Publish
          </Button>
        </div>
      </div>
    </form>
  )
}
