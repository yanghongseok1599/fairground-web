/**
 * 비밀번호 정책. 가입·재설정·변경이 모두 이 함수 하나를 쓴다.
 * (페어그라운드는 가입과 변경의 정책이 달라 변경 쪽이 더 약했다.)
 *
 * NIST SP 800-63B-4 기준:
 *  - 길이가 강도를 결정한다. "영문+숫자+특수문자" 같은 조합 규칙은 강제하지 않는다(SHALL NOT).
 *  - 최소 64자까지 허용, 붙여넣기·비밀번호 관리자 허용, 흔한 비밀번호 차단.
 *  - 비밀번호만 쓰는 서비스는 15자를 권고한다. 이 키트 기본값 10자는 국내 이용자 수용성과
 *    KISA 안내(조합 시 10자 이상)를 고려한 타협이다. 위험도가 높은 서비스면 15로 올릴 것.
 * Supabase 쪽 Auth 설정의 최소 길이도 같은 값으로 맞춰야 한다(대시보드 > Auth > Passwords).
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

// 가장 흔한 유출 비밀번호 일부. 완전한 차단은 Supabase Pro 의 유출 비밀번호 검사를 켠다.
const BLOCKLIST = new Set([
  "1234567890", "12345678910", "0123456789", "qwertyuiop", "1q2w3e4r5t", "1q2w3e4r5t6y",
  "password12", "password123", "qwer1234!@", "asdf123456", "a123456789", "iloveyou12",
  "abcd123456", "1111111111", "0000000000", "aaaaaaaaaa",
]);

export function passwordPolicyError(password: unknown, context: { email?: string } = {}): string | null {
  if (typeof password !== "string") return "비밀번호를 입력해주세요.";
  if (password.length < PASSWORD_MIN_LENGTH) return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하로 입력해주세요.`;
  const lowered = password.toLowerCase();
  if (BLOCKLIST.has(lowered) || /^(.)\1+$/.test(password)) return "너무 흔한 비밀번호입니다. 다른 비밀번호를 입력해주세요.";
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lowered.includes(local)) return "이메일 아이디가 들어간 비밀번호는 쓸 수 없습니다.";
  return null;
}
