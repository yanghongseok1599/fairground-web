import { safeFilename, type LibraryPhoto, MAX_ZIP_BYTES } from './model.ts';

export async function fetchOriginal(photo: LibraryPhoto, signal: AbortSignal, progress?: (bytes: number) => void): Promise<Blob> {
  const response = await fetch(`/api/photos/${encodeURIComponent(photo.id)}`, { signal });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
    throw new Error('원본을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  if (!response.body) throw new Error('다운로드를 지원하지 않는 브라우저입니다.');
  const reader = response.body.getReader();
  const parts: ArrayBuffer[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > photo.size) throw new Error('사진이 변경되었습니다. 자료실 목록을 갱신해 주세요.');
      parts.push(value.slice().buffer);
      progress?.(received);
    }
  } catch (error) { await reader.cancel(); throw error; }
  if (received !== photo.size) throw new Error('원본 다운로드가 중단되었습니다. 다시 시도해 주세요.');
  return new Blob(parts, { type: response.headers.get('content-type')! });
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename(name);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function header(length: number) {
  const data = new Uint8Array(length);
  return { data, view: new DataView(data.buffer) };
}

// ZIP STORE: original bytes, UTF-8 filenames, no JPEG recompression.
export async function createPhotoZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  if (files.reduce((sum, file) => sum + file.blob.size, 0) > MAX_ZIP_BYTES) throw new Error('ZIP은 한 번에 200 MB까지 저장할 수 있습니다.');
  const body: BlobPart[] = [];
  const directory: BlobPart[] = [];
  let offset = 0;
  let directorySize = 0;
  for (const [index, file] of files.entries()) {
    const name = new TextEncoder().encode(`${String(index + 1).padStart(3, '0')}_${safeFilename(file.name)}`);
    const checksum = crc32(new Uint8Array(await file.blob.arrayBuffer()));
    const local = header(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint16(12, 0x21, true);
    local.view.setUint32(14, checksum, true);
    local.view.setUint32(18, file.blob.size, true);
    local.view.setUint32(22, file.blob.size, true);
    local.view.setUint16(26, name.length, true);
    body.push(local.data, name, file.blob);
    const central = header(46);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x0800, true);
    central.view.setUint16(14, 0x21, true);
    central.view.setUint32(16, checksum, true);
    central.view.setUint32(20, file.blob.size, true);
    central.view.setUint32(24, file.blob.size, true);
    central.view.setUint16(28, name.length, true);
    central.view.setUint32(42, offset, true);
    directory.push(central.data, name);
    directorySize += 46 + name.length;
    offset += 30 + name.length + file.blob.size;
  }
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, files.length, true);
  end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, directorySize, true);
  end.view.setUint32(16, offset, true);
  return new Blob([...body, ...directory, end.data], { type: 'application/zip' });
}
