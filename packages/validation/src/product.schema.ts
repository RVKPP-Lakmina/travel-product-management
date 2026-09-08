import { z } from "zod";

export const createProductSchema = z.object({
    name: z.string().min(2),
    destination: z.string().min(2),
    category: z.string().min(2),
    description: z.string().min(10),
    price: z.number().nonnegative(),
    inventoryCount: z.number().int().nonnegative(),
    validFrom: z.string(),
    validUntil: z.string(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;