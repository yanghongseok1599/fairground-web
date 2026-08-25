import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { breadcrumbJsonLd, collectionPageJsonLd, createSeoMetadata } from "@/lib/seo";

const title = "풋살 랭킹·순위 — 선수 기록과 팀 순위";
const description =
  "FairGround 풋살 랭킹 페이지에서 풋살대회와 리그의 선수 기록, 득점, 도움, 경기 수, MOM, 팀 순위를 확인하세요. 아마추어 풋살 선수의 성장 기록을 실시간으로 정리합니다.";

export const metadata: Metadata = createSeoMetadata({
  title,
  description,
  path: "/leaderboard",
  keywords: [
    "풋살 랭킹",
    "풋살 순위",
    "풋살 득점 순위",
    "풋살 도움 순위",
    "풋살 선수 기록",
    "풋살대회 순위",
  ],
});

export default function LeaderboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "랭킹", path: "/leaderboard" },
          ]),
          collectionPageJsonLd({
            name: title,
            description,
            path: "/leaderboard",
            keywords: ["풋살 랭킹", "풋살 순위", "풋살대회 기록"],
          }),
        ]}
      />
      {children}
    </>
  );
}
