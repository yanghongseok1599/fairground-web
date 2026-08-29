import assert from "node:assert/strict";
import {
  PLAYER_CARD_CREATE_FROM_SHARE_PATH,
  getPlayerCardShareUrls,
  getPublicPlayerPath,
} from "../src/lib/player-card-share-links.ts";

assert.equal(
  PLAYER_CARD_CREATE_FROM_SHARE_PATH,
  "/my/player-setup?source=player-card-share",
);
assert.equal(getPublicPlayerPath("player/한글"), "/players/player%2F%ED%95%9C%EA%B8%80");
assert.deepEqual(getPlayerCardShareUrls("https://fairground-kor.com", "player-1"), {
  playerUrl: "https://fairground-kor.com/players/player-1",
  createCardUrl:
    "https://fairground-kor.com/my/player-setup?source=player-card-share",
});

console.log("player-card-share-links tests passed");
