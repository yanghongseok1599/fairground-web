import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

const load = moduleLoader();
const { listActiveRooms } = load("src/features/match-simulation/shared/directory.ts");
const ROOM = "f4a1c333-638d-4b3a-b7e3-4c6db82e26d8";
const OTHER = "4a96d909-1225-4c92-8171-806f6e0a9546";
const member = (id, role, room = ROOM, joinedAt = 10) => ({ id, role, room, joinedAt });

test("접속자를 방별로 묶어 관리자 여러 명과 심판을 표시하고 중복 연결은 한 번만 센다", () => {
  const admin = member("admin-1", "admin");
  const entries = [admin, { ...admin, presence_ref: "duplicate" }, member("admin-2", "admin"), member("ref", "referee"), member("other", "admin", OTHER, 20)];
  const rooms = listActiveRooms(entries);
  assert.deepEqual(rooms.map((r) => r.room), [OTHER, ROOM]);
  assert.deepEqual(rooms[1], { room: ROOM, adminCount: 2, refereeCount: 1, firstJoinedAt: 10 });
});

test("한 명이 남으면 방이 유지되고 마지막 참가자가 떠나면 목록에서 사라진다", () => {
  assert.equal(listActiveRooms([member("admin", "admin")]).length, 1);
  assert.deepEqual(listActiveRooms([]), []);
});

test("임의 URL·권한·손상된 광고는 무시하고 회원 정보는 목록에 남기지 않는다", () => {
  const valid = { ...member("admin", "admin"), email: "private@example.test", name: "개인 이름" };
  assert.deepEqual(listActiveRooms([null, {}, member("x", "owner"), member("x", "admin", "javascript:alert(1)"), member("", "admin"), member("x", "admin", ROOM, -1), valid]), [
    { room: ROOM, adminCount: 1, refereeCount: 0, firstJoinedAt: 10 },
  ]);
});

function fixture(t, advertisement, trackResult = "ok") {
  const priorWindow = globalThis.window;
  globalThis.window = new EventTarget();
  const updates = [], tracked = [], removed = [];
  let presence = {}, onSync, onStatus;
  const channel = {
    on(_type, _filter, callback) { onSync = callback; return this; },
    subscribe(callback) { onStatus = callback; return this; },
    presenceState: () => presence,
    async track(value) { tracked.push(value); return trackResult; },
  };
  const localLoad = moduleLoader({ "@/config/supabase": { supabase: {
    channel(name) { assert.equal(name, "practice-directory-v1"); return channel; },
    async removeChannel(value) { removed.push(value); },
  } } });
  const { connectRoomDirectory } = localLoad("src/features/match-simulation/shared/directory-transport.ts");
  const close = connectRoomDirectory((state) => updates.push(state), advertisement);
  t.after(() => { close(); if (priorWindow) globalThis.window = priorWindow; else delete globalThis.window; });
  return { updates, tracked, removed, close, status: (state) => onStatus(state),
    sync(entries) { presence = { participants: entries }; onSync(); } };
}

test("목록 방문자는 방을 만들지 않고 다른 관리자가 연 방을 실시간으로 받는다", async (t) => {
  const f = fixture(t);
  await f.status("SUBSCRIBED");
  assert.equal(f.tracked.length, 0);
  f.sync([member("creator", "admin")]);
  assert.equal(f.updates.at(-1).rooms[0].room, ROOM);
  f.sync([]);
  assert.deepEqual(f.updates.at(-1).rooms, []);
});

test("방 참가자는 재연결 때 다시 등록하고 연결이 끊기면 오래된 목록을 지운다", async (t) => {
  const advert = member("creator", "admin");
  const f = fixture(t, advert);
  await f.status("SUBSCRIBED"); f.sync([advert]);
  assert.deepEqual(f.tracked, [advert]);
  await f.status("CHANNEL_ERROR");
  assert.equal(f.updates.at(-1).connected, false);
  assert.deepEqual(f.updates.at(-1).rooms, []);
  await f.status("SUBSCRIBED");
  assert.equal(f.tracked.length, 2);
  assert.equal(f.updates.at(-1).connected, true);
  window.dispatchEvent(new Event("offline"));
  assert.equal(f.updates.at(-1).connected, false);
});

test("등록 실패를 성공으로 표시하지 않고 종료된 연결의 늦은 응답을 무시한다", async (t) => {
  const f = fixture(t, member("creator", "admin"), "error");
  await f.status("SUBSCRIBED");
  assert.equal(f.updates.at(-1).connected, false);
  assert.ok(f.updates.at(-1).error);
  f.close();
  const count = f.updates.length;
  await f.status("SUBSCRIBED"); f.sync([member("other", "admin")]);
  window.dispatchEvent(new Event("offline"));
  assert.equal(f.updates.length, count);
  assert.equal(f.removed.length, 1);
});
