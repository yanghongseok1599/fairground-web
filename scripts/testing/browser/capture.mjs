import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { PNG } from 'pngjs';

const WIDTH = 1512;
const HEIGHT = 828;
const CAPTURE_TIMEOUT_MS = 10000;
const MAX_PNG_BYTES = 16 * 1024 * 1024;
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function viewport() {
  return { width: innerWidth, height: innerHeight, devicePixelRatio };
}

function assertViewport(actual) {
  assert.deepEqual(actual, { width: WIDTH, height: HEIGHT, devicePixelRatio: 1 },
    'PNG evidence requires the expected 1512x828 viewport at DPR 1');
}

function decodePng(data) {
  assert.ok(typeof data === 'string' && data.length > 0 && data.length <= Math.ceil(MAX_PNG_BYTES / 3) * 4,
    'PNG capture returned missing or oversized image data');
  const bytes = Buffer.from(data, 'base64');
  assert.ok(bytes.toString('base64') === data, 'PNG capture returned invalid base64');
  assert.ok(bytes.length >= 57 && bytes.length <= MAX_PNG_BYTES && bytes.subarray(0, 8).equals(SIGNATURE),
    'PNG capture returned an invalid signature or size');
  assert.equal(bytes.readUInt32BE(8), 13, 'PNG capture returned an invalid IHDR');
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', 'PNG capture must begin with IHDR');
  assert.equal(bytes.readUInt32BE(16), WIDTH, 'PNG width does not match the expected viewport');
  assert.equal(bytes.readUInt32BE(20), HEIGHT, 'PNG height does not match the expected viewport');

  // Check framing before decoding, including duplicate headers that could
  // replace the bounded dimensions. pngjs handles CRC and pixel decoding.
  let offset = 8;
  let ended = false;
  const compressed = [];
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, 'PNG chunk is truncated');
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const end = offset + length + 12;
    assert.ok(end <= bytes.length, 'PNG chunk is truncated');
    assert.ok(offset === 8 || type !== 'IHDR', 'PNG contains a duplicate IHDR');
    if (type === 'IDAT') compressed.push(bytes.subarray(offset + 8, end - 4));
    if (type === 'IEND') {
      assert.ok(length === 0 && end === bytes.length, 'PNG has invalid IEND or trailing data');
      ended = true;
    }
    offset = end;
  }
  assert.ok(ended, 'PNG is missing IEND');
  let decoded;
  try {
    // pngjs 7's custom synchronous inflater uses Node-private error state and
    // can return uninitialised pixels for corrupt zlib data on Node 22. Validate
    // the complete stream with the public, bounded API before pixel decoding.
    const inflated = inflateSync(Buffer.concat(compressed), { maxOutputLength: MAX_PNG_BYTES });
    if (bytes[28] === 0) {
      const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[bytes[25]];
      const rowBytes = 1 + Math.ceil(WIDTH * channels * bytes[24] / 8);
      assert.equal(inflated.length, rowBytes * HEIGHT, 'PNG pixel stream has an unexpected scanline size');
    }
    decoded = PNG.sync.read(bytes, { checkCRC: true });
  } catch (cause) {
    throw new Error('PNG capture failed complete image decoding', { cause });
  }
  assert.equal(decoded.width, WIDTH, 'Decoded PNG width does not match');
  assert.equal(decoded.height, HEIGHT, 'Decoded PNG height does not match');
  assert.equal(decoded.data.length, WIDTH * HEIGHT * 4, 'Decoded PNG does not contain a complete RGBA image');

  const sum = [0, 0, 0];
  const squared = [0, 0, 0];
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  for (let index = 0; index < decoded.data.length; index += 4) {
    const alpha = decoded.data[index + 3] / 255;
    for (let channel = 0; channel < 3; channel++) {
      // Ignore invisible colour data by compositing onto white for this check.
      const value = Math.round(decoded.data[index + channel] * alpha + 255 * (1 - alpha));
      sum[channel] += value;
      squared[channel] += value * value;
      min[channel] = Math.min(min[channel], value);
      max[channel] = Math.max(max[channel], value);
    }
  }
  const pixels = WIDTH * HEIGHT;
  const variance = Math.max(...sum.map((total, channel) => squared[channel] / pixels - (total / pixels) ** 2));
  const range = Math.max(...max.map((value, channel) => value - min[channel]));
  // This rejects blank/near-uniform captures; semantic screen assertions still
  // establish which page was rendered and must run independently in the suite.
  assert.ok(variance >= 4 && range >= 16, 'PNG capture is blank or nearly uniform');
  return { bytes, pixelVariance: Number(variance.toFixed(2)) };
}

async function captureWithDeadline(cdp) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => cdp('Page.captureScreenshot', {
        format: 'png', fromSurface: true, captureBeyondViewport: false,
      }, { timeout: CAPTURE_TIMEOUT_MS })),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('PNG capture exceeded the 10000ms deadline');
          error.name = 'PngCaptureTimeoutError';
          reject(error);
        }, CAPTURE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Save mandatory real viewport pixels; never substitute a text snapshot. */
export async function capturePngEvidence(page, outputPath, {
  cdp = (...args) => page.cdp(...args), write = writeFile,
} = {}) {
  assert.ok(typeof outputPath === 'string' && path.isAbsolute(outputPath) && path.extname(outputPath) === '.png',
    'PNG output must be an absolute .png path supplied by the runner');
  const before = await page.evaluate(viewport);
  assertViewport(before);
  // Ego's screenshot wrapper adds a DPR-scaled clip even with raw:true. Direct
  // CDP without a clip avoids that wrapper and never retries a stalled capture.
  const response = await captureWithDeadline(cdp);
  const after = await page.evaluate(viewport);
  assertViewport(after);
  assert.deepEqual(after, before, 'PNG capture changed the viewport');
  const { bytes, pixelVariance } = decodePng(response?.data);
  await write(outputPath, bytes, { mode: 0o600, flag: 'wx' });
  return {
    path: path.basename(outputPath), format: 'png', width: WIDTH, height: HEIGHT,
    devicePixelRatio: before.devicePixelRatio, sizeBytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), pixelVariance,
  };
}
