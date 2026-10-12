export type LibraryPhoto = { id: string; name: string; size: number };
export const MAX_ZIP_BYTES = 200 * 1024 * 1024;
export const PAGE_SIZE = 48;
export function formatBytes(bytes: number) {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
export function originalUrl(id: string) {
  return `https://drive.usercontent.google.com/download?${new URLSearchParams({ id, export: 'download' })}`;
}
export function thumbnailUrl(id: string) { return `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w640`; }
export function safeFilename(name: string) {
  return name.normalize('NFC').replace(/[\x00-\x1f\x7f/\\]/g, '_').trim() || 'photo.jpg';
}
