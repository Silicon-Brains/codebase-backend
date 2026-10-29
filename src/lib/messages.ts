import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const messageBodySchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'Write a message first')
      .max(4000, 'Messages are limited to 4000 characters'),
  })
  .strict();

export const MESSAGES_PAGE_LIMIT = 500;