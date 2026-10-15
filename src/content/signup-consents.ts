/**
 * 가입 동의 목록. 가입 화면·소셜 가입 완료 화면(ConsentChecklist)과 DB 기록이 같은 배열을 쓴다.
 * 그래서 화면에 보인 문구와 기록된 문구 버전이 어긋날 수 없다.
 *
 * 마케팅 수신 동의는 없다 — 광고성 정보를 보내는 기능이 없다 (2026-10-15 코드 기준).
 * 광고성 메시지(푸시 포함)를 보내기 시작하면 content/consents.ts 의 marketingConsent 를 [선택] 으로 추가한다.
 *
 * 문구를 바꾸면 CONSENT_VERSION 을 올리고, 바뀐 문서를 legal_documents 에 넣는 마이그레이션을 추가한다.
 */
import { AGE14_CONFIRM, TERMS_CONSENT, privacyCollectionConsent } from "@/content/consents";
import { PRIVACY_DOCUMENT } from "@/content/legal/privacy";
import { TERMS_DOCUMENT } from "@/content/legal/terms";
import { PORTRAIT_CONSENT_DOCUMENT, PORTRAIT_CONSENT_ITEM } from "@/features/portrait-consent/policy";
import { consentDocument } from "@/lib/legal-document";
import type { ConsentEntry } from "@/lib/record-consents";

export const CONSENT_VERSION = "2026-10-15";

const AGE14_DOCUMENT = consentDocument("age14", CONSENT_VERSION, AGE14_CONFIRM);
const RETENTION = "회원 탈퇴 시까지 (법령에 따라 보관하는 기록은 개인정보처리방침에 따름)";

function signupConsents(collected: string): ConsentEntry[] {
  return [
    { item: AGE14_CONFIRM, document: AGE14_DOCUMENT },
    { item: TERMS_CONSENT, document: TERMS_DOCUMENT },
    { item: privacyCollectionConsent({ items: collected, retention: RETENTION }), document: PRIVACY_DOCUMENT },
    { item: PORTRAIT_CONSENT_ITEM, document: PORTRAIT_CONSENT_DOCUMENT },
  ];
}

export const EMAIL_SIGNUP_CONSENTS = signupConsents(
  "이름(실명), 이메일 또는 아이디, 비밀번호(암호화 저장), 전화번호, 성별, 생년월일, 선수 등록 이력(선출 여부)",
);

/** 카카오·Google 가입, 그리고 동의 기록이 없는 기존 회원이 /auth/complete 에서 받는다. */
export const ACCOUNT_COMPLETION_CONSENTS = signupConsents(
  "카카오·Google 계정 식별자, 이메일, 이름 또는 닉네임 (이메일 가입 회원은 가입 때 입력한 정보)",
);

/** legal_documents 에 시드한 문서. tests/site-essentials.test.mjs 가 마이그레이션의 해시와 대조한다. */
export const SEEDED_LEGAL_DOCUMENTS = [AGE14_DOCUMENT, TERMS_DOCUMENT, PRIVACY_DOCUMENT, PORTRAIT_CONSENT_DOCUMENT];
