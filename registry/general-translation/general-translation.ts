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
import { determineLocale, GT } from "generaltranslation";
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

export class GeneralTranslationError extends AppKitError {
  readonly code = "GT_ERROR";
  readonly isRetryable: boolean;
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message, { clientMessage: message });
    this.isRetryable = statusCode === 429 || statusCode >= 500;
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
  private credentialScope = "";
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
    const projectId = this.config.projectId ?? process.env.GT_PROJECT_ID;
    if (!projectId)
      throw new Error(
        "Set GT_PROJECT_ID or pass projectId to the General Translation plugin.",
      );
    this.gt = new GT({
      apiKey,
      projectId,
      sourceLocale: this.defaultLocale,
    });
    this.credentialScope = createHash("sha256")
      .update(`${projectId}:${apiKey}`)
      .digest("hex");
  }

  /** Picks the best supported locale for an Accept-Language header. */
  detectLocale(acceptLanguage?: string): string {
    const requested = (acceptLanguage ?? "")
      .split(",")
      .map((part) => part.split(";")[0].trim())
      .filter(Boolean);
    return determineLocale(requested, this.locales) ?? this.defaultLocale;
  }

  async translate(input: TranslateRequest): Promise<TranslateResponse> {
    if (!this.gt)
      throw new Error("General Translation plugin is not initialized.");
    const { texts, targetLocale, sourceLocale, context } =
      translateRequestSchema.parse(input);
    if ((sourceLocale ?? this.defaultLocale) === targetLocale)
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
          GeneralTranslationPlugin.DEFAULT_CONFIG.timeout,
        );
        return {
          locale: targetLocale,
          translations: results.map((result) => {
            if (!result.success)
              throw new GeneralTranslationError(
                `Translation failed: ${result.error}`,
                result.code >= 400 && result.code < 600 ? result.code : 502,
              );
            return String(result.translation);
          }),
        };
      },
      {
        default: GeneralTranslationPlugin.DEFAULT_CONFIG,
        user: {
          cache: { cacheKey: ["gt", this.credentialScope, digest] },
        },
      },
    );
    if (!result.ok)
      throw new GeneralTranslationError(result.message, result.status);
    return result.data;
  }

  injectRoutes(router: IAppRouter) {
    this.route(router, {
      name: "locale",
      method: "get",
      path: "/locale",
      handler: async (req, res) => {
        res.json({
          locale: this.detectLocale(req.get("accept-language")),
          defaultLocale: this.defaultLocale,
          locales: this.locales,
        });
      },
    });
    this.route(router, {
      name: "translate",
      method: "post",
      path: "/translate",
      handler: async (req, res) => {
        const input = translateRequestSchema.safeParse(req.body);
        if (!input.success) {
          res.status(400).json({
            error: "Invalid translate request",
            issues: input.error.issues,
          });
          return;
        }
        try {
          res.json(await this.translate(input.data));
        } catch (error) {
          this.sendError(res, error);
        }
      },
    });
  }

  private sendError(res: import("express").Response, error: unknown) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid options", issues: error.issues });
      return;
    }
    res
      .status(error instanceof GeneralTranslationError ? error.statusCode : 500)
      .json({
        error:
          error instanceof GeneralTranslationError
            ? error.message
            : "Translation request failed.",
        plugin: this.name,
      });
  }

  getAgentTools() {
    return toolsFromRegistry(this.tools);
  }

  executeAgentTool(name: string, args: unknown, signal?: AbortSignal) {
    if (!Object.hasOwn(this.tools, name))
      return Promise.reject(new Error(`Unknown General Translation tool: ${name}`));
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
