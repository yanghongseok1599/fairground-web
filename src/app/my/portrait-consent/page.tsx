"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { PortraitConsentCard } from "@/components/portrait-consent-card";
import { consentReturnTo, hasPortraitConsent } from "@/features/portrait-consent/policy";

function ConsentPageContent() {
  const { user, player, initialized } = useAuth();
  const params = useSearchParams();
  const returnTo = consentReturnTo(params.get("returnTo"));
  return (
    <div className="mx-auto max-w-xl space-y-6 px-5 py-10">
      <h1 className="text-2xl font-bold text-foreground">초상권 동의</h1>
      {!initialized ? <p role="status">회원 정보를 확인하고 있습니다...</p> : !user ? (
        <Link href={`/login?returnTo=${encodeURIComponent(`/my/portrait-consent?returnTo=${encodeURIComponent(returnTo)}`)}`} className="text-primary underline">로그인하고 동의하기</Link>
      ) : !player ? <p role="alert">회원 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.</p> : (
        <>
          <PortraitConsentCard />
          {hasPortraitConsent(player) && <Link href={returnTo} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground">계속하기</Link>}
        </>
      )}
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">홈으로</Link>
    </div>
  );
}

export default function PortraitConsentPage() {
  return <Suspense fallback={<p className="p-6">불러오는 중...</p>}><ConsentPageContent /></Suspense>;
}
