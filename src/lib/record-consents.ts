/**
 * 화면에서 받은 동의를 consent_records 에 남긴다.
 *
 * 키트는 서버 라우트 + service_role 로 기록한다. 이 프로젝트는 세션을 브라우저(localStorage)에만 두고
 * service_role 키를 쓰지 않으므로, 규칙을 **DB 가 강제**한다:
 *  - 가입: 메타데이터의 consents 를 auth.users INSERT 트리거(record_signup_consents)가 기록한다.
 *    메일 인증 전이라 세션이 없어도 같은 트랜잭션 안에서 기록되고, 기록이 실패하면 가입도 실패한다.
 *  - 로그인 후(소셜 가입 완료·초상권 철회): record_my_consents RPC — auth.uid() 로만 기록한다.
 *  - 필수 여부는 DB 가 종류로 정한다(age14·terms·privacy). 클라이언트가 보낸 required 는 받지 않는다.
 *  - 문서 본문과 해시는 마이그레이션이 legal_documents 에 넣는다. 클라이언트는 (kind, version) 만 보낸다.
 * 근거: supabase/migrations/20261015010000_consent_records.sql
 */
import type { ConsentItem } from "@/components/consent-checklist";
import type { LegalDocument } from "@/lib/legal-document";

export interface ConsentEntry { item: ConsentItem; document: LegalDocument }
export interface ConsentPayloadItem { kind: string; version: string; granted: boolean }

/** DB 가 필수로 보는 종류. supabase/migrations/20261015010000_consent_records.sql 과 같아야 한다. */
export const REQUIRED_CONSENT_KINDS = ["age14", "terms", "privacy"] as const;

/** 필수 항목이 하나라도 빠졌으면 오류 문구. 선택 항목은 보지 않는다 (제22조⑤). */
export function missingRequiredConsent(entries: ConsentEntry[], values: unknown): string | null {
  const v = (values && typeof values === "object" ? values : {}) as Record<string, unknown>;
  const missing = entries.filter((e) => e.item.required && v[e.item.key] !== true);
  return missing.length ? `[필수] ${missing.map((e) => e.item.label).join(", ")}에 동의해주세요.` : null;
}

/** 체크 값을 그대로 기록한다. 선택 항목도 "거부" 로 남긴다 — 기본값 꺼짐, 서버에서 true 로 바꾸지 않는다. */
export function consentPayload(entries: ConsentEntry[], values: unknown): ConsentPayloadItem[] {
  const v = (values && typeof values === "object" ? values : {}) as Record<string, unknown>;
  return entries.map((e) => ({ kind: e.document.kind, version: e.document.version, granted: v[e.item.key] === true }));
}

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function recordMyConsents(
  client: RpcClient, source: "oauth_complete" | "mypage", items: ConsentPayloadItem[],
): Promise<void> {
  const userAgent = typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 512);
  const { error } = await client.rpc("record_my_consents", { p_source: source, p_user_agent: userAgent, p_items: items });
  if (error) throw new Error("동의 내용을 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해주세요.");
}

/** 로그인한 본인에게 아직 기록되지 않은 필수 동의 종류. 판정할 수 없으면 null (화면을 막지 않는다). */
export async function missingRequiredConsentKinds(client: RpcClient): Promise<string[] | null> {
  const { data, error } = await client.rpc("my_consent_history");
  if (error || !Array.isArray(data)) return null;
  const granted = new Set((data as { kind: string; granted: boolean }[]).filter((r) => r.granted).map((r) => r.kind));
  return REQUIRED_CONSENT_KINDS.filter((k) => !granted.has(k));
}
