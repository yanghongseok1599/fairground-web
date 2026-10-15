/**
 * 법적 문서(약관·처리방침·동의 문구)의 공통 형태.
 *
 * 문서를 JSX 에 하드코딩하지 않고 데이터로 둔다. 그래야
 *  - 가입 화면의 동의 체크박스와 독립 페이지가 같은 원문을 쓰고 (결은 행사 신청 동의 문구가
 *    처리방침과 이미 어긋나 있었다)
 *  - 동의 기록에 그 순간의 원문 스냅샷과 해시를 남길 수 있다.
 *
 * version 은 날짜 문자열로 쓴다. **문구를 한 글자라도 고치면 version 을 올린다.**
 * 같은 version 에 다른 본문이 들어오면 DB 가 거부한다 (sql/consent-records.sql).
 */
import type { ConsentItem } from "@/components/consent-checklist";

export type LegalKind = "terms" | "privacy" | "refund" | "marketing" | "marketing_night" | "portrait" | "age14";

export interface LegalSection {
  heading: string;
  body: string[];
  /** 아직 확정되지 않은 내용이 있으면 true. 화면에서 강조되고 초안 배너가 뜬다. */
  pending?: boolean;
}

export interface LegalDocument {
  kind: LegalKind;
  title: string;
  version: string;          // "2026-10-15"
  effectiveAt: string | null; // 시행일. null 이면 초안.
  sections: LegalSection[];
}

export function isDraft(doc: LegalDocument): boolean {
  return doc.effectiveAt === null || doc.sections.some((s) => s.pending);
}

/** 동의 기록용 스냅샷 해시. 서버에서만 호출한다 (Node crypto). */
export async function documentHash(doc: LegalDocument): Promise<string> {
  const { createHash } = await import("node:crypto");
  const canonical = JSON.stringify({ kind: doc.kind, version: doc.version, sections: doc.sections });
  return createHash("sha256").update(canonical).digest("hex");
}

/** 본문에 "[확정 필요]" 가 남은 섹션을 미확정으로 표시한다. 생성기가 놓친 빈칸도 화면에서 강조되게 한다. */
export function markPendingSections(doc: LegalDocument): LegalDocument {
  return { ...doc, sections: doc.sections.map((s) => (s.body.some((b) => b.includes("[확정 필요]")) ? { ...s, pending: true } : s)) };
}

/** 동의 항목의 고지 문구 자체를 문서로 만든다. 스냅샷에 화면에 보인 그 문구가 남는다 (키트 record-consents.ts 에서 옮김). */
export function consentDocument(kind: LegalKind, version: string, item: ConsentItem): LegalDocument {
  const n = item.notice;
  return {
    kind, version, title: item.label, effectiveAt: version,
    sections: [{ heading: item.label, body: n ? [`목적: ${n.purpose}`, `항목: ${n.items}`, `보유기간: ${n.retention}`, `거부권: ${n.refusal}`] : [item.label] }],
  };
}
