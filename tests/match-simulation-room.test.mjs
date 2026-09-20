import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

const load = moduleLoader({ "@/stores/dataStore": new Proxy({}, { get() { throw Error("Must not access production data"); } }) });
const { createRoomSession } = load("src/features/match-simulation/shared/session.ts");
const { readRoomFrame, roomLink, isRoomId } = load("src/features/match-simulation/shared/protocol.ts");
const ROOM = "f4a1c333-638d-4b3a-b7e3-4c6db82e26d8";
const settle = () => new Promise(resolve => setTimeout(resolve, 25));

function network() {
  const peers = new Map(), messages = [], sessions = [];
  let holdOffers = false;
  const held = [];
  const announce = () => {
    const members = [...peers.values()].map(p => p.member);
    for (const p of peers.values()) p.handlers.members(structuredClone(members));
  };
  const emit = (from, message) => {
    if (holdOffers && message.type === "offer") { held.push({ from, message }); return; }
    messages.push({ from, message: structuredClone(message) });
    for (const [id, p] of peers) if (id !== from) p.handlers.message(structuredClone(message));
  };
  const create = (id, role, saved) => {
    const member = { id, role, joinedAt: sessions.length };
    const session = createRoomSession({ room: ROOM, id, role, saved, settleDelayMs: 5, transport: () => ({
      connect(handlers) { peers.set(id, { member, handlers }); handlers.connection(true); queueMicrotask(announce); },
      async send(message) { queueMicrotask(() => emit(id, message)); },
      close() { peers.delete(id); announce(); },
    }) });
    sessions.push(session); session.start(); return session;
  };
  return { create, emit, messages,
    holdOffers: () => { holdOffers = true; },
    releaseOffers: () => { holdOffers = false; for (const item of held.splice(0)) emit(item.from, item.message); },
    close: () => sessions.forEach(s => s.stop()) };
}

function score(ref) {
  const state = ref.store.getState(), m = state.snapshot.match;
  return state.addMatchEvent(m.tournamentId, m.id, { type: "goal", playerId: "practice-blue-3", playerName: "ignored", teamId: "practice-blue", minute: 1, half: 1 });
}

test("관리자 선입장 후 심판이 시작하면 같은 경기·점수·시계가 전달되며 시계는 한 번만 진행한다", async t => {
  const n = network(); t.after(n.close);
  const admin = n.create("admin", "admin"), ref = n.create("ref", "referee"); await settle();
  assert.equal(admin.status.getState().ready, true);
  assert.equal(ref.controls(), true);
  assert.equal(admin.store.getState().snapshot.match.id, ref.store.getState().snapshot.match.id);
  const m = ref.store.getState().snapshot.match;
  await ref.store.getState().startMatch(m.tournamentId, m.id);
  await score(ref); ref.pulse(); admin.pulse(); await settle();
  assert.equal(ref.store.getState().snapshot.elapsedSeconds, 1);
  assert.equal(admin.store.getState().snapshot.elapsedSeconds, 1);
  assert.equal(admin.store.getState().snapshot.match.homeScore, 1);
  await assert.rejects(admin.store.getState().pauseMatch(m.id));
});

test("관리자 초기화 요청은 양쪽을 함께 바꾸고 같은 요청 재전송은 중복 개설하지 않는다", async t => {
  const n = network(); t.after(n.close);
  const ref = n.create("ref", "referee"), admin = n.create("admin", "admin"); await settle();
  ref.store.getState().startAutomatic(); await settle();
  await admin.reset(); await settle();
  const firstId = ref.store.getState().snapshot.match.id;
  const command = n.messages.find(x => x.message.type === "reset").message;
  n.emit("admin", command); await settle();
  assert.equal(ref.store.getState().snapshot.match.id, firstId);
  assert.equal(admin.store.getState().snapshot.match.id, firstId);
  assert.equal(admin.store.getState().snapshot.match.status, "scheduled");
  assert.equal(admin.store.getState().snapshot.match.homeScore, 0);
});

test("중복 심판은 기록할 수 없고 기존 심판 퇴장 시 최신 기록으로 일시정지하여 인계한다", async t => {
  const n = network(); t.after(n.close);
  const first = n.create("ref-1", "referee"), admin = n.create("admin", "admin"); await settle();
  first.store.getState().startAutomatic(); first.pulse(); await settle();
  const duplicate = n.create("ref-2", "referee"); await settle();
  assert.equal(duplicate.controls(), false);
  await assert.rejects(score(duplicate));
  const before = admin.store.getState().snapshot.match;
  first.stop(); await settle();
  assert.equal(duplicate.controls(), true);
  assert.equal(duplicate.store.getState().snapshot.match.id, before.id);
  assert.equal(duplicate.store.getState().snapshot.match.homeScore, 1);
  assert.equal(duplicate.store.getState().snapshot.running, false);
});

test("심판 연결이 없으면 관리자 조작이 잠기고 새 심판이 관리자의 최신 기록을 복원한다", async t => {
  const n = network(); t.after(n.close);
  const ref = n.create("ref", "referee"), admin = n.create("admin", "admin"); await settle();
  ref.store.getState().startAutomatic(); ref.pulse(); await settle();
  const id = admin.store.getState().snapshot.match.id;
  ref.stop(); await settle();
  assert.equal(admin.status.getState().ready, false);
  assert.equal(admin.store.getState().snapshot.running, false);
  await assert.rejects(admin.reset());
  const next = n.create("new-ref", "referee"); await settle();
  assert.equal(next.store.getState().snapshot.match.id, id);
  assert.equal(next.store.getState().snapshot.match.homeScore, 1);
  assert.equal(next.store.getState().snapshot.running, false);
});

test("늦게 접속한 관리자는 점수·교체·MOM·종료 결과를 받아온다", async t => {
  const n = network(); t.after(n.close);
  const ref = n.create("ref", "referee"); await settle();
  const state = ref.store.getState(); state.startAutomatic(); ref.pulse();
  const m = state.snapshot.match;
  await ref.store.getState().substitutePlayer(m.id, "practice-blue", "practice-blue-3", "practice-blue-6", "", 1, 1);
  await ref.store.getState().setMatchMom(m.tournamentId, m.id, "practice-blue-3");
  await ref.store.getState().endMatch(m.tournamentId, m.id);
  const admin = n.create("admin", "admin"); await settle();
  const s = admin.store.getState().snapshot;
  assert.equal(s.match.homeScore, 1); assert.equal(s.match.status, "finished");
  assert.equal(s.match.momPlayerId, "practice-blue-3");
  assert.equal(s.lineup.find(p => p.playerId === "practice-blue-6").isStarter, true);
});

test("오래되거나 다른 심판의 프레임·손상된 기록은 현재 경기를 덮어쓰지 않는다", async t => {
  const n = network(); t.after(n.close);
  const ref = n.create("ref", "referee"), admin = n.create("admin", "admin"); await settle();
  const old = structuredClone(n.messages.find(x => x.message.type === "state").message);
  ref.store.getState().startAutomatic(); ref.pulse(); await settle();
  n.emit("ref", old);
  old.frame.revision = 999; old.frame.owner = "intruder"; n.emit("intruder", old);
  old.frame.owner = "ref"; old.frame.snapshot.match.homeScore = -1; n.emit("ref", old);
  assert.equal(admin.store.getState().snapshot.match.homeScore, 1);
});

test("공유 링크와 저장 기록은 방별로 분리하고 가상 선수 외 데이터는 거부한다", async t => {
  const n = network(); t.after(n.close); n.create("ref", "referee"); await settle();
  assert.equal(isRoomId("test"), false);
  assert.equal(new URL(roomLink("https://example.test", ROOM, "admin")).searchParams.get("room"), ROOM);
  const f = structuredClone(n.messages.find(x => x.message.type === "state").message.frame);
  assert.equal(readRoomFrame(f, crypto.randomUUID()), undefined);
  f.snapshot.match.events.push({ id: "x", type: "goal", playerId: "real-person", teamId: "real-team", minute: 1, half: 1, timestamp: 1 });
  assert.equal(readRoomFrame(f, ROOM), undefined);
});

test("재접속 동기화 응답이 늦어도 새 경기를 먼저 열지 않고 최신 기록 확인을 기다린다", async t => {
  const n = network(); t.after(n.close);
  const first = n.create("first", "referee"), admin = n.create("admin", "admin"); await settle();
  first.store.getState().startAutomatic(); first.pulse(); await settle();
  const id = admin.store.getState().snapshot.match.id;
  first.stop(); n.holdOffers();
  const next = n.create("next", "referee"); await settle();
  assert.equal(next.controls(), false);
  next.pulse(); await settle();
  assert.equal(next.controls(), false);
  n.releaseOffers(); await settle();
  assert.equal(next.controls(), true);
  assert.equal(next.store.getState().snapshot.match.id, id);
  assert.equal(next.store.getState().snapshot.match.homeScore, 1);
  assert.equal(next.store.getState().snapshot.running, false);
});
