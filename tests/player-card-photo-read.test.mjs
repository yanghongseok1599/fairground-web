import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { moduleLoader } from "./helpers/load-ts-module.mjs";
const { cardBadgePatch } = moduleLoader()("src/lib/player-card/badge-edit.ts");

const file = new Blob(["test"], { type: "image/webp" });
const expectedUrl = "data:image/webp;base64,dGVzdA==";
function readerFixture() {
  const readers = [], timers = new Map();
  let timerId = 0;
  class Reader {
    result = null; onload = null; onerror = null; onabort = null; abortCalls = 0;
    constructor() { readers.push(this); }
    readAsDataURL() {}
    abort() { this.abortCalls++; this.onabort?.(); }
    emit(event, result = expectedUrl) { this.result = result; this["on" + event]?.(); }
  }
  const code = ts.transpileModule(readFileSync("src/lib/player-card/read-photo-file.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("exports", "FileReader", "setTimeout", "clearTimeout", code)(
    exports, Reader,
    (fn, delay) => { assert.equal(delay, 15_000); timers.set(++timerId, fn); return timerId; },
    (id) => timers.delete(id),
  );
  return { ...exports, readers, timers, Reader,
    timeout() { for (const callback of [...timers.values()]) callback(); },
    last() { return readers.at(-1); },
  };
}

test("정상 사진 읽기는 결과를 반환하고 타이머와 이벤트를 정리한다", async () => {
  const f = readerFixture(), result = f.readPhotoFile(file);
  f.last().emit("load");
  assert.equal(await result, expectedUrl);
  assert.equal(f.timers.size, 0);
  assert.equal(f.last().onload, null);
});
for (const event of ["error", "abort"]) {
  test("사진 읽기 " + event + "는 대기하지 않고 오류를 반환한다", async () => {
    const f = readerFixture(), result = f.readPhotoFile(file);
    f.last().emit(event);
    await assert.rejects(result, /사진.*다시 선택/);
    assert.equal(f.timers.size, 0);
    assert.equal(f.last().onerror, null);
  });
}
test("15초 초과 시 읽기를 취소하고 뒤늦은 성공 이벤트를 무시한다", async () => {
  const f = readerFixture(), result = f.readPhotoFile(file);
  const lateLoad = f.last().onload;
  f.timeout();
  f.last().result = expectedUrl;
  lateLoad();
  await assert.rejects(result, /시간이 초과/);
  assert.equal(f.last().abortCalls, 1);
  assert.equal(f.timers.size, 0);
});
test("동기 파일 읽기 예외와 잘못된 결과도 정리 후 실패한다", async () => {
  const f = readerFixture();
  f.Reader.prototype.readAsDataURL = () => { throw new Error("read failure"); };
  await assert.rejects(f.readPhotoFile(file), /사진을 읽지/);
  assert.equal(f.timers.size, 0);
  const next = readerFixture(), result = next.readPhotoFile(file);
  next.last().emit("load", null);
  await assert.rejects(result, /사진을 읽지/);
  assert.equal(next.timers.size, 0);
});

function formFixture(page, reader) {
  const path = "src/app/my/" + page + "/page.tsx";
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let submit;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleSubmit") submit = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(submit, "실제 페이지의 제출 함수를 검사한다");
  const state = { locked: false, error: "", writes: 0, done: false, reads: 0 };
  const player = { photoUrl: "original-photo", profilePhotoLocked: false, teamId: "" };
  const context = {
    File, Error, photoError: "", bgProcessing: false, loading: false,
    name: "테스트", position: "ALA", number: "10", nationality: "KOR",
    photoScale: 0.92, photoBlob: file, portraitConsent: true,
    badges: [], badgesEdited: false, cardBadgePatch, earnedBadgeIds: new Set(), player, user: { gender: "male" },
    role: "player", teamId: "", cardSkin: "standard",
    draft: { ready: true, clear() {} }, clearError() {},
    clearPendingCardSkin() {}, filterEarnedBadgeIds: () => [],
    registrationError: (error) => error.message,
    setFormError: (message) => { state.error = message; },
    setDone: (value) => { state.done = value; }, setTimeout() {},
    router: { push() {} },
    uploadPlayerPhoto: (photo) => { state.reads++; return reader.readPhotoFile(photo); },
    updatePlayer: async () => { state.writes++; },
    createPlayer: async () => { state.writes++; },
    submission: {
      begin() { if (state.locked) return false; state.locked = true; return true; },
      end() { state.locked = false; },
    },
  };
  const code = ts.transpileModule("const submit = " + submit + ";", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const action = new Function(...Object.keys(context), code + "\nreturn submit;")(...Object.values(context));
  return { state, player, submit: () => action({ preventDefault() {} }) };
}

for (const page of ["card-edit", "player-setup"]) {
  for (const event of ["error", "abort", "timeout"]) {
    test(page + ": " + event + "에서 저장 중단·기존 사진 유지·잠금 해제·동일 사진 재시도", async () => {
      const reader = readerFixture(), form = formFixture(page, reader);
      const saving = form.submit();
      await form.submit(); // A rapid duplicate click must not start another read/write.
      assert.equal(form.state.reads, 1);
      assert.equal(form.state.locked, true);
      if (event === "timeout") reader.timeout(); else reader.last().emit(event);
      await saving;
      assert.equal(form.state.writes, 0);
      assert.equal(form.state.done, false);
      assert.equal(form.state.locked, false);
      assert.match(form.state.error, /사진.*다시 선택/);
      assert.equal(form.player.photoUrl, "original-photo");
      const retry = form.submit();
      reader.last().emit("load");
      await retry;
      assert.equal(form.state.writes, 1);
      assert.equal(form.state.done, true);
      assert.equal(form.state.locked, false);
      assert.equal(form.state.error, "");
    });
  }
}
