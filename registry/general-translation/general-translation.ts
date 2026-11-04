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
import { determineLocale, GT, isSameDialect } from "generaltranslation";
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
  /** General Translation project ID. Falls back to GT_PROJECT_ID. */
  projectId?: string;
}

const CLIENT_ERROR_MESSAGE = "Translation failed.";

export class GeneralTranslationError extends AppKitError {
  readonly code = "GT_ERROR";
  readonly isRetryable: boolean;
  constructor(
    public readonly statusCode: 429 | 502,
    details: string,
  ) {
    super(details, { clientMessage: CLIENT_ERROR_MESSAGE });
    this.isRetryable = statusCode === 429;
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

  private gt!: GT;
  private projectId = "";
  private tools: ToolRegistry;

  constructor(config: GeneralTranslationConfig) {
    super(config);
    this.config = { ...GeneralTranslationPlugin.DEFAULT_CONFIG, ...config };
    this.tools = {
      translate: defineTool({
        description:
          "Translate one or more strings into a target locale (BCP 47 code such as 'es' or 'ja'). Text is sent to General Translation.",
        schema: translateRequestSchema,
        annotations: { effect: "read", requiresUserContext: false },
        execute: (input) => this.translate(input),
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
    const projectId = this.config.projectId ?? process.env.GT_PROJECT_ID?.trim();
    if (!projectId)
      throw new Error(
        "Set GT_PROJECT_ID or pass projectId to the General Translation plugin.",
      );
    this.projectId = projectId;
    this.gt = new GT({ apiKey, projectId, sourceLocale: this.defaultLocale });
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

  async translate(input: TranslateRequest): Promise<TranslateResponse> {
    const { texts, targetLocale, sourceLocale, context } =
      translateRequestSchema.parse(input);
    if (isSameDialect(sourceLocale ?? this.defaultLocale, targetLocale))
      return { locale: targetLocale, translations: texts };

    const digest = createHash("sha256")
      .update(JSON.stringify({ texts, targetLocale, sourceLocale, context }))
      .digest("hex");
    const result = await this.execute(
      async () => {
        const results = await this.gt.translateMany(
          texts.map((source) => ({
            source,
            metadata: { dataFormat: "STRING" as const, context },
          })),
          { targetLocale, sourceLocale },
        );
        return {
          locale: targetLocale,
          translations: results.map((result) => {
            if (!result.success)
              throw new GeneralTranslationError(
                result.code === 429 ? 429 : 502,
                result.error,
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
    if (!result.ok)
      throw new GeneralTranslationError(
        result.status === 429 ? 429 : 502,
        result.message,
      );
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
            options.rename?.[def.name] || `${options.prefix ?? "gt."}${def.name}`;
          return [
            key,
            {
              __toolkitRef: true as const,
              pluginName: "gt",
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
