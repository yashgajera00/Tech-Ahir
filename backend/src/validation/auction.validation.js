import { z } from 'zod';

export const createAuctionSchema = z
  .object({
    title: z
      .string({ required_error: 'Title is required' })
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(160, 'Title must be 160 characters or fewer'),
    description: z
      .string()
      .trim()
      .max(5000, 'Description must be 5000 characters or fewer')
      .optional()
      .default(''),
    starting_price: z.coerce
      .number({ invalid_type_error: 'Starting price must be a number' })
      .nonnegative('Starting price cannot be negative'),
    min_bid_increment: z.coerce
      .number({ invalid_type_error: 'Minimum bid increment must be a number' })
      .positive('Minimum bid increment must be greater than zero'),
    start_time: z.coerce.date({ invalid_type_error: 'Start time is invalid' }),
    end_time: z.coerce.date({ invalid_type_error: 'End time is invalid' }),
  })
  .superRefine((value, context) => {
    if (value.end_time <= value.start_time) {
      context.addIssue({
        code: 'custom',
        path: ['end_time'],
        message: 'End time must be after start time',
      });
    }
  });

export const auctionListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  status: z.enum(['scheduled', 'active', 'ended']).optional(),
  search: z.string().trim().max(160).optional().default(''),
});
