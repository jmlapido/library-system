import { z } from 'zod';

export const CreateBookSchema = z.object({
  isbn: z.string().max(20).optional(),
  title: z.string().min(1).max(500),
  author: z.string().min(1).max(255),
  publisher: z.string().max(255).optional(),
  publicationYear: z.number().int().min(1000).max(2100).optional(),
  description: z.string().optional(),
  coverUrl: z.string().url().optional(),
  category: z.string().max(100).optional(),
  genre: z.string().max(100).optional(),
  subjectTags: z.array(z.string()).optional(),
  language: z.string().max(50).default('en'),
  pageCount: z.number().int().positive().optional(),
  lexileLevel: z.number().int().optional(),
  readingLevel: z.string().max(50).optional(),
  seriesName: z.string().max(255).optional(),
  seriesNumber: z.number().int().positive().optional(),
  deweyDecimal: z.string().max(50).optional(),
  firstCopyBarcode: z.string().min(1).max(100),
  firstCopyCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  firstCopyLocation: z.string().max(100).optional(),
});

export const UpdateBookSchema = CreateBookSchema.omit({ firstCopyBarcode: true, firstCopyCondition: true, firstCopyLocation: true }).partial();

export const AddCopySchema = z.object({
  barcode: z.string().min(1).max(100),
  condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  location: z.string().max(100).optional(),
  acquisitionDate: z.string().date().optional(),
  purchaseCost: z.number().positive().optional(),
});

export const UpdateCopySchema = z.object({
  condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  location: z.string().max(100).optional(),
  status: z.enum(['available', 'checked_out', 'returned', 'being_processed', 'shelved', 'damaged', 'lost']).optional(),
});

export const BookSearchSchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  readingLevel: z.string().optional(),
  availability: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateBookInput = z.infer<typeof CreateBookSchema>;
export type UpdateBookInput = z.infer<typeof UpdateBookSchema>;
export type AddCopyInput = z.infer<typeof AddCopySchema>;
export type UpdateCopyInput = z.infer<typeof UpdateCopySchema>;
export type BookSearchInput = z.infer<typeof BookSearchSchema>;
