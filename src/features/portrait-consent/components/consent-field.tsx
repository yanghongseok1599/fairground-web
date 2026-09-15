"use client";

import { useId } from "react";
import { PORTRAIT_CONSENT_TEXT } from "../policy";

export function PortraitConsentField({ checked, onChange, disabled = false }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4 text-foreground">
      <p id={`${id}-details`} className="text-[13px] leading-relaxed text-muted-foreground">{PORTRAIT_CONSENT_TEXT}</p>
      <label htmlFor={id} className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
          disabled={disabled} required aria-describedby={`${id}-details`} className="h-5 w-5 shrink-0 accent-[var(--primary)]" />
        [필수] 초상권·촬영물 활용에 동의합니다
      </label>
    </div>
  );
}
