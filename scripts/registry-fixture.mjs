// Test-only fetch fixture for exercising the released CLI before the registry item lands.
import { readFileSync } from 'node:fs';

const registryRoot = new URL('../', import.meta.url);
const fixtures = new Map([
  ['https://api.github.com/repos/databricks/appkit-registry/contents/registry.json?ref=main', 'registry.json'],
  [
    'https://api.github.com/repos/databricks/appkit-registry/contents/public/r/designer.json?ref=main',
    'public/r/designer.json',
  ],
  ['https://raw.githubusercontent.com/databricks/appkit-registry/main/registry.json', 'registry.json'],
  [
    'https://raw.githubusercontent.com/databricks/appkit-registry/main/public/r/designer.json',
    'public/r/designer.json',
  ],
]);
const fetchRemote = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const fixture = fixtures.get(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (fixture)
    return Promise.resolve(
      new Response(readFileSync(new URL(fixture, registryRoot)), {
        headers: { 'content-type': 'application/json' },
      })
    );
  return fetchRemote(input, init);
};
