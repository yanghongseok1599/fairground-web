import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moduleLoader } from './helpers/load-ts-module.mjs';
const load = moduleLoader();
const { applyWhiteLogoInk, needsLightTeamCardLogo, BOB_FS_TEAM_ID } = load('src/lib/team-card-logo.ts');
const { leagueTierCardIndex, LEAGUE_TIER_LABEL } = load('src/lib/team-home.ts');

test('BOB의 검정 잉크만 흰색으로 바꾸고 투명도·노랑·파랑은 보존한다', () => {
  const pixels = new Uint8ClampedArray([
    0, 0, 0, 255, 10, 10, 10, 82, 255, 213, 0, 255,
    0, 102, 198, 255, 0, 0, 0, 0, 255, 255, 255, 255,
  ]);
  applyWhiteLogoInk(pixels);
  assert.deepEqual([...pixels], [
    255, 255, 255, 255, 255, 255, 255, 82, 255, 213, 0, 255,
    0, 102, 198, 255, 0, 0, 0, 0, 255, 255, 255, 255,
  ]);
});

test('다른 팀·이름이 같은 팀에는 BOB 카드 색상 규칙을 적용하지 않는다', () => {
  assert.equal(needsLightTeamCardLogo(BOB_FS_TEAM_ID), true);
  assert.equal(needsLightTeamCardLogo('other-team'), false);
  assert.equal(needsLightTeamCardLogo('BOB FS'), false);
  assert.equal(needsLightTeamCardLogo(undefined), false);
});

test('확정 우승팀의 premium 등급은 플래티넘 프레임으로 매핑한다', () => {
  assert.equal(leagueTierCardIndex('premium'), 3);
  assert.equal(LEAGUE_TIER_LABEL.premium, '플래티넘 리그');
});
