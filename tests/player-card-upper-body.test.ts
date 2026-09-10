import assert from "node:assert/strict";
import { getUpperBodyPortraitStyles, UPPER_BODY_VISIBLE_FRACTION } from "../src/lib/player-card/upper-body-portrait.ts";

for (const scale of [0.5, 0.92, 1, 1.5, 2.5]) {
  const styles = getUpperBodyPortraitStyles(scale, 12, true);
  assert.equal(styles.frame.overflow, "hidden");
  assert.equal(styles.crop.overflow, "hidden", "하반신은 확대/축소 전에 잘라낸다");
  assert.equal(styles.crop.transformOrigin, "center top", "머리 위치는 위에 고정");
  assert.equal(styles.crop.transform, `scale(${scale})`);
  assert.equal(styles.image.height, `${100 / UPPER_BODY_VISIBLE_FRACTION}%`);
  assert.equal(styles.image.width, "auto", "인물 비율은 유지");
  assert.equal(styles.image.top, 0);
  assert.equal(styles.image.transform, "translateX(calc(-50% + 12%))");
}
assert.equal(getUpperBodyPortraitStyles(NaN).crop.transform, "scale(1)");
assert.equal(getUpperBodyPortraitStyles(100).crop.transform, "scale(2.5)");
assert.equal(getUpperBodyPortraitStyles().image.filter, undefined);
console.log("player-card upper-body display tests passed");
