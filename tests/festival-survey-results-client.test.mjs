import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

function fixture(reply) {
  const calls = [];
  const load = moduleLoader({ "@/config/supabase": { supabase: { rpc(...args) {
    calls.push(args);
    return { abortSignal(signal) {
      assert.ok(signal);
      return { retry(enabled) { assert.equal(enabled, false); return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply); } };
    } };
  } } } });
  return { client: load("src/features/festival-survey/results/client.ts"), calls };
}

test("the results read uses the signed-in shared client and the scalar RPC without pagination limits", async () => {
  const { client, calls } = fixture({ data: { responses: [] }, error: null });
  assert.deepEqual(await client.loadSurveyResponses(), []);
  assert.deepEqual(calls, [["get_festival_survey_results"]]);
});

test("unauthorized, backend and transport errors do not reveal raw details or masquerade as empty results", async () => {
  for (const [reply, message] of [
    [{ data: null, error: { code: "42501", message: "private denial" } }, /승인된 관리자/],
    [{ data: null, error: { code: "PGRST202", message: "private missing RPC" } }, /불러오지 못했습니다/],
    [new Error("private network token"), /인터넷 연결/],
    [{ data: { responses: [null] }, error: null }, /결과 형식/],
  ]) {
    const { client } = fixture(reply);
    await assert.rejects(() => client.loadSurveyResponses(), (error) => {
      assert.match(error.message, message); assert.doesNotMatch(error.message, /private/); return true;
    });
  }
});

test("permission and expired-auth failures remain typed so the UI can immediately discard cached results", async () => {
  for (const reply of [
    { data: null, error: { code: "42501", message: "private denial" }, status: 403 },
    { data: null, error: { code: "PGRST301", message: "private expired token" }, status: 401 },
  ]) {
    const { client } = fixture(reply);
    await assert.rejects(() => client.loadSurveyResponses(), (error) => error instanceof client.SurveyResultsAccessError);
  }
});
