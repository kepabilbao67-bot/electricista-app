import { z } from "zod";

// Validación de NIF / CIF / NIE español básico
const spanishNifCifRegex = /^([0-9]{8}[A-Za-z]|[XYZxyz][0-9]{7}[A-Za-z]|[ABCDEFGHJNPQRSUVWabcdefghjnpqrsuvw][0-9]{7}[0-9A-Ja-j])$/;

export const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres"),
  first_name: z.string().trim().optional().or(z.literal("")).nullable(),
  last_name: z.string().trim().optional().or(z.literal("")).nullable(),
  company: z.string().trim().optional().or(z.literal("")).nullable(),
  source: z.string().trim().optional().or(z.literal("")).nullable(),
  status: z.string().trim().optional().default("nuevo"),
  probability: z.number().optional().default(0),
  nif: z
    .string()
    .trim()
    .regex(spanishNifCifRegex, "Formato de NIF/CIF/NIE no válido")
    .optional()
    .or(z.literal(""))
    .nullable(),
  email: z
    .string()
    .trim()
    .email("Formato de email no válido")
    .optional()
    .or(z.literal(""))
    .nullable(),
  phone: z.string().trim().optional().or(z.literal("")).nullable(),
  address: z.string().trim().optional().or(z.literal("")).nullable(),
  city: z.string().trim().optional().or(z.literal("")).nullable(),
  postal_code: z.string().trim().optional().or(z.literal("")).nullable(),
  province: z.string().trim().optional().or(z.literal("")).nullable(),
  notes: z.string().trim().optional().or(z.literal("")).nullable(),
  client_type: z.enum(["particular", "empresa"]).optional().default("particular"),
  address_color: z.string().trim().optional().or(z.literal("")).nullable(),
  notes_color: z.string().trim().optional().or(z.literal("")).nullable(),
});

export type ClientInput = z.infer<typeof clientSchema>;
