"use client";

import { isDemoMode, supabase } from "@/config/supabase";
import {
  SKILL_CHALLENGE_EVENT_SLUG,
  SKILL_CHALLENGE_STORAGE_KEY,
  calculateSkillChallengeScore,
  sortSkillChallengeRecords,
  type SkillChallengeCardBadgeId,
  type SkillChallengeRankingMode,
  type SkillChallengeRecord,
} from "@/lib/skill-challenge";
import type { Database } from "@/lib/database.types";

type SkillChallengeLeaderboardRow =
  Database["public"]["Functions"]["get_skill_challenge_leaderboard"]["Returns"][number];

const LS_PLAYERS = "fg_players";

export interface SkillChallengeLeaderboardRecord extends SkillChallengeRecord {
  eventSlug: string;
  playerId: string;
  playerNumber: number | null;
  playerPosition: string | null;
  photoUrl: string | null;
  profilePhotoUrl: string | null;
}

function safeNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCardBadgeIds(ids: string[] | null | undefined): SkillChallengeCardBadgeId[] {
  return (ids ?? []).filter((id): id is SkillChallengeCardBadgeId =>
    ["event_shooting_king", "event_freekick_king", "event_touch_king"].includes(id),
  );
}

function getLocalPlayers() {
  if (typeof window === "undefined") return new Map<string, {
    number?: number;
    position?: string;
    photoUrl?: string;
    profilePhotoUrl?: string;
  }>();

  try {
    const players = JSON.parse(window.localStorage.getItem(LS_PLAYERS) || "{}") as Record<string, {
      id: string;
      number?: number;
      position?: string;
      photoUrl?: string;
      profilePhotoUrl?: string;
    }>;
    return new Map(
      Object.values(players).map((player) => [
        player.id,
        {
          number: player.number,
          position: player.position,
          photoUrl: player.photoUrl,
          profilePhotoUrl: player.profilePhotoUrl,
        },
      ]),
    );
  } catch {
    return new Map();
  }
}

function getDemoRecords(eventSlug: string): SkillChallengeLeaderboardRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const playerLookup = getLocalPlayers();
    const records = JSON.parse(window.localStorage.getItem(SKILL_CHALLENGE_STORAGE_KEY) || "{}") as Record<
      string,
      Partial<SkillChallengeLeaderboardRecord>
    >;

    return Object.values(records)
      .filter((record) => !record.eventSlug || record.eventSlug === eventSlug)
      .filter((record): record is Partial<SkillChallengeLeaderboardRecord> & { id: string; playerId: string } =>
        Boolean(record.id && record.playerId),
      )
      .map((record) => {
        const player = playerLookup.get(record.playerId);
        const normalized = {
          speedKmh: safeNumber(record.speedKmh),
          targetHit: Boolean(record.targetHit),
          airTouchScore: safeNumber(record.airTouchScore),
          targetRecorded: Boolean(record.targetRecorded || record.targetHit),
          targetAttemptCount: record.targetHit ? record.targetAttemptCount ?? null : null,
        };

        return {
          id: record.id,
          eventSlug,
          participantName: record.participantName?.trim() || record.playerName?.trim() || "이름 없음",
          playerId: record.playerId,
          playerName: record.playerName ?? record.participantName ?? "이름 없음",
          playerNumber: player?.number ?? record.playerNumber ?? null,
          playerPosition: player?.position ?? record.playerPosition ?? null,
          photoUrl: player?.photoUrl ?? record.photoUrl ?? null,
          profilePhotoUrl: player?.profilePhotoUrl ?? record.profilePhotoUrl ?? null,
          phoneLast4: undefined,
          eventDate: record.eventDate ?? "",
          speedKmh: normalized.speedKmh,
          targetNumber: Math.round(safeNumber(record.targetNumber || 1)),
          targetAttemptCount: normalized.targetAttemptCount,
          targetRecorded: normalized.targetRecorded,
          targetHit: normalized.targetHit,
          airTouchScore: normalized.airTouchScore,
          totalScore: record.totalScore ?? calculateSkillChallengeScore(normalized),
          eventBadges: record.eventBadges ?? [],
          cardBadgeIds: normalizeCardBadgeIds(record.cardBadgeIds),
          memo: undefined,
          createdAt: record.createdAt ?? Date.now(),
          updatedAt: record.updatedAt,
          recordedBy: null,
          completedAt: record.completedAt ?? null,
        };
      });
  } catch {
    return [];
  }
}

function rowToLeaderboardRecord(row: SkillChallengeLeaderboardRow): SkillChallengeLeaderboardRecord {
  return {
    id: row.id,
    eventSlug: row.event_slug,
    participantName: row.participant_name,
    playerId: row.player_id,
    playerName: row.participant_name,
    playerNumber: row.player_number,
    playerPosition: row.player_position,
    photoUrl: row.photo_url,
    profilePhotoUrl: row.profile_photo_url,
    phoneLast4: undefined,
    eventDate: row.event_date,
    speedKmh: safeNumber(row.speed_kmh),
    targetNumber: row.target_number,
    targetAttemptCount: row.target_attempt_count,
    targetRecorded: row.target_recorded,
    targetHit: row.target_hit,
    airTouchScore: safeNumber(row.air_touch_score),
    totalScore: row.total_score,
    eventBadges: row.event_badges ?? [],
    cardBadgeIds: normalizeCardBadgeIds(row.card_badge_ids),
    memo: undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: undefined,
    recordedBy: null,
    completedAt: row.completed_at,
  };
}

export async function fetchSkillChallengeLeaderboard(options?: {
  eventSlug?: string;
  limit?: number;
  mode?: SkillChallengeRankingMode;
}): Promise<SkillChallengeLeaderboardRecord[]> {
  const eventSlug = options?.eventSlug ?? SKILL_CHALLENGE_EVENT_SLUG;
  const limit = options?.limit ?? 100;
  const mode = options?.mode ?? "overall";

  if (isDemoMode) {
    return sortSkillChallengeRecords(getDemoRecords(eventSlug), mode).slice(0, limit);
  }

  const { data, error } = await supabase.rpc("get_skill_challenge_leaderboard", {
    p_event_slug: eventSlug,
    p_limit: Math.max(limit, 100),
  });

  if (error) throw new Error(error.message);
  return sortSkillChallengeRecords((data ?? []).map(rowToLeaderboardRecord), mode).slice(0, limit);
}
