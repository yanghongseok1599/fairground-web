/**
 * 만 나이 판정 (개인정보 보호법 제22조의2 — 만 14세 미만은 법정대리인 동의가 필요하다).
 * 페어그라운드는 만 14세 미만 가입을 받지 않는다. DB 가입 트리거도 같은 규칙으로 막는다
 * (supabase/migrations/20261015010000_consent_records.sql).
 */
export const MIN_SIGNUP_AGE = 14;

/** birthDate: "YYYY-MM-DD". 형식이 틀리면 null (판정 불가). 기준일은 한국 날짜. */
export function isAtLeastAge(birthDate: string, years: number, now = new Date()): boolean | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const birth = new Date(Date.UTC(y, mo - 1, d));
  if (birth.getUTCFullYear() !== y || birth.getUTCMonth() !== mo - 1 || birth.getUTCDate() !== d) return null;
  const [ty, tm, td] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now).split("-").map(Number);
  const age = ty - y - (tm < mo || (tm === mo && td < d) ? 1 : 0);
  return age >= years;
}
