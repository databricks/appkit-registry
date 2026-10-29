import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), 'designer-registry-install-'));
try {
  const item = JSON.parse(await readFile(join(root, 'public/r/designer.json'), 'utf8'));
  const dependencies = Object.fromEntries(
    item.dependencies.map((entry: string) => {
      const at = entry.lastIndexOf('@');
      return [entry.slice(0, at), entry.slice(at + 1)];
    })
  );
  await writeFile(join(fixture, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies }));
  await symlink(join(root, 'node_modules'), join(fixture, 'node_modules'));
  await mkdir(join(fixture, 'server'));
  await writeFile(
    join(fixture, 'server/server.ts'),
    "import { createApp, server } from '@databricks/appkit';\nawait createApp({ plugins: [server()] });\n"
  );
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      join(root, 'scripts/registry-fixture.mjs'),
      join(root, 'node_modules/@databricks/appkit/bin/appkit.js'),
      'add',
      'designer',
      '--yes',
      '--no-resources',
      '--allow-unverified',
    ],
    {
      cwd: fixture,
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, APPKIT_REGISTRY_TOKEN: 'registry-fixture-only' },
    }
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  for (const file of item.files) {
    assert.equal(await readFile(join(fixture, 'server', file.target), 'utf8'), file.content, file.target);
  }
  const server = await readFile(join(fixture, 'server/server.ts'), 'utf8');
  assert.match(server, /import\s*\{\s*designer\s*\}\s*from\s*['"]\.\/plugins\/designer['"]/);
  assert.match(server, /plugins:\s*\[designer\(\),\s*server\(\)\]/);
  assert.equal((server.match(/createApp\(/g) ?? []).length, 1);
  console.log(`Installed ${item.files.length} Designer files and registered designer() with the released CLI.`);
} finally {
  await rm(fixture, { recursive: true, force: true });
}
