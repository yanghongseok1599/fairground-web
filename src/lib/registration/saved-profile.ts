import { rowToPlayer } from "@/lib/mappers";
import { requireSavedRow } from "./reliability";

/** A successful HTTP response is not proof that this account's row was saved. */
export function requireSavedProfile(
  data: Parameters<typeof rowToPlayer>[0] | null,
  error: { message: string } | null,
  expectedId: string,
) {
  const row = requireSavedRow(data, error);
  if (row.id !== expectedId) {
    throw new Error("저장된 계정을 확인하지 못했습니다. 입력을 유지한 채 다시 로그인해주세요.");
  }
  return rowToPlayer(row);
}
