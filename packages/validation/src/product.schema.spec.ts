import { describe, expect, it } from 'vitest';
import { createProductSchema, updateProductSchema, productQuerySchema } from './product.schema.js';

const validProduct = {
  name: 'Test Product',
  destination: 'Colombo',
  category: 'dining' as const,
  description: 'A sufficiently long description for validation purposes.',
  price: 1000,
  inventoryCount: 5,
  validFrom: '2026-01-01',
  validUntil: '2026-02-01',
};

describe('createProductSchema', () => {
  it('accepts a valid product', () => {
    expect(createProductSchema.safeParse(validProduct).success).toBe(true);
  });

  it('rejects validUntil before validFrom', () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      validFrom: '2026-02-01',
      validUntil: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('accepts validUntil equal to validFrom (inclusive)', () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      validFrom: '2026-01-01',
      validUntil: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown category', () => {
    const result = createProductSchema.safeParse({ ...validProduct, category: 'not-a-real-category' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative price', () => {
    const result = createProductSchema.safeParse({ ...validProduct, price: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects extra/unknown fields — the mass-assignment defense', () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      id: 'client-supplied-id',
      createdBy: 'attacker-user-id',
    });
    expect(result.success).toBe(false);
  });

  it('defaults status to active and arrays to empty', () => {
    const result = createProductSchema.parse(validProduct);
    expect(result.status).toBe('active');
    expect(result.highlights).toEqual([]);
    expect(result.tags).toEqual([]);
  });
});

describe('updateProductSchema', () => {
  it('accepts a partial update with just one field', () => {
    expect(updateProductSchema.safeParse({ price: 5000 }).success).toBe(true);
  });

  it('accepts an empty update', () => {
    expect(updateProductSchema.safeParse({}).success).toBe(true);
  });

  it('rejects validUntil before validFrom when both are present', () => {
    const result = updateProductSchema.safeParse({ validFrom: '2026-06-01', validUntil: '2026-01-01' });
    expect(result.success).toBe(false);
  });

  it('still rejects id/createdBy on update', () => {
    expect(updateProductSchema.safeParse({ createdBy: 'x' }).success).toBe(false);
  });
});

describe('productQuerySchema', () => {
  it('applies sensible defaults', () => {
    const result = productQuerySchema.parse({});
    expect(result.status).toBe('any');
    expect(result.sort).toBe('created_desc');
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('clamps limit at the schema boundary', () => {
    const result = productQuerySchema.safeParse({ limit: 9999 });
    expect(result.success).toBe(false);
  });
});
