import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

const nativeRequire = createRequire(import.meta.url);
const load = moduleLoader();
const policy = load("src/features/match-control/recording-correction-policy.ts");
const event = (id, type = "goal", extra = {}) => ({ id, type, playerId: id, playerName: `${id} 선수`, teamId: "home", minute: 3, half: 1, timestamp: 100, ...extra });
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(props = {}) {
  const state = []; let cursor = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; },
    useRef(initial) { const index = cursor++; return state[index] ??= { current: initial }; },
  };
  const mocks = {
    react,
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/dialog": { Dialog: "dialog", DialogHeader: "header", DialogTitle: "h2", DialogDescription: "description" },
    "./match-dialog-content": { MatchDialogContent: "content" },
    "./recording-correction-policy": policy,
    "./roster-stats": load("src/features/match-control/roster-stats.ts"),
  };
  const code = ts.transpileModule(fs.readFileSync("src/features/match-control/recording-corrections-dialog.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)(name => mocks[name] ?? nativeRequire(name), loadedModule, loadedModule.exports);
  const settings = { events: [event("goal"), event("assist", "assist")], teams: [{ id: "home", name: "홈팀" }], isLive: true, canRecord: true, busy: false, onClose: () => {}, onCancel: async () => true, ...props };
  return {
    settings,
    render() { cursor = 0; return loadedModule.exports.RecordingCorrectionsDialog(settings); },
  };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
const text = tree => Array.isArray(tree) ? tree.map(text).join("") : tree && typeof tree === "object" ? text(tree.props?.children) : tree == null || typeof tree === "boolean" ? "" : String(tree);
const button = (tree, label) => nodes(tree).find(node => node.type === "button" && (node.props["aria-label"] === label || text(node) === label));

test("automatic red cards require correcting the yellow; direct reds and separate goals/assists remain distinct", () => {
  assert.match(policy.cancellationUnavailable(event("auto:second", "red_card"), true), /잘못 입력한 경고/);
  assert.match(policy.cancellationUnavailable(event("server-red", "red_card", { sourceYellowEventId: "second" }), true), /자동 퇴장/);
  assert.equal(policy.cancellationUnavailable(event("direct-red", "red_card"), true), null);
  assert.match(policy.cancellationEffect(event("goal")), /어시스트는 별도 기록/);
  assert.match(policy.cancellationEffect(event("assist", "assist")), /골 점수에는 영향을 주지/);
  assert.match(policy.cancellationUnavailable(event("goal"), false), /종료 후/);
});

test("selecting an event does not cancel it; confirmation sends only the selected ID once", async () => {
  const sent = []; let finish;
  const f = fixture({ onCancel: id => { sent.push(id); return new Promise(resolve => { finish = resolve; }); } });
  button(f.render(), "assist 선수 어시 취소 선택").props.onClick();
  assert.deepEqual(sent, []);
  const confirm = button(f.render(), "이 기록 취소 확인");
  assert.match(text(f.render()), /assist 선수 어시/);
  confirm.props.onClick(); confirm.props.onClick();
  assert.deepEqual(sent, ["assist"]);
  assert.equal(button(f.render(), "취소 기록 중…").props.disabled, true);
  finish(true); await flush();
  assert.match(text(f.render()), /올바른 기록을 다시 입력/);
  assert.equal(nodes(f.render()).some(node => node.props?.role === "alert"), false);
});

test("a failed durable cancellation keeps the selection and offers retry without claiming success", async () => {
  const f = fixture({ initialEventId: "goal", onCancel: async () => false });
  button(f.render(), "이 기록 취소 확인").props.onClick(); await flush();
  const alert = nodes(f.render()).find(node => node.props?.role === "alert");
  assert.match(text(alert), /취소하지 못했습니다/);
  assert.equal(button(f.render(), "이 기록 취소 확인").props.disabled, false);
  assert.equal(text(f.render()).includes("취소를 기록했습니다"), false);
});

test("a match ending, remote cancellation, or lost recording permission disables the open confirmation", async () => {
  for (const change of [settings => { settings.isLive = false; }, settings => { settings.events[0] = { ...settings.events[0], isCancelled: true }; }, settings => { settings.canRecord = false; }]) {
    let calls = 0;
    const f = fixture({ initialEventId: "goal", onCancel: async () => { calls++; return true; } });
    change(f.settings);
    const confirm = button(f.render(), "이 기록 취소 확인");
    assert.equal(confirm.props.disabled, true);
    confirm.props.onClick(); await flush();
    assert.equal(calls, 0);
  }
});

test("automatic red direct links show guidance, while cancelled history remains visible", () => {
  const f = fixture({ events: [event("auto:yellow", "red_card"), event("old-goal", "goal", { isCancelled: true })], initialEventId: "auto:yellow" });
  assert.match(text(f.render()), /잘못 입력한 경고를 취소/);
  assert.equal(button(f.render(), "이 기록 취소 확인").props.disabled, true);
  button(f.render(), "내역으로 돌아가기").props.onClick();
  assert.match(text(f.render()), /취소됨/);
  assert.equal(nodes(f.render()).some(node => node.props?.["aria-label"] === "old-goal 선수 골 취소 선택"), false);
});
