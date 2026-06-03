"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Shield, User, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Single decision point after sign-up — replaces the two competing entry
 * points (register's "감독 신청" checkbox + player-setup's role radio).
 *
 * Users land here right after /register; they pick one of two paths and we
 * forward to /my/player-setup with the role pre-filled (and locked).
 *
 * If the user already has a player row, they don't need to onboard — bounce
 * to /my so they can manage from there.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { player, initialized, user } = useAuth();

  useEffect(() => {
    if (!initialized) return;
    // Logged-out user → push to /login (returnTo onboarding).
    if (!user) {
      router.replace("/login?returnTo=/onboarding");
      return;
    }
    // Already onboarded — skip the decision screen.
    if (player) {
      router.replace("/my");
    }
  }, [initialized, user, player, router]);

  if (!initialized || !user || player) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--color-fg-paper)" }}
      >
        <p
          className="text-sm"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          확인 중…
        </p>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen px-5 py-12 md:px-10 md:py-20"
      style={{ background: "var(--color-fg-paper)" }}
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 text-center md:mb-14">
          <p
            className="fg-label mb-3"
            style={{ color: "var(--primary)" }}
          >
            WELCOME TO FAIRGROUND
          </p>
          <h1
            className="fg-display font-black"
            style={{
              fontSize: "clamp(28px, 5vw, 44px)",
              letterSpacing: "-0.8px",
              color: "var(--color-fg-ink)",
            }}
          >
            어떻게 시작할까요?
          </h1>
          <p
            className="mx-auto mt-3 max-w-xl text-sm leading-relaxed md:text-[15px]"
            style={{ color: "var(--color-fg-ink-muted)" }}
          >
            팀을 직접 만들고 운영하시려면 감독으로,
            <br className="hidden md:inline" />
            기존 팀에 합류해 활동하시려면 선수로 시작하세요.
            나중에 마이페이지에서 바꿀 수 있어요.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          {/* 감독으로 시작 */}
          <Link
            href="/my/player-setup?role=captain"
            className="group flex flex-col gap-4 border p-6 transition-transform hover:-translate-y-1 md:p-8"
            style={{
              background: "var(--primary)",
              borderColor: "var(--primary)",
              color: "var(--primary-foreground)",
              boxShadow: "0 14px 30px rgba(0,71,171,0.20)",
            }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center border"
              style={{
                borderColor: "rgba(255,255,255,0.32)",
                background: "rgba(255,255,255,0.10)",
              }}
            >
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p
                className="fg-label text-[10px]"
                style={{ color: "rgba(255,255,255,0.78)" }}
              >
                CAPTAIN
              </p>
              <h2 className="fg-display mt-1 text-2xl font-black">
                감독으로 시작
              </h2>
              <p className="mt-2 text-sm leading-relaxed opacity-90">
                팀을 만들고, 멤버를 초대·승인하고, 공지·갤러리·회비를 운영합니다.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-2 text-sm font-bold">
              감독으로 시작하기
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          {/* 선수로 시작 */}
          <Link
            href="/my/player-setup?role=player"
            className="group flex flex-col gap-4 border p-6 transition-transform hover:-translate-y-1 md:p-8"
            style={{
              background: "rgba(255,255,255,0.92)",
              borderColor: "rgba(0,71,171,0.20)",
              color: "var(--color-fg-ink)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center border"
              style={{
                borderColor: "rgba(0,71,171,0.20)",
                background: "rgba(0,71,171,0.06)",
                color: "var(--primary)",
              }}
            >
              <User className="h-6 w-6" />
            </div>
            <div>
              <p
                className="fg-label text-[10px]"
                style={{ color: "var(--primary)" }}
              >
                PLAYER
              </p>
              <h2 className="fg-display mt-1 text-2xl font-black">
                선수로 시작
              </h2>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--color-fg-ink-muted)" }}
              >
                선수 카드를 만들고, 마음에 드는 팀에 합류해 경기·공지·갤러리를 함께 즐깁니다.
              </p>
            </div>
            <span
              className="mt-auto inline-flex items-center gap-2 text-sm font-bold"
              style={{ color: "var(--primary)" }}
            >
              선수로 시작하기
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs">
          <Users
            className="h-3.5 w-3.5"
            style={{ color: "var(--color-fg-ink-muted)" }}
          />
          <span style={{ color: "var(--color-fg-ink-muted)" }}>
            팀이 이미 있으면 가입한 뒤 감독에게 추가 요청하면 됩니다.
          </span>
        </div>
      </div>
    </main>
  );
}
