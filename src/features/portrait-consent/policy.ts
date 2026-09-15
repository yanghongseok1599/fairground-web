export const PORTRAIT_CONSENT_PATH = "/my/portrait-consent";
export const PORTRAIT_CONSENT_REQUIRED = "초상권·촬영물 활용에 동의해야 선수카드를 만들거나 수정할 수 있습니다.";
export const PORTRAIT_CONSENT_TEXT = "대회·행사 현장에서 촬영되는 사진·영상에 본인이 등장할 수 있으며, 해당 촬영물이 FairGround의 홍보·마케팅 목적(온라인 채널·광고·인쇄물 등 상업적 이용 포함)으로 기간과 횟수의 제한 없이 사용되는 것에 동의합니다. 이에 대해 별도의 대가나 초상권을 주장하지 않습니다.";

export function hasPortraitConsent(player: { portraitConsentAt?: number } | null | undefined): boolean {
  const at = player?.portraitConsentAt;
  return typeof at === "number" && Number.isFinite(at) && at > 0;
}

export function requirePortraitConsent(player: { portraitConsentAt?: number } | null | undefined): void {
  if (!hasPortraitConsent(player)) throw new Error(PORTRAIT_CONSENT_REQUIRED);
}

// Derive the outstanding action from this account, without duplicate notification jobs.
export function needsPortraitConsent(player: { portraitConsentAt?: number } | null | undefined): boolean {
  return Boolean(player) && !hasPortraitConsent(player);
}

export function consentReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u0020]/.test(raw)) return "/my";
  const url = new URL(raw, "https://fairground.invalid");
  if (url.origin !== "https://fairground.invalid" || url.pathname === PORTRAIT_CONSENT_PATH) return "/my";
  return `${url.pathname}${url.search}${url.hash}`;
}
