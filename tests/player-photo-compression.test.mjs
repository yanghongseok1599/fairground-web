import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader, storeFixture } from './helpers/load-ts-module.mjs';

function fixture(t, { width = 2400, height = 1600, sizes = [200_000, 100_000], encodingStalls = false } = {}) {
  let draws = 0, encodes = 0, revoked = 0;
  t.mock.method(URL, 'createObjectURL', () => 'blob:synthetic');
  t.mock.method(URL, 'revokeObjectURL', () => { revoked++; });
  class Photo {
    naturalWidth = width; naturalHeight = height;
    set src(value) { if (value) queueMicrotask(() => this.onload?.()); }
  }
  const originalImage = globalThis.Image, originalDocument = globalThis.document;
  globalThis.Image = Photo;
  const canvas = { width: 0, height: 0,
    getContext: () => ({ drawImage() { draws++; } }),
    toBlob(callback, mime) { encodes++; if (!encodingStalls) callback(new Blob([new Uint8Array(sizes.shift() ?? 100_000)], { type: mime })); },
  };
  globalThis.document = { createElement: () => canvas };
  t.after(() => { globalThis.Image = originalImage; globalThis.document = originalDocument; });
  const load = moduleLoader({ '@/lib/player-card/read-photo-file': { readPhotoFile: async file => `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}` } });
  return { ...load('src/features/player-photos/compress.ts'), canvas, stats: () => ({ draws, encodes, revoked }) };
}

test('photos are resized proportionally and encoding steps down to the byte cap', async t => {
  const f = fixture(t);
  const url = await f.compressPlayerPhoto(new Blob(['source'], { type: 'image/png' }));
  assert.equal(f.canvas.width, 1024); assert.equal(f.canvas.height, 683);
  assert.equal(Buffer.from(url.split(',')[1], 'base64').length, 100_000);
  assert.deepEqual(f.stats(), { draws: 1, encodes: 2, revoked: 1 });
});

test('already compressed WebP is kept byte-for-byte instead of encoding twice', async t => {
  const f = fixture(t, { width: 512, height: 400 });
  const original = new Blob(['prepared'], { type: 'image/webp' });
  const result = await f.compressPlayerPhoto(original);
  assert.equal(result, 'data:image/webp;base64,cHJlcGFyZWQ='); assert.equal(f.stats().encodes, 0);
});

test('invalid, oversized and excessive-resolution inputs fail before a database write', async t => {
  const f = fixture(t, { width: 10_000, height: 10_000 });
  await assert.rejects(f.compressPlayerPhoto(new Blob(['x'], { type: 'text/plain' })), /사진 파일/);
  await assert.rejects(f.compressPlayerPhoto(new Blob([new Uint8Array(21 * 1024 * 1024)], { type: 'image/png' })), /20MB/);
  await assert.rejects(f.compressPlayerPhoto(new Blob(['x'], { type: 'image/png' })), /해상도/);
  assert.equal(f.stats().revoked, 1);
});

test('canvas encoding timeout settles and releases the object URL', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t, { encodingStalls: true });
  const promise = f.compressPlayerPhoto(new Blob(['x'], { type: 'image/png' }));
  const rejection = assert.rejects(promise, /압축 시간이 초과/);
  await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(15_000); await rejection;
  assert.equal(f.stats().revoked, 1);
});

test('restored duplicate photo drafts compress once; ordinary URL fields stay unchanged', async t => {
  const f = fixture(t, { sizes: [100] });
  const value = 'data:image/png;base64,eA==';
  const patch = { photoUrl: value, profilePhotoUrl: value, name: '원래 이름' };
  const output = await f.preparePlayerPhotoPatch(patch);
  assert.equal(output.photoUrl, output.profilePhotoUrl); assert.equal(f.stats().encodes, 1);
  assert.equal(patch.photoUrl, value); assert.equal(output.name, patch.name);
  assert.deepEqual(await f.preparePlayerPhotoPatch({ photoUrl: 'https://example.invalid/photo.webp' }), { photoUrl: 'https://example.invalid/photo.webp' });
});

test('malformed restored photo prevents the actual profile update and preserves the current player', async () => {
  const f = storeFixture();
  await assert.rejects(f.auth.getState().updatePlayer({ photoUrl: 'data:invalid' }), /보관된 사진/);
  assert.equal(f.requests.length, 0); assert.equal(f.auth.getState().player.photoUrl, f.player.photoUrl);
});
