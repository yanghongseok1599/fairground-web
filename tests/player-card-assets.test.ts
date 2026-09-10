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
import { getJuntasCardPose, JUNTAS_CARD_POSES } from "../src/lib/player-card/photo-registration.ts";

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

assert.equal(getJuntasCardPose("female"), JUNTAS_CARD_POSES.female);
assert.equal(getJuntasCardPose("male"), JUNTAS_CARD_POSES.male);
assert.equal(getJuntasCardPose(undefined), JUNTAS_CARD_POSES.male);
for (const [gender, digest] of Object.entries({
  male: "ae86be117e7d762c8afcea00a78193a07645f48ad8403dbfb8253118614f83f3",
  female: "8a2f2befaa4e70090fcb50b4c2f71266edb0fabd117cc8e4684805943411a8d6",
})) {
  const bytes = readFileSync(join(repositoryRoot, "public", JUNTAS_CARD_POSES[gender as "male" | "female"]));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), digest, "준타스 유니폼 승인본을 유지해야 합니다.");
  assert.equal(bytes[25], 6, "준타스 인물은 투명 배경 PNG여야 합니다.");
}
console.log("Juntas player-card assets tests passed");
