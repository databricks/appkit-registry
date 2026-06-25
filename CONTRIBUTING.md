# Contributing a component

Registry components are **source you hand to other people's codebases**. Keep them
self-contained, dependency-light, and built on `@databricks/appkit-ui` primitives.

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
3. Run `pnpm check` (validate + build).
4. Open a PR. CI validates the manifest, builds the registry, and type-checks your component
   against a fixture app with `@databricks/appkit-ui` installed.

## Item `type` cheat sheet

| `type`                | Use for                                          |
| --------------------- | ------------------------------------------------ |
| `registry:block`      | A composed, multi-element component (most items) |
| `registry:component`  | A single component file                          |
| `registry:hook`       | A standalone React hook                          |
| `registry:lib`        | A utility module                                 |
| `registry:theme`      | Color tokens / theme overrides                   |
