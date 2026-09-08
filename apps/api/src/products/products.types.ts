import type { CategorySlug } from '@travel/validation';

/** Shape of a row from `public.products` or `public.products_listable` — both share the same columns. */
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
