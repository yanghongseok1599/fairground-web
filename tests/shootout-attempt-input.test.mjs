import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const nativeRequire = createRequire(import.meta.url);
function uiModule(filename, imports) {
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(imports, name) ? imports[name] : nativeRequire(name), mod, mod.exports);
  return mod.exports;
}
const attempts = moduleLoader()('src/features/match-shootout/attempts.ts');
const picker = uiModule('src/features/match-shootout/attempt-picker.tsx', { './attempts': attempts });
const { ShootoutInput } = uiModule('src/features/match-shootout/shootout-input.tsx', {
  './attempts': attempts, './attempt-picker': picker,
  'lucide-react': { Loader2: () => null },
  '@/components/ui/button': { Button: props => { const buttonProps = { ...props }; delete buttonProps.variant; return createElement('button', buttonProps); } },
  '@/components/ui/input': { Input: props => createElement('input', props) },
});
const summary = uiModule('src/features/match-shootout/attempts-summary.tsx', {});
const { ShootoutResultBadge } = uiModule('src/features/match-shootout/result-badge.tsx', {
  './attempts': attempts, './attempts-summary': summary,
  './model': moduleLoader()('src/features/match-shootout/model.ts'),
});
const props = { homeName: '홈', awayName: '원정', homeValue: '0', awayValue: '0', onChange() {}, onSave() {}, onAttemptsChange() {}, disabled: false, saving: false };
const renderInput = extra => renderToStaticMarkup(createElement(ShootoutInput, { ...props, ...extra }));
const saveButton = html => html.match(/<button\b([^>]*)>승부차기 저장<\/button>/)?.[1];

test('O/X 동점 진행 기록도 저장할 수 있고 차수·팀별 접근성 라벨을 제공한다', () => {
  const html = renderInput({ attempts: { home: [true, null], away: [true] }, homeValue: '1', awayValue: '1' });
  assert.equal(saveButton(html)?.includes('disabled'), false);
  assert.match(html, /홈 1차 골 O/);
  assert.match(html, /원정 1차 노골 X/);
  assert.match(html, /승부차기 O 1 : 1/);
  assert.doesNotMatch(html, /승리/);
});

test('중간 빈차수나 모든 미입력·전송 중에는 저장을 막는다', () => {
  for (const extra of [
    { attempts: { home: [null, true], away: [false] } },
    { attempts: { home: [null], away: [null] } },
    { attempts: { home: [true], away: [false] }, disabled: true, saving: true },
  ]) {
    const html = renderInput(extra);
    assert.match(html, /disabled=""/);
    if (!extra.saving) assert.equal(saveButton(html)?.includes('disabled'), true);
  }
});

test('합계가 같아도 O/X 순서 수정은 저장 가능하고 동일 이력만 저장 완료로 표시한다', () => {
  const changed = renderInput({ attempts: { home: [true, false], away: [false] }, savedAttempts: { home: [false, true], away: [false] }, savedHome: 1, savedAway: 0 });
  assert.equal(saveButton(changed)?.includes('disabled'), false);
  const saved = renderInput({ attempts: { home: [true, false, null], away: [false] }, savedAttempts: { home: [true, false], away: [false] } });
  assert.match(saved, /승부차기 저장 완료/);
});

test('기존 합계 기록에는 차수 O/X를 추정하지 않고 명시적 시작 버튼을 제공한다', () => {
  const html = renderInput({ homeValue: '0', awayValue: '1', savedHome: 0, savedAway: 1 });
  assert.match(html, /기존 기록은 합계만 저장/);
  assert.match(html, /차수별 O\/X 기록 시작/);
  assert.doesNotMatch(html, /홈 1차 골 O/);
});

test('공개 진행 기록은 차수별 O/X를 보여주며 점수 차이로 승리를 선언하지 않는다', () => {
  const html = renderToStaticMarkup(createElement(ShootoutResultBadge, { match: {
    homeTeamName:'홈', awayTeamName:'원정', homeScore:0, awayScore:0, status:'live',
    homeShootoutScore:1, awayShootoutScore:0, homeShootoutAttempts:[true, false], awayShootoutAttempts:[false],
  } }));
  assert.match(html, /승부차기 진행 · O 1 : 0/);
  assert.match(html, /1차 O/);
  assert.match(html, /2차 X/);
  assert.doesNotMatch(html, /홈 승/);
});
