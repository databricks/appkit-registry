import { AppKitError } from "@databricks/appkit";
import type { z } from "zod";

export class TavilyError extends AppKitError {
  readonly code = "TAVILY_ERROR";
  readonly isRetryable: boolean;
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message, { clientMessage: message });
    this.isRetryable = statusCode === 429 || statusCode === 502;
    this.name = "TavilyError";
  }
}

export class TavilyClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = globalThis.fetch,
  ) { }

  async request<T>(
    operation: "search" | "extract",
    body: Record<string, unknown>,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      signal?.throwIfAborted();
      response = await this.fetcher(`https://api.tavily.com/${operation}`, {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-Client-Name": "databricks-appkit"
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      throw new TavilyError(
        signal?.aborted
          ? "Tavily request cancelled or timed out."
          : "Could not reach Tavily.",
        signal?.aborted ? 504 : 502,
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      const status = response.status;
      const message =
        status === 401 || status === 403
          ? "Tavily authentication failed. Check the server's TAVILY_API_KEY."
          : status === 429
            ? "Tavily rate limit reached. Try again later."
            : status === 432 || status === 433
              ? "Tavily credit limit reached. Check your account."
              : `Tavily request failed (HTTP ${status}).`;
      throw new TavilyError(
        message,
        status === 429 ? 429 : status >= 500 ? 502 : 400,
      );
    }
    try {
      const parsed = schema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Unexpected response shape");
      return parsed.data;
    } catch {
      throw new TavilyError(
        signal?.aborted
          ? "Tavily request cancelled or timed out."
          : "Tavily returned an invalid response.",
        signal?.aborted ? 504 : 502,
      );
    }
  }
}

export function toWire(
  options: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(options)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        value,
      ]),
  );
}
