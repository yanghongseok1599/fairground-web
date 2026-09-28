// Caller owns the transaction, reviewed ID list, restorable backup and preservation checks.
// No connection or CLI: this helper cannot independently reach production.
export async function deleteApprovedScheduledFixtures(db, matchIds) {
  if (!matchIds.length || new Set(matchIds).size !== matchIds.length) {
    throw Error('Explicit unique fixture IDs required');
  }
  const matches = (await db.query(
    'select * from public.matches where id=any($1::uuid[]) order by id for update', [matchIds],
  )).rows;
  if (matches.length !== matchIds.length) throw Error('Reviewed fixture scope changed');
  if (matches.some(m => m.status !== 'scheduled' || m.is_running || m.stats_applied ||
    m.home_score !== 0 || m.away_score !== 0 || m.elapsed_seconds !== 0 || m.mom_player_id)) {
    throw Error('Fixture has started or contains records');
  }
  // Do not let FK cascades silently remove records, messages or photo associations.
  for (const table of ['match_events', 'match_lineups', 'notifications', 'activity_events', 'team_gallery_photos']) {
    const result = await db.query(`select 1 from public.${table} where match_id=any($1::uuid[]) limit 1`, [matchIds]);
    if (result.rowCount) throw Error(`Linked data requires separate review: ${table}`);
  }
  const result = await db.query('delete from public.matches where id=any($1::uuid[]) returning id', [matchIds]);
  if (result.rowCount !== matchIds.length) throw Error('Deleted fixture count mismatch');
  return { deleted: result.rowCount, matchIds: result.rows.map(r => r.id).sort() };
}
