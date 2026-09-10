export const PHOTO_READ_TIMEOUT_MS = 15_000;

/** Read locally before any profile write; every terminal event settles exactly once. */
export function readPhotoFile(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;
    const finish = (result: string | null, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reader.onload = reader.onerror = reader.onabort = null;
      if (error) reject(error);
      else resolve(result!);
    };
    const timer = setTimeout(() => {
      finish(null, new Error("사진 읽기 시간이 초과되었습니다. 사진을 다시 선택해주세요."));
      // Detach handlers first: abort must not replace the timeout error.
      try { reader.abort(); } catch { /* The read may already have ended. */ }
    }, PHOTO_READ_TIMEOUT_MS);
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.length > 0) finish(reader.result);
      else finish(null, new Error("사진을 읽지 못했습니다. 다시 선택해주세요."));
    };
    reader.onerror = () => finish(null, new Error("사진을 읽지 못했습니다. 다시 선택해주세요."));
    reader.onabort = () => finish(null, new Error("사진 읽기가 중단되었습니다. 다시 선택해주세요."));
    try { reader.readAsDataURL(file); }
    catch { finish(null, new Error("사진을 읽지 못했습니다. 다시 선택해주세요.")); }
  });
}
