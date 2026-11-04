import { z } from "zod";

const locale = z.string().trim().min(2).max(35);

export const translateRequestSchema = z
  .object({
    texts: z.array(z.string().max(10_000)).min(1).max(100),
    targetLocale: locale,
    sourceLocale: locale.optional(),
    context: z.string().max(1_000).optional(),
  })
  .strict();

export type TranslateRequest = z.infer<typeof translateRequestSchema>;
export type TranslateResponse = { locale: string; translations: string[] };
