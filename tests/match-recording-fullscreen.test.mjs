import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

function fixture(t) {
  const previous = globalThis.document;
  const doc = new EventTarget();
  let dialogOpen = false, exits = 0;
  Object.assign(doc, {
    body: { style: { overflow: "auto" } }, documentElement: {}, fullscreenElement: null,
    querySelector: () => dialogOpen ? {} : null,
    async exitFullscreen() { exits++; doc.fullscreenElement = null; doc.dispatchEvent(new Event("fullscreenchange")); },
  });
  globalThis.document = doc;
  const cells = [], effects = []; let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = value; }]; },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (!cells[i] || deps.some((d, j) => d !== cells[i].deps[j])) cells[i] = { deps, fn }; return cells[i].fn; },
    useEffect(fn, deps) { const i = cursor++; const old = cells[i]; if (!old || deps.some((d, j) => d !== old.deps[j])) effects.push(() => { old?.cleanup?.(); cells[i] = { deps, cleanup: fn() }; }); },
  };
  const { useRecordingFullscreen: runHook } = moduleLoader({ react })("src/features/match-control/use-recording-fullscreen.ts");
  const render = () => { cursor = 0; const value = runHook(); while (effects.length) effects.shift()(); return value; };
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); return render(); };
  t.after(() => { cells.forEach(c => c?.cleanup?.()); if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  return { doc, render, flush, exits: () => exits, dialog: value => { dialogOpen = value; } };
}

test("iPhone처럼 native API가 없어도 전체화면을 열고 배경 스크롤을 복구한다", t => {
  const f = fixture(t); f.render().enter(); assert.equal(f.render().open, true); assert.equal(f.doc.body.style.overflow, "hidden");
  f.render().close(); assert.equal(f.render().open, false); assert.equal(f.doc.body.style.overflow, "auto"); assert.equal(f.exits(), 0);
});

test("브라우저가 fullscreen을 거부해도 기록 화면은 열린 상태를 유지한다", async t => {
  const f = fixture(t); f.doc.documentElement.requestFullscreen = async () => { throw new Error("unsupported"); };
  f.render().enter(); assert.equal((await f.flush()).open, true); assert.equal(f.doc.body.style.overflow, "hidden");
});

test("브라우저의 전체화면 해제도 화면 상태와 배경 스크롤에 반영한다", async t => {
  const f = fixture(t); f.doc.documentElement.requestFullscreen = async () => { f.doc.fullscreenElement = f.doc.documentElement; };
  f.render().enter(); await f.flush(); await f.doc.exitFullscreen(); assert.equal(f.render().open, false); assert.equal(f.doc.body.style.overflow, "auto");
});

test("빠르게 닫은 뒤 늦게 성공한 native 요청은 다시 화면을 가두지 않는다", async t => {
  const f = fixture(t); let complete;
  f.doc.documentElement.requestFullscreen = () => new Promise(resolve => { complete = () => { f.doc.fullscreenElement = f.doc.documentElement; resolve(); }; });
  f.render().enter(); f.render().close(); f.render(); complete(); await f.flush(); assert.equal(f.doc.fullscreenElement, null); assert.equal(f.exits(), 1);
});

test("종료 확인 팝업의 Escape는 전체화면까지 닫지 않고 외부 fullscreen도 해제하지 않는다", t => {
  const f = fixture(t); f.doc.fullscreenElement = {}; f.render().enter(); f.render(); f.dialog(true);
  const escape = new Event("keydown"); Object.assign(escape, { key: "Escape" }); f.doc.dispatchEvent(escape); assert.equal(f.render().open, true);
  f.dialog(false); f.doc.dispatchEvent(escape); assert.equal(f.render().open, false); assert.equal(f.exits(), 0);
});
