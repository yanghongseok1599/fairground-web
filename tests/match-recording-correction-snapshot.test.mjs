import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const load = moduleLoader({ '@/config/supabase': { supabase: {} } });
const { decodeSnapshot } = load('src/features/match-recording/transport.ts');
const { projectRoom } = load('src/features/match-recording/model.ts');

test('a synced automatic red keeps its yellow link across operation-ID normalization and offline cancellation', () => {
  const row = { match_id: 'match', player_id: 'player', player_name: '합성 선수', team_id: 'home', minute: 1, half: 1, created_at: '2026-10-03T00:00:00Z', is_cancelled: false, source_yellow_event_id: null };
  const decoded = decodeSnapshot({
    match: { id: 'match', status: 'live', home_team_id: 'home', away_team_id: 'away', home_score: 0, away_score: 0, elapsed_seconds: 0, current_half: 1, is_running: false },
    lineups: [], eventOperations: { 'second-yellow': 'yellow-command' },
    events: [{ ...row, id: 'first-yellow', type: 'yellow_card' }, { ...row, id: 'second-yellow', type: 'yellow_card' }, { ...row, id: 'automatic-red', type: 'red_card', source_yellow_event_id: 'second-yellow' }, { ...row, id: 'direct-red', type: 'red_card' }],
  });
  assert.equal(decoded.events[2].sourceYellowEventId, 'local:yellow-command');
  const result = projectRoom({ base: decoded, pending: [{ id: 'cancel-command', kind: 'cancel', payload: { eventOperationId: 'yellow-command' }, at: 100 }], lineups: [] });
  assert.equal(result.events[1].isCancelled, true);
  assert.equal(result.events[2].isCancelled, true);
  assert.equal(result.events[3].isCancelled, false);
});
