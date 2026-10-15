"use client";

import { useId } from "react";
import { PORTRAIT_CONSENT_ITEM } from "../policy";

/** [선택] 초상 홍보 이용 동의 체크박스. 체크하지 않아도 선수카드·대회 신청은 그대로 진행된다. */
export function PortraitConsentField({ checked, onChange, disabled = false }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const notice = PORTRAIT_CONSENT_ITEM.notice;
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4 text-foreground">
      {notice ? (
        <dl id={`${id}-details`} className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-[13px] leading-relaxed text-muted-foreground">
          <dt className="font-bold">목적</dt><dd>{notice.purpose}</dd>
          <dt className="font-bold">항목</dt><dd>{notice.items}</dd>
          <dt className="font-bold">보유기간</dt><dd>{notice.retention}</dd>
          <dt className="font-bold">거부권</dt><dd>{notice.refusal}</dd>
        </dl>
      ) : null}
      <label htmlFor={id} className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
          disabled={disabled} aria-describedby={`${id}-details`} className="h-5 w-5 shrink-0 accent-[var(--primary)]" />
        [선택] {PORTRAIT_CONSENT_ITEM.label}
      </label>
    </div>
  );
}
