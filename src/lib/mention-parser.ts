// 멘션 마크다운: @[name](uuid)
// uuid 패턴: 8-4-4-4-12 hex
export const MENTION_REGEX = /@\[([^\]]{1,80})\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/g;

export interface ParsedMention {
  name: string;
  userId: string;
  /** Index of the leading `@` in the original string. */
  start: number;
  /** Index just past the closing `)`. */
  end: number;
}

/** 본문에서 모든 멘션을 추출한다 (중복 userId 허용 — fan-out 시 dedupe). */
export function extractMentions(body: string): ParsedMention[] {
  const out: ParsedMention[] = [];
  const re = new RegExp(MENTION_REGEX.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push({ name: m[1], userId: m[2], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** 멘션된 userId 의 고유 집합. */
export function mentionedUserIds(body: string): string[] {
  return Array.from(new Set(extractMentions(body).map((m) => m.userId)));
}
