import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { breadcrumbJsonLd, collectionPageJsonLd, createSeoMetadata } from "@/lib/seo";

const title = "풋살 리그 순위표 — 팀 승점·전적·대회 순위";
const description =
  "FairGround 순위표에서 풋살 리그와 풋살대회의 팀 승점, 전적, 득실, 순위를 확인하세요. 혼성풋살대회, 여자풋살대회, 남자풋살대회 운영 결과를 정리합니다.";

export const metadata: Metadata = createSeoMetadata({
  title,
  description,
  path: "/standings",
  keywords: [
    "풋살 리그 순위표",
    "풋살 팀 순위",
    "풋살대회 순위표",
    "풋살 승점",
    "풋살 경기 결과",
  ],
});

export default function StandingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "순위표", path: "/standings" },
          ]),
          collectionPageJsonLd({
            name: title,
            description,
            path: "/standings",
            keywords: ["풋살 리그 순위표", "풋살 팀 순위", "풋살대회 순위표"],
          }),
        ]}
      />
      {children}
    </>
  );
}
