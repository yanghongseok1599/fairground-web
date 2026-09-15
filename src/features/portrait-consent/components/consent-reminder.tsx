"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { needsPortraitConsent, PORTRAIT_CONSENT_PATH } from "../policy";

export function PortraitConsentReminder() {
  const { user, player, initialized } = useAuth();
  const pathname = usePathname();
  if (!initialized || !user || user.uid !== player?.id || !needsPortraitConsent(player) ||
    pathname === PORTRAIT_CONSENT_PATH || pathname.startsWith("/auth/") || pathname === "/register" || pathname === "/login") return null;
  return (
    <aside aria-label="초상권 동의 안내" className="border-b border-primary/20 bg-muted px-4 py-3 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <Camera className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div><p className="text-sm font-bold">초상권 동의를 완료해주세요</p>
            <p className="mt-1 text-xs text-muted-foreground">선수카드 생성·수정과 대회 신청 전에 본인 동의가 필요합니다.</p></div>
        </div>
        <Link href={`${PORTRAIT_CONSENT_PATH}?returnTo=${encodeURIComponent(pathname)}`}
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">동의 내용 확인</Link>
      </div>
    </aside>
  );
}
