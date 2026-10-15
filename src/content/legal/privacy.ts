/**
 * 페어그라운드 개인정보처리방침. 키트의 buildPrivacyPolicy 틀에 **코드로 확인한 사실만** 채운다 (2026-10-15).
 *
 * 근거 위치 (항목을 바꾸기 전에 다시 확인할 것):
 *  - 가입 항목: src/app/register/page.tsx, public.handle_new_user (raw_user_meta_data)
 *  - 소셜 로그인: src/stores/authStore.ts startOAuthSignIn (google, kakao)
 *  - 선수카드·사진: src/app/my/player-setup, public.profiles(photo_url, profile_photo_url)
 *  - 팀 신청 알림: supabase/migrations/20260827010000_telegram_notify_new_team.sql (팀명·대표 이름·연락처 → Telegram)
 *  - 웹 푸시: public.push_subscriptions, supabase/functions/push-dispatch
 *  - 대회 사진 원본: src/features/photo-library/model.ts (Google Drive)
 *  - 안경 착용 동의서: public.glasses_waivers · 현장 확인: public.player_inspections
 *
 * 문구를 한 글자라도 바꾸면 version 을 올리고, 새 버전을 legal_documents 에 넣는 마이그레이션을 추가한다.
 * tests/site-essentials.test.ts 가 마이그레이션에 넣은 해시와 이 문서의 해시를 대조한다.
 */
import { buildPrivacyPolicy, ECOMMERCE_RETENTION } from "@/content/privacy-policy";
import { markPendingSections } from "@/lib/legal-document";

export const PRIVACY_DOCUMENT = markPendingSections(buildPrivacyPolicy({
  serviceName: "페어그라운드(FairGround)",
  version: "2026-10-15.2", // .2: 참가비 납부 기록 분리 보관 명시 (20261015030000)
  effectiveAt: null, // 시행일은 운영자가 정한다. 정해지기 전까지 초안으로 표시된다.
  processing: [
    {
      purpose: "회원 가입·식별·관리",
      items: "[이메일 가입] 이름(실명), 이메일 또는 아이디, 비밀번호(일방향 암호화 저장), 전화번호, 성별, 생년월일, 선수 등록 이력(선출 여부) / [카카오·Google 가입] 계정 식별자, 이메일, 이름 또는 닉네임",
      retention: "회원 탈퇴 시까지",
      basis: "계약 이행",
    },
    {
      purpose: "만 14세 이상 확인",
      items: "생년월일, 만 14세 이상 확인 여부",
      retention: "회원 탈퇴 시까지",
      basis: "법령",
    },
    {
      purpose: "대회 참가 자격 확인, 선수 등록, 현장 참가자 확인",
      items: "이름, 성별, 생년월일, 선수 등록 이력(선출 여부), 소속 팀, 현장 확인 기록, 안경 착용 경기 참가 동의서(서명자 이름, 동의 문서 버전, 서명 일시)",
      retention: "회원 탈퇴 시까지",
      basis: "계약 이행",
    },
    {
      purpose: "선수카드 제작과 리그 기록 공개 (이름, 등번호, 포지션, 소속 팀, 선수카드 사진, 경기 기록이 사이트에 공개됩니다. 사진은 본인이 올린 경우에만 쓰며 언제든 바꾸거나 지울 수 있습니다)",
      items: "이름, 등번호, 포지션, 국적, 소속 팀, 선수카드 사진, 경기 기록(득점·도움·경고 등)",
      retention: "회원 탈퇴 시까지",
      basis: "계약 이행",
    },
    {
      purpose: "팀·대회 참가 신청 접수와 참가비 입금 확인",
      items: "팀명, 대표자 이름·연락처, 참가비 청구 금액·입금 여부",
      retention: "팀 또는 대회 정보가 삭제될 때까지. 납부(일부 납부 포함) 기록은 아래 법정 보관 기록으로 5년간 분리 보관",
      basis: "계약 이행",
    },
    {
      purpose: "게시판·팀 채팅·팀 갤러리·팀 회비 관리 등 커뮤니티 기능 제공",
      items: "게시물, 댓글, 채팅 내용, 올린 사진, 팀 회비 납부 기록",
      retention: "게시물을 지우거나 회원 탈퇴 시까지",
      basis: "계약 이행",
    },
    {
      purpose: "경기·대회 알림 발송 (웹 푸시, 이용자가 알림을 켠 경우)",
      items: "푸시 구독 정보(엔드포인트, 암호화 키), 브라우저 정보",
      retention: "알림을 끄거나 회원 탈퇴 시까지",
      basis: "동의",
    },
    {
      purpose: "[선택] 대회 사진·영상과 선수카드 이미지의 홍보 이용 (동의한 경우에만)",
      items: "대회 현장에서 촬영된 본인의 사진·영상, 선수카드 이미지",
      retention: "동의일부터 2년. 철회하면 새로 게시하지 않고 게시물을 내리거나 가립니다",
      basis: "동의",
    },
    {
      purpose: "동의 이력 보관 (어떤 문구에 언제 동의·철회했는지의 증빙)",
      items: "동의 항목, 문구 버전, 동의·철회 여부와 일시, 브라우저 정보",
      retention: "[확정 필요] 탈퇴 후 보관 기간",
      basis: "법령",
    },
    {
      purpose: "문의 응대",
      items: "이메일 주소, 문의 내용",
      retention: "소비자 불만·분쟁 처리 기록 3년 (전자상거래법)",
      basis: "계약 이행",
    },
  ],
  // 대금결제 기록: 팀·대회를 지워도 참가비 납부 기록은 별도 보관함(entry_fee_payment_records)에 남는다.
  legalRetention: ECOMMERCE_RETENTION.map((r) => r.record.startsWith("대금결제") ? {
    record: "참가비 납부 기록 — 대회명, 팀명, 신청 대표자 이름, 금액, 납부 상태·일시, 입금 메모 (팀·대회가 삭제되면 삭제 시점의 내용을 운영 데이터와 분리된 별도 보관함에 옮겨 보관하고, 보관 목적 외에는 이용하지 않습니다)",
    period: "납부일부터 5년",
    basis: r.basis,
  } : r),
  thirdParties: [],
  processors: [
    { name: "Supabase Inc.", task: "회원 인증, 데이터베이스·파일 저장 (데이터베이스 서버: 서울 리전)" },
    { name: "Vercel Inc.", task: "웹사이트 호스팅과 요청 처리" },
    { name: "Telegram Messenger Inc.", task: "새 팀 참가 신청을 운영진에게 알리는 메시지 전송" },
    { name: "Google LLC", task: "대회 사진 원본 저장(Google Drive), Google 로그인" },
    { name: "(주)카카오", task: "카카오 로그인, 카카오톡 공유" },
  ],
  overseas: [
    {
      recipient: "Vercel Inc.", country: "미국", contact: "[확정 필요] 연락처",
      items: "접속 기록(IP 주소, 브라우저 정보), 이용 중 주고받는 정보",
      timing: "사이트를 이용할 때마다", method: "네트워크를 통한 전송",
      purpose: "웹사이트 호스팅", retention: "위탁 계약 종료 시까지",
    },
    {
      recipient: "Telegram Messenger Inc.", country: "[확정 필요] 국가", contact: "[확정 필요] 연락처",
      items: "팀명, 대표자 이름·연락처",
      timing: "팀 참가 신청 시", method: "네트워크를 통한 전송",
      purpose: "운영진 신청 알림", retention: "[확정 필요] 운영진 대화방 보관 기간",
    },
    {
      recipient: "Google LLC", country: "미국", contact: "[확정 필요] 연락처",
      items: "대회 현장 사진 원본(얼굴이 담긴 사진 포함)",
      timing: "사진 자료실 게시 시", method: "네트워크를 통한 전송",
      purpose: "사진 원본 저장과 내려받기 제공", retention: "자료실 게시 종료 시까지",
    },
    {
      recipient: "웹 푸시 서비스 (Google·Apple·Mozilla 등 이용자 브라우저 제조사)", country: "미국 등", contact: "각 브라우저 제조사",
      items: "푸시 구독 정보, 알림 내용",
      timing: "알림 발송 시", method: "네트워크를 통한 전송",
      purpose: "웹 푸시 알림 전달", retention: "전달 후 각 서비스 정책에 따름",
    },
  ],
  usesCookies: false, // 로그인 상태는 브라우저 저장소(localStorage)에 보관한다. 분석·광고 추적 도구 없음 (2026-10-15 코드 기준).
  acceptsUnder14: false,
  usesAiOnUserInput: false,
}));
