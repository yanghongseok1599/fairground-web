import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SeoJsonLd } from "@/components/seo-json-ld";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  createSeoMetadata,
  faqPageJsonLd,
} from "@/lib/seo";

const title = "풋살 팀 찾기·팀 가입 — 아마추어 풋살 팀 운영";
const description =
  "FairGround 팀 페이지에서 풋살 팀을 찾고 팀 가입을 신청하세요. 팀 로스터, 선수카드, 시즌 기록, 팀 게시판, 회비관리까지 풋살대회 참가에 필요한 운영 기능을 제공합니다.";

export const metadata: Metadata = createSeoMetadata({
  title,
  description,
  path: "/teams",
  keywords: [
    "풋살 팀 찾기",
    "풋살 팀 가입",
    "풋살 팀 모집",
    "풋살 동호회",
    "풋살 팀 운영",
    "풋살대회 팀 등록",
  ],
});

export default function TeamsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "팀", path: "/teams" },
          ]),
          collectionPageJsonLd({
            name: title,
            description,
            path: "/teams",
            keywords: ["풋살 팀 찾기", "풋살 팀 가입", "풋살 팀 운영"],
          }),
          faqPageJsonLd([
            {
              question: "풋살 팀 가입은 어떻게 하나요?",
              answer:
                "회원가입 후 원하는 팀 페이지에서 팀 가입을 신청하면 감독 또는 매니저가 신청자 정보를 확인하고 승인할 수 있습니다.",
            },
            {
              question: "팀 운영자는 어떤 기능을 사용할 수 있나요?",
              answer:
                "팀 운영자는 멤버 승인, 로스터 관리, 팀 게시판, 회비관리, 경기 기록 확인 등 풋살 팀 운영에 필요한 기능을 사용할 수 있습니다.",
            },
          ]),
        ]}
      />
      {children}
    </>
  );
}
