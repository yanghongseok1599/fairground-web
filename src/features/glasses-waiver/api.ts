import { supabase, isDemoMode } from "@/config/supabase";
import type { GlassesWaiverReceipt } from "./policy";

function receipt(value: unknown): GlassesWaiverReceipt | null {
  if (value === null) return null;
  const row = value as GlassesWaiverReceipt;
  if (!row || typeof row.id !== "string" || typeof row.signer_name !== "string" ||
      typeof row.version !== "string" || !Array.isArray(row.document) ||
      !row.document.every((text) => typeof text === "string") ||
      typeof row.signed_at !== "string" || !Number.isFinite(Date.parse(row.signed_at))) {
    throw new Error("서약 저장 기록을 확인하지 못했습니다.");
  }
  return row;
}

export async function getGlassesWaiver(): Promise<GlassesWaiverReceipt | null> {
  if (isDemoMode) throw new Error("로그인 후 온라인 상태에서 서약서를 확인해주세요.");
  const { data, error } = await supabase.rpc("get_my_glasses_waiver");
  if (error) throw new Error("서약서를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  return receipt(data);
}

export async function signGlassesWaiver(name: string): Promise<GlassesWaiverReceipt> {
  const { data, error } = await supabase.rpc("sign_glasses_waiver", { p_signer_name: name.trim(), p_agreed: true });
  if (error) throw new Error("서약 저장에 실패했습니다. 본인 이름과 네트워크 연결을 확인하고 다시 시도해주세요.");
  const saved = receipt(data);
  if (!saved) throw new Error("서약 저장을 확인하지 못했습니다. 다시 조회해주세요.");
  return saved;
}
