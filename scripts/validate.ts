#!/usr/bin/env tsx
/**
 * Validates registry.json before `shadcn build`:
 *  - registry.json parses and has the expected shape
 *  - item names are unique and kebab-case
 *  - every referenced file exists on disk
 *  - components depending on AppKit pin a minimum @databricks/appkit-ui version
 *
 * Run: pnpm validate
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface RegistryFile {
  path: string;
  type: string;
  target?: string;
}
interface RegistryItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
}
interface Registry {
  name: string;
  items: RegistryItem[];
}

const errors: string[] = [];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function fail(msg: string) {
  errors.push(msg);
}

const raw = readFileSync(join(ROOT, "registry.json"), "utf-8");
let registry: Registry;
try {
  registry = JSON.parse(raw);
} catch (e) {
  console.error("registry.json is not valid JSON:", (e as Error).message);
  process.exit(1);
}

if (!Array.isArray(registry.items) || registry.items.length === 0) {
  fail("registry.json has no items");
}

const seen = new Set<string>();
for (const item of registry.items ?? []) {
  const id = item.name ?? "<unnamed>";

  if (!item.name) fail(`item is missing "name"`);
  else if (!KEBAB.test(item.name)) fail(`"${id}": name must be kebab-case`);

  if (seen.has(item.name)) fail(`duplicate item name "${item.name}"`);
  seen.add(item.name);

  if (!item.type?.startsWith("registry:")) {
    fail(`"${id}": type must start with "registry:" (got "${item.type}")`);
  }
  if (!item.description) fail(`"${id}": missing "description"`);

  if (!item.files?.length) {
    fail(`"${id}": must declare at least one file`);
  }
  for (const file of item.files ?? []) {
    if (!existsSync(join(ROOT, file.path))) {
      fail(`"${id}": file does not exist: ${file.path}`);
    }
  }

  // Option A: registry components depend on the appkit-ui npm package and must
  // pin a minimum version so they don't silently break older consumers.
  const appkitDep = item.dependencies?.find((d) =>
    d.startsWith("@databricks/appkit-ui"),
  );
  if (appkitDep && !/@databricks\/appkit-ui@|>=|\^|~/.test(appkitDep)) {
    // Bare "@databricks/appkit-ui" with no version constraint.
    // shadcn stores the version in the dependency string, e.g.
    // "@databricks/appkit-ui@^0.41.0". Warn so contributors pin it.
    console.warn(
      `  ⚠ "${id}": @databricks/appkit-ui has no version constraint — consider pinning a minimum.`,
    );
  }
}

if (errors.length) {
  console.error(`\n✘ registry validation failed (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ registry "${registry.name}" valid — ${registry.items.length} item(s)`);
