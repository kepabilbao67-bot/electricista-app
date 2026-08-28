import { z } from "zod";

export const budgetItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, "La descripción del concepto debe tener al menos 2 caracteres"),
  quantity: z
    .number()
    .positive("La cantidad debe ser mayor que 0"),
  unit_price: z
    .number()
    .nonnegative("El precio unitario no puede ser negativo"),
});

export const budgetSchema = z.object({
  client_id: z
    .string()
    .trim()
    .min(1, "El cliente es obligatorio"),
  date: z.string().trim().optional(),
  valid_until: z.string().trim().optional().or(z.literal("")).nullable(),
  status: z.enum(["draft", "sent", "accepted", "rejected"]).optional().default("draft"),
  tax_rate: z.number().min(0, "El IVA no puede ser negativo").max(100, "El IVA no puede superar el 100%").optional().default(21),
  notes: z.string().trim().optional().or(z.literal("")).nullable(),
  notes_color: z.string().trim().optional().or(z.literal("")).nullable(),
  items: z
    .array(budgetItemSchema)
    .min(1, "El presupuesto debe incluir al menos un concepto"),
});

export type BudgetItemInput = z.infer<typeof budgetItemSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
