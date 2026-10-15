import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkToolingDependencies, checkToolingLock, reviewedCallers } from '../scripts/security/check-tooling-glob.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const adapterFile = path.join(root, 'packages/tooling-glob/index.cjs');
const glob = require(adapterFile);
const sorted = values => [...values].sort();

async function fixture(t, files = {}) {
  // Glob engines must treat cwd as a literal path, including spaces/brackets.
  const directory = await mkdtemp(path.join(os.tmpdir(), 'fairground glob [fixture]-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), content);
  }
  return directory;
}

function child(script, cwd = os.tmpdir(), timeout = 5000) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(PG|SUPABASE|NEXT_PUBLIC|VERCEL|FAIRGROUND|OPENROUTER)/.test(key)));
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd, env, encoding: 'utf8', timeout, maxBuffer: 1024 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test('every reviewed caller resolves the replacement engine and the vulnerable graph is absent', async () => {
  assert.deepEqual(await checkToolingDependencies({ root }), { callers: 4, engine: '0.2.17' });
  for (const name of Object.keys(reviewedCallers)) {
    const callerRequire = createRequire(path.join(root, 'node_modules', name, 'package.json'));
    for (const removed of ['braces', 'micromatch']) {
      assert.throws(() => callerRequire.resolve(removed), { code: 'MODULE_NOT_FOUND' });
    }
    const installed = callerRequire('fast-glob');
    assert.equal(typeof installed, 'function');
    assert.equal(installed.glob, installed);
    assert.equal(installed.async, installed);
    assert.equal(installed.sync, installed.globSync);
  }
});

test('dependency verification supports an explicit dev omission without skipping runtime callers', async t => {
  const directory = await fixture(t, {
    'package.json': await readFile(path.join(root, 'package.json'), 'utf8'),
    'package-lock.json': await readFile(path.join(root, 'package-lock.json'), 'utf8'),
  });
  await mkdir(path.join(directory, 'packages'));
  await mkdir(path.join(directory, 'node_modules'));
  await symlink(path.join(root, 'packages/tooling-glob'), path.join(directory, 'packages/tooling-glob'), 'dir');
  await symlink(path.join(root, 'packages/tooling-glob'), path.join(directory, 'node_modules/fast-glob'), 'dir');
  await symlink(path.join(root, 'node_modules/next-sitemap'), path.join(directory, 'node_modules/next-sitemap'), 'dir');
  await assert.rejects(checkToolingDependencies({ root: directory, omitDev: false }), { code: 'ENOENT' });
  assert.deepEqual(await checkToolingDependencies({ root: directory, omitDev: true }), { callers: 1, engine: '0.2.17' });
  await rm(path.join(directory, 'node_modules/next-sitemap'));
  await assert.rejects(checkToolingDependencies({ root: directory, omitDev: true }), { code: 'ENOENT' });
});

test('dependency verification rejects reintroduced packages, upstream fast-glob and unaudited caller changes', async () => {
  const original = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  for (const removed of ['braces', 'micromatch']) {
    const lock = structuredClone(original);
    lock.packages[`node_modules/example/node_modules/${removed}`] = { version: '3.0.3' };
    assert.throws(() => checkToolingLock(lock), /Removed vulnerable dependency/);
    delete lock.packages[`node_modules/example/node_modules/${removed}`];
    lock.packages['node_modules/renamed-package'] = { name: removed, version: '3.0.3' };
    assert.throws(() => checkToolingLock(lock), /Removed vulnerable dependency/);
  }
  const upstream = structuredClone(original);
  upstream.packages['node_modules/fast-glob'] = { version: '3.3.3', resolved: 'https://registry.npmjs.org/fast-glob/-/fast-glob-3.3.3.tgz' };
  assert.throws(() => checkToolingLock(upstream), /Unreviewed fast-glob implementation/);
  const newCaller = structuredClone(original);
  newCaller.packages['node_modules/unreviewed-tool'] = { dependencies: { 'fast-glob': '^3' } };
  assert.throws(() => checkToolingLock(newCaller), /Review glob compatibility for new caller/);
  for (const caller of Object.keys(reviewedCallers)) {
    const lock = structuredClone(original);
    lock.packages[`node_modules/${caller}`].version = '999.0.0';
    assert.throws(() => checkToolingLock(lock), /Review glob compatibility/);
  }
});

test('normal build patterns preserve comma braces, extglobs, exclusions and literal cwd', async t => {
  const cwd = await fixture(t, {
    'src/app/index.tsx': '', 'src/lib/card.ts': '', 'src/lib/card.test.ts': '',
    'src/lib/style.css': '', 'src/team name/card.ts': '', 'src/.hidden.ts': '',
  });
  const patterns = ['src/{app,lib,team name}/**/*.{ts,tsx}', '!**/*.test.ts'];
  const expected = ['src/app/index.tsx', 'src/lib/card.ts', 'src/team name/card.ts'];
  assert.deepEqual(sorted(glob.sync(patterns, { cwd })), expected);
  assert.deepEqual(sorted(await glob(patterns, { cwd })), expected);
  assert.deepEqual(sorted(glob.sync('src/**/+(index|card).{ts,tsx}', { cwd })), expected);
  assert.deepEqual(sorted(await glob('src/**/*.{ts,tsx}', { cwd, ignore: ['**/*.test.ts'], dot: true })), ['src/.hidden.ts', ...expected]);
});

test('file and directory results preserve absolute, relative and ./ output styles', async t => {
  const cwd = await fixture(t, { 'src/app/page.tsx': '', 'src/lib/card.ts': '', 'root.ts': '' });
  const files = ['src/app/page.tsx', 'src/lib/card.ts'];
  assert.deepEqual(sorted(await glob('./src/**/*.{ts,tsx}', { cwd })), files.map(file => `./${file}`));
  assert.deepEqual(sorted(glob.sync('src/**/*.{ts,tsx}', { cwd, absolute: true })), files.map(file => path.join(cwd, file)));
  assert.deepEqual(sorted(glob.sync('src/**', { cwd, onlyDirectories: true })), ['src/app', 'src/lib']);
  assert.deepEqual(sorted(await glob('./src/**', { cwd, onlyDirectories: true })), ['./src/app', './src/lib']);
  assert.deepEqual(sorted(glob.sync('src/*', { cwd, onlyFiles: false })), ['src/app', 'src/lib']);
});

test('hidden files and symlink traversal honor explicit options', async t => {
  const cwd = await fixture(t, { 'source/item.ts': '', '.hidden/item.ts': '', 'root.ts': '' });
  await symlink('source', path.join(cwd, 'linked'), 'dir');
  assert.deepEqual(sorted(await glob('**/*.ts', { cwd })), ['linked/item.ts', 'root.ts', 'source/item.ts']);
  assert.deepEqual(sorted(glob.sync('**/*.ts', { cwd, followSymbolicLinks: false })), ['root.ts', 'source/item.ts']);
  assert.deepEqual(sorted(await glob('**/*.ts', { cwd, dot: true, followSymbolicLinks: false })), ['.hidden/item.ts', 'root.ts', 'source/item.ts']);
});

test('shadcn discovery depth 1, 3 and 5 preserves the original cwd-level boundary', async t => {
  const cwd = await fixture(t, {
    'tsconfig.json': '{}', 'nested/tsconfig.json': '{}', 'tailwind.config.ts': '',
    'package.json': '{}', 'a/package.json': '{}', 'a/b/package.json': '{}', 'a/b/c/package.json': '{}',
    'root.css': '', 'a/b/c/d/inside.scss': '', 'a/b/c/d/e/outside.css': '', 'node_modules/hidden.css': '',
  });
  const ignore = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/public/**'];
  assert.deepEqual(await glob.glob('tsconfig.*', { cwd, deep: 1, ignore }), ['tsconfig.json']);
  assert.deepEqual(sorted(await glob.glob('**/package.json', { cwd, deep: 3, ignore })), ['a/b/package.json', 'a/package.json', 'package.json']);
  assert.deepEqual(sorted(glob.sync(['**/*.css', '**/*.scss'], { cwd, deep: 5, ignore })), ['a/b/c/d/inside.scss', 'root.css']);
  assert.deepEqual(await glob.glob('tailwind.config.*', { cwd, deep: 3, ignore }), ['tailwind.config.ts']);
});

test('actual Next ESLint getRootDirs preserves directory selection and excludes files', async t => {
  const cwd = await fixture(t, { 'apps/web/package.json': '{}', 'apps/admin/package.json': '{}', 'apps/readme.txt': '', 'ignored/file.ts': '' });
  child(`
    const assert = require('node:assert/strict');
    const { getRootDirs } = require(${JSON.stringify(path.join(root, 'node_modules/@next/eslint-plugin-next/dist/utils/get-root-dirs.js'))});
    assert.deepEqual(getRootDirs({ cwd: process.cwd(), settings: {} }), [process.cwd()]);
    assert.deepEqual(getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir: 'apps/*' } } }).sort(), ['apps/admin', 'apps/web']);
    assert.deepEqual(getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir: ['apps/web', 'apps/admin', false] } } }).sort(), ['apps/admin', 'apps/web']);
    assert.deepEqual(getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir: '{./apps/web,./apps/admin}' } } }).sort(), ['./apps/admin', './apps/web']);
    assert.deepEqual(getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir: 'apps/**/' } } }).sort(), ['apps/admin', 'apps/web']);
    assert.deepEqual(getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir: 'apps/web/' } } }), ['apps/web/']);
  `, cwd);
});

test('actual ts-morph filesystem discovers source files through async and sync calls', async t => {
  const cwd = await fixture(t, {
    'src/app/page.tsx': 'export {}', 'src/lib/card.ts': 'export {}',
    'src/lib/card.test.ts': '', 'src/lib/style.css': '',
    'apps/web/page.ts': 'export {}', 'apps/admin/page.ts': 'export {}',
  });
  child(`
    const assert = require('node:assert/strict');
    const path = require('node:path');
    const { RealFileSystemHost } = require(${JSON.stringify(require.resolve('@ts-morph/common'))});
    const host = new RealFileSystemHost();
    const patterns = ['src/**/*.{ts,tsx}', '!**/*.test.ts'];
    const expected = ['src/app/page.tsx', 'src/lib/card.ts'].map(file => path.join(process.cwd(), file));
    assert.deepEqual(host.globSync(patterns).sort(), expected);
    (async () => {
      assert.deepEqual((await host.glob(patterns)).sort(), expected);
      const bracePatterns = ['{apps/web,./apps/admin}/**/*.ts'];
      const apps = ['apps/admin/page.ts', 'apps/web/page.ts'].map(file => path.join(process.cwd(), file));
      assert.deepEqual(host.globSync(bracePatterns).sort(), apps);
      assert.deepEqual((await host.glob(bracePatterns)).sort(), apps);
      const slashExclusion = ['apps/**/*.ts', '!**/'];
      assert.deepEqual(host.globSync(slashExclusion).sort(), apps);
      assert.deepEqual((await host.glob(slashExclusion)).sort(), apps);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, cwd);
});

test('path brace alternatives preserve prefixes, nesting and negative or ignore selection', async t => {
  const cwd = await fixture(t, {
    'apps/admin/page.ts': '', 'apps/web/page.ts': '', 'packages/shared/page.ts': '',
    'literal{brace}/page.ts': '', 'quote"name/page.ts': '',
  });
  const apps = ['apps/admin/page.ts', 'apps/web/page.ts'];
  assert.deepEqual(sorted(glob.sync('{./apps/{web,admin},./packages/shared}/**/*.ts', { cwd })), [
    ...apps, 'packages/shared/page.ts',
  ].map(file => `./${file}`));
  assert.deepEqual(sorted(await glob('{apps/web,./apps/admin}/**/*.ts', { cwd, absolute: true })), apps.map(file => path.join(cwd, file)));
  assert.deepEqual(glob.sync(['**/*.ts', '!{./apps/admin,./apps/web}/**/*.ts', '!literal*/**', '!quote*/**'], { cwd }), ['packages/shared/page.ts']);
  assert.deepEqual(await glob('**/*.ts', { cwd, ignore: ['{./apps/admin,./apps/web}/**/*.ts', 'literal*/**', 'quote*/**'] }), ['packages/shared/page.ts']);
  assert.deepEqual(glob.sync('literal\\{brace\\}/page.ts', { cwd }), ['literal{brace}/page.ts']);
  assert.deepEqual(await glob('quote"name/page.ts', { cwd }), ['quote"name/page.ts']);
  assert.throws(() => glob.sync('{apps/web,./apps/admin}/**/*.ts', { cwd }), /mixed absolute/);
});

test('path braces do not split comma characters inside extglob parentheses or escaped names', async t => {
  const cwd = await fixture(t, { 'apps/web,admin/a.ts': '', 'apps/foo/b.ts': '', 'apps/wrong/c.ts': '' });
  const expected = ['./apps/foo/b.ts', './apps/web,admin/a.ts'];
  for (const pattern of ['{./apps/@(web,admin),./apps/foo}/**/*.ts', '{./apps/web\\,admin,./apps/foo}/**/*.ts']) {
    assert.deepEqual(sorted(glob.sync(pattern, { cwd })), expected);
    assert.deepEqual(sorted(await glob(pattern, { cwd })), expected);
  }
  assert.throws(() => glob.sync('{./apps/"web,admin",./apps/foo}/**/*.ts', { cwd }), /Quoted or dollar-prefixed/);
  await assert.rejects(glob('**/*.ts', { cwd, ignore: ['{./apps/"web,admin",./apps/foo}/**/*.ts'] }), /Quoted or dollar-prefixed/);
});

test('trailing slash exclusions affect directory entries without pruning child files or directories', async t => {
  const cwd = await fixture(t, {
    'apps/admin/deep/nested.ts': '', 'apps/admin/page.ts': '', 'apps/web/page.ts': '', 'root.ts': '',
  });
  const files = ['apps/admin/deep/nested.ts', 'apps/admin/page.ts', 'apps/web/page.ts', 'root.ts'];
  const directories = ['apps', 'apps/admin', 'apps/admin/deep', 'apps/web'];
  const cases = [
    [['**/*.ts', '!**/'], {}, files],
    ['**/*.ts', { ignore: ['**/'] }, files],
    [['**/*.ts', '!apps/admin/'], {}, files],
    ['**/*.ts', { ignore: ['apps/admin/'] }, files],
    ['apps/**/', {}, []],
    ['apps/**/', { onlyDirectories: true }, directories.slice(1)],
    ['apps/', { onlyDirectories: true }, ['apps/']],
    [['apps/', 'apps/**/'], { onlyDirectories: true }, ['apps/', ...directories.slice(1)]],
    ['**/*', { onlyDirectories: true, ignore: ['apps/admin/'] }, directories.filter(dir => dir !== 'apps/admin')],
    [['**/*', '!**/'], { onlyDirectories: true }, []],
    ['**/*', { onlyFiles: false, ignore: ['apps/admin/'] }, [...files, ...directories.filter(dir => dir !== 'apps/admin')]],
    [['**/*', '!**/'], { onlyFiles: false }, files],
    [['**/*', '!**/'], { onlyFiles: false, deep: 3 }, ['apps/admin/page.ts', 'apps/web/page.ts', 'root.ts']],
    ['**/*', { onlyDirectories: true, deep: 2, ignore: ['apps/admin/'] }, ['apps', 'apps/web']],
    [['**/*', '!apps/admin/**'], { onlyFiles: false }, ['apps', 'apps/web', 'apps/web/page.ts', 'root.ts']],
  ];
  for (const [patterns, options, expected] of cases) {
    assert.deepEqual(sorted(glob.sync(patterns, { cwd, ...options })), sorted(expected), JSON.stringify({ patterns, options }));
    assert.deepEqual(sorted(await glob(patterns, { cwd, ...options })), sorted(expected), JSON.stringify({ patterns, options }));
  }
  child(`
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const path = require('node:path');
    const reads = [];
    for (const method of ['readdir', 'readdirSync']) {
      const original = fs[method];
      fs[method] = function(directory, ...args) {
        reads.push(path.relative(process.cwd(), directory));
        return original.call(this, directory, ...args);
      };
    }
    const glob = require(${JSON.stringify(adapterFile)});
    (async () => {
      const options = { onlyDirectories: true, deep: 2, ignore: ['**/'] };
      assert.deepEqual(glob.sync('**/*', options), []);
      assert.deepEqual(await glob('**/*', options), []);
      assert.ok(reads.length > 0);
      assert.ok(reads.every(directory => directory === '' || !directory.includes(path.sep)), JSON.stringify(reads));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, cwd);
});

test('path brace expansion is bounded before traversal and its helper ships in the package', () => {
  child(`
    const assert = require('node:assert/strict');
    const glob = require(${JSON.stringify(adapterFile)});
    const { expandPathAlternatives } = require(${JSON.stringify(path.join(root, 'packages/tooling-glob/path-patterns.cjs'))});
    assert.equal(expandPathAlternatives('{a/,b/}'.repeat(9)).length, 512);
    const excessive = [
      ['{a/,b/}'.repeat(10), /exceeds 1000 alternatives/],
      ['{./apps/web,./apps/admin}' + 'x'.repeat(40000), /exceed 65536 characters/],
    ];
    (async () => {
      for (const [pattern, error] of excessive) {
        assert.throws(() => glob.sync(pattern), error);
        await assert.rejects(glob(pattern), error);
        assert.throws(() => glob.sync('*', { ignore: [pattern] }), error);
        await assert.rejects(glob('*', { ignore: [pattern] }), error);
      }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
  const packed = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: path.join(root, 'packages/tooling-glob'), encoding: 'utf8', timeout: 10000,
  });
  assert.equal(packed.status, 0, packed.stderr);
  assert.ok(JSON.parse(packed.stdout)[0].files.some(file => file.path === 'path-patterns.cjs'));
});

test('actual next-sitemap parser discovers static exports and keeps clean URL paths', async t => {
  const cwd = await fixture(t, { 'out/index.html': '', 'out/about.html': '', 'out/team name/index.html': '', 'out/ignored.txt': '' });
  child(`
    const assert = require('node:assert/strict');
    (async () => {
      const { ManifestParser } = await import(${JSON.stringify(new URL('../node_modules/next-sitemap/dist/esm/parsers/manifest-parser.js', import.meta.url).href)});
      const parser = new ManifestParser({}, {});
      assert.deepEqual((await parser.getStaticExportPages({ output: 'export' }, 'out')).sort(), ['/', '/about', '/team name/']);
      assert.deepEqual(await parser.getStaticExportPages({}, 'out'), []);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, cwd);
});

test('actual shadcn info detects the Next app, TypeScript and Tailwind without a registry request', async t => {
  const cwd = await fixture(t, {
    'package.json': JSON.stringify({ name: 'glob-fixture', dependencies: { next: '16.3.8', tailwindcss: '4.0.0' } }),
    'next.config.ts': 'export default {}',
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }),
    'src/app/page.tsx': 'export default function Page() { return null }',
    'src/app/globals.css': '@import "tailwindcss";',
  });
  const output = child(`
    // Fail if this local discovery command starts any network connection.
    for (const module of ['node:http', 'node:https']) {
      const api = require(module);
      api.request = api.get = () => { throw new Error('Unexpected network request during local project discovery'); };
    }
    // Commander treats node -e as an eval entrypoint and drops one argv item.
    process.argv = [process.execPath, 'info', '--cwd', process.cwd()];
    import(${JSON.stringify(new URL('../node_modules/shadcn/dist/index.js', import.meta.url).href)});
  `, cwd, 10000);
  assert.match(output, /name: 'next-app'/);
  assert.match(output, /isRSC: true/);
  assert.match(output, /isTsx: true/);
  assert.match(output, /tailwindCssFile: 'src\/app\/globals\.css'/);
  assert.match(output, /tailwindVersion: 'v4'/);
  assert.match(output, /aliasPrefix: '@'/);
});

test('deep closed, unclosed, mismatched and mixed delimiters are rejected before filesystem traversal', () => {
  child(`
    const assert = require('node:assert/strict');
    const glob = require(${JSON.stringify(adapterFile)});
    const patterns = [
      '{'.repeat(4000) + 'a' + '}'.repeat(4000), '{'.repeat(4000),
      '('.repeat(4000) + 'a' + ')'.repeat(4000), '('.repeat(4000),
      '{('.repeat(2000) + 'a' + ')}'.repeat(2000), '{)'.repeat(4000), '(}'.repeat(4000),
    ];
    (async () => {
      for (const pattern of patterns) {
        assert.throws(() => glob.sync(pattern), /exceeds nesting depth 100/);
        await assert.rejects(glob(pattern), /exceeds nesting depth 100/);
        assert.throws(() => glob.sync('*', { ignore: [pattern] }), /exceeds nesting depth 100/);
        await assert.rejects(glob('*', { ignore: [pattern] }), /exceeds nesting depth 100/);
      }
      assert.throws(() => glob.sync('a'.repeat(65537)), /exceeds 65536 characters/);
      await assert.rejects(glob('*', { ignore: ['a'.repeat(65537)] }), /exceeds 65536 characters/);
      const paddedRange = '{' + '0'.repeat(22000) + '1..' + '0'.repeat(22000) + '3}';
      assert.throws(() => glob.sync(paddedRange), /Normalized pattern exceeds 65536/);
      await assert.rejects(glob('*', { ignore: [paddedRange] }), /Normalized pattern exceeds 65536/);
      assert.throws(() => glob.sync('{1..999999999}'), /exceeds 1000/);
      for (const bad of [null, {}, [['*']], new Array(2), ['*', undefined]]) {
        assert.throws(() => glob.sync(bad), TypeError);
        await assert.rejects(glob('*', { ignore: bad }), TypeError);
      }
      assert.equal(glob.generateTasks, undefined);
      assert.equal(glob.stream, undefined);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
});

test('unreviewed options and semantics fail explicitly instead of silently changing matching', async () => {
  const invalid = [
    ['*', { stats: true }], ['*', { objectMode: true }], ['*', { cwd: new URL('file:///tmp/') }],
    ['*', { dot: 'yes' }], ['*', { deep: -1 }], ['*', { deep: 1.5 }],
    ['src/**/*.ts', { deep: 3 }],
    ['"web{01..03}"', {}], ['${01..03}', {}], ['*', { ignore: ['"web{01..03}"'] }],
    ['"{./apps/web,./apps/admin}"', {}], ['${./apps/web,./apps/admin}', {}],
    ['*', { ignore: ['${./apps/web,./apps/admin}'] }],
    ['*', { ignore: ['!node_modules/**'] }], ['!!*.ts', {}],
    [['./*.ts', '*.tsx'], {}], ['*', null],
  ];
  for (const [patterns, options] of invalid) {
    assert.throws(() => glob.sync(patterns, options), TypeError);
    await assert.rejects(glob(patterns, options), TypeError);
  }
});

test('caller-supplied numeric, padded, stepped and alphabetic ranges retain bounded matching', async t => {
  const cwd = await fixture(t, {
    'apps/web1/page.ts': '', 'apps/web2/page.ts': '', 'apps/web3/page.ts': '',
    'n01.ts': '', 'n02.ts': '', 'n03.ts': '', 'a.ts': '', 'b.ts': '', 'c.ts': '',
    'n-3.ts': '', 'n-2.ts': '', 'n-1.ts': '', 'literal{1..3}.ts': '',
  });
  assert.deepEqual(sorted(glob.sync('n{01..03}.ts', { cwd })), ['n01.ts', 'n02.ts', 'n03.ts']);
  assert.deepEqual(sorted(await glob('n{03..01..2}.ts', { cwd })), ['n01.ts', 'n03.ts']);
  assert.deepEqual(sorted(glob.sync('n{-3..-1}.ts', { cwd })), ['n-1.ts', 'n-2.ts', 'n-3.ts']);
  assert.deepEqual(sorted(await glob('{c..a..2}.ts', { cwd })), ['a.ts', 'c.ts']);
  assert.deepEqual(await glob('n*.ts', { cwd, ignore: ['n{01..02}.ts', 'n-*.ts'] }), ['n03.ts']);
  assert.deepEqual(glob.sync('literal\\{1..3\\}.ts', { cwd }), ['literal{1..3}.ts']);
  assert.deepEqual(glob.sync('literal{1..3}.ts', { cwd, braceExpansion: false }), ['literal{1..3}.ts']);
  child(`
    const assert = require('node:assert/strict');
    const { getRootDirs } = require(${JSON.stringify(require.resolve('@next/eslint-plugin-next/dist/utils/get-root-dirs.js'))});
    assert.deepEqual(getRootDirs({cwd:process.cwd(),settings:{next:{rootDir:'apps/web{1..2}'}}}).sort(), ['apps/web1','apps/web2']);
  `, cwd);
  assert.throws(() => glob.sync('{1..1001}', { cwd }), /1000|limit|range/i);
  await assert.rejects(glob('*', { cwd, ignore: ['{1..999999999999999999999999}'] }), /range|integer|limit/i);
});

test('ordinary depth and escaped literal delimiters still accept legitimate patterns', async t => {
  const cwd = await fixture(t, { 'literal{brace}.ts': '', '(group).ts': '', 'root.ts': '' });
  assert.deepEqual(glob.sync('literal\\{brace\\}.ts', { cwd }), ['literal{brace}.ts']);
  assert.deepEqual(await glob('\\(group\\).ts', { cwd }), ['(group).ts']);
  assert.doesNotThrow(() => glob.sync('{'.repeat(100) + 'a' + '}'.repeat(100), { cwd }));
  assert.throws(() => glob.sync('{'.repeat(101), { cwd }), /exceeds nesting depth 100/);
  assert.deepEqual(glob.sync('root.ts', { cwd, deep: Infinity }), ['root.ts']);
});
