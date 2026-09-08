import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductQuery,
  ExpiredQuery,
  ProductResponse,
  DashboardStats,
  SearchFilter,
} from '@travel/validation'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { daysUntil } from '@/lib/format'

interface ProductListResult {
  items: ProductResponse[]
  total: number
}

function toQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useProducts(query: Partial<ProductQuery>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.products.list(query),
    queryFn: () => api.get<ProductListResult>(`/products${toQueryString(query)}`),
    placeholderData: (prev) => prev,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Runs a full SearchFilter (multiple destinations/categories, a price
 * range, keyword arrays) through POST /products/query — the same
 * server-side compiler AI search uses, with zero AI involvement. This is
 * what lets removing a filter chip re-query correctly without another
 * OpenAI call.
 */
export function useProductsByFilter(filter: SearchFilter | null) {
  return useQuery({
    queryKey: ['products', 'filter', filter],
    queryFn: () => api.post<ProductListResult>('/products/query', filter),
    enabled: !!filter,
    placeholderData: (prev) => prev,
  })
}

/**
 * Expired products — the rows every other list endpoint hides. Backed by
 * GET /products/expired (its own view, `products_expired`), so this is the
 * only way for a user to find and renew a lapsed product.
 */
export function useExpiredProducts(query: Partial<ExpiredQuery>) {
  return useQuery({
    queryKey: queryKeys.products.expired(query),
    queryFn: () => api.get<ProductListResult>(`/products/expired${toQueryString(query)}`),
    placeholderData: (prev) => prev,
  })
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.detail(id ?? ''),
    queryFn: () => api.get<ProductResponse>(`/products/${id}`),
    enabled: !!id,
  })
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.products.dashboard,
    queryFn: () => api.get<DashboardStats>('/products/dashboard'),
  })
}

/** Products whose validity ends within this many days count as "expiring". */
export const EXPIRING_WINDOW_DAYS = 7

const EXPIRING_QUERY: Partial<ProductQuery> = {
  sort: 'valid_until_asc',
  status: 'active',
  limit: 10,
}

/**
 * The one definition of "expiring soon", shared by the dashboard card and
 * the header notification bell. Both call it with the same query object, so
 * React Query serves them from a single cache entry rather than fetching
 * twice — and the ≤7-day rule lives in exactly one place.
 *
 * The list endpoint reads `products_listable`, which already excludes
 * expired rows, so everything returned here is still in its validity
 * window. Already-expired products can only be counted, via
 * `useDashboardStats().expired`.
 */
export function useExpiringSoon() {
  const query = useProducts(EXPIRING_QUERY)
  const items = (query.data?.items ?? []).filter(
    (p) => daysUntil(p.validUntil) <= EXPIRING_WINDOW_DAYS,
  )
  return { ...query, items }
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProductInput) => api.post<ProductResponse>('/products', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
    },
  })
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProductInput) => api.patch<ProductResponse>(`/products/${id}`, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
      queryClient.setQueryData(queryKeys.products.detail(id), data)
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
    },
  })
}

export function useGenerateProductImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (productId: string) => api.post<{ imageUrl: string }>(`/products/${productId}/image`),
    onSuccess: (_data, productId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
    },
  })
}
