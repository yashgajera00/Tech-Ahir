import { z } from 'zod';

export const placeBidSchema = z.object({
  bid_amount: z.coerce
    .number({ invalid_type_error: 'Bid amount must be a number' })
    .positive('Bid amount must be greater than zero'),
  idempotency_key: z
    .string({ required_error: 'Idempotency key is required' })
    .uuid('Idempotency key must be a valid UUID'),
});

export const bidHistorySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
