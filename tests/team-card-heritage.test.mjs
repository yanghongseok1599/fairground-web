import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const load = moduleLoader();
const { TEAM_CARD_SIZE, TEAM_CARD_TIER_ORDER, getTeamCardAppearance, resolveTeamCardTier } = load('src/lib/team-card-appearance.ts');

test('confirmed final card tier overrides league membership without mutating it; new/withdrawn teams keep their saved tier', () => {
  const team = Object.freeze({ id: 'winner', leagueTier: 'bronze' });
  const results = Object.freeze({ winner: 'premium', runnerUp: 'gold' });
  assert.equal(resolveTeamCardTier(team, results), 'premium');
  assert.equal(team.leagueTier, 'bronze');
  assert.equal(resolveTeamCardTier({ id: 'withdrawn', leagueTier: 'bronze' }, results), 'bronze');
  assert.equal(resolveTeamCardTier({ id: 'new-team', leagueTier: 'silver' }, results), 'silver');
  assert.equal(resolveTeamCardTier(team, {}), 'bronze');
});

test('all four card tiers use one portrait heritage catalog; only platinum includes sparkle artwork', () => {
  assert.deepEqual(TEAM_CARD_SIZE, { width: 1024, height: 1536 });
  const appearances = TEAM_CARD_TIER_ORDER.map(getTeamCardAppearance);
  assert.deepEqual(appearances.map(card => card.frame), ['bronze', 'silver', 'gold', 'platinum'].map(name => `/images/team-cards/heritage-v1/${name}.webp`));
  assert.deepEqual(appearances.filter(card => card.sparkle).map(card => card.label), ['플래티넘']);
  assert.equal(getTeamCardAppearance(undefined).tier, 'bronze');
  assert.equal(getTeamCardAppearance('unknown').tier, 'bronze');
});

test('gallery and individual tier hooks reuse one subscription store and a stable empty server snapshot', () => {
  const empty = {};
  const tiers = { winner: 'premium' };
  const subscriptions = [];
  let storeCount = 0;
  const store = { subscribe: () => () => {}, snapshot: () => tiers };
  const loadHook = moduleLoader({
    react: { useSyncExternalStore(subscribe, snapshot, serverSnapshot) {
      subscriptions.push(subscribe);
      assert.equal(serverSnapshot(), empty);
      return snapshot();
    } },
    './final-card-tier-store': { EMPTY_FINAL_CARD_TIERS: empty, createFinalCardTierStore: () => { storeCount++; return store; } },
  });
  const { useFinalCardTiers, useFinalCardTier } = loadHook('src/features/standings/use-final-card-tier.ts');
  assert.equal(useFinalCardTiers(), tiers);
  assert.equal(useFinalCardTier('winner'), 'premium');
  assert.equal(useFinalCardTier('new-team'), undefined);
  assert.equal(storeCount, 1);
  assert.ok(subscriptions.every(subscribe => subscribe === store.subscribe));
  assert.equal(useFinalCardTier(), undefined);
  assert.notEqual(subscriptions.at(-1), store.subscribe);
});
