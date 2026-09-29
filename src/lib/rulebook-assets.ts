export const MATCH_RULEBOOK_PDF_FILENAME = "경기운영규정_v2.6.pdf";
export const TOURNAMENT_RULEBOOK_PDF_FILENAME = "대회규정_v1.3.pdf";
export const REFEREE_GUIDE_PDF_FILENAME = "심판가이드_v2.5.pdf";
export const CAPTAIN_GUIDE_PDF_FILENAME = "주장교육가이드_v1.3.pdf";

export const MATCH_RULEBOOK_PDF_PATH = `/document/${MATCH_RULEBOOK_PDF_FILENAME}`;
export const TOURNAMENT_RULEBOOK_PDF_PATH = `/document/${TOURNAMENT_RULEBOOK_PDF_FILENAME}`;

export const REFEREE_GUIDE_PDF_PATH = `/document/${REFEREE_GUIDE_PDF_FILENAME}`;
export const CAPTAIN_GUIDE_PDF_PATH = `/document/${CAPTAIN_GUIDE_PDF_FILENAME}`;

/**
 * 룰북 탭(doc.id) → 배포용 PDF 경로.
 * scripts/build-rulebook-pdf.mjs 의 DOCS key 와 같은 이름을 쓴다.
 * 매핑에 없는 문서는 다운로드 버튼이 뜨지 않는다(현재는 4개 문서 모두 있음).
 */
export const RULEBOOK_PDF_BY_DOC_ID: Record<string, string> = {
  match: MATCH_RULEBOOK_PDF_PATH,
  tournament: TOURNAMENT_RULEBOOK_PDF_PATH,
  referee: REFEREE_GUIDE_PDF_PATH,
  captain: CAPTAIN_GUIDE_PDF_PATH,
};

export const RULEBOOK_PDF_FILENAME_BY_DOC_ID: Record<string, string> = {
  match: MATCH_RULEBOOK_PDF_FILENAME,
  tournament: TOURNAMENT_RULEBOOK_PDF_FILENAME,
  referee: REFEREE_GUIDE_PDF_FILENAME,
  captain: CAPTAIN_GUIDE_PDF_FILENAME,
};
