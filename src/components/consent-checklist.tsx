"use client";

/**
 * 가입·결제·신청 동의 체크리스트.
 *
 * 출처: adding-korean-site-essentials 키트 (트레이너마일스톤 checkout + 동해AI사장단 신청 폼).
 *
 * 법적 요건 (개인정보 보호법 제15조②, 제22조①⑤):
 *  - 필수와 선택을 **구분**해서 받는다. 하나의 체크박스로 묶지 않는다.
 *  - 선택 항목을 거부해도 서비스를 거절하지 않는다. → 버튼 활성 조건은 필수 항목만 본다.
 *  - 동의마다 목적·항목·보유기간·거부권과 불이익을 알린다.
 *  - 전체동의는 편의 기능일 뿐이다. 누르면 선택 항목까지 체크되지만, 하나씩 해제할 수 있어야 한다.
 *
 * 여기서 받은 값은 반드시 DB 의 consent_records 에 기록한다 (src/lib/record-consents.ts).
 */
import { useId } from "react";

export interface ConsentItem {
  key: string;
  label: string;
  required: boolean;
  /** 개인정보 수집·이용 동의라면 4가지를 채운다. 약관 동의처럼 해당 없으면 비운다. */
  notice?: { purpose: string; items: string; retention: string; refusal: string };
  /** 전문 보기 링크 (/terms, /privacy 등). */
  href?: string;
}

export function ConsentChecklist({
  items, value, onChange, disabled = false,
}: {
  items: ConsentItem[];
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  disabled?: boolean;
}) {
  const groupId = useId();
  const allChecked = items.every((i) => value[i.key]);
  const setAll = (checked: boolean) => onChange(Object.fromEntries(items.map((i) => [i.key, checked])));

  return (
    <fieldset aria-describedby={`${groupId}-desc`} disabled={disabled} className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4 text-foreground">
      <legend className="px-1 text-sm font-bold">약관 동의</legend>
      <p id={`${groupId}-desc`} className="text-xs leading-relaxed text-muted-foreground">
        [필수] 항목에 모두 동의해야 진행할 수 있습니다. [선택] 항목은 동의하지 않아도 이용할 수 있습니다.
      </p>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-border pb-3 text-sm">
        <input type="checkbox" checked={allChecked} onChange={(e) => setAll(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--primary)]" />
        <span><strong>전체 동의</strong> (선택 항목 포함)</span>
      </label>

      {items.map((item) => (
        <div key={item.key} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(value[item.key])}
                onChange={(e) => onChange({ ...value, [item.key]: e.target.checked })}
                aria-required={item.required}
                className="h-5 w-5 shrink-0 accent-[var(--primary)]"
              />
              <span>[{item.required ? "필수" : "선택"}] {item.label}</span>
            </label>
            {item.href ? (
              <a href={item.href} target="_blank" rel="noopener" className="inline-flex min-h-11 shrink-0 items-center text-xs font-bold text-primary underline underline-offset-2">
                전문 보기
              </a>
            ) : null}
          </div>
          {item.notice ? (
            <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 rounded-xl bg-background px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <dt className="font-bold">목적</dt><dd>{item.notice.purpose}</dd>
              <dt className="font-bold">항목</dt><dd>{item.notice.items}</dd>
              <dt className="font-bold">보유기간</dt><dd>{item.notice.retention}</dd>
              <dt className="font-bold">거부권</dt><dd>{item.notice.refusal}</dd>
            </dl>
          ) : null}
        </div>
      ))}
    </fieldset>
  );
}

/** 버튼 활성 조건. 선택 항목은 보지 않는다. */
export function requiredConsentsGiven(items: ConsentItem[], value: Record<string, boolean>): boolean {
  return items.filter((i) => i.required).every((i) => value[i.key]);
}
