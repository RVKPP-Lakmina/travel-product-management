import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductQuery,
  ProductResponse,
  DashboardStats,
  SearchFilter,
} from '@travel/validation'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

interface ProductListResult {
  items: ProductResponse[]
  total: number
}

function toQueryString(query: Partial<ProductQuery>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useProducts(query: Partial<ProductQuery>) {
  return useQuery({
    queryKey: queryKeys.products.list(query),
    queryFn: () => api.get<ProductListResult>(`/products${toQueryString(query)}`),
    placeholderData: (prev) => prev,
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

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProductInput) => api.post<ProductResponse>('/products', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProductInput) => api.patch<ProductResponse>(`/products/${id}`, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
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
    },
  })
}
