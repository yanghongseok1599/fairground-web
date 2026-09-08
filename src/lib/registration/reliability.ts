/** A disconnected response does not prove that the server rolled back a write. */
export function registrationError(error: unknown, fallback = "저장하지 못했습니다."): string {
  const message = error instanceof Error ? error.message
    : typeof error === "object" && error && "message" in error ? String(error.message) : "";
  if (/abort|timeout|timed out|fetch|network|load failed|lock/i.test(message)) {
    return "서버 응답을 확인하지 못했습니다. 입력은 유지됩니다. 연결이 돌아오면 저장 결과를 확인한 뒤 다시 시도해주세요.";
  }
  if (/row-level security|permission denied|PGRST116/i.test(message)) {
    return "저장이 확인되지 않았습니다. 로그인한 계정과 팀 수정 권한을 확인해주세요. 입력은 유지됩니다.";
  }
  return message || fallback;
}

export function requireSavedRow<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(registrationError(error));
  if (!data) throw new Error("저장이 확인되지 않았습니다. 입력을 유지한 채 로그인 상태와 수정 권한을 확인해주세요.");
  return data;
}

// Abort the actual HTTP request, including body consumption. Never retry writes here.
export async function registrationFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // AbortSignal.any/timeout are missing on older participant iPhones.
  const controller = new AbortController();
  const source = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort(source?.reason);
  if (source?.aborted) abort();
  else source?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    source?.removeEventListener("abort", abort);
    controller.abort(new Error("서버 응답 timeout"));
  }, 25_000);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    // PostgREST/Auth return JSON, not streams; also bound waiting for the body.
    const body = await response.arrayBuffer();
    return new Response(body.byteLength ? body : null, { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally {
    clearTimeout(timer);
    source?.removeEventListener("abort", abort);
  }
}

export function readPhotoFile(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result) : reject(new Error("사진을 읽지 못했습니다. 다시 선택해주세요."));
    reader.onerror = () => reject(new Error("사진을 읽지 못했습니다. 다시 선택해주세요."));
    reader.onabort = () => reject(new Error("사진 읽기가 중단되었습니다. 다시 선택해주세요."));
    reader.readAsDataURL(file);
  });
}

export function photoDraftToBlob(dataUrl: string): Blob {
  const match = /^data:(image\/[\w.+-]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("보관된 사진을 읽지 못했습니다. 사진을 다시 선택해주세요.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}
