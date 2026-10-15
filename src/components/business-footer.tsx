/**
 * 사업자 정보 + 법적 고지 링크. 모든 페이지에 렌더한다 (키트 business-footer).
 * 비어 있는(null) 항목은 표시하지 않는다 — 다른 사업자의 번호를 쓰면 허위 표시다. src/lib/business-info.ts 참고.
 */
import Link from "next/link";
import { BUSINESS, ftcBusinessInfoUrl, visibleBusinessFields } from "@/lib/business-info";

export function BusinessFooter({ className = "" }: { className?: string }) {
  const fields = visibleBusinessFields();
  const ftcUrl = ftcBusinessInfoUrl(BUSINESS.businessNumber.value);

  return (
    <div className={`space-y-2 text-[12px] leading-relaxed text-muted-foreground ${className}`}>
      {fields.length > 0 ? (
        <p>
          {fields.map((f, i) => (
            <span key={f.label}>
              {i > 0 ? <span aria-hidden="true"> · </span> : null}
              {f.label} {f.value}
            </span>
          ))}
          {ftcUrl ? (
            <>
              <span aria-hidden="true"> · </span>
              <a href={ftcUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">사업자정보확인</a>
            </>
          ) : null}
        </p>
      ) : null}
      <nav aria-label="법적 고지" className="flex flex-wrap gap-x-3 gap-y-1">
        <Link href="/terms" className="hover:text-foreground">이용약관</Link>
        {/* 처리방침은 다른 링크와 구별되게 강조하는 것이 작성지침 권고다. */}
        <Link href="/privacy" className="font-bold text-foreground">개인정보처리방침</Link>
        <Link href="/refund" className="hover:text-foreground">환불정책</Link>
        <Link href="/no-email-collection" className="hover:text-foreground">이메일무단수집거부</Link>
      </nav>
    </div>
  );
}
