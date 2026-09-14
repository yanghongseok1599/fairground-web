import { EventStoreError } from "./store.ts";

export function eventResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function eventError(error: unknown) {
  if (error instanceof EventStoreError)
    return eventResponse({ error: error.message }, error.status);
  return eventResponse(
    {
      error:
        "이벤트 파일을 읽거나 저장하지 못했습니다. 현장 운영 서버를 확인해 주세요.",
    },
    500,
  );
}

export function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer /, "");
}

export async function eventBody(
  request: Request,
): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  // Next's Request URL may use its 0.0.0.0 bind address; Host is the browser-facing origin.
  const url = new URL(request.url);
  const expectedOrigin = `${url.protocol}//${request.headers.get("host") || url.host}`;
  if (origin && origin !== expectedOrigin)
    throw new EventStoreError(
      "다른 사이트에서 보낸 저장 요청은 허용하지 않습니다.",
      403,
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new EventStoreError("JSON 요청만 지원합니다.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new EventStoreError("요청 본문이 없습니다.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 256_000) {
      await reader.cancel();
      throw new EventStoreError("요청이 너무 큽니다.", 413);
    }
    chunks.push(value);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new EventStoreError("요청 형식을 확인해 주세요.");
  }
}
