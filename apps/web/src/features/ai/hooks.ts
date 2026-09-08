import { useMutation } from '@tanstack/react-query'
import type { AiGenerateProductResponse, AiSearchResponse } from '@travel/validation'
import { api } from '@/lib/api'

export function useGenerateProduct() {
  return useMutation({
    mutationFn: (prompt: string) => api.post<AiGenerateProductResponse>('/ai/generate-product', { prompt }),
  })
}

export function useAiSearch() {
  return useMutation({
    mutationFn: (query: string) => api.post<AiSearchResponse>('/ai/search', { query }),
  })
}
