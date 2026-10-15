"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PasswordField } from "@/components/password-field";
import { supabase } from "@/config/supabase";
import { isRecentEmailLinkSession } from "@/lib/recovery-session";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

const labelClass = "text-[10px] uppercase tracking-wider";
const labelStyle = { color: "var(--color-fg-ink-muted)" };
const inputClass = "w-full rounded-2xl px-4 py-3 text-sm outline-none";
const inputStyle = { background: "var(--color-fg-paper)", border: "1px solid var(--color-fg-line-soft)", color: "var(--color-fg-ink)" };

/**
 * 비밀번호 재설정 — 메일 링크로 진입한다.
 *
 * Supabase 는 recovery 링크의 토큰을 URL hash 로 실어 보내고,
 * detectSessionInUrl 이 이를 복구 세션으로 교환한다. 그 세션이 있어야
 * updateUser({ password }) 가 통하므로, user 가 채워질 때까지 기다린다.
 * 링크 없이 직접 들어오면(=세션 없음) 안내 후 재요청으로 보낸다.
 */
function ResetPasswordInner() {
  const router = useRouter();
  const { user, initialized, completePasswordReset } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [waited, setWaited] = useState(false);
  // 로그인만 된 세션으로 이 화면을 열면 현재 비밀번호 확인 없이 바꿀 수 있게 된다. 메일 링크 세션만 받는다.
  const [linkSession, setLinkSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setLinkSession(isRecentEmailLinkSession(data.session?.access_token));
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    // hash 파싱이 onAuthStateChange 보다 늦을 수 있어 잠시 유예한다.
    const timer = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("두 비밀번호가 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    try {
      await completePasswordReset(password);
      setDone(true);
      setTimeout(() => router.replace("/my"), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "변경에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const shell = "min-h-screen px-5 pt-[92px] pb-16";
  const box = { background: "var(--color-fg-paper-2)", border: "1px solid var(--color-fg-line-soft)" };

  if ((initialized && !user && waited) || (user && linkSession === false && !done)) {
    return (
      <div className={shell} style={{ background: "var(--color-fg-paper)" }}>
        <div className="mx-auto w-full max-w-[420px] rounded-2xl p-5" style={box}>
          <ShieldAlert className="h-6 w-6" style={{ color: "var(--destructive)" }} aria-hidden />
          <p className="mt-3 text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
            링크가 만료되었거나 올바르지 않습니다
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
            재설정 링크는 일정 시간이 지나면 만료됩니다. 다시 요청해주세요.
          </p>
          <Link
            href="/auth/forgot-password"
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl text-sm font-bold"
            style={{ background: "var(--primary)", color: "var(--color-fg-paper)" }}
          >
            재설정 메일 다시 받기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={shell} style={{ background: "var(--color-fg-paper)" }}>
      <div className="mx-auto w-full max-w-[420px]">
        <h1 className="fg-display text-[28px] font-black" style={{ color: "var(--color-fg-ink)" }}>
          새 비밀번호 설정
        </h1>

        {done ? (
          <div className="mt-6 rounded-2xl p-5" style={box}>
            <CheckCircle2 className="h-6 w-6" style={{ color: "var(--primary)" }} aria-hidden />
            <p className="mt-3 text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
              비밀번호가 변경되었습니다
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
              잠시 후 마이페이지로 이동합니다.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <PasswordField id="reset-pw" label="새 비밀번호" autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={PASSWORD_MIN_LENGTH}
              hint={`${PASSWORD_MIN_LENGTH}자 이상. 문장처럼 길게 쓰면 기억하기 쉽고 안전합니다.`}
              className="space-y-1.5" labelClassName={labelClass} labelStyle={labelStyle} inputClassName={inputClass} inputStyle={inputStyle} />
            <PasswordField id="reset-pw2" label="새 비밀번호 확인" autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required placeholder="다시 입력"
              className="space-y-1.5" labelClassName={labelClass} labelStyle={labelStyle} inputClassName={inputClass} inputStyle={inputStyle} />

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
              disabled={submitting || !initialized}
              className="min-h-12 w-full rounded-xl text-sm font-bold transition-opacity disabled:opacity-60"
              style={{ background: "var(--primary)", color: "var(--color-fg-paper)" }}
            >
              {submitting ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
