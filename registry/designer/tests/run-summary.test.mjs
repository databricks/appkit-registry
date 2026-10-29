import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseActiveRun, parseLastRunSummary, parseRunHistoryEntry, parseRunSnapshot } from '../client.ts';

test('last-run, history, and active responses retain their own metadata and int64 IDs', () => {
  const run = {
    jobRunId: '9223372036854775807',
    taskRunId: '9223372036854775806',
    startTime: 100,
    endTime: 200,
    setupDurationMs: 10,
    executionDurationMs: 90,
    runPageUrl: 'https://example.com/run',
    resultState: 'SUCCESS',
  };
  const activeMetadata = {
    lifeCycleState: 'TERMINATED',
    parameters: { region: 'east', empty: '' },
    parameterDisplayValues: { file: 'sales.csv' },
  };
  const response = { ...run, ...activeMetadata };
  assert.deepEqual(parseLastRunSummary(response), run);
  const { taskRunId, ...historyRun } = run;
  assert.deepEqual(parseRunHistoryEntry(response), { ...historyRun, ...activeMetadata });
  assert.deepEqual(parseActiveRun({ run: response, ...activeMetadata }), { run, ...activeMetadata });
  assert.equal(parseRunSnapshot(response).taskRunId, taskRunId);
});

test('malformed optional fields do not discard an otherwise valid run', () => {
  const raw = {
    jobRunId: 42,
    taskRunId: 'bad',
    startTime: '100',
    endTime: -1,
    setupDurationMs: 0,
    executionDurationMs: Number.MAX_SAFE_INTEGER + 1,
    runPageUrl: '',
    resultState: null,
    lifeCycleState: [],
    parameters: { empty: '', number: 1 },
    parameterDisplayValues: null,
  };
  assert.deepEqual(parseLastRunSummary(raw), { jobRunId: '42', startTime: 100 });
  assert.deepEqual(parseRunHistoryEntry(raw), { jobRunId: '42', startTime: 100, parameters: { empty: '' } });
  assert.deepEqual(parseActiveRun({ run: raw, lifeCycleState: 1, parameters: [] }), {
    run: { jobRunId: '42', startTime: 100 },
  });
});

test('responses without a valid run identity cannot become selectable history or active runs', () => {
  for (const raw of [null, [], {}, { jobRunId: '0' }, { jobRunId: '1.5' }, { jobRunId: '-1' }]) {
    assert.equal(parseLastRunSummary(raw), undefined);
    assert.equal(parseRunHistoryEntry(raw), undefined);
    assert.equal(parseActiveRun({ run: raw }), undefined);
  }
  assert.equal(parseActiveRun(null), undefined);
  assert.equal(parseActiveRun({}), undefined);
});
