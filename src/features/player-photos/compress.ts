import { readPhotoFile } from "@/lib/player-card/read-photo-file";
import { photoDraftToBlob } from "@/lib/registration/reliability";

export const MAX_PHOTO_BYTES = 120 * 1024;
export const MAX_PHOTO_EDGE = 1024;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

function encodePhoto(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("사진 압축 시간이 초과되었습니다. 사진을 다시 선택해주세요.")), 15_000);
    try {
      canvas.toBlob(blob => { clearTimeout(timer); resolve(blob); }, "image/webp", quality);
    } catch (error) { clearTimeout(timer); reject(error); }
  });
}

/** Preserve transparent backgrounds; encode before starting any database write. */
export async function compressPlayerPhoto(file: Blob): Promise<string> {
  if (!file.type.startsWith("image/") || !file.size || file.size > MAX_INPUT_BYTES) {
    throw new Error("20MB 이하의 사진 파일을 선택해주세요.");
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("사진 처리 시간이 초과되었습니다. 사진을 다시 선택해주세요.")), 15_000);
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("사진을 읽지 못했습니다. JPG, PNG 또는 WebP 사진을 선택해주세요."));
      image.src = url;
    });
    clearTimeout(timer);
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 64_000_000) {
      throw new Error("사진 해상도가 너무 큽니다. 작은 사진을 선택해주세요.");
    }
    // Already prepared file-picker results should not suffer a second lossy encode.
    if (file.type === "image/webp" && file.size <= MAX_PHOTO_BYTES
      && Math.max(image.naturalWidth, image.naturalHeight) <= MAX_PHOTO_EDGE) return await readPhotoFile(file);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진 처리 기능을 사용할 수 없습니다.");
    for (const edge of [MAX_PHOTO_EDGE, 768, 512]) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.72, 0.58]) {
        const blob = await encodePhoto(canvas, quality);
        // Browsers without WebP encoding may return PNG: it is still safe if under the cap.
        if (blob && blob.size <= MAX_PHOTO_BYTES) return await readPhotoFile(blob);
      }
    }
    throw new Error("사진 용량을 줄이지 못했습니다. 다른 사진을 선택해주세요.");
  } finally {
    clearTimeout(timer);
    image.onload = image.onerror = null;
    image.src = "";
    URL.revokeObjectURL(url);
  }
}

/** Covers restored drafts and direct callers that bypass the file picker. */
export async function preparePlayerPhotoPatch<T extends { photoUrl?: string; profilePhotoUrl?: string }>(patch: T): Promise<T> {
  const next = { ...patch };
  const cache = new Map<string, Promise<string>>();
  for (const key of ["photoUrl", "profilePhotoUrl"] as const) {
    const value = next[key];
    if (!value?.startsWith("data:")) continue;
    if (!cache.has(value)) cache.set(value, compressPlayerPhoto(photoDraftToBlob(value)));
    next[key] = await cache.get(value)!;
  }
  return next;
}
