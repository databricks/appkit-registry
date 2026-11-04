import { createHash } from "node:crypto";
import {
  AppKitError,
  defineManifest,
  Plugin,
  toPlugin,
  type BasePluginConfig,
  type IAppRouter,
} from "@databricks/appkit";
import {
  defineTool,
  executeFromRegistry,
  toolsFromRegistry,
  type ToolProvider,
  type ToolRegistry,
  type ToolkitEntry,
  type ToolkitOptions,
} from "@databricks/appkit/beta";
import type { Response } from "express";
import { determineLocale, isSameDialect } from "generaltranslation";
import {
  createApiClient,
  listProjects,
  translate as translateEndpoint,
} from "generaltranslation/api";
import { hashSource } from "generaltranslation/id";
import { defaultBaseUrl } from "generaltranslation/internal";
import { z } from "zod";
import manifest from "./manifest.json";
import {
  translateRequestSchema,
  type TranslateRequest,
  type TranslateResponse,
} from "./schemas";

export interface GeneralTranslationConfig extends BasePluginConfig {
  /** Locale your app's content is written in. Defaults to "en". */
  defaultLocale?: string;
  /** Locales the app supports. Used for locale detection and the client config. */
  locales?: string[];
  /**
   * General Translation project ID. Falls back to GT_PROJECT_ID, then to the
   * project the API key is bound to.
   */
  projectId?: string;
}

const CLIENT_ERROR_MESSAGE = "Translation failed.";

/** A project API key is bound to exactly one project. */
async function resolveProjectId(apiKey: string): Promise<string> {
  const client = createApiClient({ apiKey, baseUrl: defaultBaseUrl });
  const { data } = await listProjects({ client, query: { limit: 2 } });
  if (data?.items.length === 1) return data.items[0].id;
  throw new Error(
    "Could not find the project for GT_API_KEY. Use a project API key, or set GT_PROJECT_ID.",
  );
}

/**
 * Stops waiting when the caller aborts. The shared, cached execution keeps
 * running for other callers and is bounded by AppKit's timeout.
 */
function untilAborted<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export class GeneralTranslationError extends AppKitError {
  readonly code = "GT_ERROR";
  readonly isRetryable: boolean;
  readonly statusCode: 429 | 502;
  constructor(upstreamStatus: number, details: string) {
    super(details, { clientMessage: CLIENT_ERROR_MESSAGE });
    this.statusCode = upstreamStatus === 429 ? 429 : 502;
    this.isRetryable = this.statusCode === 429;
    this.name = "GeneralTranslationError";
  }
}

export class GeneralTranslationPlugin
  extends Plugin<GeneralTranslationConfig>
  implements ToolProvider
{
  static manifest = defineManifest<"gt">(manifest);
  static DEFAULT_CONFIG = {
    timeout: 30_000,
    retry: { enabled: false },
    cache: { enabled: true, ttl: 3600 }, // AppKit TTLs are in seconds.
  };

  private client!: ReturnType<typeof createApiClient>;
  private projectId = "";
  private tools: ToolRegistry;

  constructor(config: GeneralTranslationConfig) {
    super(config);
    this.tools = {
      translate: defineTool({
        description:
          "Translate one or more strings into a target locale (BCP 47 code such as 'es' or 'ja'). Text is sent to General Translation.",
        schema: translateRequestSchema,
        annotations: { effect: "read", requiresUserContext: false },
        execute: (input, signal) => this.translate(input, signal),
      }),
    };
  }

  private get defaultLocale() {
    return this.config.defaultLocale ?? "en";
  }

  private get locales() {
    return this.config.locales ?? [this.defaultLocale];
  }

  async setup() {
    const apiKey = process.env.GT_API_KEY?.trim();
    if (!apiKey) throw new Error("GT_API_KEY is required on the server.");
    const projectId =
      this.config.projectId ??
      (process.env.GT_PROJECT_ID?.trim() || (await resolveProjectId(apiKey)));
    this.projectId = projectId;
    // AppKit's execution signal carries the timeout, so the client sets none.
    this.client = createApiClient({
      apiKey,
      baseUrl: defaultBaseUrl,
      projectId,
      retryPolicy: "none",
      timeoutMs: false,
    });
  }

  /** Picks the best supported locale for an Accept-Language header. */
  detectLocale(acceptLanguage = ""): string {
    const requested = acceptLanguage
      .split(",")
      .map((entry) => {
        const [locale, ...params] = entry.split(";").map((part) => part.trim());
        const q = params.find((param) => param.startsWith("q="));
        return { locale, quality: q ? Number(q.slice(2)) : 1 };
      })
      .filter(({ locale, quality }) => locale && locale !== "*" && quality > 0)
      .sort((a, b) => b.quality - a.quality)
      .map(({ locale }) => locale);
    return determineLocale(requested, this.locales) ?? this.defaultLocale;
  }

  async translate(
    input: TranslateRequest,
    signal?: AbortSignal,
  ): Promise<TranslateResponse> {
    const { texts, targetLocale, context, ...rest } =
      translateRequestSchema.parse(input);
    const sourceLocale = rest.sourceLocale ?? this.defaultLocale;
    if (isSameDialect(sourceLocale, targetLocale))
      return { locale: targetLocale, translations: texts };

    const digest = createHash("sha256")
      .update(JSON.stringify({ texts, targetLocale, sourceLocale, context }))
      .digest("hex");
    const execution = this.execute(
      async (executionSignal) => {
        const metadata = { dataFormat: "STRING" as const, context };
        const hashes = texts.map((source) => hashSource({ source, ...metadata }));
        const { data, error, response } = await translateEndpoint({
          client: this.client,
          body: {
            requests: Object.fromEntries(
              texts.map((source, i) => [hashes[i], { source, metadata }]),
            ),
            targetLocale,
            sourceLocale,
            metadata: {},
          },
          signal: executionSignal,
        });
        if (!data)
          throw new GeneralTranslationError(
            response?.status ?? 502,
            error instanceof Error ? error.message : JSON.stringify(error),
          );
        return {
          locale: targetLocale,
          translations: hashes.map((hash) => {
            const result = data[hash];
            if (!result?.success)
              throw new GeneralTranslationError(
                result?.code ?? 502,
                result?.error ?? "No translation returned",
              );
            return String(result.translation);
          }),
        };
      },
      {
        default: GeneralTranslationPlugin.DEFAULT_CONFIG,
        user: { cache: { cacheKey: ["gt", this.projectId, digest] } },
      },
    );
    const result = await untilAborted(execution, signal);
    if (!result.ok)
      throw new GeneralTranslationError(result.status, result.message);
    return result.data;
  }

  injectRoutes(router: IAppRouter) {
    this.route(router, {
      name: "locale",
      method: "get",
      path: "/locale",
      handler: async (req, res) => {
        res.json({ locale: this.detectLocale(req.get("accept-language")) });
      },
    });
    this.route(router, {
      name: "translate",
      method: "post",
      path: "/translate",
      handler: async (req, res) => {
        if (!this.locales.includes(req.body?.targetLocale)) {
          res.status(400).json({
            error: "Unsupported targetLocale",
            locales: this.locales,
          });
          return;
        }
        try {
          res.json(await this.translate(req.body));
        } catch (error) {
          this.sendError(res, error);
        }
      },
    });
  }

  private sendError(res: Response, error: unknown) {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ error: "Invalid translate request", issues: error.issues });
      return;
    }
    res
      .status(error instanceof GeneralTranslationError ? error.statusCode : 500)
      .json({ error: CLIENT_ERROR_MESSAGE, plugin: this.name });
  }

  getAgentTools() {
    return toolsFromRegistry(this.tools);
  }

  executeAgentTool(name: string, args: unknown, signal?: AbortSignal) {
    return executeFromRegistry(this.tools, name, args, signal);
  }

  toolkit(options: ToolkitOptions = {}): Record<string, ToolkitEntry> {
    return Object.fromEntries(
      this.getAgentTools()
        .filter(
          ({ name }) =>
            (!options.only || options.only.includes(name)) &&
            !options.except?.includes(name),
        )
        .map((def) => {
          const key =
            options.rename?.[def.name] ||
            `${options.prefix ?? `${this.name}.`}${def.name}`;
          return [
            key,
            {
              __toolkitRef: true as const,
              pluginName: this.name,
              localName: def.name,
              def: { ...def, name: key },
              annotations: def.annotations,
            },
          ];
        }),
    );
  }

  clientConfig() {
    return { defaultLocale: this.defaultLocale, locales: this.locales };
  }

  exports() {
    return {
      translate: this.translate,
      detectLocale: this.detectLocale,
      toolkit: this.toolkit,
    };
  }
}

export const generalTranslation = toPlugin(GeneralTranslationPlugin);
