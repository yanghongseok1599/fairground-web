"use client";

/**
 * 가입 동의 완료 — 카카오·Google 가입, 그리고 동의 절차 도입 전에 가입해 동의 기록이 없는 회원.
 *
 * 소셜 가입은 /register 의 동의 화면을 거치지 않는다. 로그인 콜백이 필수 동의 기록이 없으면 이 화면으로 보낸다
 * (키트 reference/auth.md: callback → /auth/complete → recordConsents("oauth_complete")).
 * 기록은 record_my_consents RPC — DB 가 auth.uid() 로만, 필수 3종을 함께 동의로만 받는다.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/config/supabase";
import { ConsentChecklist, requiredConsentsGiven } from "@/components/consent-checklist";
import { ACCOUNT_COMPLETION_CONSENTS } from "@/content/signup-consents";
import { forgetMissingConsents } from "@/features/account-consent/use-missing-consents";
import { hasPortraitConsent } from "@/features/portrait-consent/policy";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { internalReturnPath } from "@/lib/internal-return-path";
import { consentPayload, missingRequiredConsent, recordMyConsents } from "@/lib/record-consents";

function CompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = internalReturnPath(params.get("returnTo"), "/onboarding");
  const { user, player, initialized, logout } = useAuth();
  const [value, setValue] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 이미 홍보 이용에 동의한 회원에게 체크 해제 상태로 다시 물으면 철회로 기록된다. 그 항목은 빼고 받는다.
  const entries = hasPortraitConsent(player)
    ? ACCOUNT_COMPLETION_CONSENTS.filter((e) => e.document.kind !== "portrait")
    : ACCOUNT_COMPLETION_CONSENTS;
  const items = entries.map((e) => e.item);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || busy) return;
    const missing = missingRequiredConsent(entries, value);
    if (missing) { setError(missing); return; }
    setBusy(true);
    setError("");
    try {
      const provider = (await supabase.auth.getSession()).data.session?.user.app_metadata?.provider;
      await recordMyConsents(supabase as unknown as Parameters<typeof recordMyConsents>[0],
        provider && provider !== "email" ? "oauth_complete" : "mypage", consentPayload(entries, value));
      forgetMissingConsents(user.uid);
      await useAuthStore.getState().refreshPlayer().catch(() => null);
      router.replace(returnTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "동의 내용을 저장하지 못했습니다. 다시 시도해주세요.");
      setBusy(false);
    }
  };

  const decline = async () => {
    try { await logout(); router.replace("/"); }
    catch (e) { setError(e instanceof Error ? e.message : "로그아웃하지 못했습니다."); }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 px-5 pb-16 pt-[92px] text-foreground">
      <div>
        <h1 className="text-2xl font-black">가입 동의</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          페어그라운드를 이용하려면 이용약관과 개인정보 수집·이용에 동의해주세요. 동의 내용은 기록으로 남습니다.
        </p>
      </div>
      {!initialized ? <p role="status">회원 정보를 확인하고 있습니다...</p> : !user ? (
        <Link href={`/login?returnTo=${encodeURIComponent(`/auth/complete?returnTo=${encodeURIComponent(returnTo)}`)}`} className="text-primary underline">로그인하고 계속하기</Link>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ConsentChecklist items={items} value={value} onChange={setValue} disabled={busy} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={busy || !requiredConsentsGiven(items, value)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "저장 중..." : "동의하고 계속하기"}
          </button>
          <button type="button" onClick={() => void decline()} disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center text-sm text-muted-foreground underline">
            동의하지 않고 로그아웃
          </button>
        </form>
      )}
    </div>
  );
}

export default function AccountCompletePage() {
  return <Suspense fallback={null}><CompleteInner /></Suspense>;
}
