"use client";

import { supabase, isDemoMode } from "@/config/supabase";
import { rowToPlayer } from "@/lib/mappers";
import {
  SKILL_CHALLENGE_EVENT_SLUG,
  SKILL_CHALLENGE_STORAGE_KEY,
  calculateSkillChallengeScore,
  createSkillChallengeRecord,
  normalizeTargetAttemptCount,
  skillChallengeRecordToCsv,
  type SkillChallengeCardBadgeId,
  type SkillChallengeRecord,
} from "@/lib/skill-challenge";
import type { Database } from "@/lib/database.types";
import type { Player } from "@/types";

type SkillChallengeRecordRow = Database["public"]["Tables"]["skill_challenge_records"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const LS_PLAYERS = "fg_players";
const CARD_BADGE_IDS = new Set<SkillChallengeCardBadgeId>([
  "event_shooting_king",
  "event_freekick_king",
  "event_touch_king",
]);

export interface SkillChallengeAdminRecord extends SkillChallengeRecord {
  eventSlug: string;
  targetRecorded: boolean;
}

export interface SkillChallengeParticipant {
  player: Player;
  record?: SkillChallengeAdminRecord;
}

export interface SkillChallengeRecordSaveInput {
  eventSlug?: string;
  playerId: string;
  eventDate: string;
  speedKmh: number;
  targetAttemptCount: number | null;
  targetRecorded: boolean;
  targetHit: boolean;
  airTouchScore: number;
  memo?: string;
}

function safeNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPhoneLast4(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits ? digits.slice(-4) : undefined;
}

function getDemoPlayers(): Player[] {
  if (typeof window === "undefined") return [];
  try {
    const players = JSON.parse(window.localStorage.getItem(LS_PLAYERS) || "{}") as Record<string, Player>;
    return Object.values(players);
  } catch {
    return [];
  }
}

function getDemoRecords(): Record<string, SkillChallengeAdminRecord> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SKILL_CHALLENGE_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDemoRecords(records: Record<string, SkillChallengeAdminRecord>) {
  window.localStorage.setItem(SKILL_CHALLENGE_STORAGE_KEY, JSON.stringify(records));
}

function normalizeCardBadgeIds(ids: string[]): SkillChallengeCardBadgeId[] {
  return ids.filter((id): id is SkillChallengeCardBadgeId => CARD_BADGE_IDS.has(id as SkillChallengeCardBadgeId));
}

export function rowToSkillChallengeRecord(row: SkillChallengeRecordRow): SkillChallengeAdminRecord {
  return {
    id: row.id,
    eventSlug: row.event_slug,
    participantName: row.participant_name,
    phoneLast4: row.phone_last4 ?? undefined,
    playerId: row.player_id,
    playerName: row.participant_name,
    eventDate: row.event_date,
    speedKmh: safeNumber(row.speed_kmh),
    targetNumber: row.target_number,
    targetAttemptCount: row.target_attempt_count,
    targetRecorded: row.target_recorded,
    targetHit: row.target_hit,
    airTouchScore: safeNumber(row.air_touch_score),
    totalScore: row.total_score,
    eventBadges: row.event_badges ?? [],
    cardBadgeIds: normalizeCardBadgeIds(row.card_badge_ids ?? []),
    memo: row.memo ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: row.updated_at,
    recordedBy: row.recorded_by,
    completedAt: row.completed_at,
  };
}

export function isSkillChallengeRecordComplete(record?: Pick<SkillChallengeAdminRecord, "speedKmh" | "targetRecorded" | "airTouchScore" | "completedAt">) {
  return Boolean(record?.completedAt) || Boolean(record && record.speedKmh > 0 && record.targetRecorded && record.airTouchScore > 0);
}

export function getSkillChallengeProgressCount(record?: Pick<SkillChallengeAdminRecord, "speedKmh" | "targetRecorded" | "airTouchScore">) {
  if (!record) return 0;
  return Number(record.speedKmh > 0) + Number(record.targetRecorded) + Number(record.airTouchScore > 0);
}

export function getPreviewSkillChallengeScore(
  input: Pick<SkillChallengeRecordSaveInput, "speedKmh" | "targetRecorded" | "targetHit" | "airTouchScore">,
) {
  return calculateSkillChallengeScore(input);
}

export async function fetchSkillChallengeParticipants(eventSlug = SKILL_CHALLENGE_EVENT_SLUG): Promise<SkillChallengeParticipant[]> {
  if (isDemoMode) {
    const records = getDemoRecords();
    return getDemoPlayers()
      .filter((player) => player.cardSkin === "hologram")
      .map((player) => ({ player, record: records[`${eventSlug}:${player.id}`] }))
      .sort(sortParticipants);
  }

  const [{ data: playersData, error: playersError }, { data: recordsData, error: recordsError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("card_skin", "hologram").order("created_at", { ascending: false }),
    supabase.from("skill_challenge_records").select("*").eq("event_slug", eventSlug),
  ]);

  if (playersError) throw new Error(playersError.message);
  if (recordsError) throw new Error(recordsError.message);

  const records = new Map(
    ((recordsData ?? []) as SkillChallengeRecordRow[]).map((row) => [row.player_id, rowToSkillChallengeRecord(row)]),
  );

  return ((playersData ?? []) as ProfileRow[])
    .map((row) => {
      const player = rowToPlayer(row);
      return { player, record: records.get(player.id) };
    })
    .sort(sortParticipants);
}

export async function saveSkillChallengeRecord(input: SkillChallengeRecordSaveInput): Promise<SkillChallengeAdminRecord> {
  const eventSlug = input.eventSlug ?? SKILL_CHALLENGE_EVENT_SLUG;
  const normalized = {
    ...input,
    eventSlug,
    targetRecorded: input.targetRecorded || input.targetHit,
    targetAttemptCount: normalizeTargetAttemptCount(input.targetAttemptCount, input.targetHit),
  };

  if (isDemoMode) {
    const player = getDemoPlayers().find((entry) => entry.id === normalized.playerId);
    if (!player) throw new Error("선수를 찾을 수 없습니다.");

    const record = createSkillChallengeRecord({
      participantName: player.name,
      phoneLast4: getPhoneLast4(player.phone),
      playerId: player.id,
      playerName: player.name,
      eventDate: normalized.eventDate,
      speedKmh: normalized.speedKmh,
      targetNumber: 1,
      targetAttemptCount: normalized.targetAttemptCount,
      targetRecorded: normalized.targetRecorded,
      targetHit: normalized.targetHit,
      airTouchScore: normalized.airTouchScore,
      memo: normalized.memo,
    });

    const now = new Date().toISOString();
    const adminRecord: SkillChallengeAdminRecord = {
      ...record,
      eventSlug,
      targetRecorded: normalized.targetRecorded,
      updatedAt: now,
      recordedBy: null,
      completedAt: isSkillChallengeRecordComplete({ ...record, targetRecorded: normalized.targetRecorded, completedAt: null })
        ? now
        : null,
    };
    const records = getDemoRecords();
    records[`${eventSlug}:${player.id}`] = adminRecord;
    saveDemoRecords(records);
    return adminRecord;
  }

  const { data, error } = await supabase.rpc("upsert_skill_challenge_record", {
    p_event_slug: eventSlug,
    p_player_id: normalized.playerId,
    p_event_date: normalized.eventDate,
    p_speed_kmh: normalized.speedKmh,
    p_target_recorded: normalized.targetRecorded,
    p_target_hit: normalized.targetHit,
    p_target_attempt_count: normalized.targetAttemptCount,
    p_air_touch_score: normalized.airTouchScore,
    p_memo: normalized.memo ?? null,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("기록 저장 결과가 없습니다.");

  return rowToSkillChallengeRecord(data as SkillChallengeRecordRow);
}

export function exportSkillChallengeCsv(records: SkillChallengeAdminRecord[]) {
  return `\uFEFF${skillChallengeRecordToCsv(records)}`;
}

export function filterSkillChallengeParticipants(participants: SkillChallengeParticipant[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return participants;
  return participants.filter(({ player, record }) =>
    [player.name, player.phone, player.email, String(player.number), player.position, record?.phoneLast4]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)),
  );
}

function sortParticipants(a: SkillChallengeParticipant, b: SkillChallengeParticipant) {
  const aDone = isSkillChallengeRecordComplete(a.record);
  const bDone = isSkillChallengeRecordComplete(b.record);
  if (aDone !== bDone) return Number(aDone) - Number(bDone);

  const aProgress = getSkillChallengeProgressCount(a.record);
  const bProgress = getSkillChallengeProgressCount(b.record);
  if (aProgress !== bProgress) return bProgress - aProgress;

  if ((a.record?.totalScore ?? 0) !== (b.record?.totalScore ?? 0)) {
    return (b.record?.totalScore ?? 0) - (a.record?.totalScore ?? 0);
  }

  return b.player.createdAt - a.player.createdAt;
}
