import assert from "node:assert/strict";
import {
  FICTIONAL_PLAYER_CARD_POSE_SOURCES,
  PLAYER_CARD_IMAGE_SET_ID,
  PLAYER_CARD_IMAGE_SHA256,
  PLAYER_CARD_POSE_TEMPLATES,
  getTeamlessPlayerCardPose,
  resolvePlayerCardPhoto,
} from "../src/lib/player-card-pose-templates.ts";

assert.equal(Object.isFrozen(FICTIONAL_PLAYER_CARD_POSE_SOURCES), true);
assert.equal(Object.isFrozen(PLAYER_CARD_IMAGE_SHA256), true);
assert.equal(PLAYER_CARD_IMAGE_SET_ID, "fairground-fictional-korean-players-v1");
assert.equal(Object.isFrozen(PLAYER_CARD_POSE_TEMPLATES), true);
assert.equal(PLAYER_CARD_POSE_TEMPLATES.length, 6);

const sources = Object.values(FICTIONAL_PLAYER_CARD_POSE_SOURCES);
assert.deepEqual(Object.keys(FICTIONAL_PLAYER_CARD_POSE_SOURCES), Object.keys(PLAYER_CARD_IMAGE_SHA256));
assert.equal(new Set(sources).size, sources.length);
for (const source of sources) {
  assert.match(source, /^\/images\/player-card-poses\/fictional-korean-.+\.png$/);
}

const fallbackPlayer = {
  id: "player-without-photo",
  uid: "user-without-photo",
  photoUrl: "",
  gender: "female" as const,
};
const firstFallback = resolvePlayerCardPhoto(fallbackPlayer);
const secondFallback = resolvePlayerCardPhoto(fallbackPlayer);

assert.equal(firstFallback, secondFallback);
assert.equal(firstFallback, getTeamlessPlayerCardPose("female", fallbackPlayer.id).src);
assert.match(firstFallback, /fictional-korean-female-/);
assert.match(
  resolvePlayerCardPhoto({ ...fallbackPlayer, id: "male-player", gender: "male" }),
  /fictional-korean-male-/,
);
assert.equal(
  resolvePlayerCardPhoto({ ...fallbackPlayer, photoUrl: "  /uploads/players/custom.webp  " }),
  "/uploads/players/custom.webp",
);

console.log("player-card-photo-fallback tests passed");
