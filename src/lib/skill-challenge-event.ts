export const SKILL_CHALLENGE_PATH = "/skill-challenge";
export const SKILL_CHALLENGE_EVENT_NAME = "그라운드 챌린지";
export const SKILL_CHALLENGE_EVENT_SUBTITLE = "FairGround 선수카드 만들기 이벤트";
export const SKILL_CHALLENGE_DATE_LABEL = "2026.08.07 - 08.09";
export const SKILL_CHALLENGE_DATE_FULL_LABEL = "2026년 8월 7일 금요일부터 8월 9일 일요일까지";
export const SKILL_CHALLENGE_LOCATION_LABEL = "망상해수욕장";
export const SKILL_CHALLENGE_LOCATION_FULL_LABEL = "강원 동해시 망상해수욕장";

export const SKILL_CHALLENGE_STORAGE_KEY = "fg_skill_challenge_records_v1";

export const SKILL_CHALLENGE_BADGE_IDS = [
  "skill_challenger",
  "speed_cannon",
  "target_sniper",
  "air_touch_master",
] as const;

export type SkillChallengeBadgeId = (typeof SKILL_CHALLENGE_BADGE_IDS)[number];

export type SkillChallengeStageId = "speed" | "target" | "airTouch";

export interface SkillChallengeStage {
  id: SkillChallengeStageId;
  step: string;
  title: string;
  shortTitle: string;
  body: string;
  metricLabel: string;
  badgeId: SkillChallengeBadgeId;
}

export const SKILL_CHALLENGE_STAGES: SkillChallengeStage[] = [
  {
    id: "speed",
    step: "1단계",
    title: "슈팅 스피드건",
    shortTitle: "스피드",
    body: "슈팅 스피드건으로 최고 속도를 측정합니다. 파워 기록은 선수카드 이벤트 기록으로 남습니다.",
    metricLabel: "km/h",
    badgeId: "speed_cannon",
  },
  {
    id: "target",
    step: "2단계",
    title: "타겟 슈팅",
    shortTitle: "타겟",
    body: "총 5번 안에 타겟을 3회 성공했는지 기록합니다. 3/3, 3/4, 3/5 또는 실패로 랭킹을 구분합니다.",
    metricLabel: "3회 성공",
    badgeId: "target_sniper",
  },
  {
    id: "airTouch",
    step: "3단계",
    title: "에어볼 터치",
    shortTitle: "터치",
    body: "하늘에서 떨어지는 공을 컨트롤해 첫 터치 감각과 집중력을 기록합니다.",
    metricLabel: "점",
    badgeId: "air_touch_master",
  },
];

export interface SkillChallengeRecordInput {
  participantName: string;
  phoneLast4?: string;
  playerId?: string;
  playerName?: string;
  eventDate: string;
  speedKmh: number;
  targetNumber?: number;
  targetAttemptCount?: number | null;
  targetRecorded?: boolean;
  targetHit: boolean;
  airTouchScore: number;
  memo?: string;
}

export interface SkillChallengeRecord extends SkillChallengeRecordInput {
  id: string;
  targetNumber: number;
  targetAttemptCount: number | null;
  targetRecorded: boolean;
  totalScore: number;
  awardedBadges: SkillChallengeBadgeId[];
  createdAt: number;
}

export const SKILL_CHALLENGE_EVENT_DATES = [
  { value: "2026-08-07", label: "8월 7일 금요일" },
  { value: "2026-08-08", label: "8월 8일 토요일" },
  { value: "2026-08-09", label: "8월 9일 일요일" },
] as const;

export function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeNonNegativeNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeTargetAttemptCount(value: number | null | undefined, targetHit: boolean) {
  if (!targetHit) return null;
  return Math.round(clampNumber(Number(value ?? 3), 3, 5));
}

export function calculateSkillChallengeScore(input: Pick<
  SkillChallengeRecordInput,
  "speedKmh" | "targetHit" | "airTouchScore"
> & Pick<Partial<SkillChallengeRecordInput>, "targetRecorded">) {
  const speedScore = Math.round(clampNumber(input.speedKmh, 0, 130) * 5);
  const targetScore = input.targetHit ? 300 : 0;
  const airTouchScore = Math.round(normalizeNonNegativeNumber(input.airTouchScore) * 50);
  const completeBonus = input.speedKmh > 0 && (input.targetRecorded ?? input.targetHit) && input.airTouchScore > 0 ? 100 : 0;

  return speedScore + targetScore + airTouchScore + completeBonus;
}

export function getSkillChallengeAwardedBadges(input: Pick<
  SkillChallengeRecordInput,
  "speedKmh" | "targetHit" | "airTouchScore"
>): SkillChallengeBadgeId[] {
  const badges: SkillChallengeBadgeId[] = ["skill_challenger"];
  if (input.speedKmh >= 75) badges.push("speed_cannon");
  if (input.targetHit) badges.push("target_sniper");
  if (input.airTouchScore >= 7) badges.push("air_touch_master");
  return badges;
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

  return {
    ...normalized,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `skill-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    totalScore: calculateSkillChallengeScore(normalized),
    awardedBadges: getSkillChallengeAwardedBadges(normalized),
    createdAt: Date.now(),
  };
}

export function sortSkillChallengeRecords(records: SkillChallengeRecord[]) {
  return [...records].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.speedKmh !== a.speedKmh) return b.speedKmh - a.speedKmh;
    if (b.airTouchScore !== a.airTouchScore) return b.airTouchScore - a.airTouchScore;
    return a.createdAt - b.createdAt;
  });
}

export function getSkillChallengeRank(records: SkillChallengeRecord[], recordId: string) {
  const sorted = sortSkillChallengeRecords(records);
  return sorted.findIndex((record) => record.id === recordId) + 1;
}
