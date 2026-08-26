"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * 비밀번호 찾기 — 재설정 메일 요청.
 *
 * 계정 열거를 막기 위해, 가입된 이메일인지와 무관하게 같은 완료 화면을
 * 보여준다. 단 짧은 ID(@fairground.local) 계정은 메일이 물리적으로 닿지
 * 않으므로 store 에서 명시적 에러를 던지고 여기서 그대로 노출한다.
 */
export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await requestPasswordReset(loginId);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-5 pt-[92px] pb-16" style={{ background: "var(--color-fg-paper)" }}>
      <div className="mx-auto w-full max-w-[420px]">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center gap-2 text-[13px] font-bold"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          로그인으로 돌아가기
        </Link>

        <h1 className="fg-display mt-5 text-[28px] font-black" style={{ color: "var(--color-fg-ink)" }}>
          비밀번호 찾기
        </h1>

        {sent ? (
          <div
            className="mt-6 rounded-2xl p-5"
            style={{ background: "var(--color-fg-paper-2)", border: "1px solid var(--color-fg-line-soft)" }}
          >
            <MailCheck className="h-6 w-6" style={{ color: "var(--primary)" }} aria-hidden />
            <p className="mt-3 text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
              재설정 메일을 보냈습니다
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
              가입된 계정이라면 메일이 도착합니다. 메일의 링크를 열면 새 비밀번호를
              설정할 수 있습니다. 몇 분 내에 오지 않으면 스팸함을 확인해주세요.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl text-sm font-bold"
              style={{ background: "var(--primary)", color: "var(--color-fg-paper)" }}
            >
              로그인으로
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
              가입할 때 쓴 이메일을 입력하면 재설정 링크를 보내드립니다.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-ink-muted)" }}>
                이메일
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                required
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: "var(--color-fg-paper)", border: "1px solid var(--color-fg-line-soft)", color: "var(--color-fg-ink)" }}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl px-3 py-2.5 text-xs leading-relaxed"
                style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.20)", color: "var(--destructive)" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="min-h-12 w-full rounded-xl text-sm font-bold transition-opacity disabled:opacity-60"
              style={{ background: "var(--primary)", color: "var(--color-fg-paper)" }}
            >
              {submitting ? "보내는 중..." : "재설정 메일 받기"}
            </button>

            <p className="text-xs leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
              구글로 가입하셨다면 비밀번호가 없습니다. 로그인 화면에서
              <strong> Google로 계속</strong>을 눌러주세요.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
