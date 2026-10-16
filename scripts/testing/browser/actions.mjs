// Browser-only functions below are serialized by Ego; keep their inputs explicit.
export const TEAM_REGION = '[role="region"][aria-label="참가 팀 카드 슬라이더"]';
export const TEAM_LINKS = `${TEAM_REGION} a[aria-label$="카드 · 팀 페이지로 이동"]`;

export function inspectButton(name) {
  const matches = [...document.querySelectorAll('button')].filter((el) =>
    (el.getAttribute('aria-label') || el.textContent.trim()) === name);
  if (matches.length !== 1) return { count: matches.length };
  const el = matches[0];
  const r = el.getBoundingClientRect();
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  // A center just above the viewport has no hit target. Observe the branded
  // site header independently, but never treat its mere presence as an overlay.
  const headers = [...document.querySelectorAll('header[data-site-header]')].filter((header) => {
    const bounds = header.getBoundingClientRect();
    return header.querySelector('a[aria-label="FairGround 홈"]') &&
      ['sticky', 'fixed'].includes(getComputedStyle(header).position) &&
      bounds.top <= 0 && bounds.bottom > 0 && bounds.bottom <= Math.min(160, innerHeight / 3);
  });
  const header = headers.length === 1 ? headers[0] : null;
  return {
    count: 1, disabled: el.matches(':disabled'),
    rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    x, y, width: innerWidth, height: innerHeight, scrollY,
    receivesInput: Boolean(hit && (hit === el || el.contains(hit))),
    headerBottom: header ? header.getBoundingClientRect().bottom : null,
    interceptedByKnownHeader: Boolean(header && hit && (hit === header || header.contains(hit))),
    interceptedBy: hit?.tagName ?? null,
  };
}

function headerRecoveryScroll(state) {
  if (state.count !== 1 || state.disabled || state.receivesInput || !state.headerBottom) return null;
  const { rect, width, height, x, y, scrollY, headerBottom } = state;
  if (![rect.x, rect.y, rect.width, rect.height, width, height, x, y, scrollY, headerBottom].every(Number.isFinite) ||
    rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0 ||
    rect.x < 0 || rect.x + rect.width > width || x <= 0 || x >= width ||
    rect.y + rect.height <= 0 || y >= headerBottom || scrollY <= 0) return null;
  const clippedCenter = y < 0 && state.interceptedBy === null;
  if (!state.interceptedByKnownHeader && !clippedCenter) return null;
  const delta = Math.round(rect.y - headerBottom - Math.min(100, height / 5));
  // Recover only a small upward scroll from a partially clipped top button.
  if (delta >= 0 || -delta > Math.min(scrollY, height / 2)) return null;
  return delta;
}

function exposedButton(state) {
  return state.count === 1 && !state.disabled && state.receivesInput &&
    state.rect.width > 0 && state.rect.height > 0 &&
    state.rect.x >= 0 && state.rect.x + state.rect.width <= state.width &&
    state.rect.y >= (state.headerBottom ?? 0) + 8 &&
    state.rect.y + state.rect.height <= state.height;
}

async function observeSettledButton(page, name) {
  let previous;
  let current;
  // Observe layout/scroll settling before the only retry; never repeat input.
  for (let attempt = 0; attempt < 5; attempt++) {
    current = await page.evaluate(inspectButton, name);
    if (exposedButton(current) && previous && exposedButton(previous) &&
      ['x', 'y', 'width', 'height'].every((key) => Math.abs(current.rect[key] - previous.rect[key]) <= 1) &&
      Math.abs(current.scrollY - previous.scrollY) <= 1) return { state: current, settled: true };
    previous = current;
    if (attempt < 4) await page.waitForTimeout(100);
  }
  return { state: current, settled: false };
}

/** Retry once, only after a pre-dispatch resolution failure and known header clipping. */
export async function clickButton(page, name, recoveries) {
  const selector = `loc=role:button[name=${JSON.stringify(name)}]`;
  try {
    await page.click(selector, { timeout: 3000, label: `${name} 클릭` });
  } catch (error) {
    // Locator resolution can time out without dispatching input. An input/CDP
    // timeout can have late effects and must never trigger another click.
    if (error.name !== 'ElementResolutionError' ||
      !/intercepts pointer|not visible in.*viewport|none can receive input/i.test(error.message)) throw error;
    const before = await page.evaluate(inspectButton, name);
    const delta = headerRecoveryScroll(before);
    if (delta === null) throw error;
    // A real wheel action moves the button below the observed header. No forced
    // click, DOM click, synthetic event, overlay removal, or broad retry.
    await page.mouse.move(before.width / 2, Math.min(before.height - 40, before.headerBottom + 150));
    await page.mouse.wheel(0, delta, { label: '헤더 아래로 버튼 이동' });
    await page.snapshot();
    const { state: after, settled } = await observeSettledButton(page, name);
    recoveries.push({ action: name, reason: 'fixed-header-interception', before, after, settled });
    if (!settled) throw new Error(`${name}: header recovery did not expose a stable button`);
    await page.click(selector, { timeout: 3000, label: `${name} 다시 클릭` });
  }
}

/** Pick a complete card inside both the clipping region and the viewport. */
export function visibleTeamCard({ regionSelector, linkSelector }) {
  const region = document.querySelector(regionSelector);
  if (!region) return null;
  const clip = region.getBoundingClientRect();
  const candidates = [...document.querySelectorAll(linkSelector)].map((el, index) => {
    const r = el.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    const visible = r.width > 0 && r.height > 0 &&
      r.left >= Math.max(0, clip.left) + 8 && r.right <= Math.min(innerWidth, clip.right) - 8 &&
      r.top >= Math.max(0, clip.top) && r.bottom <= Math.min(innerHeight, clip.bottom) &&
      hit && (hit === el || el.contains(hit));
    return { index, href: el.href, name: el.getAttribute('aria-label'), visible: Boolean(visible), x, y };
  }).filter((candidate) => candidate.visible);
  candidates.sort((a, b) => Math.abs(a.x - innerWidth / 2) - Math.abs(b.x - innerWidth / 2));
  return candidates[0] ?? null;
}

export async function clickTeamCard(page, { pause, baseUrl, trace = async () => {} }) {
  await page.waitForSelector(TEAM_REGION, { state: 'visible', timeout: 15000 });
  await page.snapshot();
  const startScroll = await page.evaluate((selector) => document.querySelector(selector).scrollLeft, TEAM_REGION);
  await page.waitForFunction(({ selector, start }) =>
    Math.abs(document.querySelector(selector).scrollLeft - start) > 2,
  { selector: TEAM_REGION, start: startScroll }, { timeout: 5000 });
  if (pause) {
    // Exercise the former offscreen-first-card failure before choosing a new
    // visible copy. Do not click or retain the first link's stale position.
    await page.waitForFunction(({ region, links }) => {
      const clip = document.querySelector(region).getBoundingClientRect();
      const first = document.querySelector(links).getBoundingClientRect();
      return first.x + first.width / 2 < clip.left;
    }, { region: TEAM_REGION, links: TEAM_LINKS }, { timeout: 8000 });
    // Ego's direct focus can set activeElement without delivering the native
    // focus transition. Tab produces the real keyboard focus event for React.
    await page.press(TEAM_REGION, 'Tab');
    // Observe several animation frames: the product's focus pause must work.
    const stopped = await page.evaluate(async (selector) => {
      const el = document.querySelector(selector);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const start = el.scrollLeft;
      for (let i = 0; i < 4; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
      return el.contains(document.activeElement) && Math.abs(el.scrollLeft - start) < 1;
    }, TEAM_REGION);
    if (!stopped) throw new Error('Team marquee did not pause on focus');
  }
  const card = await page.evaluate(visibleTeamCard, { regionSelector: TEAM_REGION, linkSelector: TEAM_LINKS });
  if (!card) throw new Error('No complete, unobstructed team card is visible');
  const target = new URL(card.href);
  if (target.origin !== baseUrl || !/^\/teams\/[a-f0-9-]{36}$/.test(target.pathname)) throw new Error('Unexpected team link');
  // The high-level selector click stalled during regression setup. Use native
  // input only after semantic/visibility/hit-test checks; record the exact phase
  // and never retry a dispatch timeout (it can have late effects).
  await trace('mouse-move');
  await page.mouse.move(card.x, card.y, { label: '표시된 팀 카드로 이동' });
  const stillTargeted = await page.evaluate(({ x, y, index, selector }) => {
    const target = document.querySelectorAll(selector)[index];
    const hit = document.elementFromPoint(x, y);
    return Boolean(target && hit && (hit === target || target.contains(hit)));
  }, { ...card, selector: TEAM_LINKS });
  if (!stillTargeted) throw new Error('Team card moved away before native input');
  await trace('mouse-down');
  await page.mouse.down();
  await trace('mouse-up');
  await page.mouse.up();
  await trace('navigation');
  await page.waitForURL(card.href, { timeout: 15000 });
  await page.waitForFunction((label) => [...document.querySelectorAll('h1,h2')].some((el) => {
    const name = el.textContent.trim();
    return name.length > 0 && label.startsWith(name + ' ');
  }), card.name, { timeout: 15000 });
  return { mode: pause ? 'focus-paused-mouse' : 'moving-mouse', card };
}
