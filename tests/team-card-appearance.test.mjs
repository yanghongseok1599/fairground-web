import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const { createTeamCardCanvas } = moduleLoader()('src/lib/team-card-canvas.ts');

test('모든 팀 카드 등급·해상도에서 순위와 과거 우승 플래그가 추가 테두리를 만들지 않는다', async t => {
  const originalDocument = globalThis.document;
  const originalImage = globalThis.Image;
  t.after(() => { globalThis.document = originalDocument; globalThis.Image = originalImage; });
  let operations = [];
  globalThis.Image = class {
    naturalWidth = 2; naturalHeight = 2;
    set src(value) { this.url = value; queueMicrotask(() => this.onload()); }
  };
  globalThis.document = {
    createElement: () => ({
      getContext: () => new Proxy({
        measureText: text => ({ width: text.length * 30 }),
        getImageData: () => ({ data: new Uint8ClampedArray(16).fill(255) }),
      }, {
        get: (target, name) => target[name] ?? ((...args) => {
          operations.push([name, ...args.map(v => v?.url ?? v)]);
        }),
      }),
    }),
  };
  for (const colorIndex of [0, 1, 2, 3]) {
    for (const width of [540, 1080]) {
      const item = { name: 'BOB FS', frame: `frame-${colorIndex}`, logo: 'bob-logo', colorIndex };
      operations = [];
      const normal = await createTeamCardCanvas(item, { width });
      const expected = structuredClone(operations);
      operations = [];
      const ranked = await createTeamCardCanvas({ ...item, isFieldChampion: true, seasonStats: { rank: 1 } }, { width });
      assert.deepEqual(operations, expected, '순위 때문에 카드 그림이 달라지면 안 된다');
      assert.equal(ranked.width, normal.width);
      assert.equal(ranked.height, normal.height);
      assert.ok(operations.some(([op, image]) => op === 'drawImage' && image === `frame-${colorIndex}`));
      assert.ok(operations.some(([op, text]) => op === 'fillText' && text === 'BOB FS'));
      assert.ok(!operations.some(([op]) => ['stroke', 'strokeRect', 'strokeText'].includes(op)), '원본 프레임 밖의 윤곽선 금지');
    }
  }
});
