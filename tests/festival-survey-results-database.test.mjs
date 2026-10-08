// Synthetic answers and users only, on isolated localhost PG17; fixtures always roll back.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";

const url = process.env.FESTIVAL_SURVEY_RESULTS_TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("FESTIVAL_SURVEY_RESULTS_TEST_DATABASE_URL must point to an isolated localhost database.");
}
const db = new pg.Client({ connectionString: url });
await db.connect();
let assertions = 0;
const fixtureUsers = { admin: randomUUID(), unapproved: randomUUID(), referee: randomUUID(), player: randomUUID(), operator: randomUUID(), missing: randomUUID() };
const answers = { role: "captain", overallSatisfaction: 5, recommendation: 0, returnIntent: "probably",
  categoryRatings: { referee: 5, safety: 4, schedule: 3, facilities: 2, communication: 1, program: 5 },
  rulesOpinion: "appropriate", matchDuration: "appropriate", entryFee: "appropriate",
  bestMoment: "즐거운 경기", improvement: "없음", safetyIncident: "", suggestions: "" };
const getResults = () => db.query("select public.get_festival_survey_results() as results");
const asUser = async (id, role = "authenticated") => {
  await db.query("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id ?? ""]);
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id ?? null, role })]);
  await db.query(`set local role ${role}`);
};
const denied = async (run) => {
  await db.query("savepoint denied");
  try { await assert.rejects(run, (error) => { assert.equal(error.code, "42501"); return true; }); assertions++; }
  finally { await db.query("rollback to savepoint denied"); }
};
const snapshot = async () => (await db.query(`select
  (select md5(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')) from pg_proc p where p.oid='public.submit_festival_survey(uuid,jsonb)'::regprocedure) as submit,
  (select row(relacl::text,relrowsecurity,relforcerowsecurity)::text from pg_class where oid='public.festival_survey_responses'::regclass) as table_permissions,
  (select coalesce(jsonb_agg(to_jsonb(p) order by p.policyname),'[]'::jsonb) from pg_policies p where p.schemaname='public' and p.tablename='festival_survey_responses') as policies,
  (select md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by r.response_id),'')) from public.festival_survey_responses r) as responses`)).rows[0];

try {
  const applied = process.env.FESTIVAL_SURVEY_RESULTS_TEST_MIGRATION_APPLIED === "1";
  let standalone = false;
  if (!applied) {
    assert.equal((await db.query("select to_regprocedure('public.get_festival_survey_results()') as existing")).rows[0].existing, null);
    standalone = !(await db.query("select to_regclass('public.profiles') as present")).rows[0].present;
    if (standalone) {
      await db.query(`do $$ begin
        if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
        if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
        if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
      end $$;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated,service_role;
      create table public.profiles(id uuid primary key,role text not null,is_approved boolean);
      create table public.player_inspection_operators(profile_id uuid primary key,granted_by uuid);`);
      await db.query(await fs.readFile(new URL("../supabase/migrations/20261008010000_festival_survey.sql", import.meta.url), "utf8"));
    }
    const before = await snapshot();
    await db.query(await fs.readFile(new URL("../supabase/migrations/20261008020000_festival_survey_results.sql", import.meta.url), "utf8"));
    assert.deepEqual(await snapshot(), before, "Results migration cannot change response storage or submit behavior."); assertions++;
  }
  const initial = await snapshot();
  await db.query("begin");
  try {
    if (standalone) {
      for (const [kind, id] of Object.entries(fixtureUsers).filter(([kind]) => kind !== "missing")) {
        await db.query("insert into public.profiles(id,role,is_approved) values($1,$2,$3)", [id, ["admin", "unapproved"].includes(kind) ? "admin" : kind === "referee" ? "referee" : "player", kind !== "unapproved"]);
      }
    } else {
      for (const [kind, id] of Object.entries(fixtureUsers).filter(([kind]) => kind !== "missing")) {
        await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [id, `${id}@example.invalid`, { name: "설문 결과 권한 합성 사용자", portrait_consent: true }]);
        await db.query("select set_config('app.in_end_match','1',true)");
        await db.query("update public.profiles set role=$2,is_approved=$3 where id=$1", [id, ["admin", "unapproved"].includes(kind) ? "admin" : kind === "referee" ? "referee" : "player", kind !== "unapproved"]);
        await db.query("select set_config('app.in_end_match','0',true)");
      }
    }
    await db.query("insert into public.player_inspection_operators(profile_id,granted_by) values($1,$2)", [fixtureUsers.operator, fixtureUsers.admin]);
    const contract = (await db.query("select prosecdef,provolatile,proconfig,prorettype::regtype::text as result_type from pg_proc where oid='public.get_festival_survey_results()'::regprocedure")).rows[0];
    assert.equal(contract.prosecdef, true); assert.equal(contract.provolatile, "s");
    assert.equal(contract.result_type, "jsonb"); assert.ok(contract.proconfig.includes("search_path=pg_catalog, public, pg_temp")); assertions += 4;
    assert.equal((await db.query("select has_function_privilege('authenticated','public.get_festival_survey_results()','EXECUTE') allowed")).rows[0].allowed, true); assertions++;

    // Null identity, absent profile, unapproved admin and every non-admin role are denied.
    for (const kind of ["unapproved", "referee", "player", "operator", "missing"]) {
      await asUser(fixtureUsers[kind]); await denied(getResults);
    }
    await asUser(null); await denied(getResults);
    for (const role of ["anon", "service_role"]) {
      await asUser(fixtureUsers.admin, role); await denied(getResults);
    }
    await asUser(fixtureUsers.admin);
    const initialResponses = (await getResults()).rows[0].results.responses;
    assert.ok(Array.isArray(initialResponses)); assertions++;

    // Existing records, if present on a schema-rehearsal target, remain in totals unchanged.
    await asUser(null, "anon");
    await db.query("select public.submit_festival_survey(gen_random_uuid(),$1::jsonb) from generate_series(1,1001)", [JSON.stringify(answers)]);
    await asUser(fixtureUsers.admin);
    const payload = (await getResults()).rows[0].results;
    assert.deepEqual(Object.keys(payload), ["responses"]);
    assert.equal(payload.responses.length, initialResponses.length + 1001);
    assert.ok(payload.responses.every(row => Object.keys(row).sort().join(",") === "answers,createdAt,responseId"));
    assert.ok(payload.responses.every(row => typeof row.createdAt === "string"));
    assert.doesNotMatch(JSON.stringify(payload), /example\.invalid|설문 결과 권한 합성 사용자|granted_by/);
    const lastTime = (row) => Date.parse(row.createdAt);
    assert.ok(payload.responses.every((row, index) => index === 0 || lastTime(payload.responses[index - 1]) >= lastTime(row)));
    assertions += 6;
    // An administrator's RPC access does not grant direct reads or writes.
    for (const sql of ["select * from public.festival_survey_responses", "update public.festival_survey_responses set answers='{}'::jsonb", "delete from public.festival_survey_responses"]) {
      await denied(() => db.query(sql));
    }

    // Approval revocation is enforced on the next call using the same session.
    await db.query("reset role");
    await db.query("select set_config('app.in_end_match','1',true)");
    await db.query("update public.profiles set is_approved=false where id=$1", [fixtureUsers.admin]);
    await db.query("select set_config('app.in_end_match','0',true)");
    await asUser(fixtureUsers.admin); await denied(getResults);
  } finally { await db.query("rollback"); }
  assert.deepEqual(await snapshot(), initial, "Synthetic fixtures must not alter existing submissions, ACL or RLS."); assertions++;
  console.log(`Festival survey results database: ${assertions} checks passed (approved admin only, denied other roles, all 1001 responses, unchanged storage/submit, fixture rollback).`);
} finally { await db.query("rollback"); await db.end(); }
