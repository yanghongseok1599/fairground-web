/**
 * 가입·신청 시 받는 개별 동의 문구. ConsentChecklist 의 items 로 그대로 들어간다.
 *
 * 원칙: 목적이 다른 동의는 따로 받는다 (제22조①). 아래 세 가지는 조사에서 묶이거나 강제된 사례가 있었다.
 */
import type { ConsentItem } from "@/components/consent-checklist";

/**
 * 초상권 — 홍보 공표는 반드시 [선택] 으로 분리한다.
 *
 * TOP100RUN 은 촬영과 홍보 공표를 하나의 [필수] 동의로 묶었고, 페어그라운드는 "기간과 횟수의
 * 제한 없이 … 초상권을 주장하지 않습니다" 문구에 철회를 DB 가 막고 있었다. 둘 다 고친다.
 *  - 찍히는 것과 공개되는 것은 다르다. 촬영 동의는 공표 동의가 아니다 (대법원 2010다103185).
 *  - 기간 없는 이용 허락은 무제한 허락으로 해석되지 않는다.
 *  - 공표가 동의 범위 안이었다는 입증책임은 공표한 쪽에 있다 → 동의 기록을 남긴다.
 */
export function portraitPublicityConsent(o: { channels: string; period: string; withdrawal: string }): ConsentItem {
  return {
    key: "portrait", label: "행사 사진·영상 홍보 이용 동의", required: false,
    notice: {
      purpose: `행사 기록과 홍보 (${o.channels}). 상업 광고에는 별도 동의 없이 쓰지 않습니다.`,
      items: "행사 중 촬영된 본인의 얼굴·모습이 담긴 사진과 영상",
      retention: `${o.period}. 이후 새로 게시하지 않으며, 철회하시면 지체 없이 게시물을 내리거나 가립니다.`,
      refusal: `동의하지 않아도 참가할 수 있습니다. 철회 방법: ${o.withdrawal}`,
    },
  };
}

/**
 * 마케팅 수신 — [선택], 채널 명시, 야간 별도.
 * 오토사장은 이 값을 서버에서 true 로 고정 저장했고, TOP100RUN 은 토글 기본값이 켜짐이었다.
 * 정보통신망법 제50조: 사전 명시 동의, 21~08시 전송은 별도 동의, 2년마다 수신동의 여부 확인.
 */
export function marketingConsent(o: { channels: string }): ConsentItem {
  return {
    key: "marketing", label: `광고성 정보 수신 동의 (${o.channels})`, required: false,
    notice: {
      purpose: "새 행사·강의·혜택 안내",
      items: "이름, 연락처",
      retention: "동의 철회 또는 회원 탈퇴 시까지. 2년마다 수신 동의 여부를 다시 확인합니다.",
      refusal: "동의하지 않아도 모든 서비스를 이용할 수 있습니다. 마이페이지나 수신거부 링크로 언제든 철회할 수 있습니다.",
    },
  };
}

export const NIGHT_MARKETING_CONSENT: ConsentItem = {
  key: "marketing_night", label: "야간(21시~다음 날 8시) 광고성 정보 수신 동의", required: false,
};

/**
 * 만 14세 이상 확인. 만 14세 미만을 받지 않는 서비스라면 이것으로 충분하다.
 * 받는다면 법정대리인 동의와 그 확인 절차가 필요하다 (제22조의2, 시행령 제17조의2) — 이 키트 범위 밖.
 */
export const AGE14_CONFIRM: ConsentItem = { key: "age14", label: "만 14세 이상입니다", required: true };

export const TERMS_CONSENT: ConsentItem = { key: "terms", label: "이용약관 동의", required: true, href: "/terms" };

export function privacyCollectionConsent(o: { items: string; retention: string }): ConsentItem {
  return {
    key: "privacy", label: "개인정보 수집·이용 동의", required: true, href: "/privacy",
    notice: {
      purpose: "회원 식별, 서비스 제공, 문의 응대",
      items: o.items,
      retention: o.retention,
      refusal: "동의를 거부할 수 있으나, 거부하시면 회원가입을 할 수 없습니다.",
    },
  };
}
