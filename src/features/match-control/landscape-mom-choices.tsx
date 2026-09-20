"use client";

import { useId, useRef } from "react";

/** Keep choices in the rotated dialog; a viewport-positioned portal cannot align here. */
export function LandscapeMomChoices({ value, onValueChange, options, disabled }: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled: boolean;
}) {
  const name = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  return (
    <details ref={detailsRef} className="rounded-md border">
      <summary
        ref={summaryRef}
        aria-disabled={disabled}
        className="min-h-11 cursor-pointer rounded-md px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        onClick={(event) => { if (disabled) event.preventDefault(); }}
      >
        {options.find((option) => option.value === value)?.label ?? "MOM 선수 또는 MOM 없음 선택"}
      </summary>
      <fieldset disabled={disabled} className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto overscroll-contain border-t p-2">
        <legend className="sr-only">최종 MOM 선택</legend>
        {options.map((option) => (
          <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-sm has-checked:border-primary has-checked:bg-primary/10">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => {
                onValueChange(option.value);
                if (detailsRef.current) detailsRef.current.open = false;
                summaryRef.current?.focus();
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    </details>
  );
}
