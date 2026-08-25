import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { breadcrumbJsonLd, collectionPageJsonLd, createSeoMetadata } from "@/lib/seo";

const title = "풋살 자유게시판 — 대회·팀 모집·경기 이야기";
const description =
  "FairGround 자유게시판에서 풋살대회, 혼성풋살대회, 여자풋살대회, 남자풋살대회, 팀 모집, 경기 후기, 운영 공지를 자유롭게 나누세요.";

export const metadata: Metadata = createSeoMetadata({
  title,
  description,
  path: "/board",
  keywords: [
    "풋살 자유게시판",
    "풋살 팀 모집 게시판",
    "풋살대회 후기",
    "풋살 커뮤니티",
    "아마추어 풋살",
  ],
});

export default function BoardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "자유게시판", path: "/board" },
          ]),
          collectionPageJsonLd({
            name: title,
            description,
            path: "/board",
            keywords: ["풋살 자유게시판", "풋살 커뮤니티", "풋살대회 후기"],
          }),
        ]}
      />
      {children}
    </>
  );
}
