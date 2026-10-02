"use client";

import { useId, useRef, useState } from "react";
import { saveInspectionGender } from "../gender-api";
import { INSPECTION_GENDERS, inspectionGenderLabel } from "../gender";
import type { InspectionPlayer } from "../types";

export function GenderEditor({ player, tournamentId, disabled, onSaved }: {
  player: InspectionPlayer;
  tournamentId: string;
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const id = useId();
  // Snapshot and draft deliberately survive background roster refreshes.
  const [editing, setEditing] = useState<InspectionPlayer | null>(null);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const cancel = () => { if (!lock.current) { setEditing(null); setError(""); } };
  const submit = async () => {
    if (!editing || disabled || lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      await saveInspectionGender(tournamentId, editing, input);
      setEditing(null);
      setMessage("저장했습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다. 입력을 확인해주세요.");
    } finally {
      await onSaved();
      lock.current = false;
      setSaving(false);
    }
  };
  return <div className={`${editing ? "basis-full" : "max-w-full"} text-sm`}>
    {editing ? <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="mt-2 space-y-2">
      <label htmlFor={id} className="block text-xs font-bold text-muted-foreground">{player.name} 성별</label>
      <div className="flex flex-wrap gap-2">
        <select id={id} autoFocus value={input}
          onChange={(event) => { setInput(event.target.value); setError(""); }}
          onKeyDown={(event) => { if (event.key === "Escape") cancel(); }}
          disabled={saving} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-11 w-40 max-w-full rounded-lg border border-border bg-background px-3 disabled:opacity-50">
          <option value="" disabled>성별 선택</option>
          {input && !INSPECTION_GENDERS.some((option) => option.value === input) && <option value={input} disabled>기존 값 확인 필요</option>}
          {INSPECTION_GENDERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button type="submit" disabled={saving || disabled} className="min-h-11 rounded-lg bg-primary px-3 font-bold text-primary-foreground disabled:opacity-40">{saving ? "저장 중…" : "저장"}</button>
        <button type="button" disabled={saving} onClick={cancel} className="min-h-11 rounded-lg border px-3 font-bold disabled:opacity-40">취소</button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </form> : <div className="flex flex-wrap items-center gap-x-2">
      <p className="tabular-nums"><span className="text-muted-foreground">성별 </span>{inspectionGenderLabel(player.gender)}</p>
      <button type="button" disabled={disabled || saving || player.gender === undefined} aria-label={`${player.name} 성별 ${player.gender ? "수정" : "입력"}`}
        onClick={() => { setEditing(player); setInput(player.gender ?? ""); setError(""); setMessage(""); }}
        className="min-h-11 px-2 font-bold text-primary underline underline-offset-4 disabled:opacity-40">{player.gender ? "수정" : "입력"}</button>
      {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
    </div>}
  </div>;
}
