/**
 * 사업자 정보의 단일 출처. 푸터·법적 고지·결제 화면·메타데이터가 전부 여기서 읽는다.
 *
 * 출처: TOP100RUN site-config.ts (항목별 null + 누락 목록) + 오토사장 companyInfo.ts
 *       (자리표시자 노출 방지) 를 합치고, 두 곳 모두 빠뜨린 호스팅 제공자와
 *       공정위 사업자정보 공개 링크(전자상거래법 시행규칙 제7조②)를 더했다.
 *
 * ── 절대 규칙: 값을 지어내지 않는다 ──
 *  모르는 값은 null 로 둔다. null 인 항목은 화면에서 빠지고, 필수 항목이 하나라도 null 이면
 *  법적 고지 페이지에 초안 배너가 뜬다. 다른 프로젝트의 번호를 복사해 오면 허위 표시다.
 *  같은 사업자가 운영한다는 사실을 확인한 경우에만 같은 값을 쓴다.
 *
 * 페어그라운드: 운영 사업자 정보를 아직 받지 못했다. 이메일 외 모든 항목은 null 이다 (2026-10-15).
 *
 * 근거: 전자상거래법 제10조① + 시행령 제11조의4 — 초기화면에 상호·대표자·주소·전화·이메일·
 *       사업자등록번호·약관·호스팅 제공자 상호 표시. 통신판매업 신고번호는 제13조①3 (면제 시 생략).
 */
export interface BusinessField {
  label: string;
  value: string | null;
  /** 법적 표시 의무 항목인가. false 면 비어 있어도 초안 배너를 띄우지 않는다. */
  required: boolean;
}

export const BUSINESS = {
  companyName: { label: "상호", value: null, required: true },
  representative: { label: "대표자", value: null, required: true },
  /** 10자리. 비영리 단체는 고유번호(가운데 두 자리 80~89)로 대체하고 label 을 "고유번호" 로 바꾼다. */
  businessNumber: { label: "사업자등록번호", value: null, required: true },
  /** 직전 연도 거래 50회 미만이거나 간이과세자면 신고 면제 → null 로 두면 된다. */
  mailOrderNumber: { label: "통신판매업신고번호", value: null, required: false },
  /** 사업자등록증 기재 그대로. 축약·변형 금지 (Meta 비즈니스 인증이 대조한다). */
  address: { label: "주소", value: null, required: true },
  phone: { label: "전화", value: null, required: true },
  /** 2026-10-15 MX 레코드 확인(dig +short MX fairground-kor.com). site-config 의 SITE_CONTACT_EMAIL 과 같은 값. */
  email: { label: "이메일", value: "info@fairground-kor.com", required: true },
  /** 성명 또는 담당 부서. 개인정보 보호법 제30조①6. */
  privacyOfficer: { label: "개인정보 보호책임자", value: null, required: true },
  /** 호스팅 서비스 제공자 상호. 조사한 7개 프로젝트 모두 빠져 있었다. */
  hostingProvider: { label: "호스팅 제공자", value: null, required: true },
} satisfies Record<string, BusinessField>;

export type BusinessKey = keyof typeof BUSINESS;

const entries = Object.entries(BUSINESS) as [BusinessKey, BusinessField][];

/** 비어 있는 항목 전부. 배포 전 체크리스트로 쓴다. */
export const MISSING_BUSINESS_FIELDS = entries
  .filter(([, f]) => f.value === null)
  .map(([key, f]) => ({ key, label: f.label, required: f.required }));

/** 필수 항목이 하나라도 비면 법적 고지는 초안이다. */
export const BUSINESS_INFO_READY = MISSING_BUSINESS_FIELDS.every((f) => !f.required);

/** 화면에 표시할 항목만, 표시 순서대로. */
export function visibleBusinessFields(): { label: string; value: string }[] {
  return entries
    .filter(([, f]) => f.value !== null)
    .map(([, f]) => ({ label: f.label, value: f.value as string }));
}

/**
 * 사업자등록번호(및 고유번호) 검증숫자 확인.
 * 오토사장 원본 문서에 0 이 하나 더 붙은 11자리 오기가 실제로 있었다. 값을 넣을 때 반드시 통과시킬 것.
 */
export function isValidBusinessNumber(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 10) return false;
  const n = [...d].map(Number);
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = w.reduce((acc, weight, i) => acc + n[i] * weight, 0);
  sum += Math.floor((n[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === n[9];
}

/** 공정위 통신판매사업자 정보공개 페이지. 초기화면 연결 의무(시행규칙 제7조②). */
export function ftcBusinessInfoUrl(businessNumber: string | null): string | null {
  if (!businessNumber) return null;
  const digits = businessNumber.replace(/\D/g, "");
  return digits.length === 10 ? `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${digits}` : null;
}
