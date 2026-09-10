# Contributing a component

Registry components are **source you hand to other people's codebases**. Keep them
self-contained, dependency-light, and built on `@databricks/appkit-ui` primitives.

## Developer Certificate of Origin

To contribute to this repository, you must sign off your commits to certify
that you have the right to contribute the code and that it complies with the
open source license. The rules are pretty simple, if you can certify the
content of [DCO](./DCO), then simply add a "Signed-off-by" line to your
commit message to certify your compliance. Please use your real name as
pseudonymous/anonymous contributions are not accepted.

```
Signed-off-by: Joe Smith <joe.smith@email.com>
```

If you set your `user.name` and `user.email` git configs, you can sign your
commit automatically with `git commit -s`:

```
git commit -s -m "Your commit message"
```

## Rules

1. **Compose, don't redefine.** Import primitives (`Button`, `Card`, `cn`, …) from
   `@databricks/appkit-ui/react`. Never copy shadcn primitive source into a registry item.
2. **Declare every dependency.** Anything you import from npm goes in the item's `dependencies`.
   Pin a minimum AppKit version, e.g. `"@databricks/appkit-ui@^0.41.0"`.
3. **Self-contained folder.** One folder per component under `registry/<name>/`. Co-locate hooks,
   types, and a `README.md` with usage + props.
4. **No app-specific coupling.** No hardcoded routes, env vars, or server endpoints. Take data via
   props / callbacks.
5. **Theme via the consumer.** Don't ship colors; rely on AppKit CSS tokens
   (`text-muted-foreground`, `bg-background`, …). The consumer imports `styles.css`.

## Steps

1. Create `registry/<name>/<name>.tsx` (+ optional `use-*.ts`, `types.ts`, `README.md`).
2. Add an entry to `registry.json`:
   ```jsonc
   {
     "name": "<name>",
     "type": "registry:block",
     "title": "Human Title",
     "description": "One sentence on what it does and what it composes.",
     // Keywords for `appkit registry search` — add the terms people (and agents)
     // would search for: domain, UI pattern, synonyms.
     "categories": ["dashboard", "kpi", "chart"],
     "dependencies": ["@databricks/appkit-ui@^0.41.0", "lucide-react"],
     "files": [
       {
         "path": "registry/<name>/<name>.tsx",
         "type": "registry:component",
         "target": "components/appkit/<name>.tsx"
       }
     ]
   }
   ```
   A clear `description` + good `categories` are what make an item discoverable via
   `appkit registry search` — treat them as part of the contract, not an afterthought.
3. Run `pnpm check` (validate + build).
4. Open a PR. CI validates the manifest, builds the registry, and type-checks your component
   against a fixture app with `@databricks/appkit-ui` installed.

## Verified items

Items reviewed and maintained by the AppKit team are marked verified:

```jsonc
{ "name": "metric-card", "meta": { "verified": true }, /* ... */ }
```

`appkit registry list` shows a ✓ for verified items (and `--verified` filters to
them). **Do not set `verified` in a community PR** — a maintainer adds it on
review. Community items ship unverified by default.

## Item `type` cheat sheet

| `type`                | Use for                                          |
| --------------------- | ------------------------------------------------ |
| `registry:block`      | A composed, multi-element component (most items) |
| `registry:component`  | A single component file                          |
| `registry:hook`       | A standalone React hook                          |
| `registry:lib`        | A utility module                                 |
| `registry:theme`      | Color tokens / theme overrides                   |
