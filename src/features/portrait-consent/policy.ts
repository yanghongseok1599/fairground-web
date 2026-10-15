import type { ConsentItem } from "@/components/consent-checklist";
import { portraitPublicityConsent } from "@/content/consents";
import { internalReturnPath } from "@/lib/internal-return-path";
import { consentDocument } from "@/lib/legal-document";
import { SITE_CONTACT_EMAIL } from "@/lib/site-config";

/**
 * 초상권 — 대회 사진·영상과 선수카드 이미지의 **홍보** 이용 동의. [선택].
 *
 * 2026-10-15 개정 전 문구는 "기간과 횟수의 제한 없이 … 상업적 이용 포함 … 초상권을 주장하지 않습니다" 였고
 * 가입·선수카드·대회 신청의 필수 조건이었다. 기간 없는 포괄 허락과 권리 포기 문구는 약관법상 무효 위험이 크고,
 * 홍보 공표를 참가 조건에 묶는 것은 개인정보 보호법 제22조(목적별 구분·선택 거부 보장) 위반이다.
 *
 * 나눈 기준:
 *  - 서비스 자체 — 선수카드(이름·등번호·사진)와 경기 기록을 리그 화면에 보여주는 것. 이용약관·처리방침으로 고지하고
 *    동의를 조건으로 삼지 않는다. 사진은 본인이 올리고 언제든 바꾸거나 지운다.
 *  - 홍보 — 서비스 밖(SNS·인쇄물·협찬 제안서)에 쓰는 것. 이 동의가 있을 때만, 기간 안에서만.
 * 철회: record_my_consents 로 granted=false 행을 남기면 DB 가 profiles.portrait_consent_at 을 비운다.
 * 선수카드는 그대로 서비스에 남고, 운영진은 새 홍보 게시를 멈추고 기존 게시물을 내리거나 가린다.
 *
 * 문구를 바꾸면 PORTRAIT_CONSENT_VERSION 을 올리고 legal_documents 마이그레이션을 추가한다.
 */
export const PORTRAIT_CONSENT_PATH = "/my/portrait-consent";
export const PORTRAIT_CONSENT_VERSION = "2026-10-15";

const publicity = portraitPublicityConsent({
  channels: "페어그라운드 홈페이지·공식 SNS·홍보 인쇄물·협찬 제안서",
  period: "동의일부터 2년",
  withdrawal: `마이페이지의 초상권 동의 화면에서 철회하거나 ${SITE_CONTACT_EMAIL} 로 요청`,
});

export const PORTRAIT_CONSENT_ITEM: ConsentItem = {
  ...publicity,
  label: "대회 사진·영상과 선수카드 이미지 홍보 이용 동의",
  notice: publicity.notice && {
    ...publicity.notice,
    items: "대회 현장에서 촬영된 본인의 얼굴·모습이 담긴 사진과 영상, 본인의 선수카드 이미지",
  },
};

export const PORTRAIT_CONSENT_DOCUMENT = consentDocument("portrait", PORTRAIT_CONSENT_VERSION, PORTRAIT_CONSENT_ITEM);

/** 지금 홍보 이용에 동의한 상태인가. 철회하면 DB 가 시각을 비운다. */
export function hasPortraitConsent(player: { portraitConsentAt?: number } | null | undefined): boolean {
  const at = player?.portraitConsentAt;
  return typeof at === "number" && Number.isFinite(at) && at > 0;
}

export function consentReturnTo(raw: string | null): string {
  const target = internalReturnPath(raw);
  const url = new URL(target, "https://fairground.invalid");
  return url.pathname === PORTRAIT_CONSENT_PATH ? "/my" : target;
}
