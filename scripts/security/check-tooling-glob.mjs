import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));
export const reviewedCallers = {
  '@next/eslint-plugin-next': '16.3.8',
  '@ts-morph/common': '0.27.0',
  'next-sitemap': '4.2.3',
  shadcn: '3.8.5',
};

export function checkToolingLock(lock) {
  assert.ok(lock.packages, 'A modern package-lock.json is required');
  for (const [entry, metadata] of Object.entries(lock.packages)) {
    if (entry && metadata.dependencies?.['fast-glob']) {
      assert.ok(Object.keys(reviewedCallers).some(name => entry === `node_modules/${name}`),
        `Review glob compatibility for new caller ${entry}`);
    }
    assert.ok(!/(^|\/)node_modules\/(braces|micromatch)$/.test(entry)
      && !['braces', 'micromatch'].includes(metadata.name),
    `Removed vulnerable dependency has returned: ${entry}`);
    if (/(^|\/)node_modules\/fast-glob$/.test(entry)) {
      assert.equal(metadata.link, true, `Unreviewed fast-glob implementation: ${entry}`);
      assert.equal(metadata.resolved, 'packages/tooling-glob');
    }
  }
  for (const [name, version] of Object.entries(reviewedCallers)) {
    const caller = lock.packages[`node_modules/${name}`];
    assert.equal(caller?.version, version, `Review glob compatibility before upgrading ${name}`);
    assert.ok(caller.dependencies?.['fast-glob'], `Review changed glob integration in ${name}`);
  }
  assert.equal(lock.packages['packages/tooling-glob']?.name, '@fairground/tooling-glob');
  assert.equal(lock.packages['packages/tooling-glob']?.dependencies?.tinyglobby, '0.2.17');
}

export async function checkToolingDependencies({
  root = defaultRoot,
  omitDev = process.env.NODE_ENV === 'production'
    || (process.env.npm_config_omit ?? '').split(/\s+/).includes('dev'),
} = {}) {
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  checkToolingLock(lock);
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.overrides?.['fast-glob'], '$fast-glob');
  assert.equal(manifest.dependencies?.['fast-glob'], 'file:packages/tooling-glob');
  const adapterFile = await realpath(path.join(root, 'packages/tooling-glob/index.cjs'));
  let installedCallers = 0;
  for (const name of Object.keys(reviewedCallers)) {
    const callerFile = path.join(root, 'node_modules', name, 'package.json');
    let source;
    try {
      source = await readFile(callerFile, 'utf8');
    } catch (error) {
      // npm ci --omit=dev sets NODE_ENV=production for lifecycle scripts. Only
      // explicitly dev-only callers may be absent; runtime callers must exist.
      if (error.code === 'ENOENT' && omitDev
          && lock.packages[`node_modules/${name}`]?.dev === true) continue;
      throw error;
    }
    const caller = JSON.parse(source);
    assert.equal(caller.version, reviewedCallers[name]);
    const require = createRequire(callerFile);
    assert.equal(await realpath(require.resolve('fast-glob')), adapterFile,
      `${name} is not using the reviewed glob adapter`);
    installedCallers += 1;
  }
  const require = createRequire(adapterFile);
  const engine = require('tinyglobby/package.json');
  assert.equal(engine.version, '0.2.17');
  return { callers: installedCallers, engine: engine.version };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    assert.equal(process.argv.length, 2, 'Usage: node scripts/security/check-tooling-glob.mjs');
    const result = await checkToolingDependencies();
    console.log(`Dependency graph verified: ${result.callers} tooling callers use tinyglobby@${result.engine}; braces/micromatch absent.`);
  } catch (error) {
    console.error(`Dependency security check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
