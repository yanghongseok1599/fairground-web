"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

// returnTo 는 같은 사이트 내부 경로만 허용 (오픈 리다이렉트 방지).
function safeReturnTo(raw: string | null): string {
  // 기본 착지점은 /onboarding. 선수 등록을 마쳤으면 온보딩이 알아서 /my 로
  // 넘기고, 아직이면 결정 화면 → 선수 등록(실명 입력)으로 이어진다.
  // 구글 가입자가 실명 확인 없이 바로 /my 로 들어가던 경로를 막는다.
  if (!raw) return "/onboarding";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/onboarding";
  return raw;
}

/**
 * OAuth 콜백 (implicit flow).
 *
 * Supabase 클라이언트는 detectSessionInUrl: true 이므로 URL hash 의
 * access_token 을 자동 파싱하여 세션을 저장하고, authStore.init() 의
 * onAuthStateChange 가 user/player 를 채운다. 본 페이지는 그 처리가
 * 끝날 때까지 대기한 뒤 returnTo(기본 /my)로 이동한다.
 *
 * PKCE(?code=) 플로우는 현재 클라이언트 설정상 사용하지 않음 —
 * @supabase/ssr 쿠키 핸들러가 없어 서버 교환이 불가하므로 implicit 유지.
 */
function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, initialized } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  useEffect(() => {
    if (initialized && user) {
      router.replace(returnTo);
      return;
    }
    if (initialized && !user) {
      // 세션 파싱 직후 onAuthStateChange 가 잠깐 늦을 수 있어 유예.
      const t = setTimeout(() => setTimedOut(true), 4000);
      return () => clearTimeout(t);
    }
  }, [initialized, user, returnTo, router]);

  if (timedOut) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-lg font-bold text-foreground">
          로그인을 완료하지 못했습니다
        </h1>
        <p className="text-sm text-muted-foreground">
          다시 시도해주세요. 문제가 계속되면 이메일 로그인을 이용해주세요.
        </p>
        <button
          onClick={() => router.replace("/login")}
          className="min-h-[44px] rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground"
        >
          로그인 페이지로
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2"
        style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        role="status"
        aria-label="로그인 처리 중"
      />
      <p className="text-sm text-muted-foreground">로그인 처리 중...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
