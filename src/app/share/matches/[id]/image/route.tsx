import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSharedMatchResult } from "@/features/match-share/server/result";
import { ResultImage } from "@/features/match-share/result-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const font = readFile(join(process.cwd(), "public/fonts/Paperlogy-7Bold.ttf"));

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getSharedMatchResult((await params).id);
  if (!result) return new Response("공개된 종료 경기 결과가 없습니다.", { status: 404, headers: { "Cache-Control": "no-store" } });
  const data = await font;
  return new ImageResponse(<ResultImage result={result} />, {
    width: 1200, height: 630,
    fonts: [{ name: "Paperlogy", data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, weight: 700, style: "normal" }],
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60" },
  });
}
