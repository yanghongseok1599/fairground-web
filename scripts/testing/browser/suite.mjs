import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { clickButton, clickTeamCard } from './actions.mjs';
import { KNOWN_EXTENSION_ID } from './extensions.mjs';
import { capturePngEvidence } from './capture.mjs';

const DEV_HOST = 'fhytkbjadhnmozppolrv.supabase.co';
// Exact profile/team reads used by these screens; do not infer RPC safety from
// an arbitrary get_/list_ prefix. Unknown POST RPCs fail the cancellation check.
const READ_RPCS = new Set([
  'get_my_profile', 'get_team_member_profiles', 'get_team_admin_profiles',
  'get_team_join_request_profiles', 'get_my_player_inspections', 'can_manage_player_inspections',
]);

function displayTeam() {
  const name = document.querySelector('main h2')?.textContent.trim();
  const logo = [...document.querySelectorAll('main img')].find((el) => el.alt === `${name} 엠블럼`);
  return { name, logo: logo?.getAttribute('src'), logoLoaded: Boolean(logo?.complete && logo.naturalWidth > 0) };
}

// Keep only method/host/path, never request headers, tokens, bodies, or queries.
export function summarizeRequests(events) {
  return events.filter((e) => e.method === 'Network.requestWillBeSent').flatMap((e) => {
    const url = new URL(e.params.request.url);
    if (!['https:', 'http:'].includes(url.protocol)) return [];
    const request = { method: e.params.request.method, host: url.hostname, path: url.pathname };
    // Preserve only this non-sensitive classification, never the auth query or body.
    if (request.method === 'POST' && request.host === DEV_HOST && request.path === '/auth/v1/token'
      && url.searchParams.getAll('grant_type').length === 1
      && url.searchParams.get('grant_type') === 'refresh_token') request.authRefresh = true;
    return [request];
  });
}

export function isUnexpectedWrite(request, appHost) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false;
  if (request.host === DEV_HOST) {
    if (request.method === 'POST' && request.path === '/auth/v1/token' && request.authRefresh === true) return false;
    // PostgREST reads may use POST for explicitly read-only RPCs.
    if (request.method === 'POST' && READ_RPCS.has(request.path.replace(/^\/rest\/v1\/rpc\//, ''))) return false;
    return true;
  }
  // Next Server Actions can POST to a page route, not only /api/.
  return request.host === appHost;
}

async function assertDevelopmentBackend(page) {
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((entry) => {
    try { return new URL(entry.name).hostname.endsWith('.supabase.co'); } catch { return false; }
  }), undefined, { timeout: 15000 });
  const hosts = await page.evaluate(() => [...new Set(performance.getEntriesByType('resource').map((entry) => {
    try { return new URL(entry.name).hostname; } catch { return ''; }
  }).filter((host) => host.endsWith('.supabase.co')))]);
  assert.deepEqual(hosts, [DEV_HOST], 'Only the hosted development backend may be exercised');
}

export async function runTeamRegression({ taskSpace, config, credentials }) {
  assert.equal(credentials?.email, 'captain@example.com');
  assert.ok(typeof credentials.password === 'string' && credentials.password.length > 0);
  const task = await taskSpace(config.space);
  const page = task.page(config.page);
  const report = { url: config.url, sha: config.sha, engine: config.engine ?? 'ego', startedAt: new Date().toISOString(), status: 'running', evidenceFormat: 'png', screenshots: [], cases: [], recoveries: [] };
  const save = () => writeFile(path.join(config.output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  const readEvents = async () => {
    const events = await page.events();
    if (config.isolateExtension === 'aliprice') {
      const scripts = events.filter((event) => event.method === 'Debugger.scriptParsed' &&
        event.params.url?.startsWith(`chrome-extension://${KNOWN_EXTENSION_ID}/`));
      assert.equal(scripts.length, 0, 'Isolated extension code must not execute in the Preview page');
      report.extensionScriptChecks = (report.extensionScriptChecks ?? 0) + 1;
    }
    return events;
  };
  const runCase = async (name, fn) => {
    report.activeCase = name;
    report.phase = 'start';
    await save();
    const start = Date.now();
    await page.cdp('Profiler.start');
    let details;
    try {
      details = await fn();
      await page.cdp('Profiler.stop');
    } catch (error) {
      // Observation only: do not retry the input, navigate, or clean up after a
      // stalled dispatch. A pending action may still have late effects.
      try {
        if (/CdpRequestTimeout|timed out: Input/.test(error.name + error.message)) {
          await page.cdp('Debugger.pause', {}, { timeout: 5000 });
          const paused = (await page.events()).filter((event) => event.method === 'Debugger.paused').map((event) => ({
            reason: event.params.reason,
            frames: event.params.callFrames.map((frame) => ({ name: frame.functionName, url: frame.url, location: frame.location })),
          }));
          await writeFile(path.join(config.output, `${name}-paused.json`), JSON.stringify(paused, null, 2));
          if (paused[0]?.frames[0]?.location.scriptId) {
            const source = await page.cdp('Debugger.getScriptSource', { scriptId: paused[0].frames[0].location.scriptId }, { timeout: 5000 });
            await writeFile(path.join(config.output, `${name}-paused-source.js`), source.scriptSource);
          }
        }
        const capture = await page.cdp('Profiler.stop', {}, { timeout: 5000 });
        await writeFile(path.join(config.output, `${name}.cpuprofile`), JSON.stringify(capture.profile));
      } catch { report.profileCapture = 'unavailable'; }
      throw error;
    }
    report.cases.push({ name, status: 'passed', elapsedMs: Date.now() - start, ...details });
    await save();
    console.log(`PASS ${name}`);
  };
  await save();
  const trace = async (phase) => { report.phase = phase; await save(); };
  try {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1512, height: 828, deviceScaleFactor: 1, mobile: false });
    await page.cdp('Network.enable');
    await page.cdp('Debugger.enable');
    await page.cdp('Profiler.enable');
    await page.events(); // Ignore the caller's previous document before navigation.
    await page.goto(config.url + '/teams');
    await assertDevelopmentBackend(page);
    await readEvents();
    await page.waitForSelector('loc=href:/login', { state: 'visible', timeout: 15000 });
    await runCase('team-card-moving-mouse', () => clickTeamCard(page, { pause: false, baseUrl: config.url, trace }));
    for (let i = 0; i < config.repeat; i++) {
      await page.goto(config.url + '/teams');
      await runCase(`team-card-focus-paused-${i + 1}`, () => clickTeamCard(page, { pause: true, baseUrl: config.url, trace }));
    }
    await trace('capture-team-card');
    // The heading appears before TeamEmblem's asynchronous canvas export.
    // Wait for the completed card image, not its translucent frame placeholder.
    await page.waitForFunction(() => {
      const name = document.querySelector('main h1')?.textContent.trim();
      if (!name) return false;
      const images = [...document.querySelectorAll('main img')].filter((image) =>
        image.alt.startsWith(name + ' ') && image.alt.endsWith(' 팀 카드'));
      return images.length === 1 && images[0].getAttribute('src')?.startsWith('data:image/png') &&
        images[0].complete && images[0].naturalWidth > 0 && images[0].naturalHeight > 0 &&
        Number(getComputedStyle(images[0]).opacity) === 1;
    }, undefined, { timeout: 20000 });
    report.screenshots.push(await capturePngEvidence(page, path.join(config.output, 'team-card-detail.png')));
    await save();
    await page.goto(config.url + '/login?returnTo=/my/team');
    await page.snapshot();
    await page.fill('input[name="email"]', credentials.email);
    await page.fill('input[name="password"]', credentials.password);
    await page.click('loc=role:button[name="로그인"]');
    await page.waitForURL(config.url + '/my/team', { timeout: 15000 });
    await page.waitForSelector('loc=role:button[name="팀 정보 수정"]', { state: 'visible', timeout: 15000 });
    await page.waitForFunction(() => {
      const name = document.querySelector('main h2')?.textContent.trim();
      return [...document.querySelectorAll('main img')].some((el) => el.alt === `${name} 엠블럼` && el.complete && el.naturalWidth > 0);
    }, undefined, { timeout: 15000 });
    const baseline = await page.evaluate(displayTeam);
    assert.equal(baseline.name, 'FC 하늘', 'Only the synthetic captain team is allowed');
    const startupRequests = summarizeRequests(await readEvents());
    assert.ok(startupRequests.some((r) => r.host === DEV_HOST), 'Network observation must be active before cancel assertions');
    for (let i = 0; i < config.repeat; i++) {
      await runCase(`team-edit-cancel-${i + 1}`, async () => {
        await page.snapshot();
        await clickButton(page, '팀 정보 수정', report.recoveries);
        await page.waitForFunction(() => {
          const input = document.querySelector('#editTeamName');
          return input && !input.matches(':disabled');
        }, undefined, { timeout: 10000 });
        await page.snapshot();
        await page.fill('#editTeamName', baseline.name + ' 회귀 검증');
        const withLogo = i % 2 === 0;
        if (withLogo) {
          await page.setInputFiles('#editTeamLogo', [path.join(config.repositoryRoot, 'public/images/badges/hat_trick.png')]);
          await page.waitForFunction(() => {
            const image = document.querySelector('img[alt="로고 미리보기"]');
            return image?.getAttribute('src')?.startsWith('data:image/') && image.complete && image.naturalWidth > 0 && !document.querySelector('#editTeamLogo').disabled;
          }, undefined, { timeout: 15000 });
          await page.snapshot();
          await clickButton(page, '로고 제거', report.recoveries);
          await page.waitForFunction(() => !document.querySelector('img[alt="로고 미리보기"]'), undefined, { timeout: 5000 });
        }
        await page.snapshot();
        await clickButton(page, '취소', report.recoveries);
        await page.waitForFunction(() => !document.querySelector('#editTeamName'), undefined, { timeout: 5000 });
        await page.waitForFunction(displayTeamReady, undefined, { timeout: 15000 });
        assert.equal(await page.url(), config.url + '/my/team');
        assert.deepEqual(await page.evaluate(displayTeam), baseline, 'Cancel must preserve the displayed team name and original logo');
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('main [role="status"]')].some((el) => /수정되었습니다|저장되었습니다/.test(el.textContent))), false);
        const requests = summarizeRequests(await readEvents());
        assert.deepEqual(requests.filter((r) => isUnexpectedWrite(r, new URL(config.url).hostname)), [], 'Cancel must not write application data');
        const foreign = requests.filter((r) => r.host.endsWith('.supabase.co') && r.host !== DEV_HOST);
        assert.deepEqual(foreign, [], 'No production backend requests are allowed');
        return { withLogo, applicationWrites: 0 };
      });
      // Intentionally do not navigate/reset scroll: reopening must exercise the
      // actual post-cancel geometry, including the known sticky-header overlap.
    }
    await runCase('team-cancel-reload-preserves-data', async () => {
      await page.reload();
      await page.waitForSelector('loc=role:button[name="팀 정보 수정"]', { state: 'visible', timeout: 15000 });
      await page.waitForFunction(displayTeamReady, undefined, { timeout: 15000 });
      assert.deepEqual(await page.evaluate(displayTeam), baseline);
    });
    await trace('capture-cancelled-team');
    // All repeated cancel/scroll assertions are complete. Frame the original
    // team name and emblem for the required visual evidence using native input.
    const captureScroll = await page.evaluate(() => scrollY);
    if (captureScroll > 0) {
      await page.mouse.move(756, 200, { label: '팀 정보 캡처 영역 선택' });
      await page.mouse.wheel(0, -captureScroll, { label: '원래 팀 정보 화면 캡처' });
      await page.waitForFunction(() => scrollY <= 1, undefined, { timeout: 5000 });
    }
    assert.deepEqual(await page.evaluate(displayTeam), baseline);
    report.screenshots.push(await capturePngEvidence(page, path.join(config.output, 'team-cancel-verified.png')));
    await save();
    // Use the observed header menu role to avoid the duplicate body logout button.
    await page.goto(config.url + '/my');
    await page.waitForSelector('loc=role:button[name="마이페이지"]', { state: 'visible', timeout: 15000 });
    await page.snapshot();
    await clickButton(page, '마이페이지', report.recoveries);
    await page.snapshot();
    await page.click('loc=role:menuitem[name="로그아웃"]');
    await page.waitForSelector('loc=href:/login', { state: 'visible', timeout: 15000 });
    await readEvents();
    await page.cdp('Emulation.clearDeviceMetricsOverride');
    report.status = 'passed';
    delete report.activeCase;
    delete report.phase;
    report.finishedAt = new Date().toISOString();
    await save();
    console.log(`Browser regression passed: ${report.cases.length} cases, ${report.screenshots.length} verified PNGs, ${report.recoveries.length} observed header recoveries.`);
  } catch (error) {
    report.status = 'failed';
    // Do not record arbitrary backend errors that could contain sensitive URLs.
    report.failure = { name: error.name, message: String(error.message).split(credentials.password).join('[REDACTED]').replace(/https?:\/\/[^\s]+/g, '[URL]') };
    await save();
    throw error;
  }
}

function displayTeamReady() {
  const name = document.querySelector('main h2')?.textContent.trim();
  return [...document.querySelectorAll('main img')].some((el) => el.alt === `${name} 엠블럼` && el.complete && el.naturalWidth > 0);
}
