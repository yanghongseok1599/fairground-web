import type { Metadata } from "next";
import { BeachSoccerApplyClient } from "./beach-soccer-apply-client";
import { BEACH_SOCCER_EVENT_NAME } from "@/lib/beach-soccer-event";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `참가 신청 — ${BEACH_SOCCER_EVENT_NAME}`,
  description:
    "전국 비치사커대회 참가 신청 페이지. 팀 대표가 참가 부문(대학부·남자부·여자부), 팀명, 연락처를 제출하고 운영진 승인 절차를 진행합니다.",
  alternates: { canonical: `${SITE_URL}/beach-soccer/apply` },
};

export default function BeachSoccerApplyPage() {
  return <BeachSoccerApplyClient />;
}
