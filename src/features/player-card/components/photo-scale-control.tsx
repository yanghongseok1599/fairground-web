"use client";

import { useId } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { DEFAULT_CARD_PHOTO_SCALE } from "@/lib/player-profile-photo";

interface PhotoScaleControlProps {
  value: number;
  onChange: (scale: number) => void;
  disabled?: boolean;
}

/** Edit the existing photoScale value; the card preview and saved card use it directly. */
export function PhotoScaleControl({ value, onChange, disabled = false }: PhotoScaleControlProps) {
  const id = useId();
  // Match the portrait renderer's supported 50–250% range.
  const percent = Math.round(Math.min(2.5, Math.max(0.5,
    Number.isFinite(value) ? value : DEFAULT_CARD_PHOTO_SCALE,
  )) * 100);
  const changePercent = (next: number) => onChange(Math.min(250, Math.max(50, next)) / 100);
  const buttonClass = "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-fg-line-soft)] bg-[var(--color-fg-paper)] text-[var(--primary)] transition-colors hover:bg-[var(--color-fg-paper-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="mt-4 w-full rounded-2xl border border-[var(--color-fg-line-soft)] bg-[var(--color-fg-paper-2)] p-4" role="group" aria-labelledby={`${id}-label`}>
      <div className="flex items-center justify-between gap-3">
        <label id={`${id}-label`} htmlFor={id} className="text-sm font-bold text-[var(--color-fg-ink)]">카드 사진 크기</label>
        <output htmlFor={id} className="text-sm font-black tabular-nums text-[var(--primary)]">{percent}%</output>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className={buttonClass} disabled={disabled || percent <= 50} onClick={() => changePercent(percent - 10)} aria-label="카드 사진 축소">
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>
        <input id={id} type="range" min={50} max={250} step={1} value={percent}
          onChange={(event) => changePercent(Number(event.target.value))} disabled={disabled}
          aria-valuetext={`${percent}%`} aria-describedby={`${id}-help`}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40" />
        <button type="button" className={buttonClass} disabled={disabled || percent >= 250} onClick={() => changePercent(percent + 10)} aria-label="카드 사진 확대">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex justify-between px-[56px] text-[10px] tabular-nums text-[var(--color-fg-ink-muted)]" aria-hidden="true"><span>50%</span><span>250%</span></div>
      <p id={`${id}-help`} className="mt-2 text-xs leading-relaxed text-[var(--color-fg-ink-muted)]">미리보기를 보며 크기를 맞춘 뒤 아래에서 저장해주세요.</p>
      <button type="button" disabled={disabled || percent === Math.round(DEFAULT_CARD_PHOTO_SCALE * 100)}
        onClick={() => onChange(DEFAULT_CARD_PHOTO_SCALE)}
        className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-xs font-semibold text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-40">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />기본 크기로
      </button>
    </div>
  );
}
