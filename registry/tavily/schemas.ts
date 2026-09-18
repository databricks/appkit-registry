import { z } from "zod";

const query = z.string().trim().min(1).max(400);
const httpUrl = z
  .string()
  .url()
  .max(8192)
  .refine((value) => {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  }, "Use an HTTP(S) URL without embedded credentials");
const domain = z.string().trim().min(1).max(253);

export const searchOptionsSchema = z
  .object({
    searchDepth: z.enum(["basic", "advanced", "fast", "ultra-fast"]).optional(),
    topic: z.enum(["general", "news", "finance"]).optional(),
    maxResults: z.number().int().min(1).max(20).optional(),
    timeRange: z.enum(["day", "week", "month", "year"]).optional(),
    includeDomains: z.array(domain).max(300).optional(),
    excludeDomains: z.array(domain).max(150).optional(),
    includeAnswer: z.boolean().optional(),
    includeRawContent: z
      .union([z.literal(false), z.enum(["markdown", "text"])])
      .optional(),
  })
  .strict();

export const extractOptionsSchema = z
  .object({
    extractDepth: z.enum(["basic", "advanced"]).optional(),
    format: z.enum(["markdown", "text"]).optional(),
    query: query.optional(),
    chunksPerSource: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export const searchRequestSchema = searchOptionsSchema.extend({ query });
export const extractRequestSchema = extractOptionsSchema
  .extend({
    urls: z.array(httpUrl).min(1).max(20),
  })
  .refine((value) => !value.chunksPerSource || !!value.query, {
    message: "chunksPerSource requires query",
    path: ["chunksPerSource"],
  });

// Keep Tavily's native snake_case response contract. Validate the outer edge
// before caching it; retain optional provider metadata for callers.
export const searchResponseSchema = z
  .object({
    query: z.string(),
    answer: z.string().nullable().optional(),
    results: z.array(
      z
        .object({
          title: z.string(),
          url: z.string(),
          content: z.string(),
          score: z.number(),
          raw_content: z.string().nullable().optional(),
          published_date: z.string().optional(),
        })
        .passthrough(),
    ),
    response_time: z.number(),
    request_id: z.string().optional(),
  })
  .passthrough();

export const extractResponseSchema = z
  .object({
    results: z.array(
      z
        .object({
          url: z.string(),
          raw_content: z.string(),
          title: z.string().nullable().optional(),
        })
        .passthrough(),
    ),
    failed_results: z.array(
      z.object({ url: z.string(), error: z.string() }).passthrough(),
    ),
    response_time: z.number(),
    request_id: z.string().optional(),
  })
  .passthrough();

export type SearchOptions = z.infer<typeof searchOptionsSchema>;
export type ExtractOptions = z.infer<typeof extractOptionsSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type ExtractResponse = z.infer<typeof extractResponseSchema>;
