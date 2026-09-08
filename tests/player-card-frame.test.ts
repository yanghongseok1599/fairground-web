import assert from "node:assert/strict";
import {
  PLAYER_CARD_FRAME,
  PLAYER_CARD_FRAME_ID,
  PLAYER_CARD_PRESET_ID,
  PLAYER_CARD_WIDTH_PX,
  getPlayerCardFrameDimensions,
  type PlayerCardSize,
} from "../src/lib/player-card-frame.ts";

assert.equal(PLAYER_CARD_FRAME_ID, "fairground-player-card-v1");
assert.equal(PLAYER_CARD_PRESET_ID, "fairground-player-card-complete-v1");
assert.equal(Object.isFrozen(PLAYER_CARD_FRAME), true);
assert.equal(Object.isFrozen(PLAYER_CARD_FRAME.pos), true);
assert.equal(Object.isFrozen(PLAYER_CARD_FRAME.pos.photo), true);
assert.equal(Object.isFrozen(PLAYER_CARD_FRAME.fontPct), true);
assert.equal(Object.isFrozen(PLAYER_CARD_WIDTH_PX), true);

assert.deepEqual(PLAYER_CARD_FRAME.pos, {
  rating: { y: 17 },
  position: { y: 28 },
  logo: { y: 34.5 },
  flag: { y: 45.5 },
  photo: { x: 43.5, y: 11, w: 36, h: 42.5 },
  name: { y: 54.5, w: 48 },
  badges: { y: 63.5 },
  stats: { y: 75.5 },
});

const sizes: PlayerCardSize[] = ["sm", "md", "lg", "xl", "export"];
for (const size of sizes) {
  const dimensions = getPlayerCardFrameDimensions(size);
  assert.equal(dimensions.width, PLAYER_CARD_WIDTH_PX[size]);
  assert.equal(
    dimensions.height,
    Math.round(PLAYER_CARD_WIDTH_PX[size] * PLAYER_CARD_FRAME.aspect),
  );
}

console.log("player-card-frame tests passed");
