"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PortraitConsentCard } from "@/features/portrait-consent/components/consent-card";
import { hasPortraitConsent } from "@/features/portrait-consent/policy";
import { useTournamentPush, type TournamentPush } from "../hooks/use-tournament-push";
import { TournamentPushCard } from "./tournament-push-card";
import { PUSH_STATE_LABEL } from "../policy";

export function ParticipantReadiness({ push, consentComplete, consent }: {
  push: TournamentPush;
  consentComplete: boolean;
  consent: ReactNode;
}) {
  return (
    <section id="participant-readiness" aria-label="대회 참가 준비" className="scroll-mt-24 rounded-3xl border border-primary/25 bg-muted/40 p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-black text-foreground"><ClipboardCheck className="h-5 w-5 text-primary" />대회 참가 준비</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          초상권 동의 후 선수 정보를 저장할 수 있습니다. 대회 알림은 별도로 설정하며, 설치·권한 확인 중에도 선수등록을 계속할 수 있습니다.
        </p>
        <p role="status" className="mt-2 text-xs font-bold text-primary">
          초상권 {consentComplete ? "동의 완료" : "확인 필요"} · 대회 알림 {PUSH_STATE_LABEL[push.state]}
        </p>
      </div>
      <div className="grid gap-3">
        {consent}
        <TournamentPushCard push={push} />
      </div>
    </section>
  );
}

export function MyParticipantReadiness() {
  const { user, player } = useAuth();
  const push = useTournamentPush();
  if (!user) return null;
  return <ParticipantReadiness push={push} consentComplete={hasPortraitConsent(player)} consent={
    player ? <PortraitConsentCard /> : <div className="rounded-2xl border border-border bg-background p-5 text-sm">
      <p className="font-bold">초상권·촬영물 활용 동의</p>
      <p className="mt-2 text-muted-foreground">선수카드를 설정하면서 본인 동의를 함께 완료해주세요.</p>
      <Link href="/my/player-setup" className="mt-3 inline-flex min-h-11 items-center font-bold text-primary">선수카드 설정하기 →</Link>
    </div>
  } />;
}
