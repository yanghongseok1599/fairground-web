/**
 * 페어그라운드 환불정책 — 키트 `event` 프리셋 (대회·행사 참가비, 소비자분쟁해결기준 체육시설·레저용역).
 * 룰북·대회 안내의 "주최 측 취소 시 전액 환불" 은 이 정책의 첫 줄과 같다. 더 불리한 조건을 따로 광고하지 않는다.
 */
import { refundSections } from "@/content/refund-presets";
import { BUSINESS } from "@/lib/business-info";
import { markPendingSections, type LegalDocument } from "@/lib/legal-document";

export const REFUND_DOCUMENT: LegalDocument = markPendingSections({
  kind: "refund",
  title: "페어그라운드(FairGround) 환불정책",
  version: "2026-10-15",
  effectiveAt: null,
  sections: [
    { heading: "적용 대상", body: [
      "리그·대회 참가비에 적용합니다. 참가비는 참가 신청 후 운영진이 안내하는 계좌로 입금합니다.",
    ] },
    // 마이페이지 환불 신청 기능은 없다 (2026-10-15). 있는 경로만 적는다.
    ...refundSections("event", BUSINESS.email.value).map((s) => ({
      ...s, body: s.body.map((line) => line.replace("위 연락처나 마이페이지에서", "위 연락처로")),
    })),
  ],
});
