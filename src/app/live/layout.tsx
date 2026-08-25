import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { breadcrumbJsonLd, collectionPageJsonLd, createSeoMetadata } from "@/lib/seo";

const title = "풋살 실시간 스코어 — 라이브 경기 기록";
const description =
  "FairGround 라이브 페이지에서 풋살대회와 리그 경기의 실시간 스코어, 득점, 도움, 경기 상황을 확인하세요. 현장 경기 기록을 빠르게 공유합니다.";

export const metadata: Metadata = createSeoMetadata({
  title,
  description,
  path: "/live",
  keywords: [
    "풋살 실시간 스코어",
    "풋살 라이브",
    "풋살 경기 기록",
    "풋살대회 실시간",
    "풋살 경기 결과",
  ],
});

export default function LiveLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "라이브", path: "/live" },
          ]),
          collectionPageJsonLd({
            name: title,
            description,
            path: "/live",
            keywords: ["풋살 실시간 스코어", "풋살 라이브", "풋살 경기 기록"],
          }),
        ]}
      />
      {children}
    </>
  );
}
