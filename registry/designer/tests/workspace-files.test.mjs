import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createWorkspaceClient } from '@databricks/appkit';
import { test } from 'vitest';
import { createUploadStore } from '../server/uploadStore';
import { createOutputFileStore } from '../server/outputFileStore';

async function workspace(t) {
  const config = {
    volume: 'main.apps.files',
    path: '/Volumes/main/apps/files/designer_apps/test',
    maxUploadFileSizeBytes: 1024 * 1024,
  };
  const files = new Map();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://workspace.test');
    const path = decodeURIComponent(url.pathname.slice('/api/2.0/fs/files'.length));
    assert.equal(req.headers.authorization, 'Bearer test-only');
    if (req.method === 'PUT') {
      if (files.has(path)) {
        res.writeHead(409, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error_code: 'ALREADY_EXISTS', message: 'Immutable' }));
        return;
      }
      assert.equal(url.searchParams.get('overwrite'), 'false');
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      assert.equal(Number(req.headers['content-length']), bytes.length);
      files.set(path, bytes);
      res.writeHead(204).end();
      return;
    }
    if (path.endsWith('forbidden.csv') || !files.has(path)) {
      const forbidden = path.endsWith('forbidden.csv');
      res.writeHead(forbidden ? 403 : 404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error_code: forbidden ? 'PERMISSION_DENIED' : 'NOT_FOUND', message: 'Unavailable' }));
      return;
    }
    const bytes = files.get(path);
    if (!path.endsWith('unknown-size.csv')) res.setHeader('content-length', bytes.length);
    if (req.method === 'HEAD') res.end();
    else res.end(bytes);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.onTestFinished(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const client = createWorkspaceClient({ host: `http://127.0.0.1:${server.address().port}`, token: 'test-only' });
  return {
    config,
    files,
    uploads: createUploadStore(client, config),
    outputs: createOutputFileStore(client, config.volume),
  };
}

test('raw metadata and typed downloads preserve missing-file errors without hiding permission failures', async (t) => {
  const { config, uploads, outputs } = await workspace(t);
  const path = `${config.path}/uploads/owner/missing.csv`;
  assert.equal(await outputs.size(path), undefined);
  await assert.rejects(uploads.size(path), { status: 404, code: 'UPLOAD_UNAVAILABLE' });
  await assert.rejects(uploads.download(path), { status: 404, code: 'UPLOAD_UNAVAILABLE' });
  await assert.rejects(uploads.download(`${config.path}/uploads/owner/forbidden.csv`), { status: 502 });
  await assert.rejects(outputs.size(`${config.path}/forbidden.csv`));
});

test('Files transport preserves encoded filenames, immutable record bytes, and unknown sizes', async (t) => {
  const { config, files, uploads, outputs } = await workspace(t);
  const path = `${config.path}/uploads/owner/data #1?100% 日本.csv`;
  const value = { filename: '日本.csv' };
  const bytes = Buffer.from(JSON.stringify(value));
  await uploads.put(path, bytes);
  assert.deepEqual(files.get(path), bytes);
  assert.equal(await outputs.size(path), bytes.length);
  assert.deepEqual(await uploads.read(path), value);
  await assert.rejects(uploads.put(path, Buffer.from('overwrite')), { status: 502 });
  assert.deepEqual(Buffer.from(await new Response(await uploads.download(path)).arrayBuffer()), bytes);
  const unknown = `${config.path}/unknown-size.csv`;
  files.set(unknown, Buffer.from('data'));
  assert.equal(await outputs.size(unknown), undefined);
});

test('completion records enforce the 16 KiB byte limit through the real Files transport', async (t) => {
  const { config, files, uploads } = await workspace(t);
  const path = `${config.path}/uploads/owner/completion.json`;
  const exact = JSON.stringify('x'.repeat(16 * 1024 - 2));
  files.set(path, Buffer.from(exact));
  assert.equal(await uploads.read(path), 'x'.repeat(16 * 1024 - 2));
  files.set(path, Buffer.from(JSON.stringify('é'.repeat(10_000))));
  await assert.rejects(uploads.read(path), { status: 502 });
});
