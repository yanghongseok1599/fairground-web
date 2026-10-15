/**
 * 개인정보처리방침 생성기.
 *
 * 순서와 항목: 개인정보 보호법 제30조① + 시행령 제31조① 을 개인정보보호위원회
 * 「개인정보 처리방침 작성지침」(2026.4. 개정) 순서로 배치. 오토사장 app/privacy/page.tsx 가
 * 조사에서 유일하게 필수 항목을 모두 갖춘 문서였고, 그 구성을 따랐다.
 *
 * 이 파일은 **틀**이다. 문구를 복사해 쓰는 게 아니라 config 에 그 서비스의 사실을 채운다.
 * 다른 프로젝트의 처리방침을 베끼면 수집하지도 않는 항목, 쓰지도 않는 위탁사가 적힌
 * 거짓 고지가 된다. 비어 있는 칸은 pending 으로 표시되고 초안 배너가 뜬다.
 *
 * 미게시·미공개 과태료: 1천만원 이하 (제75조④8호).
 * (깃허브의 유명 템플릿 kimlawtech/korean-privacy-terms 는 5천만원이라고 적고 있는데 틀렸다.)
 */
import { BUSINESS } from "@/lib/business-info";
import type { LegalDocument, LegalSection } from "@/lib/legal-document";

export interface PrivacyPolicyConfig {
  serviceName: string;
  version: string;
  effectiveAt: string | null;
  /** 처리 목적별로 한 줄. 목적·항목·기간이 한 줄에 묶여야 이용자가 대응 관계를 안다. */
  processing: { purpose: string; items: string; retention: string; basis: "동의" | "계약 이행" | "법령" }[];
  /** 법령에 따라 탈퇴 후에도 보관하는 기록. 전자상거래를 하면 최소 아래 3개가 들어간다. */
  legalRetention: { record: string; period: string; basis: string }[];
  thirdParties: { recipient: string; purpose: string; items: string; retention: string }[];
  processors: { name: string; task: string }[];
  /** Supabase·Vercel·Resend 등 해외 서버를 쓰면 대부분 해당한다. 조사에서 가장 많이 빠진 항목. */
  overseas: { recipient: string; country: string; items: string; timing: string; method: string; purpose: string; retention: string; contact: string }[];
  usesCookies: boolean;
  acceptsUnder14: boolean;
  usesAiOnUserInput: boolean;
}

/** 전자상거래법 시행령 제6조. 유료 판매가 있으면 이 기본값을 그대로 넣는다. */
export const ECOMMERCE_RETENTION = [
  { record: "계약 또는 청약철회 등에 관한 기록", period: "5년", basis: "전자상거래법 시행령 제6조" },
  { record: "대금결제 및 재화 등의 공급에 관한 기록", period: "5년", basis: "전자상거래법 시행령 제6조" },
  { record: "소비자의 불만 또는 분쟁처리에 관한 기록", period: "3년", basis: "전자상거래법 시행령 제6조" },
  { record: "표시·광고에 관한 기록", period: "6개월", basis: "전자상거래법 시행령 제6조" },
  { record: "웹사이트 방문 기록(접속 로그)", period: "3개월", basis: "통신비밀보호법 시행령 제41조" },
];

const pending = (text: string) => `[확정 필요] ${text}`;

export function buildPrivacyPolicy(c: PrivacyPolicyConfig): LegalDocument {
  const controller = BUSINESS.companyName.value ?? pending("상호");
  const officer = BUSINESS.privacyOfficer.value;
  const officerContact = BUSINESS.email.value;
  const s: LegalSection[] = [];

  s.push({
    heading: "개인정보의 처리 목적, 항목, 보유기간",
    pending: c.processing.length === 0,
    body: c.processing.length
      ? c.processing.map((p) => `${p.purpose} — 항목: ${p.items} / 보유기간: ${p.retention} / 근거: ${p.basis}`)
      : [pending("처리 목적별 항목과 보유기간")],
  });

  s.push({
    heading: "개인정보의 파기 절차 및 방법",
    pending: c.legalRetention.length === 0 && c.processing.some((p) => p.basis === "계약 이행"),
    body: [
      "보유기간이 지나거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.",
      "전자적 파일은 복구할 수 없는 방법으로 삭제하고, 종이 문서는 분쇄하거나 소각합니다.",
      ...(c.legalRetention.length
        ? ["다만 아래 기록은 법령에 따라 별도로 분리해 보관한 뒤 기간이 지나면 파기합니다.",
           ...c.legalRetention.map((r) => `${r.record}: ${r.period} (${r.basis})`)]
        : []),
    ],
  });

  s.push({
    heading: "개인정보의 제3자 제공",
    body: c.thirdParties.length
      ? c.thirdParties.map((t) => `${t.recipient} — 목적: ${t.purpose} / 항목: ${t.items} / 보유기간: ${t.retention}`)
      : [`${c.serviceName}은(는) 이용자의 개인정보를 제3자에게 제공하지 않습니다. 법령에 특별한 규정이 있는 경우는 예외입니다.`],
  });

  if (c.processors.length) {
    s.push({
      heading: "개인정보 처리업무의 위탁",
      body: [
        ...c.processors.map((p) => `${p.name}: ${p.task}`),
        "위탁계약 시 개인정보 보호 관련 법령 준수, 재위탁 제한, 안전성 확보조치, 손해배상 책임을 계약서에 명시하고 수탁자를 관리·감독합니다.",
      ],
    });
  }

  if (c.overseas.length) {
    s.push({
      heading: "개인정보의 국외 이전",
      body: [
        ...c.overseas.map((o) =>
          `${o.recipient} (${o.country}, 연락처 ${o.contact}) — 항목: ${o.items} / 시기·방법: ${o.timing}, ${o.method} / 목적: ${o.purpose} / 보유기간: ${o.retention}`),
        "국외 이전을 원하지 않으시면 회원 탈퇴로 거부할 수 있습니다. 다만 서비스 제공에 필수적인 이전이므로 거부 시 서비스 이용이 어렵습니다.",
      ],
    });
  }

  s.push({
    heading: "정보주체와 법정대리인의 권리·의무 및 행사방법",
    body: [
      "이용자는 언제든지 개인정보의 열람·정정·삭제·처리정지 및 동의 철회를 요구할 수 있습니다.",
      "마이페이지에서 직접 처리하거나 아래 개인정보 보호책임자에게 서면·이메일로 요청할 수 있으며, 지체 없이 조치합니다.",
      ...(c.acceptsUnder14 ? ["만 14세 미만 아동의 법정대리인은 아동의 개인정보에 대해 같은 권리를 행사할 수 있습니다."] : []),
    ],
  });

  s.push({
    heading: "개인정보의 안전성 확보조치",
    body: [
      "관리적 조치: 내부관리계획 수립·시행, 개인정보 취급자 최소화 및 정기 교육.",
      "기술적 조치: 접근권한 관리와 접근통제, 비밀번호 일방향 암호화 저장, 전송 구간 암호화(TLS), 접속기록 보관 및 위·변조 방지.",
      "물리적 조치: 클라우드 서비스 수탁자의 물리적 보안 통제를 계약으로 확인합니다.",
    ],
  });

  s.push(c.usesCookies
    ? { heading: "개인정보 자동 수집 장치의 설치·운영 및 거부", body: [
        "로그인 유지와 이용 환경 개선을 위해 쿠키를 사용합니다.",
        "브라우저 설정에서 쿠키 저장을 거부할 수 있습니다. 거부하면 로그인이 필요한 기능을 이용하기 어렵습니다.",
      ] }
    : { heading: "개인정보 자동 수집 장치의 설치·운영 및 거부", body: ["로그인 유지에 필요한 쿠키 외에 행태정보를 수집하는 장치를 사용하지 않습니다."] });

  if (c.usesAiOnUserInput) {
    s.push({
      heading: "생성형 AI 이용",
      pending: true,
      // 개인정보 처리방침 작성지침 2026.4. 신설 부록.
      body: [pending("입력 정보 저장 여부, 모델 학습 이용 여부, 학습 제외 요청 방법")],
    });
  }

  s.push({
    heading: "개인정보 보호책임자",
    pending: !officer || !officerContact,
    body: [
      `처리자: ${controller}`,
      `개인정보 보호책임자: ${officer ?? pending("성명 또는 담당 부서")}`,
      `연락처: ${officerContact ?? pending("이메일 또는 전화")}`,
    ],
  });

  s.push({
    heading: "권익침해 구제방법",
    body: [
      "개인정보분쟁조정위원회 1833-6972 (www.kopico.go.kr)",
      "개인정보침해신고센터 118 (privacy.kisa.or.kr)",
      "대검찰청 1301 (www.spo.go.kr) · 경찰청 182 (ecrm.police.go.kr)",
    ],
  });

  s.push({
    heading: "처리방침의 변경",
    pending: c.effectiveAt === null,
    body: [
      `이 처리방침은 ${c.effectiveAt ?? pending("시행일")}부터 적용됩니다.`,
      "내용을 바꿀 때는 시행 7일 전부터, 이용자 권리에 중요한 변경은 30일 전부터 공지합니다. 이전 버전은 아래에서 열람할 수 있습니다.",
    ],
  });

  return { kind: "privacy", title: `${c.serviceName} 개인정보처리방침`, version: c.version, effectiveAt: c.effectiveAt, sections: s };
}
