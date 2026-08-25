import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SeoJsonLd } from "@/components/seo-json-ld";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  createSeoMetadata,
  faqPageJsonLd,
} from "@/lib/seo";

const title = "풋살대회 일정·참가 신청 — 혼성·여자·남자 풋살대회";
const description =
  "FairGround에서 풋살대회, 혼성풋살대회, 여자풋살대회, 남자풋살대회 일정과 참가 신청 정보를 확인하세요. 대회 일정, 장소, 참가 부문, 팀 모집, 경기 결과까지 한곳에서 관리합니다.";

export const metadata: Metadata = createSeoMetadata({
  title,
  description,
  path: "/tournaments",
  keywords: [
    "풋살대회 일정",
    "풋살대회 참가신청",
    "혼성 풋살대회 참가",
    "여자 풋살대회 일정",
    "남자 풋살대회 일정",
    "전국 풋살대회",
    "풋살 토너먼트",
  ],
});

export default function TournamentsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "대회", path: "/tournaments" },
          ]),
          collectionPageJsonLd({
            name: title,
            description,
            path: "/tournaments",
            keywords: [
              "풋살대회",
              "혼성풋살대회",
              "여자풋살대회",
              "남자풋살대회",
              "풋살대회 참가 신청",
            ],
          }),
          faqPageJsonLd([
            {
              question: "풋살대회 참가 신청은 어디서 하나요?",
              answer:
                "FairGround 대회 페이지에서 진행 중인 풋살대회 정보를 확인하고 참가 신청 페이지로 이동할 수 있습니다.",
            },
            {
              question: "혼성풋살대회, 여자풋살대회, 남자풋살대회를 모두 확인할 수 있나요?",
              answer:
                "FairGround는 혼성풋살대회, 여자풋살대회, 남자풋살대회, 아마추어 풋살 리그와 이벤트 대회 정보를 한곳에 정리합니다.",
            },
          ]),
        ]}
      />
      {children}
    </>
  );
}
