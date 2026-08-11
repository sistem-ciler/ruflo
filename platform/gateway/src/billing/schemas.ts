import { z } from "zod";

export const subscribeSchema = z.object({
  planId: z.string().uuid(),
  paymentMethodId: z.string().optional(),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

export const listInvoicesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
