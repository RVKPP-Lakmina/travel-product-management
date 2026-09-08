import type { ProductResponse } from '@travel/validation';
import { isExpired } from '../common/date/colombo-date.js';
import type { ProductRow } from './products.types.js';

/**
 * The only place a DB row becomes an API response. `isExpired` is always
 * computed HERE, server-side — the frontend never does date math or
 * guesses a timezone, and a client can never submit its own `isExpired`
 * value (it isn't in any request schema in packages/validation).
 */
export function toProductResponse(row: ProductRow): ProductResponse {
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    category: row.category,
    description: row.description,
    price: Number(row.price),
    currency: row.currency,
    inventoryCount: row.inventory_count,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    status: row.status,
    highlights: row.highlights,
    inclusions: row.inclusions,
    tags: row.tags,
    imageUrl: row.image_url,
    isExpired: isExpired(row.valid_until),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
