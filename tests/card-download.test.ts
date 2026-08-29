import assert from "node:assert/strict";
import { isAppleMobileDevice } from "../src/lib/card-download.ts";

assert.equal(
  isAppleMobileDevice(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    5,
  ),
  true,
);
assert.equal(
  isAppleMobileDevice(
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36",
    5,
  ),
  false,
);
assert.equal(
  isAppleMobileDevice(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    0,
  ),
  false,
);
assert.equal(
  isAppleMobileDevice(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    5,
  ),
  true,
);

console.log("card-download tests passed");
