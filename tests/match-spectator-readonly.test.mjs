import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

// Run the real hook's effects with a deterministic local clock and store.
function fixture(t) {
  const load = moduleLoader();
  const { createPracticeStore } = load("src/features/match-simulation/store.ts");
  const actual = createPracticeStore();
  const m = actual.getState().snapshot.match;
  const writes = [];
  const store = { ...actual.getState(), managesClock: false };
  for (const key of ["startMatch", "pauseMatch", "resumeMatch", "endMatch", "addMatchEvent", "cancelMatchEvent", "setMatchMom", "updateMatchTimer", "notifyNextMatchReady"]) store[key] = async () => { writes.push(key); };
  const cells = [], effects = [], timers = new Map(); let cursor = 0, nextTimer = 0;
  const prior = { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval, window: globalThis.window };
  globalThis.window = new EventTarget();
  globalThis.setInterval = fn => { timers.set(++nextTimer, fn); return nextTimer; };
  globalThis.clearInterval = id => timers.delete(id);
  const react = {
    useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = typeof initial === "function" ? initial() : initial; return [cells[i], value => { cells[i] = typeof value === "function" ? value(cells[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial }; },
    useCallback(fn) { return fn; },
    useEffect(fn, deps) { const i = cursor++; const old = cells[i]; if (!old || !deps || deps.some((d, j) => !Object.is(d, old.deps[j]))) effects.push(() => { old?.cleanup?.(); cells[i] = { deps, cleanup: fn() }; }); },
  };
  const { useMatchControl: runHook } = moduleLoader({ react, "@/features/match-control/store-context": { useMatchControlStore: () => store } })("src/hooks/useMatchControl.ts");
  let result;
  const render = () => { cursor = 0; result = runHook({ tournamentId: m.tournamentId, matchId: m.id, readOnly: true }); while (effects.length) effects.shift()(); return result; };
  const flush = async () => { for (let i = 0; i < 6; i++) { await Promise.resolve(); render(); } return result; };
  t.after(() => { cells.forEach(c => c?.cleanup?.()); globalThis.setInterval = prior.setInterval; globalThis.clearInterval = prior.clearInterval; if (prior.window) globalThis.window = prior.window; else delete globalThis.window; });
  return { actual, m, store, writes, render, flush, tick: () => [...timers.values()].forEach(fn => fn()) };
}

test("참가자 중계의 모든 기록 액션과 12분 시계는 운영 저장소에 쓰지 않는다", async t => {
  const f = fixture(t);
  await f.actual.getState().startMatch(f.m.tournamentId, f.m.id); f.store.liveMatches = f.actual.getState().liveMatches;
  let hook = await f.flush();
  for (const run of [() => hook.startMatch(), () => hook.pauseMatch(), () => hook.resumeMatch(), () => hook.endMatch(), () => hook.cancelEvent("event"), () => hook.setMom("player"), () => hook.addEvent({ type: "goal", playerId: "player", teamId: "team", playerName: "name" })]) assert.equal(await run(), false);
  for (let i = 0; i < 725; i++) f.tick();
  hook = f.render(); assert.equal(hook.elapsedSeconds, 720); assert.deepEqual(f.writes, []);
});

test("라이브 목록에서 빠진 종료 경기를 다시 읽어 최종 점수와 MOM을 표시한다", async t => {
  const f = fixture(t); const state = f.actual.getState();
  await state.startMatch(f.m.tournamentId, f.m.id); f.store.liveMatches = f.actual.getState().liveMatches; await f.flush();
  await state.addMatchEvent(f.m.tournamentId, f.m.id, { type: "goal", playerId: "practice-blue-6", playerName: "", teamId: "practice-blue", minute: 1, half: 1 });
  await state.setMatchMom(f.m.tournamentId, f.m.id, "practice-blue-6"); await state.endMatch(f.m.tournamentId, f.m.id);
  f.store.liveMatches = []; const hook = await f.flush();
  assert.equal(hook.match.status, "finished"); assert.equal(hook.match.homeScore, 1); assert.equal(hook.match.momPlayerId, "practice-blue-6"); assert.equal(hook.isRunning, false); assert.deepEqual(f.writes, []);
});
