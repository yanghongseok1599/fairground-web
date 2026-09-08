"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Gauge, MapPin, Sparkles, Target, Trophy } from "lucide-react";
import { GroundChallengeLeaderboard } from "@/components/ground-challenge-leaderboard";
import { PlayerCard } from "@/components/player-card";
import { useAuth } from "@/hooks/useAuth";
import { GROUND_CHALLENGE_EVENT_QUERY_VALUE } from "@/lib/player-card-skin";
import { shouldContinueGroundChallengeSetup } from "@/lib/player-onboarding";
import { FICTIONAL_PLAYER_CARD_POSE_SOURCES } from "@/lib/player-card-pose-templates";
import {
  SKILL_CHALLENGE_DATE_FULL_LABEL,
  SKILL_CHALLENGE_EVENT_NAME,
  SKILL_CHALLENGE_LOCATION_FULL_LABEL,
  SKILL_CHALLENGE_STAGES,
} from "@/lib/skill-challenge";
import type { Player } from "@/types";

const REGISTER_HREF = `/register?event=${GROUND_CHALLENGE_EVENT_QUERY_VALUE}`;
const SETUP_HREF = `/my/player-setup?role=player&event=${GROUND_CHALLENGE_EVENT_QUERY_VALUE}`;
const TEAM_LOGO = "/images/team-logos/fairground-ops-logo.webp";

const SAMPLE_PLAYER: Player = {
  id: "ground-challenge-event-card",
  uid: "ground-challenge-event-card",
  name: "MANGSANG",
  number: 7,
  position: "ALA",
  teamId: "ground-challenge",
  teamName: "FairGround",
  nationality: "KOR",
  photoUrl: FICTIONAL_PLAYER_CARD_POSE_SOURCES.male02,
  profilePhotoUrl: FICTIONAL_PLAYER_CARD_POSE_SOURCES.male02,
  gender: "male",
  photoScale: 0.98,
  cardType: "gold",
  cardSkin: "hologram",
  cardRating: 96,
  stats: { goals: 98, assists: 24, games: 3, mom: 1 },
  badges: ["event_shooting_king", "event_freekick_king", "event_touch_king"],
  penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
  isApproved: true,
  role: "player",
  createdAt: 1760000000000,
};

const DETAIL_ITEMS = [
  { icon: MapPin, label: SKILL_CHALLENGE_LOCATION_FULL_LABEL },
  { icon: CalendarDays, label: SKILL_CHALLENGE_DATE_FULL_LABEL },
  { icon: Sparkles, label: "신규 가입 홀로그램 선수카드 발급" },
  { icon: Trophy, label: "3가지 챌린지 현장 기록 및 랭킹 반영" },
] as const;

export default function SkillChallengePage() {
  const { user, player, initialized } = useAuth();
  const needsSetup = shouldContinueGroundChallengeSetup(player);
  const primaryHref = !initialized || !user ? REGISTER_HREF : needsSetup ? SETUP_HREF : "/my";
  const primaryLabel = !initialized || !user
    ? "이벤트 선수카드 만들기"
    : needsSetup
      ? "홀로그램 카드 완성하기"
      : "내 선수카드 보기";

  return (
    <main className="min-h-screen bg-[#05070a] pt-[60px] text-white">
      <section className="relative overflow-hidden">
        <Image
          src="/images/ground-challenge-disciplines.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-48"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,10,0.96)_0%,rgba(5,7,10,0.76)_48%,rgba(5,7,10,0.52)_100%)]" />
        <div className="absolute inset-0 fg-scanlines opacity-30" />
        <div className="relative mx-auto grid max-w-[1180px] gap-8 px-4 py-12 sm:px-6 lg:min-h-[calc(100svh-60px)] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:py-16">
          <div className="max-w-[720px]">
            <div className="mb-5 inline-flex items-center gap-2 border px-3 py-2 text-[10px] font-black tracking-[0.24em] text-[#ff3b30]" style={{ borderColor: "rgba(255,59,48,0.48)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff3b30]" />
              MANGSANG EVENT
            </div>
            <h1 className="fg-display text-[48px] font-black leading-[0.95] sm:text-[76px] lg:text-[92px]">
              망상
              <br />
              {SKILL_CHALLENGE_EVENT_NAME}
            </h1>
            <p className="mt-6 max-w-[660px] break-keep text-lg font-semibold leading-8 text-white/70 sm:text-xl">
              자기 사진으로 홀로그램 선수카드를 만들고, 슈팅 스피드·타겟 슈팅·에어볼 터치 기록을 현장에서 남깁니다.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {DETAIL_ITEMS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex min-h-12 items-center gap-3 border border-white/12 bg-black/36 px-4 py-3 backdrop-blur">
                  <Icon className="h-4 w-4 shrink-0 text-[#ff3b30]" />
                  <span className="text-sm font-bold text-white/76">{label}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[6px] bg-[#ff3b30] px-6 text-sm font-black text-white transition hover:-translate-y-0.5"
              >
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/leaderboard?view=ground"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[6px] border border-white/16 px-6 text-sm font-black text-white/78 transition hover:border-[#ff3b30] hover:text-white"
              >
                랭킹 전체보기
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[330px] lg:max-w-none">
            <div className="absolute inset-4 bg-[#ff3b30]/18 blur-3xl" />
            <div className="relative flex justify-center">
              <PlayerCard
                player={SAMPLE_PLAYER}
                size="lg"
                teamLogo={TEAM_LOGO}
                disableHoverScale
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0a0d12]">
        <div className="mx-auto grid max-w-[1180px] gap-3 px-4 py-8 sm:px-6 lg:grid-cols-3">
          {SKILL_CHALLENGE_STAGES.map((stage) => {
            const Icon = stage.id === "speed" ? Gauge : stage.id === "target" ? Target : Sparkles;
            return (
              <div key={stage.id} className="border border-white/10 bg-white/[0.035] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="fg-label text-[10px] text-[#ff3b30]">{stage.step}</div>
                  <Icon className="h-5 w-5 text-[#ff3b30]" />
                </div>
                <h2 className="mt-4 text-xl font-black text-white">{stage.title}</h2>
                <p className="mt-3 break-keep text-sm font-medium leading-6 text-white/58">{stage.body}</p>
                <div className="mt-5 inline-flex border border-white/12 px-3 py-1.5 text-[11px] font-black text-white/72">
                  {stage.eventBadgeName}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="border-t px-4 py-10 sm:px-6 lg:py-14"
        style={{
          background: "var(--color-fg-paper-2, var(--color-fg-paper))",
          borderColor: "var(--color-fg-line-soft)",
        }}
      >
        <div className="mx-auto max-w-[1180px]">
          <GroundChallengeLeaderboard limit={8} fetchLimit={300} showViewAllLink />
        </div>
      </section>
    </main>
  );
}
