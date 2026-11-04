# General Translation

Locale detection and AI translation for AppKit apps and agents, powered by [General Translation](https://generaltranslation.com).

## Setup

1. Create a project and API key at [generaltranslation.com](https://generaltranslation.com).
2. Set `GT_API_KEY` (bound from a Databricks secret) and `GT_PROJECT_ID` on the server.
3. Register the plugin:

```ts
import { createApp } from "@databricks/appkit";
import { generalTranslation } from "./plugins/general-translation";

const app = await createApp({
  plugins: [
    generalTranslation({ defaultLocale: "en", locales: ["en", "es", "fr", "ja"] }),
  ],
});
```

## Server API

```ts
await app.gt.translate({
  texts: ["Revenue by region", "Last updated"],
  targetLocale: "es",
  context: "Dashboard labels",
});
// → { locale: "es", translations: ["Ingresos por región", "Última actualización"] }

app.gt.detectLocale("fr-CA,fr;q=0.9,en;q=0.8"); // → "fr"
```

Translations are cached per input (1 hour by default) through AppKit's execution interceptors, so repeated strings don't cost extra calls.

## Routes

| Route                    | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| `GET /api/gt/locale`     | Best supported locale for the request's `Accept-Language`, plus `locales` and `defaultLocale`. |
| `POST /api/gt/translate` | Body: `{ texts, targetLocale, sourceLocale?, context? }`.            |

## Agents

The plugin exposes a `translate` tool. Add it to an agent with `tools: [plugin:gt]`, or `app.gt.toolkit()` in code.

## Config

| Option          | Default            | Description                                      |
| --------------- | ------------------ | ------------------------------------------------ |
| `defaultLocale` | `"en"`             | Locale your source content is written in.        |
| `locales`       | `[defaultLocale]`  | Locales the app supports.                        |
| `projectId`     | `GT_PROJECT_ID`    | General Translation project ID.                  |

For translating your app's UI strings at build time, use [`gt-react`](https://generaltranslation.com/docs/react) alongside this plugin. The `locale-selector` registry block gives you a ready-made language picker.
