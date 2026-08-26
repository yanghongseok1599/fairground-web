"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  const { login, loginWithGoogle, loading, error, clearError } = useAuth();
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
      await loginWithGoogle(returnTo);
      // 리다이렉트되므로 후속 코드 없음.
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

            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full font-medium"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google로 계속
            </Button>
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
