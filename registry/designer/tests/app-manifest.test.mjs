import assert from 'node:assert/strict';
import { test } from 'vitest';
import { appManifestSchema } from '../client.ts';

const parseAppManifest = (raw) => appManifestSchema.safeParse(raw).data;

const storage = {
  volume: 'main.default.designer_app1',
  path: '/Volumes/main/default/designer_app1/designer_apps/app1',
  maxUploadFileSizeBytes: 5 * 1024 * 1024 * 1024,
};

const fileParameter = { name: 'path', type: 'file', label: 'Data', defaultValue: '/Volumes/private/author.csv' };

const manifest = {
  version: 8,
  appName: 'Uploads',
  storage,
  parameters: [fileParameter],
  blocks: [{ type: 'output', id: 'data', nodeId: 'source', port: 'data', label: 'Data' }],
};

test('file-output manifest scopes are explicit without requiring upload storage', () => {
  const fileManifest = {
    ...manifest,
    storage: undefined,
    parameters: [],
    blocks: [{ ...manifest.blocks[0], fileOutput: { volumes: ['main.default.files', 'main.default.other'] } }],
  };
  const parsed = parseAppManifest(fileManifest);
  assert.deepEqual(parsed.blocks[0].fileOutput, fileManifest.blocks[0].fileOutput);
  assert.equal(parsed.storage, undefined);
  for (const fileOutput of [null, {}, { volumes: [] }, { volumes: ['bad'] }, { volumes: ['main.default.files/..'] }]) {
    assert.equal(parseAppManifest({ ...fileManifest, blocks: [{ ...fileManifest.blocks[0], fileOutput }] }), undefined);
  }
});

test('malformed file-output identities cannot silently downgrade an App to preview-only behavior', () => {
  const preview = manifest.blocks[0];
  const file = {
    type: 'output',
    id: 'file',
    nodeId: 'output_0',
    port: 'result',
    fileOutput: { volumes: ['main.apps.files'] },
  };
  for (const blocks of [
    [preview, { ...file, id: undefined }],
    [preview, { ...file, id: '' }],
    [preview, { ...file, id: ' ' }],
    [preview, { ...file, nodeId: undefined }],
    [preview, { ...file, nodeId: '' }],
    [preview, { ...file, id: preview.id }],
    [{ ...file, id: preview.id }, preview],
    [preview, file, file],
    [preview, { ...file, type: 'markdown', text: 'Not a file output' }],
  ]) {
    assert.equal(parseAppManifest({ ...manifest, storage: undefined, parameters: [], blocks }), undefined);
  }
  const ordinary = parseAppManifest({
    ...manifest,
    storage: undefined,
    parameters: [],
    blocks: [preview, { ...preview, id: '' }, preview],
  });
  assert.equal(ordinary.blocks.length, 1);
});

test('preserves file format constraints through the browser manifest and rejects malformed metadata', () => {
  const configured = { ...manifest, parameters: [{ ...fileParameter, fileFormats: ['excel'] }] };
  assert.deepEqual(parseAppManifest(configured).parameters[0].fileFormats, ['excel']);
  for (const invalid of ['excel', null, [1], [''], ['EXCEL']]) {
    assert.equal(
      parseAppManifest({ ...manifest, parameters: [{ ...fileParameter, fileFormats: invalid }] }),
      undefined
    );
  }
});

const ENVIRONMENT_BLOCKS = [{ type: 'output', id: 'prod', label: 'Prod Output', nodeId: 'prod', port: 'data' }];
const HTML_BLOCK = { type: 'output', id: 'page', nodeId: 'html_1', kind: 'html', label: 'Report' };

test('optional execution metadata preserves valid fields and ignores malformed values', () => {
  const base = { version: 8, appName: 'Branch outputs', blocks: ENVIRONMENT_BLOCKS, parameters: [] };
  for (const disabled of [true, false]) {
    const parsed = parseAppManifest({
      ...base,
      blocks: [{ ...ENVIRONMENT_BLOCKS[0], disabled, parentGroupId: 'group_prod' }],
    });
    assert.equal(parsed.blocks[0].disabled, disabled);
    assert.equal(parsed.blocks[0].parentGroupId, 'group_prod');
  }
  for (const disabled of [undefined, null, 'true', 'false', 0, 1, {}, []]) {
    const parsed = parseAppManifest({ ...base, blocks: [{ ...ENVIRONMENT_BLOCKS[0], disabled }] });
    assert.deepEqual(parsed.blocks, [ENVIRONMENT_BLOCKS[0]]);
  }
  for (const parentGroupId of [undefined, null, '', true, false, 0, 1, {}, []]) {
    const parsed = parseAppManifest({ ...base, blocks: [{ ...ENVIRONMENT_BLOCKS[0], parentGroupId }] });
    assert.deepEqual(parsed.blocks, [ENVIRONMENT_BLOCKS[0]]);
  }
});

test('manifest retains HTML without a port and discards contradictory output declarations', () => {
  const manifest = parseAppManifest({
    version: 8,
    appName: 'HTML app',
    parameters: [],
    blocks: [
      HTML_BLOCK,
      { ...HTML_BLOCK, id: 'bad', port: 'data' },
      { type: 'output', id: 'no-port', nodeId: 'source' },
    ],
  });
  assert.equal(manifest.blocks.length, 1);
  assert.equal(manifest.blocks[0].kind, 'html');
  assert.equal(manifest.blocks[0].port, undefined);
});
