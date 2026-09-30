import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path, context, requireModule) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { ...context, exports, require: requireModule, URL, Promise, Error });
  return exports;
}
const calls = [];
const sdk = { isInitialized: () => false, init: key => calls.push(['init', key]), Share: { sendDefault: payload => calls.push(['share', payload]) } };
const kakao = loadModule('src/lib/kakao-sdk.ts', { window: { Kakao: sdk }, process: { env: { NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY: 'test-key' } } });
const share = loadModule('src/features/kakao-tools/share.ts', {}, () => kakao);
const content = { title: '홈 2 : 1 원정', description: '대회 · 경기 종료', url: 'https://fairground-kor.com/tournaments/cup#match-one' };
assert.match(await share.shareEvent(content), /대화방/);
assert.equal(calls[0][0], 'init');
assert.equal(calls[1][1].content.link.webUrl, content.url);
assert.equal(calls[1][1].buttons[0].link.mobileWebUrl, content.url);
assert.equal(calls[1][1].content.imageUrl, 'https://fairground-kor.com/og-image-futsal-shoes-v2.png');
let copied = '';
const fallback = loadModule('src/features/kakao-tools/share.ts', { navigator: { clipboard: { writeText: async text => { copied = text; } } } }, () => ({ isKakaoShareConfigured: () => false }));
assert.match(await fallback.shareEvent(content), /복사/);
assert.ok(copied.includes(content.url));
const failed = loadModule('src/features/kakao-tools/share.ts', { navigator: { share: () => { throw new Error('unexpected fallback'); } } }, () => ({ isKakaoShareConfigured: () => true, loadKakaoSdk: async () => { throw new Error('SDK unavailable'); } }));
await assert.rejects(failed.shareEvent(content), /SDK unavailable/);
console.log('카카오 공유 및 대체 동작 검증 통과');
