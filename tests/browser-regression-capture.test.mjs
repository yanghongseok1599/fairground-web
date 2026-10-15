import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import { PNG } from 'pngjs';
import { capturePngEvidence } from '../scripts/testing/browser/capture.mjs';

const dimensions = Object.freeze({ width: 1512, height: 828, devicePixelRatio: 1 });
const outputPath = path.join(tmpdir(), 'controlled-capture-fixture.png');

function fixturePng({ blank = false, transparent = false, nearUniform = false } = {}) {
  const png = new PNG({ width: dimensions.width, height: dimensions.height });
  for (let index = 0; index < png.data.length; index += 4) {
    const value = blank || nearUniform ? 255 : (index / 4) % dimensions.width < 756 ? 30 : 230;
    png.data.set([value, value, value, transparent ? 0 : 255], index);
  }
  if (nearUniform) png.data.set([0, 0, 0, 255], 0);
  return PNG.sync.write(png);
}

const validPng = fixturePng();

function fixture({ bytes = validPng, observations = [dimensions, dimensions] } = {}) {
  const calls = [];
  const writes = [];
  const page = {
    async evaluate(fn) {
      calls.push('observe');
      assert.ok(observations.length, 'unexpected extra viewport observation');
      const next = observations.shift();
      // Exercise the serializable browser callback without a browser or input.
      return { ...vm.runInNewContext(`(${fn.toString()})()`, {
        innerWidth: next.width, innerHeight: next.height, devicePixelRatio: next.devicePixelRatio,
      }) };
    },
    async cdp(method, params, options) {
      calls.push('capture');
      assert.equal(method, 'Page.captureScreenshot');
      assert.deepEqual(params, { format: 'png', fromSurface: true, captureBeyondViewport: false });
      assert.deepEqual(options, { timeout: 10000 });
      return { data: bytes.toString('base64') };
    },
  };
  const write = async (...args) => { calls.push('write'); writes.push(args); };
  return { page, calls, writes, write };
}

test('saves a fully decoded private PNG and returns the exact persisted hash, size and basename', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fairground-capture-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const destination = path.join(directory, 'team-detail.png');
  const f = fixture();
  const metadata = await capturePngEvidence(f.page, destination);
  const persisted = await readFile(destination);
  assert.deepEqual(persisted, validPng);
  assert.deepEqual(metadata, {
    path: 'team-detail.png', format: 'png', ...dimensions, sizeBytes: persisted.length,
    sha256: createHash('sha256').update(persisted).digest('hex'), pixelVariance: 10000,
  });
  assert.equal((await stat(destination)).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(directory), ['team-detail.png']);
  assert.deepEqual(f.calls, ['observe', 'capture', 'observe']);
});

test('supports injected capture and persistence without the buggy screenshot wrapper or clip', async () => {
  const f = fixture();
  const cdp = f.page.cdp;
  f.page.cdp = () => assert.fail('injected CDP must be used');
  f.page.screenshot = () => assert.fail('screenshot wrapper must never be used');
  const metadata = await capturePngEvidence(f.page, outputPath, { cdp, write: f.write });
  assert.deepEqual(f.calls, ['observe', 'capture', 'observe', 'write']);
  assert.deepEqual(f.writes[0], [outputPath, validPng, { mode: 0o600, flag: 'wx' }]);
  assert.equal(metadata.path, path.basename(outputPath));
  assert.ok(!JSON.stringify(metadata).includes(tmpdir() + path.sep));
});

test('rejects a wrong viewport or DPR before starting a capture', async () => {
  for (const changes of [{ width: 756 }, { height: 414 }, { devicePixelRatio: 2 }, { devicePixelRatio: NaN }]) {
    const f = fixture({ observations: [{ ...dimensions, ...changes }] });
    await assert.rejects(capturePngEvidence(f.page, outputPath, { write: f.write }), /expected 1512x828/);
    assert.deepEqual(f.calls, ['observe']);
    assert.deepEqual(f.writes, []);
  }
});

test('a successful CDP response cannot hide changed viewport dimensions or DPR', async () => {
  for (const changes of [{ width: 756 }, { height: 414 }, { devicePixelRatio: 2 }]) {
    const f = fixture({ observations: [dimensions, { ...dimensions, ...changes }] });
    await assert.rejects(capturePngEvidence(f.page, outputPath, { write: f.write }), /expected 1512x828/);
    assert.deepEqual(f.calls, ['observe', 'capture', 'observe']);
    assert.deepEqual(f.writes, []);
  }
});

test('propagates CDP failures without retrying or creating substitute evidence', async () => {
  const f = fixture();
  const failure = Object.assign(new Error('Page.captureScreenshot timed out'), { name: 'CdpRequestTimeoutError' });
  const cdp = async () => { f.calls.push('capture'); throw failure; };
  await assert.rejects(capturePngEvidence(f.page, outputPath, { cdp, write: f.write }), (error) => error === failure);
  assert.deepEqual(f.calls, ['observe', 'capture']);
  assert.deepEqual(f.writes, []);
});

test('enforces the 10-second deadline and discards a late successful response without writing', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  let release;
  let dispatched;
  const started = new Promise((resolve) => { dispatched = resolve; });
  const cdp = () => {
    f.calls.push('capture');
    dispatched();
    return new Promise((resolve) => { release = resolve; });
  };
  let settled = false;
  const running = capturePngEvidence(f.page, outputPath, { cdp, write: f.write });
  const rejected = assert.rejects(running, { name: 'PngCaptureTimeoutError' }).then(() => { settled = true; });
  await started;
  t.mock.timers.tick(9999);
  await Promise.resolve();
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  await rejected;
  release({ data: validPng.toString('base64') });
  await Promise.resolve();
  assert.deepEqual(f.calls, ['observe', 'capture']);
  assert.deepEqual(f.writes, []);
});

for (const [label, data] of [
  ['missing data', undefined], ['empty data', ''], ['invalid base64', '!not-base64!'],
  ['ignored base64 suffix', validPng.toString('base64') + '!'],
  ['oversized response', 'A'.repeat(24 * 1024 * 1024)],
]) {
  test(`rejects ${label} without persisting evidence`, async () => {
    const f = fixture();
    await assert.rejects(capturePngEvidence(f.page, outputPath, {
      cdp: async () => ({ data }), write: f.write,
    }), /image data|invalid base64/);
    assert.deepEqual(f.writes, []);
  });
}

function editedPng(edit) {
  const copy = Buffer.from(validPng);
  edit(copy);
  return copy;
}

for (const [label, bytes, error] of [
  ['bad signature', editedPng((bytes) => { bytes[0] = 0; }), /invalid signature/],
  ['wrong IHDR width', editedPng((bytes) => bytes.writeUInt32BE(3024, 16)), /PNG width/],
  ['wrong IHDR height', editedPng((bytes) => bytes.writeUInt32BE(1656, 20)), /PNG height/],
  ['bad IEND CRC', editedPng((bytes) => { bytes[bytes.length - 1] ^= 1; }), /complete image decoding/],
  ['truncated chunk', validPng.subarray(0, validPng.length - 5), /truncated/],
  ['missing IEND', validPng.subarray(0, validPng.length - 12), /missing IEND/],
  ['trailing data', Buffer.concat([validPng, Buffer.from('extra')]), /trailing data/],
  ['duplicate IHDR', Buffer.concat([validPng.subarray(0, 33), validPng.subarray(8)]), /duplicate IHDR/],
]) {
  test(`rejects ${label} before writing`, async () => {
    const f = fixture({ bytes });
    await assert.rejects(capturePngEvidence(f.page, outputPath, { write: f.write }), error);
    assert.deepEqual(f.writes, []);
  });
}

function withCompressedPixels(transform) {
  const parts = [];
  for (let offset = 33; offset < validPng.length;) {
    const length = validPng.readUInt32BE(offset);
    if (validPng.toString('ascii', offset + 4, offset + 8) === 'IDAT') {
      parts.push(validPng.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const pixels = transform(Buffer.concat(parts));
  const chunk = Buffer.alloc(pixels.length + 12);
  chunk.writeUInt32BE(pixels.length);
  chunk.write('IDAT', 4);
  pixels.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return { pixels, bytes: Buffer.concat([validPng.subarray(0, 33), chunk, validPng.subarray(-12)]) };
}

for (const [label, transform] of [
  ['invalid zlib header', (bytes) => { bytes[0] = 0; return bytes; }],
  ['invalid Adler checksum', (bytes) => { bytes[bytes.length - 1] ^= 1; return bytes; }],
  ['truncated zlib trailer', (bytes) => bytes.subarray(0, -4)],
]) {
  test(`valid PNG chunk CRCs cannot conceal an ${label}`, async () => {
    const { pixels, bytes } = withCompressedPixels(transform);
    assert.throws(() => inflateSync(pixels), 'the fixture must be invalid according to standard zlib');
    const f = fixture({ bytes });
    await assert.rejects(capturePngEvidence(f.page, outputPath, { write: f.write }), /complete image decoding/);
    assert.deepEqual(f.writes, []);
  });
}

for (const [label, transform] of [
  ['missing scanline bytes', (bytes) => bytes.subarray(0, -1)],
  ['extra scanline bytes', (bytes) => Buffer.concat([bytes, Buffer.from([0])])],
]) {
  test(`valid zlib and CRC checksums cannot conceal ${label}`, async () => {
    const { pixels, bytes } = withCompressedPixels((compressed) => deflateSync(transform(inflateSync(compressed))));
    assert.doesNotThrow(() => inflateSync(pixels));
    const f = fixture({ bytes });
    await assert.rejects(capturePngEvidence(f.page, outputPath, { write: f.write }), /complete image decoding/);
    assert.deepEqual(f.writes, []);
  });
}

for (const [label, options] of [
  ['uniform white', { blank: true }], ['invisible RGB variation', { transparent: true }],
  ['one nonblank pixel', { nearUniform: true }],
]) {
  test(`rejects ${label} as blank evidence despite being a valid full-sized PNG`, async () => {
    const f = fixture({ bytes: fixturePng(options) });
    await assert.rejects(capturePngEvidence(f.page, outputPath, { write: f.write }), /blank or nearly uniform/);
    assert.deepEqual(f.writes, []);
  });
}

test('write failure propagates without a success result or fallback', async () => {
  const f = fixture();
  const failure = Object.assign(new Error('No space'), { code: 'ENOSPC' });
  const write = async () => { f.calls.push('write'); throw failure; };
  await assert.rejects(capturePngEvidence(f.page, outputPath, { write }), (error) => error === failure);
  assert.deepEqual(f.calls, ['observe', 'capture', 'observe', 'write']);
});

test('does not overwrite an existing evidence file with a new capture', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fairground-capture-existing-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const destination = path.join(directory, 'existing.png');
  await writeFile(destination, 'existing evidence');
  await assert.rejects(capturePngEvidence(fixture().page, destination), { code: 'EEXIST' });
  assert.equal(await readFile(destination, 'utf8'), 'existing evidence');
});

test('unconfirmed post-capture viewport prevents persistence', async () => {
  const f = fixture();
  const evaluate = f.page.evaluate;
  f.page.evaluate = async (fn) => {
    if (f.calls.includes('capture')) throw new Error('Page unavailable');
    return evaluate(fn);
  };
  await assert.rejects(capturePngEvidence(f.page, outputPath, { write: f.write }), /Page unavailable/);
  assert.deepEqual(f.writes, []);
});
