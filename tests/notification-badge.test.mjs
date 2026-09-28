import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import sharp from 'sharp';

const badgeUrl = '/icons/notification-badge-96.png?v=1';

test('status-bar badge has white glyphs with transparent negative space, not an opaque disk', async () => {
  const file = readFileSync('public/icons/notification-badge-96.png');
  assert.deepEqual(readFileSync('public/icons/badge-96.png'), file);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 96);
  assert.equal(info.height, 96);
  let visible = 0;
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      const offset = (y * 96 + x) * 4;
      const alpha = data[offset + 3];
      if (x < 4 || x >= 92 || y < 4 || y >= 92) assert.equal(alpha, 0);
      if (!alpha) continue;
      visible++;
      assert.deepEqual([...data.subarray(offset, offset + 3)], [255, 255, 255]);
    }
  }
  assert.ok(visible > 96 * 96 * 0.2, 'glyphs must remain legible');
  assert.ok(visible < 96 * 96 * 0.55, 'filled background would become a solid status-bar shape');
});

for (const path of ['public/sw.js', 'public/sw-push.js']) {
  test(`${path} sends a separate status-bar badge without changing the notification content or color icon`, async () => {
    const handlers = {};
    const calls = [];
    vm.runInNewContext(readFileSync(path, 'utf8'), {
      URL,
      self: {
        location: { origin: "https://fairground-kor.com" },
        addEventListener: (name, fn) => { handlers[name] = fn; },
        registration: { showNotification: async (...args) => calls.push(args) },
      },
    });
    let pending;
    handlers.push({
      data: { json: () => ({ title: '경기 호출', body: '1구장으로 와주세요', url: '/my' }) },
      waitUntil: promise => { pending = promise; },
    });
    await pending;
    assert.equal(calls.length, 1);
    const [title, options] = calls[0];
    assert.equal(title, '경기 호출');
    assert.equal(options.body, '1구장으로 와주세요');
    assert.equal(options.data.url, '/my');
    assert.equal(options.icon, '/icons/icon-192.png');
    assert.equal(options.badge, badgeUrl);
  });
}
