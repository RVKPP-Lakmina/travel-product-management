import type { CategorySlug } from '@travel/validation';

/**
 * Shape of a row from `public.products`, `public.products_listable`, or
 * `public.products_expired` — all three share the same columns.
 */
export interface ProductRow {
  id: string;
  name: string;
  destination: string;
  category: CategorySlug;
  description: string;
  price: number;
  currency: 'LKR';
  inventory_count: number;
  valid_from: string;
  valid_until: string;
  status: 'active' | 'inactive';
  highlights: string[];
  inclusions: string[];
  tags: string[];
  image_url: string | null;
  ai_generated: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStatsRow {
  total: number;
  active: number;
  expired: number;
  inactive: number;
}
