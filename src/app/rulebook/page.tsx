import type { Metadata } from "next";
import { RulebookClient } from "./rulebook-client";

export const metadata: Metadata = {
  title: "룰북 — 경기·운영 규정 | FairGround",
  description:
    "FairGround(Pair Ground) 공식 룰북. 경기·운영 규정 v2.4, 대회 규정 v1.2, 심판/주장 교육 가이드. ‘경쟁보다 존중, 승패보다 안전, 결과보다 과정’의 혼성 풋살 페스티벌 규정.",
};

export default function RulebookPage() {
  return <RulebookClient />;
}
