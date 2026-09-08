import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FICTIONAL_PLAYER_CARD_POSE_SOURCES,
  PLAYER_CARD_IMAGE_SET_ID,
  PLAYER_CARD_IMAGE_SHA256,
} from "../src/lib/player-card-pose-templates.ts";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

assert.equal(PLAYER_CARD_IMAGE_SET_ID, "fairground-fictional-korean-players-v1");

for (const key of Object.keys(FICTIONAL_PLAYER_CARD_POSE_SOURCES) as Array<keyof typeof FICTIONAL_PLAYER_CARD_POSE_SOURCES>) {
  const source = FICTIONAL_PLAYER_CARD_POSE_SOURCES[key];
  const imagePath = join(repositoryRoot, "public", source.replace(/^\//, ""));
  const bytes = readFileSync(imagePath);
  const digest = createHash("sha256").update(bytes).digest("hex");

  assert.equal(digest, PLAYER_CARD_IMAGE_SHA256[key], `${key} 이미지 파일이 승인본과 다릅니다.`);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${key} 파일은 PNG여야 합니다.`);
  assert.equal(bytes.readUInt32BE(16), 1024, `${key} 이미지 너비가 변경되었습니다.`);
  assert.equal(bytes.readUInt32BE(20), 1536, `${key} 이미지 높이가 변경되었습니다.`);
  assert.equal(bytes[25], 6, `${key} 이미지는 RGBA 알파 PNG여야 합니다.`);
}

console.log("player-card-assets tests passed");
