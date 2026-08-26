export const MATCH_RULEBOOK_PDF_PATH = "/document/fairground-match-rulebook-v2.4.pdf";
export const TOURNAMENT_RULEBOOK_PDF_PATH =
  "/document/fairground-tournament-rulebook-v1.2.pdf";

/**
 * 룰북 탭(doc.id) → 배포용 PDF 경로.
 * scripts/build-rulebook-pdf.mjs 의 DOCS key 와 같은 이름을 쓴다.
 * PDF 가 없는 문서(심판·주장 가이드)는 항목이 없고, 다운로드 버튼도 뜨지 않는다.
 */
export const RULEBOOK_PDF_BY_DOC_ID: Record<string, string> = {
  match: MATCH_RULEBOOK_PDF_PATH,
  tournament: TOURNAMENT_RULEBOOK_PDF_PATH,
};
