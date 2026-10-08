import { parseSurveySubmission } from "@/features/festival-survey/model";
import { saveSurveyResponse } from "@/features/festival-survey/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0" };
// Four legal 3,000-character answers can exceed 72 KiB when JSON escapes controls.
const MAX_REQUEST_BYTES = 96 * 1024;

export async function POST(request: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return Response.json({ error: "JSON 형식으로 응답을 제출해 주세요." }, { status: 415, headers });
  }
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "설문 응답이 없습니다." }, { status: 400, headers });
  let input: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return Response.json({ error: "응답 내용이 너무 깁니다. 각 의견을 3,000자 이내로 입력해 주세요." }, { status: 413, headers });
      }
      chunks.push(value);
    }
    const body = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return Response.json({ error: "설문 응답을 읽을 수 없습니다. 다시 제출해 주세요." }, { status: 400, headers });
  } finally {
    reader.releaseLock();
  }
  const validation = parseSurveySubmission(input);
  if (!validation.success) {
    return Response.json({ error: "필수 응답과 입력 내용을 확인해 주세요.", errors: validation.errors }, { status: 422, headers });
  }
  const result = await saveSurveyResponse(validation.value);
  if (!result.success) return Response.json({ error: result.error }, { status: result.status, headers });
  return Response.json({ success: true }, { headers });
}
