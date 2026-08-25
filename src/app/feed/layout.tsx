import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { breadcrumbJsonLd, collectionPageJsonLd, createSeoMetadata } from "@/lib/seo";

const title = "풋살 피드 — 경기 소식과 선수카드 공유";
const description =
  "FairGround 피드에서 풋살대회 소식, 선수카드, 경기 결과, 팀 활동을 확인하세요. 아마추어 풋살 커뮤니티의 최신 기록과 이야기를 모읍니다.";

export const metadata: Metadata = createSeoMetadata({
  title,
  description,
  path: "/feed",
  keywords: [
    "풋살 피드",
    "풋살 소식",
    "풋살 선수카드 공유",
    "풋살 경기 결과",
    "풋살 커뮤니티",
  ],
});

export default function FeedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "피드", path: "/feed" },
          ]),
          collectionPageJsonLd({
            name: title,
            description,
            path: "/feed",
            keywords: ["풋살 피드", "풋살 선수카드 공유", "풋살 소식"],
          }),
        ]}
      />
      {children}
    </>
  );
}
