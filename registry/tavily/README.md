# Tavily — AppKit server plugin

Public web **search** and page **extraction**, with typed server methods, validated HTTP routes, and agent tools.

## Install in an AppKit app

```bash
appkit add tavily
```

Set `TAVILY_API_KEY` in the server environment, then register the plugin:

```ts
import { createApp, server } from "@databricks/appkit";
import { tavily } from "./plugins/tavily";

const app = await createApp({
  plugins: [
    server({ port: 8000 }),
    tavily({
      search: { maxResults: 5, searchDepth: "basic" },
      cache: { enabled: true, ttl: 300 }, // seconds
      timeout: 30_000, // milliseconds
    }),
  ],
});

const results = await app.tavily.search(
  "Recent developments in Databricks Apps",
  {
    timeRange: "month",
  },
);
const pages = await app.tavily.extract(["https://docs.tavily.com/"], {
  format: "markdown",
});
```

### Databricks secret binding

Create a secret containing your Tavily API key, then bind it as an app resource named **`tavily-api-key`**, with `READ` permission. In your app's `databricks.yml`, the resource entry under `resources.apps.<app-name>.resources` is:

```yaml
- name: tavily-api-key
  secret:
    scope: your-secret-scope
    key: your-secret-key-name
    permission: READ
```

In `app.yaml`:

```yaml
env:
  - name: TAVILY_API_KEY
    valueFrom: tavily-api-key
```

## HTTP API

Both routes accept flat JSON bodies and return Tavily's native **snake_case** response fields (e.g. `response_time`, `raw_content`, `failed_results`).

```http
POST /api/tavily/search
Content-Type: application/json

{"query":"Databricks Apps","maxResults":5,"searchDepth":"basic","includeAnswer":true}
```

[Search](https://docs.tavily.com/documentation/api-reference/endpoint/search) options: `searchDepth` (`basic`, `advanced`, `fast`, `ultra-fast`), `topic` (`general`, `news`, `finance`), `maxResults` (1–20), `timeRange` (`day`, `week`, `month`, `year`), `includeDomains`, `excludeDomains`, `includeAnswer`, `includeRawContent` (`false`, `markdown`, `text`). Queries must be nonblank.

```http
POST /api/tavily/extract
Content-Type: application/json

{"urls":["https://docs.tavily.com/"],"extractDepth":"basic","format":"markdown"}
```

[Extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract) options: `extractDepth` (`basic`, `advanced`), `format` (`markdown`, `text`), optional `query` and `chunksPerSource` (1–5, requires `query`). Accepts 1–20 HTTP(S) URLs. Partial successes return both `results` and `failed_results`.

## Agents

The plugin implements AppKit's `ToolProvider` contract. For markdown agents:

```yaml
tools:
  - plugin:tavily
```

For code-defined agents:

```ts
tools: (plugins) => ({
  ...plugins.tavily.toolkit({ only: ["search", "extract"] }),
});
```

## Execution and security

- All Tavily calls run through `Plugin.execute()` for AppKit caching, timeouts, telemetry, and optional retries.
- Native `fetch` is intentional: it propagates abort signals to the HTTP transport. No extra SDK or retry layer is needed. The only upstream origin is `https://api.tavily.com`.
- Cache TTL defaults to 300 **seconds**, with operation, normalized inputs, credential fingerprint and AppKit executor identity in the cache key. Queries, URLs and raw keys are not embedded in cache keys. Defaults are overridable; domain defaults are not a security allowlist.
- Calls with an explicit `AbortSignal` bypass the shared cache so cancelling one agent cannot cancel another caller's cached work.
- Retries are off by default to avoid surprise duplicate charges. Opt in with `retry: { enabled: true, attempts: 2, initialDelay: 1000 }`. Authentication/validation/credit errors do not retry; transient connection/5xx and 429 failures can retry. A retry may still consume credits.
- Provider error bodies are never logged or returned. Invalid inputs return 400, rate limits 429, network/provider failures 502, and timeouts use AppKit's timeout status. Failed requests are not cached.
- Queries and URLs leave your workspace for Tavily; do not send sensitive internal information without authorization. Treat returned web content as **untrusted data**, not agent instructions.

## Development checks

From the registry root:

```bash
pnpm check          # registry validation and build
```
