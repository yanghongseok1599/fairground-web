"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { useAuth } from "@/hooks/useAuth";

// returnTo 는 같은 사이트 내부 경로만 허용 (오픈 리다이렉트 방지).
function safeReturnTo(raw: string | null): string {
  if (!raw) return "/my";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/my";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const { login, loginWithGoogle, loginWithKakao, loading, error, clearError } = useAuth();
  const socialReturnTo = searchParams.has("returnTo") ? returnTo : "/onboarding";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 다른 화면에서 남은 store error 가 이 페이지로 따라오지 않도록 마운트 시 초기화.
  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email.trim(), password.trim());
      router.push(returnTo);
    } catch {
      // error 는 store 에 표면화됨 (aria-describedby 로 노출)
    }
  };

  const handleGoogleLogin = async () => {
    clearError();
    try {
      // OAuth 복귀 경로에 returnTo 를 전달 (콜백 페이지가 소비).
      await loginWithGoogle(socialReturnTo);
      // 리다이렉트되므로 후속 코드 없음.
    } catch {
      // error 는 store 에 표면화됨
    }
  };

  const handleKakaoLogin = async () => {
    clearError();
    try {
      // 첫 소셜 로그인은 선수 실명·카드 정보를 확인할 수 있도록 온보딩을 거친다.
      await loginWithKakao(socialReturnTo);
    } catch {
      // error 는 store 에 표면화됨
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-horizontal.png"
            alt="FairGround"
            style={{ height: 36, width: "auto" }}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            풋살 리그 실시간 통합 플랫폼
          </p>
        </div>

        {/* Login Form */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">아이디 또는 이메일</Label>
                <Input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="username"
                  placeholder="myid123 또는 email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-invalid={!!error}
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-invalid={!!error}
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>

              {error && (
                <p
                  id="login-error"
                  role="alert"
                  className="text-sm"
                  style={{ color: "var(--destructive)" }}
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="min-h-[44px] w-full font-semibold"
                disabled={loading}
              >
                {loading ? "로그인 중..." : "로그인"}
              </Button>
            </form>

            <div className="relative my-6" aria-hidden="true">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">또는</span>
              </div>
            </div>

            <SocialAuthButtons
              disabled={loading}
              onGoogle={handleGoogleLogin}
              onKakao={handleKakaoLogin}
            />
          </CardContent>
        </Card>

        {/* Links */}
        <div className="flex flex-col items-center gap-3 text-sm">
          <Link
            href="/auth/forgot-password"
            className="min-h-11 inline-flex items-center font-semibold text-muted-foreground transition-opacity hover:opacity-80"
          >
            비밀번호를 잊으셨나요?
          </Link>
          <div className="flex justify-center gap-4">
            <span className="text-muted-foreground">계정이 없으신가요?</span>
            <Link
              href="/register"
              className="font-semibold text-primary transition-opacity hover:opacity-80"
            >
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
