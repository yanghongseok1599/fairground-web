"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PortraitConsentCard } from "@/features/portrait-consent/components/consent-card";
import { hasPortraitConsent } from "@/features/portrait-consent/policy";
import { useTournamentPush, type TournamentPush } from "../hooks/use-tournament-push";
import { TournamentPushCard } from "./tournament-push-card";

export function ParticipantReadiness({ push, consentComplete, consent, required = false }: {
  push: TournamentPush;
  consentComplete: boolean;
  consent: ReactNode;
  required?: boolean;
}) {
  const ready = consentComplete && push.state === "on";
  return (
    <section id="participant-readiness" aria-label="대회 참가 준비" className="scroll-mt-24 rounded-3xl border border-primary/25 bg-muted/40 p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-black text-foreground"><ClipboardCheck className="h-5 w-5 text-primary" />대회 참가 준비</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {ready ? "초상권 동의와 이 기기의 알림 설정을 완료했습니다." : "원활한 현장 진행을 위해 초상권 동의와 대회 알림 ON을 확인해주세요."}
        </p>
        <p role="status" className="mt-2 text-xs font-bold text-primary">
          초상권 {consentComplete ? "동의 완료" : "확인 필요"} · 대회 알림 {push.state === "on" ? "ON" : push.state === "loading" ? "확인 중" : "설정 필요"}
        </p>
      </div>
      <div className="grid gap-3">
        {consent}
        <TournamentPushCard push={push} required={required} />
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
