"use client";

import { useId, useRef, useState } from "react";
import { saveInspectionBirthDate } from "../birth-date-api";
import type { InspectionPlayer } from "../types";

export function BirthDateEditor({ player, tournamentId, disabled, onSaved }: {
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
      await saveInspectionBirthDate(tournamentId, editing, input);
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
      <label htmlFor={id} className="block text-xs font-bold text-muted-foreground">{player.name} 생년월일</label>
      <div className="flex flex-wrap gap-2">
        <input id={id} type="text" inputMode="numeric" autoComplete="off" autoFocus maxLength={10}
          value={input} onChange={(event) => { setInput(event.target.value); setError(""); }}
          onKeyDown={(event) => { if (event.key === "Escape") cancel(); }}
          placeholder="예: 19900101" disabled={saving} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : `${id}-hint`}
          className="min-h-11 w-40 max-w-full rounded-lg border border-border bg-background px-3 tabular-nums disabled:opacity-50" />
        <button type="submit" disabled={saving || disabled} className="min-h-11 rounded-lg bg-primary px-3 font-bold text-primary-foreground disabled:opacity-40">{saving ? "저장 중…" : "저장"}</button>
        <button type="button" disabled={saving} onClick={cancel} className="min-h-11 rounded-lg border px-3 font-bold disabled:opacity-40">취소</button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">숫자 8자리 또는 YYYY-MM-DD</p>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </form> : <div className="flex flex-wrap items-center gap-x-2">
      <p className="tabular-nums"><span className="text-muted-foreground">생년월일 </span>{player.birth_date ? <time dateTime={player.birth_date}>{player.birth_date}</time> : "미등록"}</p>
      <button type="button" disabled={disabled || saving} aria-label={`${player.name} 생년월일 ${player.birth_date ? "수정" : "입력"}`}
        onClick={() => { setEditing(player); setInput(player.birth_date ?? ""); setError(""); setMessage(""); }}
        className="min-h-11 px-2 font-bold text-primary underline underline-offset-4 disabled:opacity-40">{player.birth_date ? "수정" : "입력"}</button>
      {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
    </div>}
  </div>;
}
