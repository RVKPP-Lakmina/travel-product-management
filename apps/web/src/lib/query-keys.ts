import type { ProductQuery } from '@travel/validation'

export const queryKeys = {
  products: {
    all: ['products'] as const,
    list: (query: Partial<ProductQuery>) => ['products', 'list', query] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    dashboard: ['products', 'dashboard'] as const,
  },
}
