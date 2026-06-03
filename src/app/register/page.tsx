"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Gender } from "@/types";

/* ===========================================================
 * Light theme (White&Blue) — FairGround BrandKit 2026
 * 모든 다크/노란 액센트는 브랜드 블루·ink 톤으로 통일.
 * 입력 보더 --color-fg-line-soft, 포커스 링 --color-ring.
 * =========================================================== */

const inputStyle: React.CSSProperties = {
  background: "var(--color-fg-paper)",
  border: "1px solid var(--color-fg-line-soft)",
  color: "var(--color-fg-ink)",
};

// MBTI/성향/추구하는 가치관/자기소개(FA) 4개 필드는 회원가입에서 제거하고
// /my(마이페이지) 프로필 편집으로 이동. 가입은 본질 정보(이름·이메일·비밀번호)에
// 집중하고, 자기 표현 요소는 가입 후 사용자가 원할 때 채우게 한다.

const labelClass = "text-xs font-medium uppercase tracking-wider";
const labelStyle: React.CSSProperties = {
  color: "var(--color-fg-ink-muted)",
  fontFamily: "var(--font-space-mono)",
};

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle, loading, error, clearError } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [hasPlayerExperience, setHasPlayerExperience] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);
  const [invitedTeamId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("teamId") || "";
  });

  // 감독 신청 분기는 /onboarding으로 일원화. 이전의 applyAsCoach 토글 +
  // teamsForCoach fetch + coach 신청 후속 로직은 이 페이지에서 제거됨.

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setFormError("");

    // Slim signup: 이름·이메일·비밀번호만 필수. 나머지(전화/성별/생년월일/
    // MBTI/성향/bio)는 선택. 마이페이지에서 언제든 채울 수 있다.
    if (!name.trim()) {
      setFormError("이름을 입력해주세요");
      return;
    }
    if (!email.trim()) {
      setFormError("이메일을 입력해주세요");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("비밀번호가 일치하지 않습니다");
      return;
    }
    if (password.length < 6) {
      setFormError("비밀번호는 6자 이상이어야 합니다");
      return;
    }

    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        phone: phone.trim(),
        // 빈 값은 그대로 빈 문자열로 전달 — DB 컬럼은 모두 nullable이라
        // 빈 문자열이 들어가도 안전하며, 사용자가 마이페이지에서 언제든 채울 수 있다.
        gender: (gender || "") as Gender,
        birthDate,
        hasPlayerExperience,
        teamId: invitedTeamId,
      });

      // MBTI/성향/추구하는 가치관/자기소개(FA) 후속 저장 로직 제거 — 이 필드들은
      // /my 마이페이지에서 설정한다.

      // 가입 분기는 /onboarding(감독/선수 결정 화면)으로 일원화됨.
      // 이전 applyAsCoach 체크박스 + team_role=coach 시도는 이 페이지에서 제거.
      setSuccess(true);
    } catch {
      // error is set in the store
    }
  };

  const handleGoogleRegister = async () => {
    clearError();
    setFormError("");
    try {
      await loginWithGoogle();
      // Google 신규 가입자는 player 행이 없으므로 결정 화면으로 보낸다.
      // onboarding이 이미 player가 있으면 /my로 자동 redirect한다.
      router.push("/onboarding");
    } catch {
      // error is set in the store
    }
  };

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "var(--color-fg-paper)" }}
      >
        <div className="w-full max-w-sm text-center space-y-6">
          <CheckCircle className="mx-auto h-16 w-16" style={{ color: "var(--primary)" }} />
          <div>
            <h2 className="text-xl font-bold" style={{ color: "var(--color-fg-ink)" }}>
              가입 완료!
            </h2>
            <p
              className="mt-3 text-sm leading-relaxed"
              style={{ color: "var(--color-fg-ink-muted)" }}
            >
              계정이 생성되었습니다. 다음 화면에서 감독/선수 중 시작 방식을 선택해주세요.
              <br />
              일부 운영 기능은 관리자 승인 후 활성화됩니다.
            </p>
          </div>
          <button
            onClick={() => router.push("/onboarding")}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
            style={{
              background: "var(--primary)",
              color: "var(--color-fg-paper)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            다음
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col px-6"
      style={{ background: "var(--color-fg-paper)" }}
    >
      {/* mx-auto+my-auto: 콘텐츠가 짧으면 중앙정렬, 길면 위에서부터 흘러 스크롤(상단 안 잘림) */}
      <div className="mx-auto my-auto w-full max-w-sm space-y-8 py-12">

        {/* Back + Header */}
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm mb-8 transition-opacity hover:opacity-70"
            style={{ color: "var(--color-fg-ink-muted)" }}
          >
            <ArrowLeft className="w-4 h-4" /> 뒤로
          </button>
          <h1
            className="font-black text-3xl leading-tight"
            style={{
              fontFamily: "var(--font-pretendard)",
              letterSpacing: "-1.5px",
              color: "var(--color-fg-ink)",
            }}
          >
            회원가입
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--color-fg-ink-muted)" }}>
            계정을 만들고 시작하세요
            {invitedTeamId && " · 팀 초대 링크로 입장"}
          </p>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogleRegister}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
          style={{
            background: "var(--color-fg-paper)",
            border: "1px solid var(--color-fg-line-soft)",
            color: "var(--color-fg-ink)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Google로 가입
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" style={{ borderColor: "var(--color-fg-line-soft)" }} />
          </div>
          <div className="relative flex justify-center text-xs">
            <span
              className="px-3"
              style={{ background: "var(--color-fg-paper)", color: "var(--color-fg-ink-muted)" }}
            >
              또는 아이디로 가입
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="register-name" className={labelClass} style={labelStyle}>
              이름
            </label>
            <input
              id="register-name"
              type="text"
              placeholder="이름 입력"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all focus:ring-2"
              style={inputStyle}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-phone" className={labelClass} style={labelStyle}>
              전화번호
            </label>
            <input
              id="register-phone"
              type="tel"
              placeholder="010-0000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
              style={inputStyle}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-email" className={labelClass} style={labelStyle}>
              이메일 또는 아이디
            </label>
            <input
              id="register-email"
              type="text"
              autoComplete="username"
              placeholder="ccv5 또는 email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="space-y-1.5">
              <label htmlFor="register-gender" className={labelClass} style={labelStyle}>
                성별
              </label>
              <select
                id="register-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender | "")}
                required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                style={inputStyle}
              >
                <option value="">선택</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
                <option value="other">기타</option>
                <option value="prefer_not_to_say">응답 안 함</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="register-birth" className={labelClass} style={labelStyle}>
                생년월일
              </label>
              <input
                id="register-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                style={inputStyle}
              />
            </div>
          </div>

          <div
            className="space-y-2 rounded-2xl px-4 py-3"
            style={{
              border: "1px solid var(--color-fg-line-soft)",
              background: "var(--color-fg-paper-2)",
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>
              선수 경력 여부
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHasPlayerExperience(true)}
                aria-pressed={hasPlayerExperience}
                className="rounded-xl py-2.5 text-sm font-bold transition-all"
                style={{
                  background: hasPlayerExperience ? "var(--primary)" : "var(--color-fg-paper)",
                  color: hasPlayerExperience ? "var(--color-fg-paper)" : "var(--color-fg-ink)",
                  border: `1px solid ${
                    hasPlayerExperience ? "var(--primary)" : "var(--color-fg-line-soft)"
                  }`,
                }}
              >
                경력 있음
              </button>
              <button
                type="button"
                onClick={() => setHasPlayerExperience(false)}
                aria-pressed={!hasPlayerExperience}
                className="rounded-xl py-2.5 text-sm font-bold transition-all"
                style={{
                  background: !hasPlayerExperience ? "var(--primary)" : "var(--color-fg-paper)",
                  color: !hasPlayerExperience ? "var(--color-fg-paper)" : "var(--color-fg-ink)",
                  border: `1px solid ${
                    !hasPlayerExperience ? "var(--primary)" : "var(--color-fg-line-soft)"
                  }`,
                }}
              >
                없음 / 처음
              </button>
            </div>
          </div>

          {/* 감독 신청 토글은 /onboarding(감독 vs 선수 결정 화면)으로 일원화되어
              가입 폼에서 제거됨. 가입 후 onboarding으로 진입하면 감독 경로를
              선택할 수 있다. */}

          {/* MBTI / 성향 / 추구하는 가치관 / 자기소개(FA) 필드는 회원가입에서
              제거됨. 가입 후 /my 마이페이지에서 채울 수 있다. */}

          <div className="space-y-1.5">
            <label htmlFor="register-password" className={labelClass} style={labelStyle}>
              비밀번호
            </label>
            <input
              id="register-password"
              type="password"
              placeholder="6자 이상 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
              style={inputStyle}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-password2" className={labelClass} style={labelStyle}>
              비밀번호 확인
            </label>
            <input
              id="register-password2"
              type="password"
              placeholder="비밀번호 다시 입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
              style={inputStyle}
            />
          </div>

          {(formError || error) && (
            <p
              className="text-xs px-1"
              style={{ color: "var(--destructive)" }}
              role="alert"
              aria-live="polite"
            >
              {formError || error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40 mt-2"
            style={{
              background: "var(--primary)",
              color: "var(--color-fg-paper)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {loading ? "처리 중..." : "가입하기"}
          </button>
        </form>

        <p className="text-center text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
          이미 계정이 있으신가요?{" "}
          <Link
            href="/login"
            style={{ color: "var(--primary)" }}
            className="font-semibold hover:opacity-80 transition-opacity"
          >
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
