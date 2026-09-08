import type { ProductQuery, ExpiredQuery } from '@travel/validation'

export const queryKeys = {
  products: {
    all: ['products'] as const,
    list: (query: Partial<ProductQuery>) => ['products', 'list', query] as const,
    expired: (query: Partial<ExpiredQuery>) => ['products', 'expired', query] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    dashboard: ['products', 'dashboard'] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    overview: ['analytics', 'overview'] as const,
  },
}
