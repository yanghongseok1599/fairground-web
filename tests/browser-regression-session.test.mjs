import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  receiptWriter, recoverExtensionSession, runRegressionSession,
} from '../scripts/testing/browser/session.mjs';

const preview = 'https://fairground-7idyy4r9g-milestones-projects-d52c4dda.vercel.app';
const credentials = { email: 'captain@example.com', password: 'fixture-password-not-for-artifacts' };

async function fixture(t) {
  const output = await mkdtemp(path.join(tmpdir(), 'fairground-browser-session-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const config = { space: 91, page: 'p1', url: preview, sha: 'a'.repeat(40), output, isolateExtension: 'aliprice' };
  const calls = [];
  const task = { spaceId: config.space };
  const taskSpace = async (space) => {
    assert.equal(space, config.space);
    calls.push('task');
    return task;
  };
  const receipt = { phase: 'isolated' };
  const guard = {
    receipt,
    async restore() {
      calls.push('restore');
      receipt.phase = 'restored';
    },
  };
  const dependencies = {
    async beginIsolation(input) {
      calls.push('isolate');
      assert.equal(input.task, task);
      assert.equal(input.config, config);
      assert.equal(typeof input.writeReceipt, 'function');
      return guard;
    },
    async runRegression(input) {
      calls.push('suite');
      assert.equal(input.taskSpace, taskSpace);
      assert.equal(input.config, config);
      assert.equal(input.credentials, credentials);
    },
  };
  return {
    config, calls, task, taskSpace, guard, dependencies,
    input: { taskSpace, config, credentials },
    report: async () => JSON.parse(await readFile(path.join(output, 'session.json'), 'utf8')),
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('session cannot report success until extension restoration finishes', async (t) => {
  const f = await fixture(t);
  const restoring = deferred();
  const finishRestore = deferred();
  f.guard.restore = async () => {
    f.calls.push('restore');
    restoring.resolve();
    await finishRestore.promise;
    f.guard.receipt.phase = 'restored';
  };
  let settled = false;
  const running = runRegressionSession(f.input, f.dependencies).then(() => { settled = true; });
  await restoring.promise;
  assert.equal(settled, false);
  await assert.rejects(f.report(), { code: 'ENOENT' });
  finishRestore.resolve();
  await running;
  assert.deepEqual(f.calls, ['task', 'isolate', 'suite', 'restore']);
  assert.deepEqual(await f.report(), {
    status: 'passed', space: 91, sha: f.config.sha, isolation: 'aliprice', extensionPhase: 'restored',
  });
});

test('a failed app case restores once and remains a failed session without retrying the app', async (t) => {
  const f = await fixture(t);
  const failure = new Error(`App failure containing ${credentials.password}`);
  f.dependencies.runRegression = async () => { f.calls.push('suite'); throw failure; };
  await assert.rejects(runRegressionSession(f.input, f.dependencies), (error) => error === failure);
  assert.deepEqual(f.calls, ['task', 'isolate', 'suite', 'restore']);
  const report = await f.report();
  assert.equal(report.status, 'failed');
  assert.equal(report.extensionPhase, 'restored');
  assert.equal(report.failure, 'Error');
  assert.ok(!JSON.stringify(report).includes(credentials.password));
  assert.ok(!JSON.stringify(report).includes('App failure'));
});

test('passing app cases do not hide an extension restoration failure', async (t) => {
  const f = await fixture(t);
  const failure = new Error('Extension restoration unconfirmed');
  f.guard.restore = async () => { f.calls.push('restore'); throw failure; };
  await assert.rejects(runRegressionSession(f.input, f.dependencies), (error) => error === failure);
  assert.deepEqual(f.calls, ['task', 'isolate', 'suite', 'restore']);
  assert.equal((await f.report()).status, 'failed');
  assert.equal((await f.report()).extensionPhase, 'isolated');
});

test('app and restoration failures are both retained without retrying either operation', async (t) => {
  const f = await fixture(t);
  const appFailure = new Error('App input may have late effects');
  const restoreFailure = new Error('Extension restoration unconfirmed');
  f.dependencies.runRegression = async () => { f.calls.push('suite'); throw appFailure; };
  f.guard.restore = async () => { f.calls.push('restore'); throw restoreFailure; };
  await assert.rejects(runRegressionSession(f.input, f.dependencies), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [appFailure, restoreFailure]);
    return true;
  });
  assert.deepEqual(f.calls, ['task', 'isolate', 'suite', 'restore']);
  assert.equal((await f.report()).failure, 'AggregateError');
});

test('failed isolation prevents all app input and propagates its recovery outcome', async (t) => {
  const f = await fixture(t);
  const failure = new AggregateError([new Error('disable failed'), new Error('restore pending')], 'Isolation incomplete');
  f.dependencies.beginIsolation = async () => { f.calls.push('isolate'); throw failure; };
  await assert.rejects(runRegressionSession(f.input, f.dependencies), (error) => error === failure);
  assert.deepEqual(f.calls, ['task', 'isolate']);
  assert.equal((await f.report()).status, 'failed');
  assert.equal((await f.report()).extensionPhase, null);
});

test('failed TaskSpace access stops before isolation or app execution', async (t) => {
  const f = await fixture(t);
  const failure = new Error('TaskSpace is user owned');
  f.input.taskSpace = async () => { throw failure; };
  await assert.rejects(runRegressionSession(f.input, f.dependencies), (error) => error === failure);
  assert.deepEqual(f.calls, []);
  await assert.rejects(f.report(), { code: 'ENOENT' });
});

test('omitting opt-in uses the real no-op guard without creating or changing a control Page', async (t) => {
  const f = await fixture(t);
  delete f.config.isolateExtension;
  await runRegressionSession(f.input, { runRegression: f.dependencies.runRegression });
  assert.deepEqual(f.calls, ['task', 'suite']);
  assert.equal((await f.report()).status, 'passed');
  assert.equal((await f.report()).isolation, 'none');
  assert.equal((await f.report()).extensionPhase, null);
});

test('report persistence failure still occurs after restoration and fails the session', async (t) => {
  const f = await fixture(t);
  await mkdir(path.join(f.config.output, 'session.json'));
  await assert.rejects(runRegressionSession(f.input, f.dependencies), { code: 'EISDIR' });
  assert.deepEqual(f.calls, ['task', 'isolate', 'suite', 'restore']);
  assert.equal(f.guard.receipt.phase, 'restored');
});

test('durable receipt writes replace the complete private journal and leave no pending file', async (t) => {
  const f = await fixture(t);
  const write = receiptWriter(f.config.output);
  await write({ phase: 'disable-attempted', controlPageClosed: false });
  assert.deepEqual(JSON.parse(await readFile(path.join(f.config.output, 'extension-receipt.json'), 'utf8')), {
    phase: 'disable-attempted', controlPageClosed: false,
  });
  await write({ phase: 'restored', controlPageClosed: true });
  assert.deepEqual(JSON.parse(await readFile(path.join(f.config.output, 'extension-receipt.json'), 'utf8')), {
    phase: 'restored', controlPageClosed: true,
  });
  assert.deepEqual(await readdir(f.config.output), ['extension-receipt.json']);
  assert.equal((await stat(path.join(f.config.output, 'extension-receipt.json'))).mode & 0o777, 0o600);
});

test('recovery delegates only the recorded extension and never reruns app actions', async (t) => {
  const f = await fixture(t);
  const receipt = { space: f.config.space, previewOrigin: f.config.url, phase: 'disable-attempted' };
  const restored = { ...receipt, phase: 'restored', controlPageClosed: true };
  const result = await recoverExtensionSession({ ...f.input, receipt }, {
    async restoreIsolation(input) {
      f.calls.push('recover');
      assert.equal(input.task, f.task);
      assert.equal(input.receipt, receipt);
      await input.writeReceipt(restored);
      return restored;
    },
  });
  assert.equal(result, restored);
  assert.deepEqual(f.calls, ['task', 'recover']);
  assert.deepEqual(JSON.parse(await readFile(path.join(f.config.output, 'extension-receipt.json'), 'utf8')), restored);
  await assert.rejects(f.report(), { code: 'ENOENT' });
});

test('a mismatched recovery request stops before touching the TaskSpace or an extension', async (t) => {
  const f = await fixture(t);
  const receipt = { space: f.config.space, previewOrigin: f.config.url };
  for (const change of [
    { config: { ...f.config, isolateExtension: undefined } },
    { config: { ...f.config, isolateExtension: 'other' } },
    { receipt: { ...receipt, space: f.config.space + 1 } },
    { receipt: { ...receipt, previewOrigin: 'https://fairground.run' } },
  ]) {
    await assert.rejects(recoverExtensionSession({ ...f.input, receipt, ...change }, {
      restoreIsolation: async () => { assert.fail('must not restore a mismatched run'); },
    }), /does not match/);
  }
  assert.deepEqual(f.calls, []);
  assert.deepEqual(await readdir(f.config.output), []);
});

test('unconfirmed recovery remains an error and writes no synthetic success report', async (t) => {
  const f = await fixture(t);
  const receipt = { space: f.config.space, previewOrigin: f.config.url };
  const failure = new Error('Extension callback still pending');
  await assert.rejects(recoverExtensionSession({ ...f.input, receipt }, {
    restoreIsolation: async () => { f.calls.push('recover'); throw failure; },
  }), (error) => error === failure);
  assert.deepEqual(f.calls, ['task', 'recover']);
  assert.deepEqual(await readdir(f.config.output), []);
});
