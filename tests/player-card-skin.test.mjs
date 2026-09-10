import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function fixture() {
  const memory = () => { const map = new Map(); return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) }; };
  const window = { localStorage: memory(), sessionStorage: memory() };
  const code = ts.transpileModule(readFileSync("src/lib/player-card-skin.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("exports", "window", code)(exports, window);
  return { ...exports, window };
}

test("챌린지 자격 보유자도 기본·대회·편집 카드는 standard, 명시적 챌린지만 hologram", () => {
  const f = fixture(), player = { cardSkin: "hologram" };
  assert.equal(f.getPlayerCardDisplaySkin(player), "standard");
  assert.equal(f.getPlayerCardDisplaySkin(player, "league"), "standard");
  assert.equal(f.getPlayerCardDisplaySkin(player, "challenge"), "hologram");
  assert.equal(f.getPlayerCardDisplaySkin({ cardSkin: "standard" }, "challenge"), "standard");
  assert.equal(f.isHologramPlayerCard(player), true, "참가 자격·집계는 보존");
});
test("영구 저장된 이전 이벤트는 새 가입에 상속되지 않는다", () => {
  const f = fixture(); f.window.localStorage.setItem(f.GROUND_CHALLENGE_CARD_STORAGE_KEY, "hologram");
  assert.equal(f.readPendingCardSkin(), undefined);
  f.rememberPendingCardSkin("hologram"); assert.equal(f.readPendingCardSkin(), "hologram");
  f.rememberPendingCardSkin(); assert.equal(f.readPendingCardSkin(), undefined);
});
test("만료·손상·저장소 차단 시 일반 카드로 안전하게 복귀", () => {
  for (const value of ["broken", JSON.stringify({ cardSkin: "hologram", expiresAt: Date.now() - 1 })]) {
    const f = fixture(); f.window.sessionStorage.setItem(f.PENDING_CARD_SKIN_SESSION_KEY, value);
    assert.equal(f.readPendingCardSkin(), undefined);
  }
  const f = fixture();
  f.window.localStorage.removeItem = () => { throw new Error("denied"); };
  f.window.sessionStorage.setItem = () => { throw new Error("denied"); };
  assert.doesNotThrow(() => f.rememberPendingCardSkin("hologram"));
  assert.equal(f.readPendingCardSkin(), undefined);
});
test("일반 진입은 기본 카드, standard 명시는 챌린지 캠페인보다 우선", () => {
  const f = fixture();
  assert.equal(f.getCardSkinFromSearchParams(new URLSearchParams()), undefined);
  assert.equal(f.getCardSkinFromSearchParams(new URLSearchParams("event=ground-challenge")), "hologram");
  assert.equal(f.getCardSkinFromSearchParams(new URLSearchParams("event=ground-challenge&cardSkin=standard")), "standard");
  const setup = readFileSync("src/app/my/player-setup/page.tsx", "utf8");
  assert.ok(!setup.includes("readPendingCardSkin"), "일반 선수 등록이 이전 브라우저 이벤트를 읽지 않음");
});
