import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beginExtensionIsolation, restoreExtensionIsolation } from './extensions.mjs';
import { runTeamRegression } from './suite.mjs';

export function receiptWriter(output) {
  return async (receipt) => {
    const file = path.join(output, 'extension-receipt.json');
    await writeFile(file + '.tmp', JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
    await rename(file + '.tmp', file);
  };
}

/** Browser work succeeds only when extension restoration succeeds as well. */
export async function runRegressionSession({ taskSpace, config, credentials }, {
  beginIsolation = beginExtensionIsolation, runRegression = runTeamRegression,
} = {}) {
  const task = await taskSpace(config.space);
  let guard;
  let failure;
  const report = { status: 'running', space: config.space, sha: config.sha, isolation: config.isolateExtension ?? 'none' };
  try {
    guard = await beginIsolation({ task, config, writeReceipt: receiptWriter(config.output) });
    await runRegression({ taskSpace, config, credentials });
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (guard) await guard.restore();
    } catch (error) {
      failure = failure ? new AggregateError([failure, error], 'Browser verification and extension restoration failed') : error;
    }
    report.status = failure ? 'failed' : 'passed';
    if (failure) report.failure = failure.name;
    report.extensionPhase = guard?.receipt?.phase ?? null;
    await writeFile(path.join(config.output, 'session.json'), JSON.stringify(report, null, 2) + '\n');
  }
  if (failure) throw failure;
}

/** Recovery changes only the recorded extension; it never retries app input. */
export async function recoverExtensionSession({ taskSpace, config, receipt }, { restoreIsolation = restoreExtensionIsolation } = {}) {
  if (config.isolateExtension !== 'aliprice' || receipt.space !== config.space || receipt.previewOrigin !== config.url) {
    throw new Error('Extension recovery receipt does not match this verified run');
  }
  const task = await taskSpace(config.space);
  return restoreIsolation({ task, receipt, writeReceipt: receiptWriter(config.output) });
}
