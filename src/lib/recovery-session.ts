/**
 * "이 세션은 방금 메일 링크로 만들어졌다" 판정 — 재설정 화면이 현재 비밀번호 없이 새 비밀번호를 받아도 되는가.
 *
 * 키트는 서버 쿠키(recovery proof)로 증명한다. 이 앱은 세션이 브라우저에만 있어 서버 쿠키가 없으므로
 * 액세스 토큰의 amr(인증 방법) 클레임을 본다. 비밀번호·소셜 로그인 세션은 password·oauth 로 남고,
 * 메일 링크(재설정·가입 확인)로 만든 세션은 recovery 또는 otp 로 남는다. 이 앱은 매직 링크·OTP 로그인을
 * 쓰지 않으므로 otp 는 메일 링크 세션이다. 30분이 지나면 다시 링크를 받아야 한다 (키트 RECOVERY_SECONDS).
 * 이것이 없으면 로그인만 된 화면에서 /auth/reset-password 를 열어 현재 비밀번호 확인을 건너뛸 수 있다.
 */
export const RECOVERY_WINDOW_SECONDS = 30 * 60;
const LINK_METHODS = new Set(["recovery", "otp", "magiclink"]);

export function isRecentEmailLinkSession(accessToken: string | null | undefined, nowMs = Date.now()): boolean {
  const payload = accessToken?.split(".")[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")));
    const amr: unknown = json?.amr;
    if (!Array.isArray(amr)) return false;
    return amr.some((entry) => {
      if (typeof entry === "string") return LINK_METHODS.has(entry);
      const at = Number(entry?.timestamp);
      return LINK_METHODS.has(entry?.method) && Number.isFinite(at) && nowMs / 1000 - at <= RECOVERY_WINDOW_SECONDS && at <= nowMs / 1000 + 60;
    });
  } catch {
    return false;
  }
}
