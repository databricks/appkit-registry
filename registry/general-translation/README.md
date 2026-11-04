# General Translation

Locale detection and AI translation for AppKit apps and agents, powered by [General Translation](https://generaltranslation.com).

## Setup

1. Create a project at [generaltranslation.com](https://generaltranslation.com).
2. Create an API key and store it as a Databricks secret. With the [GT CLI](https://www.npmjs.com/package/gt), the key goes straight into the secret without being shown:

   ```bash
   npx gt login
   npx gt api-key create --project-id <your-project-id> --name "Databricks app" --permission project:translations:generate | databricks secrets put-secret gt api-key
   ```

   Or create the key in the dashboard and run `databricks secrets put-secret gt api-key` to paste it. For local development, set `GT_API_KEY` in `.env`.

3. Bind the secret to the app's `apiKey` resource. The plugin finds the project from the key, so no project ID is needed.
4. Register the plugin:

```ts
import { createApp } from '@databricks/appkit';
import { generalTranslation } from './plugins/general-translation';

const app = await createApp({
  plugins: [
    generalTranslation({
      defaultLocale: 'en',
      locales: ['en', 'es', 'fr', 'ja'],
    }),
  ],
});
```

## Server API

```ts
await app.gt.translate({
  texts: ['Revenue by region', 'Last updated'],
  targetLocale: 'es',
  context: 'Dashboard labels',
});
// → { locale: "es", translations: ["Ingresos por región", "Última actualización"] }

app.gt.detectLocale('fr-CA,fr;q=0.9,en;q=0.8'); // → "fr"
```

Translations are cached per input (1 hour by default) through AppKit's execution interceptors, so repeated strings don't cost extra calls.

## Routes

| Route                    | Description                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `GET /api/gt/locale`     | Best supported locale for the request's `Accept-Language`, plus `locales` and `defaultLocale`. |
| `POST /api/gt/translate` | Body: `{ texts, targetLocale, sourceLocale?, context? }`.                                      |

## Agents

The plugin exposes a `translate` tool. Add it to an agent with `tools: [plugin:gt]`, or `app.gt.toolkit()` in code.

## Config

| Option          | Default           | Description                               |
| --------------- | ----------------- | ----------------------------------------- |
| `defaultLocale` | `"en"`            | Locale your source content is written in. |
| `locales`       | `[defaultLocale]` | Locales the app supports.                 |
| `projectId`     | `GT_PROJECT_ID`   | General Translation project ID. If unset, the plugin uses the API key's project.           |

For translating your app's UI strings at build time, use [`gt-react`](https://generaltranslation.com/docs/react) alongside this plugin. The `locale-selector` registry block gives you a ready-made language picker.
