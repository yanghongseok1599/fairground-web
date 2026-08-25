import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SeoJsonLd } from "@/components/seo-json-ld";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  createSeoMetadata,
  faqPageJsonLd,
} from "@/lib/seo";

const title = "FA선수·풋살 선수카드 — 아마추어 풋살 선수 찾기";
const description =
  "FairGround FA선수 페이지에서 풋살 선수카드, 포지션, 등번호, 팀 가입 가능 선수, 경기 기록을 확인하세요. 풋살대회에 함께할 GK, FIXO, ALA, PIVO 선수를 찾을 수 있습니다.";

export const metadata: Metadata = createSeoMetadata({
  title,
  description,
  path: "/players",
  keywords: [
    "FA선수",
    "풋살 FA선수",
    "풋살 선수 찾기",
    "풋살 선수카드",
    "풋살 팀원 모집",
    "아마추어 풋살 선수",
  ],
});

export default function PlayersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "FA선수", path: "/players" },
          ]),
          collectionPageJsonLd({
            name: title,
            description,
            path: "/players",
            keywords: ["FA선수", "풋살 선수카드", "풋살 선수 찾기"],
          }),
          faqPageJsonLd([
            {
              question: "풋살 선수카드는 무엇인가요?",
              answer:
                "풋살 선수카드는 선수 이름, 포지션, 등번호, 소속팀, 경기 기록, 뱃지 등을 한 장의 카드 형태로 보여주는 FairGround 프로필입니다.",
            },
            {
              question: "팀이 없는 선수도 FairGround에서 팀을 찾을 수 있나요?",
              answer:
                "FA선수 목록을 통해 팀이 없는 선수나 팀 가입을 원하는 선수를 확인하고, 팀 운영자는 필요한 포지션의 선수를 찾을 수 있습니다.",
            },
          ]),
        ]}
      />
      {children}
    </>
  );
}
