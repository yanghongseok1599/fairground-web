"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileCheck } from "lucide-react";
import { ACCOUNT_CONSENT_PATH, useMissingConsents } from "./use-missing-consents";

/** 필수 동의 기록이 없는 회원(소셜 가입, 동의 절차 도입 전 가입)에게 동의 화면을 안내한다. */
export function AccountConsentReminder() {
  const missing = useMissingConsents();
  const pathname = usePathname();
  if (!missing?.length || pathname === ACCOUNT_CONSENT_PATH || pathname.startsWith("/auth/") ||
    pathname === "/register" || pathname === "/login" || ["/terms", "/privacy", "/refund"].includes(pathname)) return null;
  return (
    <aside aria-label="약관 동의 안내" className="border-b border-primary/20 bg-muted px-4 py-3 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <FileCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div><p className="text-sm font-bold">이용약관·개인정보 수집 동의를 완료해주세요</p>
            <p className="mt-1 text-xs text-muted-foreground">회원 정보를 안전하게 다루기 위해 동의 기록을 남깁니다. 1분이면 끝납니다.</p></div>
        </div>
        <Link href={`${ACCOUNT_CONSENT_PATH}?returnTo=${encodeURIComponent(pathname)}`}
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">동의하기</Link>
      </div>
    </aside>
  );
}
