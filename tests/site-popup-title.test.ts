import assert from "node:assert/strict";
import { joinPopupTitleLines, splitPopupTitleLines } from "../src/lib/site-popup-title.ts";

// 기본 분리: 첫 번째 `|` 가 두 줄의 경계다.
assert.deepEqual(splitPopupTitleLines("제1회|혼성 풋살 대회"), {
  lineOne: "제1회",
  lineTwo: "혼성 풋살 대회",
});

// 구분자가 없으면 전부 첫 줄.
assert.deepEqual(splitPopupTitleLines("혼성 풋살 대회"), {
  lineOne: "혼성 풋살 대회",
  lineTwo: "",
});

// `|` 가 2개 이상이면 첫 번째만 구분자로 쓰고 나머지는 둘째 줄에 그대로 남긴다.
assert.deepEqual(splitPopupTitleLines("제1회|혼성|풋살 대회"), {
  lineOne: "제1회",
  lineTwo: "혼성|풋살 대회",
});

// 앞뒤 공백은 trim.
assert.deepEqual(splitPopupTitleLines("  제1회 | 혼성 풋살 대회  "), {
  lineOne: "제1회",
  lineTwo: "혼성 풋살 대회",
});
assert.deepEqual(splitPopupTitleLines("   "), { lineOne: "", lineTwo: "" });
assert.deepEqual(splitPopupTitleLines(""), { lineOne: "", lineTwo: "" });

// 구분자만 있고 한쪽이 비었을 때.
assert.deepEqual(splitPopupTitleLines("제1회|"), { lineOne: "제1회", lineTwo: "" });
assert.deepEqual(splitPopupTitleLines("|혼성 풋살 대회"), {
  lineOne: "",
  lineTwo: "혼성 풋살 대회",
});

// 기본 결합.
assert.equal(joinPopupTitleLines("제1회", "혼성 풋살 대회"), "제1회|혼성 풋살 대회");

// 둘째 줄이 비었거나 공백뿐이면 `|` 를 붙이지 않는다.
assert.equal(joinPopupTitleLines("혼성 풋살 대회", ""), "혼성 풋살 대회");
assert.equal(joinPopupTitleLines("혼성 풋살 대회", "   "), "혼성 풋살 대회");

// 첫 줄이 비었으면 선행 `|` 를 붙이지 않는다.
assert.equal(joinPopupTitleLines("", "둘째"), "둘째");
assert.equal(joinPopupTitleLines("   ", "둘째"), "둘째");

// 둘 다 비면 빈 문자열.
assert.equal(joinPopupTitleLines("", ""), "");
assert.equal(joinPopupTitleLines("  ", "  "), "");

// 결합 시에도 앞뒤 공백은 trim.
assert.equal(joinPopupTitleLines("  제1회  ", "  혼성 풋살 대회  "), "제1회|혼성 풋살 대회");

// 왕복 보존: 정규형 제목은 split → join 을 거쳐도 trim 된 원본과 같다.
const roundTripTitles = [
  "제1회|혼성 풋살 대회",
  "혼성 풋살 대회",
  "제1회|혼성|풋살 대회",
  "  제1회|혼성 풋살 대회  ",
  "",
  "   ",
  "FAIRGROUND|2026 SEASON",
];
for (const title of roundTripTitles) {
  const { lineOne, lineTwo } = splitPopupTitleLines(title);
  assert.equal(
    joinPopupTitleLines(lineOne, lineTwo),
    title.trim(),
    `왕복 보존 실패: ${JSON.stringify(title)}`,
  );
}

// 정규형이 아닌 제목(빈 줄이 생기는 `|`)도 한 번 정규화되면 그 뒤로는 안정적이다.
for (const title of ["제1회|", "|혼성 풋살 대회", "  제1회 | 혼성 풋살 대회  "]) {
  const once = joinPopupTitleLines(
    splitPopupTitleLines(title).lineOne,
    splitPopupTitleLines(title).lineTwo,
  );
  const twice = joinPopupTitleLines(
    splitPopupTitleLines(once).lineOne,
    splitPopupTitleLines(once).lineTwo,
  );
  assert.equal(twice, once, `정규화 안정성 실패: ${JSON.stringify(title)}`);
}

console.log("site-popup-title tests passed");
