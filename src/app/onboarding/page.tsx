"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Shield, User, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  hasCompletedPlayerCardSetup,
  shouldContinueGroundChallengeSetup,
} from "@/lib/player-onboarding";
import {
  getCardSkinFromSearchParams,
  GROUND_CHALLENGE_EVENT_QUERY_VALUE,
  GROUND_CHALLENGE_PLAYER_CARD_SKIN,
  rememberPendingCardSkin,
} from "@/lib/player-card-skin";

/**
 * Single decision point after sign-up — replaces the two competing entry
 * points (register's old 감독 신청 checkbox + player-setup's role radio).
 *
 * Users land here right after /register; they pick one of two paths and we
 * forward to /my/player-setup with the role pre-filled (and locked).
 *
 * OAuth가 미완성 player 행을 먼저 생성할 수 있으므로, 행 존재 여부가 아니라
 * 선수카드 설정 완료 여부로 온보딩 통과를 결정한다.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { player, initialized, user } = useAuth();
  const [entryParams] = useState(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  });
  const eventCardSkin = getCardSkinFromSearchParams(entryParams);
  const isGroundChallengeCard = eventCardSkin === GROUND_CHALLENGE_PLAYER_CARD_SKIN;
  const eventQuery = isGroundChallengeCard ? `&event=${GROUND_CHALLENGE_EVENT_QUERY_VALUE}` : "";
  const groundChallengeSetupHref = `/my/player-setup?role=player&event=${GROUND_CHALLENGE_EVENT_QUERY_VALUE}`;
  const onboardingReturnTo = isGroundChallengeCard
    ? `/onboarding?event=${GROUND_CHALLENGE_EVENT_QUERY_VALUE}`
    : "/onboarding";

  useEffect(() => {
    rememberPendingCardSkin(eventCardSkin);
  }, [eventCardSkin]);

  useEffect(() => {
    if (!initialized) return;
    // Logged-out user → push to /login (returnTo onboarding).
    if (!user) {
      router.replace(`/login?returnTo=${encodeURIComponent(onboardingReturnTo)}`);
      return;
    }
    if (isGroundChallengeCard && shouldContinueGroundChallengeSetup(player)) {
      router.replace(groundChallengeSetupHref);
      return;
    }
    // 선수 등록까지 마친 사용자만 결정 화면을 건너뛴다.
    //
    // 구글 로그인은 authStore 가 프로필을 자동 생성한다(이름은 구글 계정의
    // full_name). 예전에는 "프로필 행이 있으면 온보딩 완료"로 보고 /my 로
    // 보내버려서, 구글 가입자는 선수 등록 화면을 한 번도 거치지 않았다.
    // 그 결과 실명을 확인받지 못한 로마자 이름이 그대로 경기 기록에 남았다
    // (최은우 → "Eunwoo" 등 4건).
    if (player && hasCompletedPlayerCardSetup(player)) {
      router.replace("/my");
    }
  }, [initialized, user, player, router, onboardingReturnTo, isGroundChallengeCard, groundChallengeSetupHref]);

  if (!initialized || !user) {
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
            선수 지도를 총괄하시려면 감독으로,
            <br className="hidden md:inline" />
            기존 팀에 합류해 활동하시려면 선수로 시작하세요.
            나중에 마이페이지에서 바꿀 수 있어요.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          {/* 감독으로 시작 */}
          <Link
            href={`/my/player-setup?role=captain${eventQuery}`}
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
                HEAD COACH
              </p>
              <h2 className="fg-display mt-1 text-2xl font-black">
                감독으로 시작
              </h2>
              <p className="mt-2 text-sm leading-relaxed opacity-90">
                팀을 만들고 선수 지도와 경기 운영을 총괄합니다. 팀 운영관리는 매니저와 나눌 수 있습니다.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-2 text-sm font-bold">
              감독으로 시작하기
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          {/* 선수로 시작 */}
          <Link
            href={`/my/player-setup?role=player${eventQuery}`}
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
            팀이 이미 있으면 가입한 뒤 감독이나 매니저에게 추가 요청하면 됩니다.
          </span>
        </div>
      </div>
    </main>
  );
}
