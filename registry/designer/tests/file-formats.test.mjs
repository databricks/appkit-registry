import assert from 'node:assert/strict';
import { test } from 'vitest';
import * as fileFormats from '../client.ts';

test('validates supported extensions case-insensitively without inferring formats', () => {
  assert.equal(fileFormats.uploadAccept(['excel']), '.xls,.xlsx');
  for (const [format, filename] of [
    ['excel', 'DATA.XLSX'],
    ['excel', 'legacy.xls'],
    ['csv', 'data.tsv'],
    ['csv', 'data.CSV.GZ'],
    ['json', 'data.jsonl'],
    ['json', 'data.ndjson.bz2'],
    ['parquet', 'part.parquet'],
    ['avro', 'part.avro'],
    ['orc', 'part.orc'],
    ['xml', 'data.xml'],
    ['pdf', 'data.pdf'],
  ])
    assert.equal(fileFormats.validateFileFormat(filename, [format]), undefined);
  for (const filename of ['data.csv', 'data.xlsx.csv', 'data', 'data.xlsx.gz'])
    assert.match(fileFormats.validateFileFormat(filename, ['excel']), /expects Excel/);
  assert.match(fileFormats.validateFileFormat('data.xlsx', ['csv']), /expects CSV/);
  for (const formats of [undefined, [], ['text'], ['binaryfile'], ['custom.provider'], ['constructor']]) {
    assert.equal(fileFormats.validateFileFormat('no-extension', formats), undefined);
    assert.equal(fileFormats.uploadAccept(formats), undefined);
  }
  assert.match(fileFormats.validateFileFormat('data.csv', ['csv', 'excel']), /expects Excel/);
  assert.equal(fileFormats.uploadAccept(['csv', 'text']), fileFormats.uploadAccept(['csv']));
  assert.equal(fileFormats.uploadAccept(['csv', 'excel']), undefined);
});
