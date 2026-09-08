"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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
  const { user, initialized, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [waited, setWaited] = useState(false);

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
      await updatePassword(password);
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

  if (initialized && !user && waited) {
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
            <PasswordField id="reset-pw" label="새 비밀번호" value={password} onChange={setPassword} placeholder="8자 이상" />
            <PasswordField id="reset-pw2" label="새 비밀번호 확인" value={confirm} onChange={setConfirm} placeholder="다시 입력" />

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

function PasswordField({
  id, label, value, onChange, placeholder,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-ink-muted)" }}>
        {label}
      </label>
      <input
        id={id}
        type="password"
        autoComplete="new-password"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        minLength={8}
        className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
        style={{ background: "var(--color-fg-paper)", border: "1px solid var(--color-fg-line-soft)", color: "var(--color-fg-ink)" }}
      />
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
