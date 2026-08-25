import type { Metadata } from "next";
import { MixedFutsalApplyClient } from "./mixed-futsal-apply-client";
import {
  MIXED_FUTSAL_APPLY_PATH,
  MIXED_FUTSAL_ELIGIBILITY_LABEL,
  MIXED_FUTSAL_ENTRY_FEE_LABEL,
  MIXED_FUTSAL_ENTRY_FEE_NOTE,
  MIXED_FUTSAL_EVENT_DATE_FULL_LABEL,
  MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL,
  MIXED_FUTSAL_EVENT_NAME,
  MIXED_FUTSAL_EVENT_PATH,
  MIXED_FUTSAL_EVENT_TIME_LABEL,
  MIXED_FUTSAL_GENDER_RULE_NOTE,
  MIXED_FUTSAL_MATCH_FORMAT_LABEL,
  MIXED_FUTSAL_ROSTER_LABEL,
} from "@/lib/mixed-futsal-event";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { breadcrumbJsonLd, createSeoMetadata, faqPageJsonLd } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: `참가 신청 — ${MIXED_FUTSAL_EVENT_NAME}`,
  description: `${MIXED_FUTSAL_EVENT_NAME} 참가 신청 페이지. ${MIXED_FUTSAL_EVENT_DATE_FULL_LABEL} ${MIXED_FUTSAL_EVENT_TIME_LABEL}, ${MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL} 개최. ${MIXED_FUTSAL_MATCH_FORMAT_LABEL}, ${MIXED_FUTSAL_ELIGIBILITY_LABEL}, 참가비 ${MIXED_FUTSAL_ENTRY_FEE_LABEL}. 팀 대표가 팀명과 연락처를 제출하고 운영진 승인 절차를 진행합니다.`,
  path: MIXED_FUTSAL_APPLY_PATH,
  keywords: [
    "혼성 풋살 대회 참가 신청",
    "혼성풋살대회 신청",
    "제1회 페어그라운드 혼성 풋살 대회 신청",
    "은평 풋살대회 신청",
    "엠무브 은평점 풋살 신청",
    "아마추어 풋살 팀 참가",
  ],
});

export default function MixedFutsalApplyPage() {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: MIXED_FUTSAL_EVENT_NAME, path: MIXED_FUTSAL_EVENT_PATH },
            { name: "참가 신청", path: MIXED_FUTSAL_APPLY_PATH },
          ]),
          faqPageJsonLd([
            {
              question: `${MIXED_FUTSAL_EVENT_NAME} 신청은 누가 하나요?`,
              answer:
                "팀 대표가 팀명과 대표 연락처, 혼성 구성 정보를 제출하고 운영진 승인 절차를 진행합니다. 팀원은 회원가입 후 해당 팀에 가입 신청하면 됩니다.",
            },
            {
              question: "팀 구성 조건은 어떻게 되나요?",
              answer: `${MIXED_FUTSAL_MATCH_FORMAT_LABEL}로 진행합니다. ${MIXED_FUTSAL_GENDER_RULE_NOTE} 교대 인원을 포함해 ${MIXED_FUTSAL_ROSTER_LABEL}합니다.`,
            },
            {
              question: "참가비는 언제 내나요?",
              answer: MIXED_FUTSAL_ENTRY_FEE_NOTE,
            },
          ]),
        ]}
      />
      <MixedFutsalApplyClient />
    </>
  );
}
