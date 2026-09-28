import assert from "node:assert/strict";
import {
  PLAYER_CARD_FRAME,
  PLAYER_CARD_COMPOSITION,
  PLAYER_CARD_FRAME_ID,
  PLAYER_CARD_PRESET_ID,
  PLAYER_CARD_WIDTH_PX,
  getPlayerCardFrameDimensions,
  type PlayerCardSize,
} from "../src/lib/player-card-frame.ts";

assert.equal(PLAYER_CARD_FRAME_ID, "fairground-player-card-v2");
assert.equal(PLAYER_CARD_PRESET_ID, "fairground-player-card-complete-v2");
assert.equal(Object.isFrozen(PLAYER_CARD_FRAME), true);
assert.equal(Object.isFrozen(PLAYER_CARD_FRAME.pos), true);
assert.equal(Object.isFrozen(PLAYER_CARD_FRAME.pos.photo), true);
assert.equal(Object.isFrozen(PLAYER_CARD_FRAME.fontPct), true);
assert.equal(Object.isFrozen(PLAYER_CARD_WIDTH_PX), true);

assert.deepEqual(PLAYER_CARD_FRAME.pos, {
  rating: { y: 15 },
  position: { y: 26.5 },
  logo: { y: 34 },
  flag: { y: 47 },
  photo: { x: 43.5, y: 11, w: 36, h: 42.5 },
  name: { y: 54.5, w: 48 },
  badges: { y: 66 },
  stats: { y: 77 },
});

const sizes: PlayerCardSize[] = ["sm", "md", "lg", "xl", "export"];
for (const size of sizes) {
  const dimensions = getPlayerCardFrameDimensions(size);
  assert.equal(dimensions.width, PLAYER_CARD_WIDTH_PX[size]);
  assert.equal(
    dimensions.height,
    PLAYER_CARD_WIDTH_PX[size] * PLAYER_CARD_FRAME.aspect,
  );
}

console.log("player-card-frame tests passed");

// Check normalized slot clearances across every rendered size, rather than
// allowing font rounding or an inherited name line-height to close the gaps.
for (const size of sizes) {
  const { width, height } = getPlayerCardFrameDimensions(size);
  const { pos, fontPct } = PLAYER_CARD_FRAME;
  const bottom = (y: number, heightPx: number) => y / 100 * height + heightPx;
  const gap = (nextY: number, previousBottom: number) => (nextY / 100 * height - previousBottom) / height;
  assert.ok(gap(pos.position.y, bottom(pos.rating.y, width * fontPct.rating / 100)) > 0.015);
  assert.ok(gap(pos.logo.y, bottom(pos.position.y, width * fontPct.position / 100)) > 0.03);
  assert.ok(gap(pos.flag.y, bottom(pos.logo.y, width * fontPct.logo / 100)) > 0.03);
  assert.ok(gap(pos.badges.y, bottom(pos.name.y, width * fontPct.name / 100 * 1.7)) > 0.03);
  assert.ok(gap(pos.stats.y, bottom(pos.badges.y, width * fontPct.badge / 100 * 0.95 * 2.745)) > 0.005);
}
assert.equal(PLAYER_CARD_COMPOSITION.width / PLAYER_CARD_COMPOSITION.height, 4 / 5);
const cardBottom = PLAYER_CARD_COMPOSITION.card.y + PLAYER_CARD_COMPOSITION.card.width * PLAYER_CARD_FRAME.aspect;
assert.ok(PLAYER_CARD_COMPOSITION.wordmark.y > cardBottom);
assert.ok(Object.isFrozen(PLAYER_CARD_COMPOSITION.card));
assert.ok(Object.isFrozen(PLAYER_CARD_COMPOSITION.wordmark));
console.log("player-card layout spacing and composition tests passed");
