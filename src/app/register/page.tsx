"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { buildRegistrationProfile, isValidRegistrationProfile } from "@/lib/registration-profile";
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

const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
] as const;

const labelClass = "text-xs font-medium uppercase tracking-wider";
const labelStyle: React.CSSProperties = {
  color: "var(--color-fg-ink-muted)",
  fontFamily: "var(--font-space-mono)",
};
const helperStyle: React.CSSProperties = {
  color: "var(--color-fg-ink-muted)",
  fontFamily: "var(--font-space-mono)",
};

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle, loading, error, clearError, updatePlayer } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [hasPlayerExperience, setHasPlayerExperience] = useState(false);
  const [mbti, setMbti] = useState("");
  const [disposition, setDisposition] = useState("");
  const [personalValues, setPersonalValues] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);
  const [invitedTeamId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("teamId") || "";
  });

  const isFreeAgent = !invitedTeamId;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setFormError("");

    const profile = buildRegistrationProfile({
      name,
      email,
      phone,
      gender,
      birthDate,
      hasPlayerExperience,
    });

    if (!isValidRegistrationProfile(profile)) {
      setFormError("이름, 전화번호, 이메일, 성별, 생년월일을 모두 입력해주세요");
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
        email: profile.email,
        password,
        name: profile.name,
        phone: profile.phone,
        gender: profile.gender as Gender,
        birthDate: profile.birthDate,
        hasPlayerExperience: profile.hasPlayerExperience,
        teamId: invitedTeamId,
      });

      // 신규 프로필 필드는 store 시그니처 영향 없이 가입 직후 후속 저장으로 결선.
      const extraUpdate: Record<string, string | undefined> = {};
      if (mbti.trim()) extraUpdate.mbti = mbti.trim();
      if (disposition.trim()) extraUpdate.disposition = disposition.trim();
      if (personalValues.trim()) extraUpdate.personalValues = personalValues.trim();
      if (isFreeAgent && bio.trim()) extraUpdate.bio = bio.trim();
      if (Object.keys(extraUpdate).length > 0) {
        try {
          await updatePlayer(extraUpdate);
        } catch (extraErr) {
          // 보조 저장 실패는 가입 자체를 막지 않음 — 마이페이지에서 재시도 가능.
          console.warn("[register] optional profile fields update skipped:", extraErr);
        }
      }

      // 가입 후 관리자 승인 안내(운영 플로우) — fairground 이식.
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
      router.push("/my");
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
              계정이 생성되었습니다. 마이페이지에서 선수 정보를 등록할 수 있습니다.
              <br />
              일부 운영 기능은 관리자 승인 후 활성화됩니다.
            </p>
          </div>
          <button
            onClick={() => router.push("/my")}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
            style={{
              background: "var(--primary)",
              color: "var(--color-fg-paper)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            마이페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--color-fg-paper)" }}
    >
      <div className="w-full max-w-sm space-y-8 py-12">

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

          <div className="grid grid-cols-2 gap-3">
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

          {/* ── 프로필 보강(선택 입력) ── */}
          <div className="space-y-1.5">
            <label htmlFor="register-mbti" className={labelClass} style={labelStyle}>
              MBTI
            </label>
            <select
              id="register-mbti"
              value={mbti}
              onChange={(e) => setMbti(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
              style={inputStyle}
            >
              <option value="">선택 안 함</option>
              {MBTI_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-disposition" className={labelClass} style={labelStyle}>
              성향
            </label>
            <input
              id="register-disposition"
              type="text"
              placeholder="예: 적극적 / 분석적 / 협동적"
              value={disposition}
              onChange={(e) => setDisposition(e.target.value)}
              maxLength={200}
              aria-describedby="register-disposition-help"
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
              style={inputStyle}
            />
            <p id="register-disposition-help" className="text-[10px] pl-1" style={helperStyle}>
              한 줄 · 최대 200자 ({disposition.length}/200)
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-values" className={labelClass} style={labelStyle}>
              추구하는 가치관
            </label>
            <textarea
              id="register-values"
              rows={3}
              placeholder="내가 그라운드에서 중요하게 여기는 것"
              value={personalValues}
              onChange={(e) => setPersonalValues(e.target.value)}
              maxLength={500}
              aria-describedby="register-values-help"
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all resize-none"
              style={inputStyle}
            />
            <p id="register-values-help" className="text-[10px] pl-1" style={helperStyle}>
              최대 500자 ({personalValues.length}/500)
            </p>
          </div>

          {/* ── FA(팀 미초대) 전용 자기소개 ── */}
          {isFreeAgent && (
            <div className="space-y-1.5">
              <label htmlFor="register-bio" className={labelClass} style={labelStyle}>
                자기소개 (FA)
              </label>
              <textarea
                id="register-bio"
                rows={5}
                placeholder="내 플레이 스타일·강점·연락처 등을 자유롭게 — 팀 영입 안내에 사용됩니다"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={2000}
                aria-describedby="register-bio-help"
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all resize-none"
                style={inputStyle}
              />
              <p id="register-bio-help" className="text-[10px] pl-1" style={helperStyle}>
                팀 미초대 가입에만 표시 · 최대 2000자 ({bio.length}/2000)
              </p>
            </div>
          )}

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
