/**
 * 페어그라운드 이용약관. 키트 termsSections 골격 + 이 서비스의 사실 (2026-10-15).
 *  - sellsOnline: 대회·리그 참가비를 계좌이체로 받는다 (src/lib/entry-fee.ts, /admin/entry-fees).
 *  - hasUserContent: 게시판·팀 채팅·팀 갤러리·선수카드 사진을 이용자가 올린다.
 * 문구를 바꾸면 version 을 올리고 legal_documents 마이그레이션을 추가한다.
 */
import { termsSections } from "@/content/terms";
import { markPendingSections, type LegalDocument } from "@/lib/legal-document";

const sections = termsSections({
  serviceName: "페어그라운드(FairGround)",
  sellsOnline: true,
  hasSubscription: false,
  hasUserContent: true,
  jurisdiction: null,
});

// 셀프 탈퇴 화면이 아직 없다 (2026-10-15). 없는 기능을 약관에 적지 않는다.
const signup = sections.find((s) => s.heading === "제3조 회원가입과 탈퇴");
if (signup) signup.body = signup.body.map((line) => line.startsWith("회원은 언제든지 마이페이지에서 직접 탈퇴")
  ? "회원은 언제든지 탈퇴를 요청할 수 있습니다. 고객 문의 이메일로 요청하면 지체 없이 처리하며, 탈퇴 절차는 가입 절차보다 복잡하지 않게 운영합니다."
  : line);

const liability = sections.findIndex((s) => s.heading === "책임의 제한");
sections.splice(liability, 0, {
  heading: "선수카드와 경기 기록",
  body: [
    "리그 운영을 위해 회원의 이름, 등번호, 포지션, 소속 팀, 선수카드 사진, 경기 기록은 서비스 화면에 공개됩니다.",
    "선수카드 사진은 회원이 직접 올리며 언제든 바꾸거나 지울 수 있습니다.",
    "대회 사진·영상과 선수카드 이미지를 서비스 밖의 홍보에 쓰는 것은 별도의 [선택] 동의를 받은 경우에만 하며, 회원은 그 동의를 언제든 철회할 수 있습니다.",
  ],
});

export const TERMS_DOCUMENT: LegalDocument = markPendingSections({
  kind: "terms",
  title: "페어그라운드(FairGround) 이용약관",
  version: "2026-10-15",
  effectiveAt: null, // 시행일은 운영자가 정한다.
  sections,
});
