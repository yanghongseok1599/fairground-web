import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

const submission = {
  responseId: "66526e15-3744-45e5-95a2-6e84ef7603a4",
  answers: { role: "captain", overallSatisfaction: 5, recommendation: 0, returnIntent: "probably",
    categoryRatings: { referee: 5, safety: 4, schedule: 3, facilities: 2, communication: 1, program: 5 },
    rulesOpinion: "appropriate", matchDuration: "appropriate", entryFee: "appropriate",
    bestMoment: "  즐거운 경기  ", improvement: "없음", safetyIncident: "", suggestions: "" },
};
function fixture(result = { success: true }) {
  const requests = [];
  const load = moduleLoader({ "@/features/festival-survey/server": {
    async saveSurveyResponse(input) { requests.push(input); return result; },
  } });
  return { route: load("src/app/api/survey/route.ts"), requests };
}
const request = (body = submission, headers = { "Content-Type": "application/json", Cookie: "member=secret", "X-Forwarded-For": "192.0.2.1" }) =>
  new Request("http://localhost/api/survey", { method: "POST", headers, body: JSON.stringify(body) });

test("valid anonymous submissions save canonical answers only and return a no-store receipt", async () => {
  const { route, requests } = fixture();
  const reply = await route.POST(request());
  assert.equal(reply.status, 200);
  assert.deepEqual(await reply.json(), { success: true });
  assert.match(reply.headers.get("Cache-Control"), /no-store/);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].answers.bestMoment, "즐거운 경기");
  assert.deepEqual(Object.keys(requests[0]).sort(), ["answers", "responseId"]);
  assert.equal(route.GET, undefined);
  assert.equal(route.DELETE, undefined);
});

test("malformed, incomplete or excessive inputs never reach the database", async () => {
  const { route, requests } = fixture();
  assert.equal((await route.POST(new Request("http://localhost/api/survey", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status, 400);
  assert.equal((await route.POST(request(submission, { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await route.POST(request({ ...submission, answers: { ...submission.answers, recommendation: null } }))).status, 422);
  assert.equal((await route.POST(request({ ...submission, answers: { ...submission.answers, ip: "192.0.2.1" } }))).status, 422);
  assert.equal((await route.POST(request({ ...submission, answers: { ...submission.answers, bestMoment: "a".repeat(70_000) } }))).status, 413);
  assert.equal(requests.length, 0);
});

test("failed persistence never returns a success receipt and keeps retries identifiable", async () => {
  for (const status of [409, 422, 503]) {
    const { route, requests } = fixture({ success: false, status, error: "접수를 확인해 주세요." });
    const reply = await route.POST(request());
    assert.equal(reply.status, status);
    assert.deepEqual(await reply.json(), { error: "접수를 확인해 주세요." });
    assert.equal(requests[0].responseId, submission.responseId);
  }
});

test("the real server uses an anonymous client, exact UUID retries, timeout, and private error messages", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-public-key";
  try {
    for (const [result, expected] of [
      [{ data: true, error: null }, 200],
      [{ data: false, error: null }, 503],
      [{ data: null, error: { code: "23505", message: "private database detail" } }, 409],
      [{ data: null, error: { code: "22023", message: "private database detail" } }, 422],
      [{ data: null, error: { code: "PGRST202", message: "private database detail" } }, 503],
    ]) {
      const calls = [];
      const load = moduleLoader({ "@supabase/supabase-js": { createClient(url, key, options) {
        calls.push({ url, key, options });
        return { rpc(name, args) {
          calls.push({ name, args });
          return { abortSignal(signal) { assert.ok(signal); return { retry(enabled) { assert.equal(enabled, false); return Promise.resolve(result); } }; } };
        } };
      } } });
      const reply = await load("src/features/festival-survey/server.ts").saveSurveyResponse(submission);
      assert.equal(reply.success ? 200 : reply.status, expected);
      assert.deepEqual(calls[0].options.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
      assert.equal(calls[1].name, "submit_festival_survey");
      assert.equal(calls[1].args.p_response_id, submission.responseId);
      assert.deepEqual(Object.keys(calls[1].args).sort(), ["p_answers", "p_response_id"]);
      if (!reply.success) assert.doesNotMatch(reply.error, /private database/);
    }
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});

test("a missing configuration or a thrown transport failure cannot produce a false success", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const missing = moduleLoader({ "@supabase/supabase-js": { createClient() { throw new Error("must not initialize without env"); } } });
    const unavailable = await missing("src/features/festival-survey/server.ts").saveSurveyResponse(submission);
    assert.equal(unavailable.success, false);
    assert.equal(unavailable.status, 503);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-public-key";
    const thrown = moduleLoader({ "@supabase/supabase-js": { createClient() { throw new Error("private transport details"); } } });
    const failed = await thrown("src/features/festival-survey/server.ts").saveSurveyResponse(submission);
    assert.equal(failed.success, false);
    assert.equal(failed.status, 503);
    assert.doesNotMatch(failed.error, /private transport details/);
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});
