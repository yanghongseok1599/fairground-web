import type { Player } from "@/types";
import { requireSavedRow } from "./reliability";

/** A successful HTTP response is not proof that this account's row was saved. */
export async function requireSavedProfile(
  data: { id: string } | null,
  error: { message: string } | null,
  expectedId: string,
  readOwnProfile: (id: string) => Promise<Player | null>,
) {
  const row = requireSavedRow(data, error);
  if (row.id !== expectedId) {
    throw new Error("저장된 계정을 확인하지 못했습니다. 입력을 유지한 채 다시 로그인해주세요.");
  }
  // Production grants SELECT only on public columns. Never request profiles.*;
  // fetch the canonical private record through the existing own-profile RPC.
  let player: Player | null;
  try {
    player = await readOwnProfile(expectedId);
  } catch {
    throw new Error("저장 요청은 처리되었지만 결과를 다시 확인하지 못했습니다. 입력은 유지됩니다. 연결이 돌아오면 내 카드의 저장 결과를 확인해주세요.");
  }
  if (!player || player.id !== expectedId) {
    throw new Error("저장 결과의 계정을 확인하지 못했습니다. 입력을 유지한 채 해당 계정의 내 카드를 확인해주세요.");
  }
  return player;
}
