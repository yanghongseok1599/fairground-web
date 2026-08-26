import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCueSheet, cueSheetToCsv } from "../src/lib/cue-sheet.ts";

const six = (prefix: string) => Array.from({ length: 6 }, (_, i) => `${prefix}${i + 1}`);
const groups = [
  { name: "A", teamNames: six("A") },
  { name: "B", teamNames: six("B") },
];
const base = { startTime: "10:00", lunchStart: "", lunchMinutes: 0 };

test("6팀 2조 → 구장별 15경기, 총 30경기", () => {
  const { rows, warnings } = buildCueSheet(groups, base);
  assert.equal(warnings.length, 0);
  assert.equal(rows.length, 30);
  assert.equal(rows.filter((r) => r.court === "A구장").length, 15);
  assert.equal(rows.filter((r) => r.court === "B구장").length, 15);
});

// 경기 12분 + 전환 8분 = 슬롯 20분. 타임테이블이 20분 간격인 근거다.
test("슬롯 간격은 20분, 경기 길이는 12분", () => {
  const rows = buildCueSheet(groups, base).rows.filter((r) => r.court === "A구장");
  assert.equal(rows[0].start, "10:00");
  assert.equal(rows[0].end, "10:12");
  assert.equal(rows[1].start, "10:20");
  assert.equal(rows[2].start, "10:40");
});

test("점심 없으면 10:00 시작 → 14:52 종료", () => {
  const { courtEnd } = buildCueSheet(groups, base);
  // 15경기의 간격은 14번. 10:00 + 14×20분 = 14:40 시작, +12분 = 14:52 종료.
  assert.equal(courtEnd["A구장"], "14:52");
  assert.equal(courtEnd["B구장"], "14:52");
});

test("점심 시간에 걸치는 경기는 점심 뒤로 밀린다", () => {
  const { rows } = buildCueSheet(groups, { startTime: "10:00", lunchStart: "13:00", lunchMinutes: 50 });
  const a = rows.filter((r) => r.court === "A구장");
  // 12:40 경기는 12:52 에 끝나 점심 전에 소화된다
  assert.ok(a.some((r) => r.start === "12:40"));
  // 13:00 에 걸리는 경기는 점심(50분) 뒤인 13:50 으로 밀린다
  assert.ok(a.some((r) => r.start === "13:50"), "점심 후 첫 경기가 13:50 이어야 한다");
  // 점심 시간대(13:00~13:50)에 시작하는 경기가 없어야 한다
  assert.equal(a.filter((r) => r.start >= "13:00" && r.start < "13:50").length, 0);
});

test("홀수 팀 조는 부전승 처리가 필요하다고 알린다", () => {
  const { rows, warnings } = buildCueSheet(
    [{ name: "A", teamNames: ["1", "2", "3", "4", "5"] }], base,
  );
  assert.equal(rows.length, 0);
  assert.match(warnings[0], /홀수/);
});

test("시작 시각 형식이 틀리면 빈 결과와 경고", () => {
  const { rows, warnings } = buildCueSheet(groups, { ...base, startTime: "열시" });
  assert.equal(rows.length, 0);
  assert.match(warnings[0], /시작 시각/);
});

test("CSV 는 쉼표·따옴표가 든 팀명을 escape 한다", () => {
  const csv = cueSheetToCsv([
    { order: 1, start: "10:00", end: "10:12", court: "A구장", groupName: "A", home: 'FC "번개"', away: "가,나 FC" },
  ]);
  assert.match(csv, /"FC ""번개"""/);
  assert.match(csv, /"가,나 FC"/);
});

console.log("cue-sheet tests passed");

// 대진 공개 게이트 — 참가팀 화면에서 예정 경기가 새어 나가면 안 된다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("공개 대회 페이지는 fixturesPublished 일 때만 예정 경기를 보여준다", () => {
  const src = read("src/app/tournaments/[id]/page.tsx");
  assert.match(src, /\{tournament\?\.fixturesPublished && scheduledMatches\.length > 0 && \(/);
  assert.ok(
    !/\{scheduledMatches\.length > 0 && \(/.test(src),
    "게이트 없는 예정 경기 렌더가 남아 있으면 대진이 새어 나간다",
  );
});

test("큐시트는 운영진 화면 전용 — 공개 라우트에 없다", () => {
  const admin = read("src/app/admin/tournaments/page.tsx");
  assert.match(admin, /buildCueSheet\(/);
  assert.match(admin, /운영진 화면에만/);
  // /tournaments (공개) 쪽에서는 큐시트를 만들지 않는다
  for (const p of ["src/app/tournaments/page.tsx", "src/app/tournaments/[id]/page.tsx"]) {
    assert.ok(!/buildCueSheet|cue-sheet/.test(read(p)), `${p} 에 큐시트가 노출됨`);
  }
});
