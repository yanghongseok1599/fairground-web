"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#FAFCFF",
} as React.CSSProperties;

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle, loading, error, clearError } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setFormError("");

    if (!name.trim()) {
      setFormError("이름을 입력해주세요");
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
      await register({ email, password, name: name.trim(), phone: phone.trim() });
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
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0D1B2A" }}>
        <div className="w-full max-w-sm text-center space-y-6">
          <CheckCircle className="mx-auto h-16 w-16" style={{ color: "#00C853" }} />
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#FAFCFF" }}>
              가입 완료!
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "#627D98" }}>
              관리자 승인 후 활성화됩니다.
              <br />
              승인이 완료되면 로그인하여 이용할 수 있습니다.
            </p>
          </div>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: "#FFD700", color: "#0D1B2A" }}
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0D1B2A" }}>
      <div className="w-full max-w-sm space-y-8">

        {/* Back + Header */}
        <div>
          <button onClick={() => router.back()}
            className="flex items-center gap-2 text-sm mb-8 transition-opacity hover:opacity-70"
            style={{ color: "#627D98" }}>
            <ArrowLeft className="w-4 h-4" /> 뒤로
          </button>
          <h1 className="font-black text-3xl leading-tight"
            style={{ fontFamily: "var(--font-outfit)", letterSpacing: "-1.5px", color: "#FAFCFF" }}>
            회원가입
          </h1>
          <p className="text-sm mt-2" style={{ color: "#627D98" }}>
            계정을 만들고 시작하세요
          </p>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogleRegister}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "#fff", color: "#0D1B2A" }}
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
            <div className="w-full border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3" style={{ background: "#0D1B2A", color: "#627D98" }}>
              또는 이메일로 가입
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
              이름
            </label>
            <input
              type="text"
              placeholder="이름 입력"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
              style={inputStyle}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
              전화번호
            </label>
            <input
              type="tel"
              placeholder="010-0000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
              style={inputStyle}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
              이메일
            </label>
            <input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
              style={inputStyle}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
              비밀번호
            </label>
            <input
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
            <label className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
              비밀번호 확인
            </label>
            <input
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
            <p className="text-xs px-1" style={{ color: "#FF6B6B" }}>{formError || error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40 mt-2"
            style={{ background: "#FFD700", color: "#0D1B2A" }}>
            {loading ? "처리 중..." : "가입하기"}
          </button>
        </form>

        <p className="text-center text-sm" style={{ color: "#627D98" }}>
          이미 계정이 있으신가요?{" "}
          <Link href="/login" style={{ color: "#00C853" }} className="font-semibold hover:opacity-80 transition-opacity">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
