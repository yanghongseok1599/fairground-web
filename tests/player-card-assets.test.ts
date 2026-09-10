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
  male: "bb770c4bf0457fac76e4f066e378bf2b8ff72ef125dba4c4e0c2855a07f047f8",
  female: "fc5a8cd05f9b4139636f1fefc7e9569350f3264bdbbf34f82f4db8d72025aea9",
})) {
  const bytes = readFileSync(join(repositoryRoot, "public", JUNTAS_CARD_POSES[gender as "male" | "female"]));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), digest, "준타스 유니폼 승인본을 유지해야 합니다.");
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(bytes.readUInt32BE(16), 1024);
  assert.equal(bytes.readUInt32BE(20), 1536);
  // RGB source assets are segmented before composition; raw assets are never rendered as the card photo.
}
const model = readFileSync(join(repositoryRoot, "public/models/selfie-head/selfie_multiclass_256x256.tflite"));
assert.equal(createHash("sha256").update(model).digest("hex"), "c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0");
console.log("Juntas player-card assets tests passed");
