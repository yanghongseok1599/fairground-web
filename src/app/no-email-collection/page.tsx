/**
 * 이메일 무단수집 거부. BusinessFooter 가 이 경로로 링크한다 (키트 app/no-email-collection).
 * 근거: 정보통신망법 제50조의2 — 웹사이트에서 자동화된 방법으로 전자우편 주소를 수집하는 행위 금지.
 */
import type { Metadata } from "next";
import { BUSINESS } from "@/lib/business-info";

export const metadata: Metadata = { title: "이메일무단수집거부", alternates: { canonical: "/no-email-collection" } };

export default function NoEmailCollectionPage() {
  const name = BUSINESS.companyName.value ?? "페어그라운드(FairGround)";
  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-5 pb-16 pt-[92px] text-sm leading-relaxed text-muted-foreground">
      <h1 className="text-2xl font-black text-foreground">이메일무단수집거부</h1>
      <p>
        {name}의 웹사이트에 게시된 전자우편 주소가 전자우편 수집 프로그램이나 그 밖의 기술적 장치로
        무단 수집되는 것을 거부합니다.
      </p>
      <p>이를 위반하면 정보통신망 이용촉진 및 정보보호 등에 관한 법률 제50조의2에 따라 처벌받을 수 있습니다.</p>
    </main>
  );
}
