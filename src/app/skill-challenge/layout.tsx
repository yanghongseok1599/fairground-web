import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { breadcrumbJsonLd, collectionPageJsonLd, createSeoMetadata } from "@/lib/seo";

const title = "망상 그라운드 챌린지 — 홀로그램 선수카드 이벤트";
const description =
  "망상해수욕장에서 자기 사진으로 홀로그램 선수카드를 만들고 슈팅 스피드, 타겟 슈팅, 에어볼 터치 3가지 챌린지 기록과 랭킹을 확인하세요.";

export const metadata: Metadata = createSeoMetadata({
  title,
  description,
  path: "/skill-challenge",
  keywords: [
    "망상 그라운드 챌린지",
    "홀로그램 선수카드",
    "풋살 이벤트",
    "슈팅 스피드",
    "타겟 슈팅",
    "에어볼 터치",
  ],
});

export default function SkillChallengeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "그라운드 챌린지", path: "/skill-challenge" },
          ]),
          collectionPageJsonLd({
            name: title,
            description,
            path: "/skill-challenge",
            keywords: ["망상 이벤트", "그라운드 챌린지", "선수카드 랭킹"],
          }),
        ]}
      />
      {children}
    </>
  );
}
