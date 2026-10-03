"use client";

import { MAX_SHOOTOUT_ATTEMPTS, type ShootoutAttempt } from "./attempts";

export function ShootoutAttemptPicker({ teamName, values, onChange, disabled }: {
  teamName: string;
  values: ShootoutAttempt[];
  onChange: (values: ShootoutAttempt[]) => void;
  disabled: boolean;
}) {
  const set = (index: number, value: ShootoutAttempt) => onChange(values.map((current, i) => i === index ? value : current));
  return <fieldset disabled={disabled} className="min-w-0 rounded-lg border border-blue-200 bg-white p-2.5">
    <legend className="sr-only">{teamName} 차수별 승부차기</legend>
    <p className="break-words text-sm font-bold">{teamName}</p>
    <p className="mt-1 text-xs text-slate-600">O {values.filter(value => value === true).length}개 · 기록 {values.filter(value => value !== null).length}회</p>
    <div className="mt-2 max-h-64 space-y-2 overflow-y-auto overscroll-contain">
      {values.map((value, index) => <div key={index} className="flex items-center gap-1.5" role="group" aria-label={`${teamName} ${index + 1}차`}>
        <span className="w-8 shrink-0 text-xs font-bold tabular-nums">{index + 1}차<span className="block text-center text-base" aria-label={value === null ? "미입력" : value ? "골" : "노골"}>{value === null ? "—" : value ? "O" : "X"}</span></span>
        <button type="button" aria-label={`${teamName} ${index + 1}차 골 O`} aria-pressed={value === true} onClick={() => set(index, true)} className={`min-h-11 min-w-11 flex-1 rounded-md border text-lg font-black focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${value === true ? "border-emerald-700 bg-emerald-100 text-emerald-900" : "border-slate-300 bg-white text-slate-600"}`}>O</button>
        <button type="button" aria-label={`${teamName} ${index + 1}차 노골 X`} aria-pressed={value === false} onClick={() => set(index, false)} className={`min-h-11 min-w-11 flex-1 rounded-md border text-lg font-black focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${value === false ? "border-red-700 bg-red-100 text-red-900" : "border-slate-300 bg-white text-slate-600"}`}>X</button>
        <button type="button" aria-label={`${teamName} ${index + 1}차 기록 지우기`} disabled={value === null || disabled} onClick={() => set(index, null)} className="min-h-11 rounded-md px-1.5 text-xs text-slate-600 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40">지우기</button>
      </div>)}
    </div>
    <button type="button" disabled={disabled || values.length >= MAX_SHOOTOUT_ATTEMPTS} onClick={() => onChange([...values, null])} className="mt-2 min-h-11 w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">{values.length + 1}차 추가</button>
  </fieldset>;
}
