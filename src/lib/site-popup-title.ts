/**
 * 팝업 제목의 저장 포맷은 `첫째줄|둘째줄` 한 문자열이다.
 * 관리자 폼에서만 두 칸으로 나눠 보여주고 저장 직전에 다시 합치기 위한 순수 함수.
 *
 * 이 파일은 의존성이 없어야 한다(`node --test` 로 직접 import 하기 위함).
 */

const TITLE_LINE_SEPARATOR = "|";

/** 팝업 제목 문자열("첫째줄|둘째줄")을 폼 입력용 두 줄로 나눈다. */
export function splitPopupTitleLines(title: string): { lineOne: string; lineTwo: string } {
  const normalized = title.trim();
  const separatorIndex = normalized.indexOf(TITLE_LINE_SEPARATOR);
  if (separatorIndex === -1) {
    return { lineOne: normalized, lineTwo: "" };
  }
  return {
    lineOne: normalized.slice(0, separatorIndex).trim(),
    lineTwo: normalized.slice(separatorIndex + 1).trim(),
  };
}

/** 폼의 두 줄을 저장용 제목 문자열로 합친다. */
export function joinPopupTitleLines(lineOne: string, lineTwo: string): string {
  const first = lineOne.trim();
  const second = lineTwo.trim();
  if (!second) return first;
  if (!first) return second;
  return `${first}${TITLE_LINE_SEPARATOR}${second}`;
}
