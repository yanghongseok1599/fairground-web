import assert from "node:assert/strict";
import { faceMaskAlpha, requireSingleFace, triangleTransform, type Triangle } from "../src/lib/player-card/face-geometry.ts";

const source: Triangle = [{ x: 27, y: 43 }, { x: 110, y: 35 }, { x: 63, y: 130 }];
const target: Triangle = [{ x: 418, y: 205 }, { x: 508, y: 260 }, { x: 390, y: 340 }];
const transform = triangleTransform(source, target)!;
source.forEach((point, i) => {
  assert.ok(Math.abs(transform[0] * point.x + transform[2] * point.y + transform[4] - target[i].x) < 1e-8);
  assert.ok(Math.abs(transform[1] * point.x + transform[3] * point.y + transform[5] - target[i].y) < 1e-8);
});
assert.equal(triangleTransform([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], target), null);
const outline = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
assert.equal(faceMaskAlpha({ x: 50, y: 50 }, outline, 10), 1, "old eyes, nose and mouth must be fully covered");
assert.equal(faceMaskAlpha({ x: -1, y: 50 }, outline, 10), 0, "hair and body must remain untouched");
assert.equal(faceMaskAlpha({ x: 5, y: 50 }, outline, 10), 0.5, "blend only the boundary");
assert.throws(() => requireSingleFace([]), /얼굴을 찾지 못했습니다/);
assert.throws(() => requireSingleFace([{}, {}]), /여러 얼굴/);
const face = { id: "selected-person" };
assert.equal(requireSingleFace([face]), face);
console.log("player-card-face-geometry tests passed");
