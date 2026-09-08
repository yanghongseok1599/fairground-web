import assert from "node:assert/strict";
import test from "node:test";

import {
  diffAgainstDatabase,
  extractReferences,
  filterIgnored,
  isStrictEnvironment,
  isTruthyFlag,
} from "../scripts/supabase/check-schema-parity.mjs";

function names(references, kind) {
  return references.filter((reference) => reference.kind === kind).map((reference) => reference.name);
}

test("문자열 리터럴 RPC·릴레이션·백틱 호출을 종류별로 추출한다", () => {
  const source = [
    'const a = await supabase.rpc("get_my_profile");',
    "const b = await supabase.from('public_player_profiles').select('*');",
    "const c = await supabase.rpc(`end_match`, { p_match_id: id });",
    "const d = await supabase.from(`matches`).select();",
  ].join("\n");

  const { references, dynamic } = extractReferences(source, "src/example.ts");

  assert.deepEqual(names(references, "function").sort(), ["end_match", "get_my_profile"]);
  assert.deepEqual(names(references, "relation").sort(), ["matches", "public_player_profiles"]);
  assert.deepEqual(dynamic, []);
});

test("참조 위치를 file:line 으로 기록한다", () => {
  const source = ["const noop = 1;", "", 'await supabase.rpc("start_match");'].join("\n");

  const { references } = extractReferences(source, "src/lib/match.ts");

  assert.deepEqual(references, [
    { kind: "function", name: "start_match", file: "src/lib/match.ts", line: 3 },
  ]);
});

test("storage.from 은 릴레이션이 아니라 버킷으로 분류한다", () => {
  const source = [
    'await supabase.storage.from("team-galleries").remove([objectPath]);',
    "const { data } = supabase.storage",
    '  .from("team-galleries")',
    "  .getPublicUrl(objectPath);",
  ].join("\n");

  const { references } = extractReferences(source, "src/stores/dataStore.ts");

  assert.deepEqual(names(references, "bucket"), ["team-galleries", "team-galleries"]);
  assert.deepEqual(names(references, "relation"), []);
});

test("하이픈이 있는 이름을 접두사만 잘라내지 않는다", () => {
  const source = 'await supabase.storage.from("team-galleries").upload(path, file);';

  const { references } = extractReferences(source, "src/stores/dataStore.ts");

  assert.deepEqual(names(references, "bucket"), ["team-galleries"]);
  assert.equal(references.some((reference) => reference.name === "team"), false);
});

test("변수·보간 템플릿 인자는 동적으로 분류하고 치명 목록에 넣지 않는다", () => {
  const source = [
    "await supabase.rpc(`get_${kind}`);",
    "await supabase.from(tableName).select();",
    "await supabase.from(tbl).update(patch);",
  ].join("\n");

  const { references, dynamic } = extractReferences(source, "src/stores/dataStore.ts");

  assert.deepEqual(references, []);
  assert.equal(dynamic.length, 3);
  assert.deepEqual(dynamic.map((entry) => entry.kind), ["function", "relation", "relation"]);
  assert.deepEqual(dynamic.map((entry) => entry.line), [1, 2, 3]);
  assert.match(dynamic[0].snippet, /get_\$\{kind\}/);
});

test("주석 안의 호출은 수집하지 않는다", () => {
  const source = [
    '// await supabase.from("ghost");',
    "/*",
    ' await supabase.rpc("ghost_rpc");',
    ' await supabase.storage.from("ghost-bucket");',
    "*/",
    'await supabase.from("teams").select();',
  ].join("\n");

  const { references, dynamic } = extractReferences(source, "src/example.ts");

  assert.deepEqual(names(references, "relation"), ["teams"]);
  assert.deepEqual(names(references, "function"), []);
  assert.deepEqual(names(references, "bucket"), []);
  assert.deepEqual(dynamic, []);
});

test("정규식 리터럴 안의 슬래시를 줄 주석으로 오인하지 않는다", () => {
  const source = [
    'const objectPath = storagePath.replace(/^team-galleries\\//, ""); await supabase.from("teams").select();',
  ].join("\n");

  const { references } = extractReferences(source, "src/stores/dataStore.ts");

  assert.deepEqual(names(references, "relation"), ["teams"]);
});

test("Array.from 은 Supabase 호출로 수집하지 않는다", () => {
  const source = [
    "const ids = Array.from(teamIds);",
    "const slots = Array.from({ length: 4 }, () => null);",
    "const nodes = Array.from(element.querySelectorAll(\"img\"));",
    'await supabase.from("teams").select();',
  ].join("\n");

  const { references, dynamic } = extractReferences(source, "src/example.tsx");

  assert.deepEqual(names(references, "relation"), ["teams"]);
  assert.deepEqual(dynamic, []);
});

test("호출 사이에 주석이 끼어 있어도 이름을 읽는다", () => {
  const source = [
    "const { data } = await supabase.rpc(",
    "  // 자동 생성 타입에 없어 캐스팅",
    '  "get_vapid_public_key" as never',
    ");",
  ].join("\n");

  const { references } = extractReferences(source, "src/lib/push.ts");

  assert.deepEqual(names(references, "function"), ["get_vapid_public_key"]);
});

test("ignore 목록의 이름은 결과에서 제외하고 사유와 함께 남긴다", () => {
  const source = [
    'await supabase.from("legacy_view").select();',
    'await supabase.from("teams").select();',
    'await supabase.rpc("legacy_rpc");',
    'await supabase.storage.from("legacy-bucket").list();',
  ].join("\n");

  const { references } = extractReferences(source, "src/example.ts");
  const { kept, ignored } = filterIgnored(references, {
    relations: [{ name: "legacy_view", reason: "삭제 예정 뷰" }],
    functions: [{ name: "legacy_rpc", reason: "미사용 경로" }],
    buckets: [{ name: "legacy-bucket", reason: "아카이브" }],
  });

  assert.deepEqual(kept.map((reference) => reference.name), ["teams"]);
  assert.deepEqual(
    ignored.map((entry) => `${entry.kind}:${entry.name}:${entry.reason}`).sort(),
    [
      "bucket:legacy-bucket:아카이브",
      "function:legacy_rpc:미사용 경로",
      "relation:legacy_view:삭제 예정 뷰",
    ],
  );
});

test("ignore 파일이 없을 때와 같은 빈 목록에서는 아무것도 제외하지 않는다", () => {
  const { references } = extractReferences('await supabase.from("teams").select();', "src/a.ts");
  const { kept, ignored } = filterIgnored(references, { relations: [], functions: [], buckets: [] });

  assert.deepEqual(kept.map((reference) => reference.name), ["teams"]);
  assert.deepEqual(ignored, []);
});

test("DB에 없는 참조만 치명 목록에 담고 참조 위치를 유지한다", () => {
  const source = [
    'await supabase.rpc("get_my_profile");',
    'await supabase.rpc("codex_only_rpc");',
    'await supabase.from("teams").select();',
    'await supabase.from("missing_view").select();',
    'await supabase.storage.from("team-galleries").list();',
  ].join("\n");

  const { references } = extractReferences(source, "src/example.ts");
  const byKind = { function: new Map(), relation: new Map(), bucket: new Map() };
  for (const reference of references) {
    if (!byKind[reference.kind].has(reference.name)) byKind[reference.kind].set(reference.name, []);
    byKind[reference.kind].get(reference.name).push({ file: reference.file, line: reference.line });
  }

  const missing = diffAgainstDatabase(byKind, {
    function: new Set(["get_my_profile"]),
    relation: new Set(["teams"]),
    bucket: new Set(["team-galleries"]),
  });

  assert.deepEqual(missing.function.map((entry) => entry.name), ["codex_only_rpc"]);
  assert.deepEqual(missing.relation.map((entry) => entry.name), ["missing_view"]);
  assert.deepEqual(missing.bucket, []);
  assert.deepEqual(missing.function[0].references, [{ file: "src/example.ts", line: 2 }]);
  assert.deepEqual(missing.relation[0].references, [{ file: "src/example.ts", line: 4 }]);
});

test("코드가 참조하는 객체가 모두 존재하면 치명 목록이 비어 있다", () => {
  const { references } = extractReferences('await supabase.from("teams").select();', "src/a.ts");
  const byKind = { function: new Map(), relation: new Map([["teams", references]]), bucket: new Map() };

  const missing = diffAgainstDatabase(byKind, {
    function: new Set(),
    relation: new Set(["teams", "profiles"]),
    bucket: new Set(),
  });

  assert.deepEqual(missing, { function: [], relation: [], bucket: [] });
});

// 게이트가 조용히 무력화되는 것을 막는 회귀 테스트.
// 최초 구현은 `CI === "true"` 만 봤는데, Vercel 은 CI 를 "1" 로 설정하므로
// Preview 빌드가 검사를 건너뛰고 통과했다. CI 표기는 시스템마다 다르다.
test("CI 표기가 시스템마다 달라도 엄격 환경으로 인식한다", () => {
  for (const value of ["true", "TRUE", "1", "yes", "on"]) {
    assert.equal(isStrictEnvironment({ CI: value }), true, `CI=${value} 는 엄격이어야 한다`);
  }
});

test("명시적 거짓과 미설정은 엄격 환경이 아니다", () => {
  for (const value of ["false", "FALSE", "0", "off", "", "   "]) {
    assert.equal(isStrictEnvironment({ CI: value }), false, `CI=${JSON.stringify(value)} 는 비엄격이어야 한다`);
  }
  assert.equal(isStrictEnvironment({}), false);
});

test("Vercel Production 과 Preview 는 엄격, vercel dev 는 비엄격이다", () => {
  assert.equal(isStrictEnvironment({ VERCEL_ENV: "production" }), true);
  assert.equal(isStrictEnvironment({ VERCEL_ENV: "preview" }), true);
  assert.equal(isStrictEnvironment({ VERCEL_ENV: "development" }), false);
});

test("isTruthyFlag 는 문자열이 아닌 값을 거짓으로 본다", () => {
  assert.equal(isTruthyFlag(undefined), false);
  assert.equal(isTruthyFlag(null), false);
  assert.equal(isTruthyFlag(1), false);
});
