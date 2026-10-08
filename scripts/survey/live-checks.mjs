import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { quote } from "./catalog.mjs";

async function savepoint(client, role, callback) {
  await client.query("savepoint survey_api_probe");
  try {
    await client.query(`set local role ${quote(role)}`);
    return await callback();
  } finally {
    await client.query("rollback to savepoint survey_api_probe;release savepoint survey_api_probe");
  }
}

async function expectDenied(client, sql) {
  let denied = false;
  try { await client.query(sql); }
  catch (error) { assert.equal(error.code, "42501", "Expected a permission rejection."); denied = true; }
  assert.equal(denied, true, "API role unexpectedly received survey access.");
}

async function submission(client) {
  const answers = {role:"captain",overallSatisfaction:5,recommendation:0,returnIntent:"probably",categoryRatings:{referee:5,safety:4,schedule:3,facilities:2,communication:1,program:5},rulesOpinion:"appropriate",matchDuration:"appropriate",entryFee:"appropriate",bestMoment:"합성 검증 응답",improvement:"합성 검증 응답",safetyIncident:"",suggestions:""};
  for (const role of ["anon", "authenticated"]) await savepoint(client, role, async () => {
    const id = randomUUID();
    for(let retry=0;retry<2;retry++)assert.equal((await client.query("select public.submit_festival_survey($1::uuid,$2::jsonb) accepted",[id,JSON.stringify(answers)])).rows[0].accepted,true);
    await expectDenied(client, "select * from public.festival_survey_responses");
  });
  assert.equal((await client.query("select count(*)::int count from public.festival_survey_responses")).rows[0].count,0);
  return {anonAndAuthenticatedRpcVerified:true,syntheticResponseRows:0};
}

async function results(client) {
  const admin = (await client.query("select id from public.profiles where role='admin' and is_approved is true order by id limit 1")).rows[0];
  const member = (await client.query("select id from public.profiles where role<>'admin' order by id limit 1")).rows[0];
  assert.ok(admin && member, "Hosted permission checks need existing approved admin and regular member identities.");
  await savepoint(client, "anon", () => expectDenied(client, "select public.get_festival_survey_results()"));
  await savepoint(client, "authenticated", async () => {
    await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[member.id,JSON.stringify({sub:member.id,role:"authenticated"})]);
    await expectDenied(client, "select public.get_festival_survey_results()");
  });
  await savepoint(client, "authenticated", async () => {
    await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[admin.id,JSON.stringify({sub:admin.id,role:"authenticated"})]);
    // Only shape/count cross the DB boundary; respondent payload and admin identity are not logged.
    const row = (await client.query("select jsonb_typeof(r->'responses') kind,jsonb_array_length(r->'responses')::int count from (select public.get_festival_survey_results() r) q")).rows[0];
    assert.equal(row.kind, "array"); assert.ok(Number.isSafeInteger(row.count) && row.count >= 0);
  });
  return {approvedAdminRpcVerified:true,anonAndOrdinaryMemberDenied:true,respondentPayloadLogged:false,syntheticRowsInserted:0};
}

export async function verifyLiveAccess(client, task) {
  return task.name === "results" ? results(client) : submission(client);
}
