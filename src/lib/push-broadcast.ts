"use client";

/**
 * 관리자 푸시 브로드캐스트 클라 헬퍼.
 *
 * 서버: admin_broadcast_count / admin_broadcast_push RPC (SECURITY DEFINER, is_admin 강제).
 * notifications insert → trg_push_dispatch → push-dispatch 엣지펑션이 대상 기기로 web push 발사.
 *
 * database.types.ts 자동 생성본에 새 RPC 가 없어 typed 클라이언트에서 unknown 처리되므로,
 * push.ts 와 동일하게 명시 캐스팅으로 우회한다(런타임 안전, 서버 is_admin 이 최종 강제).
 */

import { supabase } from "@/config/supabase";

export type BroadcastTargetType = "all" | "role" | "team" | "user";

export type BroadcastTarget =
  | { type: "all" }
  | { type: "role"; value: string }
  | { type: "team"; value: string }
  | { type: "user"; value: string };

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** 발송 전 수신자 수 미리보기. */
export async function countBroadcastRecipients(target: BroadcastTarget): Promise<number> {
  const { data, error } = await (supabase as unknown as RpcClient).rpc("admin_broadcast_count", {
    p_target: target,
  });
  if (error) throw new Error(error.message);
  return asNumber(data);
}

/** 브로드캐스트 발송. 반환값 = notification 이 생성된 수신자 수. */
export async function sendBroadcast(
  title: string,
  body: string,
  target: BroadcastTarget,
): Promise<number> {
  const { data, error } = await (supabase as unknown as RpcClient).rpc("admin_broadcast_push", {
    p_title: title,
    p_body: body,
    p_target: target,
  });
  if (error) throw new Error(error.message);
  return asNumber(data);
}
