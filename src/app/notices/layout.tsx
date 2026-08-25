import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { breadcrumbJsonLd, collectionPageJsonLd, createSeoMetadata } from "@/lib/seo";

const title = "풋살 공지사항 — 대회 일정·운영 안내";
const description =
  "FairGround 공지사항에서 풋살대회 일정, 혼성·여자·남자 풋살대회 운영 안내, 팀 등록, 참가 신청, 경기 규정, 플랫폼 업데이트를 확인하세요.";

export const metadata: Metadata = createSeoMetadata({
  title,
  description,
  path: "/notices",
  keywords: [
    "풋살 공지사항",
    "풋살대회 공지",
    "풋살대회 일정 안내",
    "풋살 참가 신청 안내",
    "풋살 경기 규정",
  ],
});

export default function NoticesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "공지사항", path: "/notices" },
          ]),
          collectionPageJsonLd({
            name: title,
            description,
            path: "/notices",
            keywords: ["풋살 공지사항", "풋살대회 공지", "풋살 운영 안내"],
          }),
        ]}
      />
      {children}
    </>
  );
}
