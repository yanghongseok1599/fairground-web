import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SeoJsonLd } from "@/components/seo-json-ld";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  createSeoMetadata,
  faqPageJsonLd,
} from "@/lib/seo";

const title = "풋살 경기규정·룰북 — 대회 운영 기준";
const description =
  "FairGround 풋살 경기규정과 룰북에서 풋살대회 운영 방식, 경기 시간, 반칙, 카드, 순위 산정, 팀 등록 기준을 확인하세요. 혼성·여자·남자 풋살대회 운영에 필요한 규정을 정리합니다.";

export const metadata: Metadata = createSeoMetadata({
  title,
  description,
  path: "/rulebook",
  keywords: [
    "풋살 경기규정",
    "풋살 룰북",
    "풋살대회 규정",
    "풋살 운영 기준",
    "풋살 반칙 규정",
  ],
});

export default function RulebookLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "경기규정", path: "/rulebook" },
          ]),
          collectionPageJsonLd({
            name: title,
            description,
            path: "/rulebook",
            keywords: ["풋살 경기규정", "풋살 룰북", "풋살대회 규정"],
          }),
          faqPageJsonLd([
            {
              question: "풋살대회 규정은 어디서 확인하나요?",
              answer:
                "FairGround 경기규정 페이지에서 대회 운영 기준, 경기 기록 기준, 순위 산정과 팀 등록 관련 안내를 확인할 수 있습니다.",
            },
          ]),
        ]}
      />
      {children}
    </>
  );
}
