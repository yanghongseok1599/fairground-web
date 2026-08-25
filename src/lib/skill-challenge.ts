export const SKILL_CHALLENGE_PATH = "/skill-challenge";
export const SKILL_CHALLENGE_EVENT_NAME = "그라운드 챌린지";
export const SKILL_CHALLENGE_EVENT_SUBTITLE = "FairGround 선수카드 만들기 이벤트";
export const SKILL_CHALLENGE_EVENT_SLUG = "mangsang-2026";
export const SKILL_CHALLENGE_DATE_LABEL = "2026.08.07 - 08.09";
export const SKILL_CHALLENGE_DATE_FULL_LABEL = "2026년 8월 7일 금요일부터 8월 9일 일요일까지";
export const SKILL_CHALLENGE_LOCATION_LABEL = "망상해수욕장";
export const SKILL_CHALLENGE_LOCATION_FULL_LABEL = "강원 동해시 망상해수욕장";
export const SKILL_CHALLENGE_STORAGE_KEY = "fg_skill_challenge_records_v2";

export type SkillChallengeStageId = "speed" | "target" | "airTouch";
export type SkillChallengeCardBadgeId =
  | "event_shooting_king"
  | "event_freekick_king"
  | "event_touch_king";

export interface SkillChallengeStage {
  id: SkillChallengeStageId;
  step: string;
  title: string;
  shortTitle: string;
  body: string;
  metricLabel: string;
  eventBadgeName: string;
  cardBadgeId: SkillChallengeCardBadgeId;
}

export const SKILL_CHALLENGE_STAGES: SkillChallengeStage[] = [
  {
    id: "speed",
    step: "1단계",
    title: "슈팅 스피드건",
    shortTitle: "스피드",
    body: "슈팅 스피드건으로 최고 속도를 측정합니다. 파워 기록은 선수카드 이벤트 기록으로 남습니다.",
    metricLabel: "km/h",
    eventBadgeName: "스피드캐논",
    cardBadgeId: "event_shooting_king",
  },
  {
    id: "target",
    step: "2단계",
    title: "타겟 슈팅",
    shortTitle: "타겟",
    body: "총 5번 안에 타겟을 3회 성공했는지 기록합니다. 3/3, 3/4, 3/5 또는 실패로 랭킹을 구분합니다.",
    metricLabel: "3회 성공",
    eventBadgeName: "타겟스나이퍼",
    cardBadgeId: "event_freekick_king",
  },
  {
    id: "airTouch",
    step: "3단계",
    title: "에어볼 터치",
    shortTitle: "터치",
    body: "하늘에서 떨어지는 공을 컨트롤해 첫 터치 감각과 집중력을 기록합니다.",
    metricLabel: "점",
    eventBadgeName: "에어터치마스터",
    cardBadgeId: "event_touch_king",
  },
];

export const SKILL_CHALLENGE_EVENT_DATES = [
  { value: "2026-08-07", label: "8월 7일 금요일" },
  { value: "2026-08-08", label: "8월 8일 토요일" },
  { value: "2026-08-09", label: "8월 9일 일요일" },
] as const;

export interface SkillChallengeRecordInput {
  participantName: string;
  phoneLast4?: string;
  playerId?: string;
  playerName?: string;
  eventDate: string;
  speedKmh: number;
  targetNumber?: number;
  targetAttemptCount?: number | null;
  targetHit: boolean;
  targetRecorded?: boolean;
  airTouchScore: number;
  memo?: string;
}

export interface SkillChallengeRecord extends SkillChallengeRecordInput {
  id: string;
  targetNumber: number;
  targetAttemptCount: number | null;
  targetRecorded: boolean;
  totalScore: number;
  eventBadges: string[];
  cardBadgeIds: SkillChallengeCardBadgeId[];
  createdAt: number;
  updatedAt?: string;
  recordedBy?: string | null;
  completedAt?: string | null;
}

export type SkillChallengeRankingMode = "overall" | "speed" | "target" | "airTouch";

export function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeNonNegativeNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function normalizeTargetAttemptCount(value: number | null | undefined, targetHit: boolean) {
  if (!targetHit) return null;
  return Math.round(clampNumber(Number(value ?? 3), 3, 5));
}

export function calculateSkillChallengeScore(
  input: Pick<SkillChallengeRecordInput, "speedKmh" | "targetHit" | "airTouchScore"> &
    Pick<Partial<SkillChallengeRecordInput>, "targetRecorded">,
) {
  const speedScore = Math.round(clampNumber(input.speedKmh, 0, 130) * 5);
  const targetScore = input.targetHit ? 300 : 0;
  const touchScore = Math.round(normalizeNonNegativeNumber(input.airTouchScore) * 50);
  const completeBonus = input.speedKmh > 0 && (input.targetRecorded ?? input.targetHit) && input.airTouchScore > 0 ? 100 : 0;
  return speedScore + targetScore + touchScore + completeBonus;
}

export function getSkillChallengeAwards(
  input: Pick<SkillChallengeRecordInput, "speedKmh" | "targetHit" | "airTouchScore">,
) {
  const eventBadges = ["그라운드 챌린저"];
  const cardBadgeIds: SkillChallengeCardBadgeId[] = [];

  if (input.speedKmh > 0) {
    eventBadges.push("스피드캐논");
    cardBadgeIds.push("event_shooting_king");
  }
  if (input.targetHit) {
    eventBadges.push("타겟스나이퍼");
    cardBadgeIds.push("event_freekick_king");
  }
  if (input.airTouchScore > 0) {
    eventBadges.push("에어터치마스터");
    cardBadgeIds.push("event_touch_king");
  }

  return { eventBadges, cardBadgeIds };
}

export function createSkillChallengeRecord(input: SkillChallengeRecordInput): SkillChallengeRecord {
  const normalized = {
    ...input,
    participantName: input.participantName.trim(),
    phoneLast4: input.phoneLast4?.trim() || undefined,
    memo: input.memo?.trim() || undefined,
    speedKmh: clampNumber(input.speedKmh, 0, 130),
    targetNumber: Math.round(clampNumber(input.targetNumber ?? 1, 1, 9)),
    targetRecorded: input.targetRecorded ?? input.targetHit,
    targetAttemptCount: normalizeTargetAttemptCount(input.targetAttemptCount, input.targetHit),
    airTouchScore: normalizeNonNegativeNumber(input.airTouchScore),
  };
  const awards = getSkillChallengeAwards(normalized);

  return {
    ...normalized,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `skill-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    totalScore: calculateSkillChallengeScore(normalized),
    eventBadges: awards.eventBadges,
    cardBadgeIds: awards.cardBadgeIds,
    createdAt: Date.now(),
  };
}

export function sortSkillChallengeRecords<T extends SkillChallengeRecord>(
  records: T[],
  mode: SkillChallengeRankingMode = "overall",
) {
  return [...records].sort((a, b) => {
    if (mode === "speed" && b.speedKmh !== a.speedKmh) return b.speedKmh - a.speedKmh;
    if (mode === "target") {
      if (Number(b.targetHit) !== Number(a.targetHit)) {
        return Number(b.targetHit) - Number(a.targetHit);
      }
      const aAttempt = a.targetHit ? a.targetAttemptCount ?? 6 : 99;
      const bAttempt = b.targetHit ? b.targetAttemptCount ?? 6 : 99;
      if (aAttempt !== bAttempt) return aAttempt - bAttempt;
    }
    if (mode === "airTouch" && b.airTouchScore !== a.airTouchScore) {
      return b.airTouchScore - a.airTouchScore;
    }
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.speedKmh !== a.speedKmh) return b.speedKmh - a.speedKmh;
    if (b.airTouchScore !== a.airTouchScore) return b.airTouchScore - a.airTouchScore;
    return a.createdAt - b.createdAt;
  });
}

export function skillChallengeRecordToCsv(records: SkillChallengeRecord[]) {
  const header = [
    "rank",
    "name",
    "date",
    "score",
    "speed_kmh",
    "target_result",
    "target_attempt_count",
    "air_touch_score",
    "badges",
    "memo",
    "created_at",
  ];
  const rows = sortSkillChallengeRecords(records).map((record, index) => [
    String(index + 1),
    record.participantName,
    record.eventDate,
    String(record.totalScore),
    String(record.speedKmh),
    record.targetHit ? "success" : record.targetRecorded ? "fail" : "not_recorded",
    record.targetAttemptCount ? String(record.targetAttemptCount) : "",
    String(record.airTouchScore),
    record.eventBadges.join(" / "),
    record.memo ?? "",
    new Date(record.createdAt).toISOString(),
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
