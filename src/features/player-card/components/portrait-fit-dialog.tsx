"use client";

import { useEffect, useId, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UpperBodyPortrait } from "@/components/upper-body-portrait";
import { DEFAULT_HEAD_ADJUSTMENT, type HeadAdjustment } from "@/lib/player-card/head-geometry";
import type { PreparedPlayerPortrait } from "@/lib/player-card-photo-composer";

const CONTROLS = [
  { key: "scale", label: "얼굴 크기", min: 80, max: 125 },
  { key: "offsetX", label: "좌우 위치", min: -15, max: 15 },
  { key: "offsetY", label: "높이", min: -10, max: 10 },
] as const;

/** Local-only composition preview. Nothing is uploaded until the parent saves. */
export function PortraitFitDialog({ portrait, onConfirm, onCancel }: {
  portrait: PreparedPlayerPortrait;
  onConfirm: (photo: Blob) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [adjustment, setAdjustment] = useState<HeadAdjustment>(DEFAULT_HEAD_ADJUSTMENT);
  const [result, setResult] = useState<{ blob: Blob; url: string; adjustment: HeadAdjustment } | null>(null);
  const [error, setError] = useState("");
  const ready = result?.adjustment === adjustment && !error;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      portrait.render(adjustment).then(blob => {
        if (cancelled) return;
        setError("");
        setResult({ blob, url: URL.createObjectURL(blob), adjustment });
      }).catch(() => { if (!cancelled) setError("미리보기를 만들지 못했습니다. 다시 선택해주세요."); });
    }, 80);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [portrait, adjustment]);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto rounded-2xl p-5 sm:max-w-md">
        <DialogTitle className="pr-7">얼굴과 유니폼 맞추기</DialogTitle>
        <DialogDescription>목과 어깨가 자연스럽게 이어지는지 확인해주세요. 얼굴만 조절할 수 있어요.</DialogDescription>
        <div className="relative flex h-[min(38dvh,300px)] min-h-32 justify-center overflow-hidden rounded-xl bg-slate-100" aria-busy={!ready}>
          {result ? <UpperBodyPortrait src={result.url} alt="조절한 얼굴과 준타스 유니폼 미리보기" />
            : <span role="status" className="self-center text-sm text-slate-600">미리보기 준비 중…</span>}
        </div>
        <div className="space-y-2">
          {CONTROLS.map(control => (
            <div key={control.key}>
              <label htmlFor={`${id}-${control.key}`} className="flex justify-between text-sm font-medium">
                {control.label}<span className="tabular-nums text-muted-foreground">{Math.round(adjustment[control.key] * 100)}{control.key === "scale" ? "%" : ""}</span>
              </label>
              <input id={`${id}-${control.key}`} type="range" min={control.min} max={control.max} step={1}
                value={Math.round(adjustment[control.key] * 100)} className="h-9 w-full accent-[var(--primary)]"
                onChange={event => setAdjustment(current => ({ ...current, [control.key]: Number(event.target.value) / 100 }))} />
            </div>
          ))}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => setAdjustment({ ...DEFAULT_HEAD_ADJUSTMENT })}>자동 맞춤으로</Button>
          <Button type="button" disabled={!ready} onClick={() => { if (ready && result) onConfirm(result.blob); }}>이 사진 사용</Button>
        </div>
        <button type="button" className="min-h-10 text-sm text-muted-foreground underline" onClick={onCancel}>취소하고 다른 사진 선택</button>
      </DialogContent>
    </Dialog>
  );
}
