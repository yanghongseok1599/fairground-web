import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleLoader, memoryStorage } from "./helpers/load-ts-module.mjs";

const load = moduleLoader({
  "@/config/supabase": new Proxy({}, { get() { throw Error("Simulation must not access Supabase"); } }),
  "@/stores/dataStore": new Proxy({}, { get() { throw Error("Simulation must not access the production store"); } }),
});
const { createPracticeStore } = load("src/features/match-simulation/store.ts");
const { readPracticeSnapshot, savePracticeSnapshot, PRACTICE_STORAGE_KEY } = load("src/features/match-simulation/persistence.ts");

function fixture() {
  const store = createPracticeStore();
  const state = () => store.getState();
  const match = () => state().snapshot.match;
  const home = state().snapshot.players.find(p => p.number === 3);
  const event = type => ({ type, playerId: home.id, playerName: home.name, teamId: home.teamId, minute: 1, half: 1 });
  const start = () => state().startMatch(match().tournamentId, match().id);
  const add = type => state().addMatchEvent(match().tournamentId, match().id, event(type));
  return { store, state, match, home, event, start, add };
}

test("가상 2팀·14명·선발 5명씩 생성하고 새 경기에는 이전 기록을 가져오지 않는다", async () => {
  const f = fixture();
  assert.equal(f.state().snapshot.players.length, 14);
  assert.equal(f.state().snapshot.lineup.filter(p => p.isStarter).length, 10);
  const previous = f.match().id;
  await f.start(); await f.add("goal"); f.state().reset();
  assert.notEqual(f.match().id, previous);
  assert.equal(f.match().status, "scheduled");
  assert.equal(f.match().homeScore, 0);
  assert.deepEqual(f.match().events, []);
});

test("득점 취소를 반복해도 점수가 음수가 되지 않으며 취소 기록을 보존한다", async () => {
  const f = fixture(); await f.start(); await f.add("goal");
  assert.equal(f.match().homeScore, 1);
  const eventId = f.match().events[0].id;
  for (let i = 0; i < 2; i++) await f.state().cancelMatchEvent(f.match().tournamentId, f.match().id, eventId);
  assert.equal(f.match().homeScore, 0);
  assert.equal(f.match().events[0].isCancelled, true);
});

test("경고 두 번은 퇴장을 한 번 생성하고 경고 정정 시 자동 퇴장을 취소한다", async () => {
  const f = fixture(); await f.start(); await f.add("yellow_card"); await f.add("yellow_card");
  assert.equal(f.match().events.filter(e => e.type === "red_card" && !e.isCancelled).length, 1);
  const second = f.match().events.filter(e => e.type === "yellow_card")[1];
  await f.state().cancelMatchEvent(f.match().tournamentId, f.match().id, second.id);
  assert.equal(f.match().events.filter(e => e.type === "red_card" && !e.isCancelled).length, 0);
});

test("자동 진행은 12분에서 멈추고 2:1 결과를 유지하며 종료 확인을 기다린다", async () => {
  const f = fixture(); f.state().startAutomatic();
  for (let i = 0; i < 20; i++) f.state().tick();
  assert.equal(f.state().snapshot.elapsedSeconds, 720);
  assert.equal(f.state().snapshot.running, false);
  assert.equal(f.match().status, "live");
  assert.equal(f.match().homeScore, 2);
  assert.equal(f.match().awayScore, 1);
  assert.equal(f.match().events.filter(e => e.type === "red_card").length, 1);
  await assert.rejects(f.state().resumeMatch(f.match().id));
  const count = f.match().events.length;
  f.state().startAutomatic(); f.state().tick();
  assert.equal(f.match().events.length, count);
});

test("일시정지·재개와 속도 조절이 한 개의 시계만 변경한다", async () => {
  const f = fixture(); await f.start(); f.state().setSpeed(10); f.state().tick();
  assert.equal(f.state().snapshot.elapsedSeconds, 10);
  await f.state().pauseMatch(f.match().id); f.state().tick();
  assert.equal(f.state().snapshot.elapsedSeconds, 10);
  await f.state().resumeMatch(f.match().id); f.state().setSpeed(60); f.state().tick();
  assert.equal(f.state().liveMatches[0].elapsedSeconds, 70);
});

test("교체는 같은 팀의 코트·벤치만 바꾸며 선발 5명을 유지한다", async () => {
  const f = fixture(); await f.start(); const team = f.home.teamId;
  await f.state().substitutePlayer(f.match().id, team, `${team}-3`, `${team}-6`, "", 1, 1);
  const lineup = f.state().snapshot.lineup.filter(p => p.teamId === team);
  assert.equal(lineup.filter(p => p.isStarter).length, 5);
  assert.equal(lineup.find(p => p.playerId === `${team}-6`).isStarter, true);
  assert.equal(lineup.find(p => p.playerId === `${team}-3`).isStarter, false);
  await assert.rejects(f.state().substitutePlayer(f.match().id, team, `${team}-3`, `${team}-6`, "", 1, 1));
});

test("MOM·종료는 가상 선수에게 한 번만 반영되고 종료 후 추가 기록은 거부한다", async () => {
  const f = fixture(); await f.start(); await f.add("goal");
  await f.state().setMatchMom(f.match().tournamentId, f.match().id, f.home.id);
  for (let i = 0; i < 2; i++) await f.state().endMatch(f.match().tournamentId, f.match().id);
  assert.deepEqual(f.state().snapshot.players.find(p => p.id === f.home.id).stats, { games: 1, goals: 1, assists: 0, mom: 1 });
  assert.equal(f.match().status, "finished");
  assert.deepEqual(f.state().liveMatches, []);
  await assert.rejects(f.add("goal"));
});

test("운영 경기·선수 ID를 넘겨도 외부 저장소로 전환하지 않고 거부한다", async () => {
  const f = fixture(); await f.start();
  await assert.rejects(f.state().fetchMatch("real-tournament", "real-match"));
  await assert.rejects(f.state().pauseMatch("real-match"));
  await assert.rejects(f.state().addMatchEvent(f.match().tournamentId, f.match().id, { ...f.event("goal"), playerId: "real-player" }));
  assert.equal(await f.state().notifyNextMatchReady(f.match().id), 0);
  assert.equal(f.match().homeScore, 0);
});

test("자체 키만 저장하며 새로고침 복원은 점수를 유지하고 시계를 멈춘다", async () => {
  const storage = memoryStorage(); storage.setItem("fg_matches", "preserved");
  const f = fixture(); f.state().startAutomatic(); f.state().tick();
  savePracticeSnapshot(storage, f.state().snapshot);
  const restored = createPracticeStore(readPracticeSnapshot(storage)).getState();
  assert.equal(restored.snapshot.match.homeScore, 1);
  assert.equal(restored.snapshot.running, false);
  assert.equal(restored.snapshot.automatic, false);
  assert.equal(storage.getItem("fg_matches"), "preserved");
  storage.setItem(PRACTICE_STORAGE_KEY, "broken");
  assert.throws(() => readPracticeSnapshot(storage));
});
