import { z } from 'zod';

export const CheckoutInputSchema = z.object({
  barcode: z.string().min(1).optional(),
  inventoryId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
}).refine((d) => d.barcode !== undefined || d.inventoryId !== undefined, {
  message: 'Either barcode or inventoryId is required',
});

export const ReturnInputSchema = z.object({
  barcode: z.string().min(1).optional(),
  inventoryId: z.string().uuid().optional(),
}).refine((d) => d.barcode !== undefined || d.inventoryId !== undefined, {
  message: 'Either barcode or inventoryId is required',
});

export const AdvanceStageInputSchema = z.object({
  barcode: z.string().min(1).optional(),
  inventoryId: z.string().uuid().optional(),
}).refine((d) => d.barcode !== undefined || d.inventoryId !== undefined, {
  message: 'Either barcode or inventoryId is required',
});

export const RenewInputSchema = z.object({
  checkoutId: z.string().uuid(),
});

export const PlaceHoldInputSchema = z.object({
  bookId: z.string().uuid(),
});

export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;
export type ReturnInput = z.infer<typeof ReturnInputSchema>;
export type AdvanceStageInput = z.infer<typeof AdvanceStageInputSchema>;
export type RenewInput = z.infer<typeof RenewInputSchema>;
export type PlaceHoldInput = z.infer<typeof PlaceHoldInputSchema>;
