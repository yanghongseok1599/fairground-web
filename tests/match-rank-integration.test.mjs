import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

// Restore a fresh production SCHEMA ONLY into a disposable local database first.
// This suite creates synthetic rows and never connects to a hosted database.
const url = process.env.FAIRGROUND_TEST_DB_URL;
if (!url || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("A disposable LOCAL schema is required via FAIRGROUND_TEST_DB_URL.");
}

function sqlBridge(db) {
  const ident = name => { assert.match(name, /^[a-z_][a-z0-9_]*$/); return `"${name}"`; };
  const execute = async (sql, args) => {
    try { return { data: (await db.query(sql, args)).rows, error: null }; }
    catch (error) { return { data: null, error: { message: error.message, code: error.code } }; }
  };
  return {
    rpc: (name, args) => execute(`select * from public.${ident(name)}(${Object.keys(args).map((k, i) => `${ident(k)} => $${i + 1}`).join(",")})`, Object.values(args)),
    from(table) {
      let columns = "*", limit; const where = [], values = [], order = [];
      const chain = {
        select(value) { columns = value === "*" ? "*" : value.split(",").map(ident).join(","); return chain; },
        eq(key, value) { values.push(value); where.push(`${ident(key)} = $${values.length}`); return chain; },
        gt(key, value) { values.push(value); where.push(`${ident(key)} > $${values.length}`); return chain; },
        order(key, options) { order.push(`${ident(key)} ${options.ascending ? "asc" : "desc"}`); return chain; },
        limit(value) { assert.ok(Number.isInteger(value)); limit = value; return chain; },
        then(resolve, reject) {
          const sql = `select ${columns} from public.${ident(table)}${where.length ? ` where ${where.join(" and ")}` : ""}${order.length ? ` order by ${order.join(",")}` : ""}${limit !== undefined ? ` limit ${limit}` : ""}`;
          return execute(sql, values).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

async function fixture(t, { lineup = true } = {}) {
  const owner = new pg.Client({ connectionString: url }); await owner.connect();
  const actor = new pg.Client({ connectionString: url }); await actor.connect();
  t.after(async () => { await actor.end(); await owner.end(); });
  const ids = Array.from({ length: 12 }, () => randomUUID());
  const [admin, home, away, season, tournament, match, ...players] = ids;
  for (const [index, id] of [admin, ...players].entries()) await owner.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [id, `${id}@synthetic.invalid`, { name: `검수 선수 ${index}`, portrait_consent: true }]);
  await owner.query("begin; select set_config('app.in_end_match','1',true)");
  await owner.query("update public.profiles set role='admin',is_approved=true where id=$1", [admin]);
  await owner.query("commit");
  await owner.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
  for (const [id, name] of [[home, `검수 블루 ${home}`], [away, `검수 레드 ${away}`]]) await owner.query("insert into public.teams(id,name,is_approved,captain_id,portrait_consent_at) values($1,$2,true,$3,now())", [id, name, admin]);
  for (const [index, id] of players.entries()) await owner.query("update public.profiles set team_id=$2,is_approved=true,number=$3 where id=$1", [id, index < 3 ? home : away, index % 3 + 1]);
  await owner.query("insert into public.seasons(id,year,name,is_active) values($1,2026,'합성 검수 시즌',true)", [season]);
  await owner.query("insert into public.tournaments(id,season_id,name) values($1,$2,'합성 검수 대회')", [tournament, season]);
  await owner.query("insert into public.matches(id,tournament_id,home_team_id,away_team_id,home_team_name,away_team_name) values($1,$2,$3,$4,'검수 블루','검수 레드')", [match, tournament, home, away]);
  if (lineup) for (const [index, id] of players.entries()) await owner.query("insert into public.match_lineups(match_id,team_id,player_id,is_starter) values($1,$2,$3,$4)", [match, index < 3 ? home : away, id, index % 3 < 2]);
  await actor.query("set role authenticated"); await actor.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
  const { useDataStore } = moduleLoader({ "@/config/supabase": { supabase: sqlBridge(actor), isDemoMode: false } })("src/stores/dataStore.ts");
  const store = useDataStore.getState();
  const record = (type, index) => store.addMatchEvent(tournament, match, { type, playerId: players[index], playerName: `검수 선수 ${index + 1}`, teamId: index < 3 ? home : away, minute: 1, half: 1 });
  const profile = async index => (await owner.query("select goals,assists,games,mom,card_rating,season_yellow_cards,ban_matches_remaining from public.profiles where id=$1", [players[index]])).rows[0];
  const team = async id => (await owner.query("select season_stats from public.teams where id=$1", [id])).rows[0].season_stats;
  await store.startMatch(tournament, match);
  return { owner, actor, store, useDataStore, home, away, tournament, match, players, record, profile, team };
}

test("공식 종료 결과가 공개 랭킹과 리그 순위 조회까지 연결되고 중복 반영되지 않는다", async t => {
  const f = await fixture(t);
  await f.record("goal", 0); await f.record("goal", 2); await f.record("goal", 3); await f.record("assist", 1);
  await f.store.setMatchMom(f.tournament, f.match, f.players[0]);
  await f.store.endMatch(f.tournament, f.match);
  assert.deepEqual(await f.profile(0), { goals: 1, assists: 0, games: 1, mom: 1, card_rating: 74, season_yellow_cards: 0, ban_matches_remaining: 0 });
  assert.equal((await f.profile(2)).goals, 1); assert.equal((await f.profile(1)).assists, 1);
  const home = await f.team(f.home), away = await f.team(f.away);
  assert.deepEqual({ ...home, rank: 0 }, { points: 3, rank: 0, wins: 1, draws: 0, losses: 0, goalsFor: 2, goalsAgainst: 1, goalDifference: 1, gamesPlayed: 1 });
  assert.equal(away.points, 0); assert.equal(away.losses, 1); assert.ok(home.rank < away.rank);
  await f.store.endMatch(f.tournament, f.match); assert.deepEqual(await f.team(f.home), home); assert.equal((await f.profile(0)).games, 1);
  // The public view/column grants and the actual TS mappers are exercised as anon.
  await f.actor.query("reset role; set role anon");
  const goals = await f.store.fetchLeaderboard("goals", 500);
  const scorer = goals.find(p => p.id === f.players[2]); assert.equal(scorer?.stats.goals, 1);
  const assists = await f.store.fetchLeaderboard("assists", 500); assert.equal(assists.find(p => p.id === f.players[1])?.stats.assists, 1);
  const mom = await f.store.fetchLeaderboard("mom", 500); assert.equal(mom.find(p => p.id === f.players[0])?.stats.mom, 1);
  await f.store.fetchStandings(); const standing = f.useDataStore.getState().standings.find(s => s.teamId === f.home);
  assert.equal(standing?.points, 3); assert.equal(standing?.goalDifference, 1);
});

test("취소한 골·어시는 제외되고 무승부는 양 팀 1점이다", async t => {
  const f = await fixture(t); await f.record("goal", 0); await f.record("goal", 3); await f.record("goal", 0); await f.record("assist", 1);
  const events = (await f.owner.query("select id,type from public.match_events where match_id=$1 order by created_at desc", [f.match])).rows;
  await f.store.cancelMatchEvent(f.tournament, f.match, events.find(e => e.type === "assist").id);
  await f.store.cancelMatchEvent(f.tournament, f.match, events.find(e => e.type === "goal").id);
  await f.store.endMatch(f.tournament, f.match);
  assert.equal((await f.team(f.home)).points, 1); assert.equal((await f.team(f.away)).points, 1); assert.equal((await f.profile(0)).goals, 1); assert.equal((await f.profile(1)).assists, 0);
});

test("출전 명단이 없는 경기의 기록도 종료 시 집계된다", async t => {
  const f = await fixture(t, { lineup: false }); await f.record("goal", 0); await f.store.endMatch(f.tournament, f.match);
  assert.equal((await f.profile(0)).goals, 1); assert.equal((await f.team(f.home)).points, 3);
});

test("0:0 경기의 출전 횟수와 무승부 승점도 반영된다", async t => {
  const f = await fixture(t); await f.store.endMatch(f.tournament, f.match);
  assert.equal((await f.profile(0)).games, 1); assert.equal((await f.team(f.home)).points, 1); assert.equal((await f.team(f.away)).points, 1);
});

test("두 번째 경고·취소·직접 퇴장의 최종 징계가 한 번만 반영된다", async t => {
  const f = await fixture(t); await f.record("yellow_card", 0); await f.record("yellow_card", 0);
  let cards = (await f.owner.query("select id,type from public.match_events where match_id=$1 and not is_cancelled order by created_at desc", [f.match])).rows;
  assert.equal(cards.filter(e => e.type === "red_card").length, 1);
  await f.store.cancelMatchEvent(f.tournament, f.match, cards.find(e => e.type === "yellow_card").id);
  cards = (await f.owner.query("select type from public.match_events where match_id=$1 and not is_cancelled", [f.match])).rows;
  assert.equal(cards.filter(e => e.type === "red_card").length, 0);
  await f.record("red_card", 3); await f.store.endMatch(f.tournament, f.match); await f.store.endMatch(f.tournament, f.match);
  assert.equal((await f.profile(0)).season_yellow_cards, 1); assert.equal((await f.profile(0)).ban_matches_remaining, 0); assert.equal((await f.profile(3)).ban_matches_remaining, 2);
});

test("출전 명단 없이 MOM만 선택한 선수의 MOM 기록도 반영된다", async t => {
  const f = await fixture(t, { lineup: false }); await f.record("goal", 0);
  await f.store.setMatchMom(f.tournament, f.match, f.players[1]); await f.store.endMatch(f.tournament, f.match);
  assert.equal((await f.profile(1)).mom, 1); assert.equal((await f.profile(1)).games, 1);
});

test("일반 선수의 경기 종료 요청은 차단된다", async t => {
  const f = await fixture(t); await f.actor.query("select set_config('request.jwt.claim.sub',$1,false)", [f.players[0]]);
  await assert.rejects(f.store.endMatch(f.tournament, f.match), /only referee\/admin/);
  assert.equal((await f.profile(0)).games, 0);
});

test("종료 도중 실패하면 선수 통계·팀 승점·종료 상태가 부분 반영되지 않는다", async t => {
  const f = await fixture(t); await f.record("goal", 0);
  await f.owner.query("update public.teams set season_stats=$2 where id=$1", [f.home, { points: "invalid synthetic value" }]);
  try {
    await assert.rejects(f.store.endMatch(f.tournament, f.match), /invalid input syntax for type integer: "invalid synthetic value"/);
    assert.equal((await f.profile(0)).games, 0); assert.equal((await f.profile(0)).goals, 0);
    const match = (await f.owner.query("select status,stats_applied from public.matches where id=$1", [f.match])).rows[0];
    assert.deepEqual(match, { status: "live", stats_applied: false });
  } finally {
    // Also restore the invalid row when a different production defect fails this test.
    await f.owner.query("update public.teams set season_stats='{}'::jsonb where id=$1", [f.home]);
  }
});
