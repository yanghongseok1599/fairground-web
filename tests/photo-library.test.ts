import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPhotoZip, fetchOriginal } from '../src/features/photo-library/download.ts';
import { safeFilename, originalUrl } from '../src/features/photo-library/model.ts';

test('Korean filenames remain NFC Unicode, strip paths and controls', () => {
  assert.equal(safeFilename('한글 사진.jpg'), '한글 사진.jpg');
  assert.equal(safeFilename('photo.jpg'), 'photo.jpg');
  assert.equal(safeFilename('  '), 'photo.jpg');
  assert.equal(safeFilename('a/b\\c\n.jpg'), 'a_b_c_.jpg');
  assert.equal(safeFilename('한글'.normalize('NFD')), '한글');
  assert.equal(new URL(originalUrl('abc')).searchParams.get('id'), 'abc');
});
test('manifest contains unique photos from supplied folder', () => {
  const album = JSON.parse(readFileSync(new URL('../src/features/photo-library/data/cup-2026.json', import.meta.url), 'utf8'));
  assert.equal(album.photos.length, 2215);
  assert.equal(new Set(album.photos.map((p: { id: string }) => p.id)).size, 2215);
  assert.ok(album.photos.every((p: { size: number }) => p.size > 0));
});
test('ZIP has uncompressed original bytes and UTF-8 Korean names', async () => {
  const raw = new TextEncoder().encode('123456789');
  const zip = new Uint8Array(await (await createPhotoZip([{ name: '원본.jpg', blob: new Blob([raw]) }])).arrayBuffer());
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint16(6, true), 0x0800);
  assert.equal(view.getUint16(8, true), 0);
  assert.equal(view.getUint32(14, true), 0xcbf43926);
  const nameLength = view.getUint16(26, true);
  assert.equal(new TextDecoder().decode(zip.slice(30, 30 + nameLength)), '001_원본.jpg');
  assert.deepEqual(zip.slice(30 + nameLength, 30 + nameLength + raw.length), raw);
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
});
test('HTML/quota responses and truncated originals are rejected', async () => {
  const originalFetch = globalThis.fetch;
  const photo = { id: 'test', name: 'photo.jpg', size: 9 };
  try {
    globalThis.fetch = async () => new Response('<html>quota</html>', { headers: { 'content-type': 'text/html' } });
    await assert.rejects(fetchOriginal(photo, new AbortController().signal), /원본/);
    globalThis.fetch = async () => new Response('short', { headers: { 'content-type': 'image/jpeg' } });
    await assert.rejects(fetchOriginal(photo, new AbortController().signal), /중단/);
    globalThis.fetch = async () => new Response('123456789', { headers: { 'content-type': 'image/jpeg' } });
    assert.equal((await fetchOriginal(photo, new AbortController().signal)).size, 9);
  } finally { globalThis.fetch = originalFetch; }
});
