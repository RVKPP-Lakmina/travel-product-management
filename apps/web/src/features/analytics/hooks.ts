import { useQuery } from '@tanstack/react-query'
import type { ProductAnalytics } from '@travel/validation'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function useProductAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics.overview,
    queryFn: () => api.get<ProductAnalytics>('/products/analytics'),
    staleTime: 5 * 60_000,
  })
}
