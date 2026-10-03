import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const nativeRequire = createRequire(import.meta.url);
const { finalRankCardType } = moduleLoader()('src/features/standings/final-placements.ts');
function renderModule(filename, imports) {
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    name => Object.hasOwn(imports, name) ? imports[name] : nativeRequire(name), mod, mod.exports,
  );
  return mod.exports;
}
const table = renderModule('src/features/standings/final-standings-table.tsx', {
  'next/link': { default: ({ href, children }) => createElement('a', { href }, children), __esModule: true },
  './final-placements': { finalRankCardType },
});
const { GroupedStandingsTable } = renderModule('src/features/standings/grouped-standings-table.tsx', {
  './final-standings-table': table,
  './group-filter': { filterGroupStandings: () => [] },
  '@/components/standings-table': { StandingsTable: () => createElement('p', null, '조별 순위') },
});
const rows = Array.from({ length: 6 }, (_, index) => ({
  rank: index + 1, teamId: `team-${index}`, teamName: `순위팀 ${index + 1}`,
}));
const withdrawnNames = ['ROOT FC A팀', 'ROOT FC B팀'];
const render = props => renderToStaticMarkup(createElement(GroupedStandingsTable, {
  standings: [], finalRanks: rows, ...props,
}));

test('검증된 기권팀 안내를 최종 순위 표와 함께 표시하며 7·8위나 선수카드 등급을 부여하지 않는다', () => {
  const html = render({ finalWithdrawnTeamNames: withdrawnNames });
  assert.match(html, /대회 최종 순위/);
  assert.match(html, /ROOT FC A팀 \/ ROOT FC B팀/);
  assert.match(html, /양팀 기권으로 7·8위전 미실시 · 순위 구분 없음/);
  assert.equal((html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr /g) ?? []).length, 6);
  assert.doesNotMatch(html, />7위<|>8위<|공동 7위|조별 순위/);
  assert.doesNotMatch(html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '', /ROOT FC/);
});

test('6팀 최종 순위만으로 기권을 추측하지 않는다', () => {
  assert.doesNotMatch(render({}), /기권|미실시|순위 구분 없음/);
});

test('전체 8팀 순위나 비연속 6행에는 기권 안내를 표시하지 않는다', () => {
  for (const finalRanks of [
    [...rows, { rank: 7, teamId: 'a', teamName: 'A팀' }, { rank: 8, teamId: 'b', teamName: 'B팀' }],
    rows.map(row => row.rank === 6 ? { ...row, rank: 7 } : row),
  ]) assert.doesNotMatch(render({ finalRanks, finalWithdrawnTeamNames: withdrawnNames }), /기권|미실시/);
});

test('기권팀 이름이 누락·중복되면 잘못된 안내를 표시하지 않는다', () => {
  for (const finalWithdrawnTeamNames of [[], ['A팀'], ['A팀', 'A팀'], ['', 'B팀']]) {
    assert.doesNotMatch(render({ finalWithdrawnTeamNames }), /기권|미실시/);
  }
});
