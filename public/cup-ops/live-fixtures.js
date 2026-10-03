const refreshInterval = 5_000;

export function fixtureStatusText(fixture) {
  if (fixture.status === 'cancelled' && typeof fixture.note === 'string') return fixture.note;
  const labels = { scheduled: '예정', live: '진행 중', finished: '종료', cancelled: '취소' };
  const status = labels[fixture.status] ?? (fixture.homeTeamId && fixture.awayTeamId ? '대진 확정' : '결과 대기');
  if ((fixture.status !== 'live' && fixture.status !== 'finished') ||
      !Number.isInteger(fixture.homeScore) || !Number.isInteger(fixture.awayScore)) return status;
  const score = `${fixture.homeScore} : ${fixture.awayScore}`;
  const pk = Number.isInteger(fixture.homeShootoutScore) && Number.isInteger(fixture.awayShootoutScore)
    ? ` · PK ${fixture.homeShootoutScore} : ${fixture.awayShootoutScore}` : '';
  return `${status} · ${score}${pk}`;
}

export function updateCupFixtureRows(fixtures, { document, teamNames }) {
  for (const fixture of fixtures) {
    const row = document.querySelector(`[data-knockout-slot="${fixture.slot}"]`);
    if (!row) continue;
    row.querySelector('[data-fixture-match]').textContent = `${fixture.homeLabel} vs ${fixture.awayLabel}`;
    row.querySelector('[data-fixture-status]').textContent = fixtureStatusText(fixture);
    if (fixture.homeTeamId && fixture.awayTeamId) {
      row.querySelector('[data-fixture-rest]').textContent = teamNames
        .filter(name => name !== fixture.home && name !== fixture.away).join(', ');
    }
  }
}

/** Update only match cells. Other sections, focus and the page scroll stay intact. */
export function startCupFixtureRefresh({
  document = globalThis.document,
  fetch = globalThis.fetch,
  setTimeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
  teamNames,
  onFixtures = () => {},
} = {}) {
  let timer;
  let pending = false;
  let stopped = false;
  const validFixtures = fixtures => Array.isArray(fixtures) && fixtures.length === 8 &&
    new Set(fixtures.map(row => row?.slot)).size === 8 && fixtures.every(row =>
      Number.isInteger(row?.slot) && row.slot >= 13 && row.slot <= 20 &&
      typeof row.homeLabel === 'string' && typeof row.awayLabel === 'string');

  async function refresh() {
    clearTimeout(timer);
    if (pending || stopped || document.hidden) return;
    pending = true;
    try {
      const response = await fetch('/api/cup-fixtures', {
        cache: 'no-store', signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Fixtures unavailable');
      const { fixtures } = await response.json();
      if (!validFixtures(fixtures)) throw new Error('Invalid fixtures');
      if (!stopped) {
        updateCupFixtureRows(fixtures, { document, teamNames });
        onFixtures(fixtures);
      }
    } catch {
      // A network interruption leaves the last successful schedule visible.
    } finally {
      pending = false;
      if (!stopped && !document.hidden) timer = setTimeout(refresh, refreshInterval);
    }
  }
  function visibilityChanged() {
    clearTimeout(timer);
    if (!document.hidden) void refresh();
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  void refresh();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', visibilityChanged);
  };
}
