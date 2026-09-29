"use client";

import type { FixtureTiming } from "@/lib/fixture-timetable";

export function FixtureTimingFields({ value, onChange, disabled = false }: {
  value: FixtureTiming;
  onChange: (value: FixtureTiming) => void;
  disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="flex flex-wrap items-end gap-3 disabled:opacity-60">
    <legend className="mb-2 text-xs font-medium">경기 시간 · 한국 시간</legend>
    <label className="grid gap-1 text-xs">구장 운영
      <select value={value.courtMode ?? "per-group"}
        onChange={(e) => onChange({ ...value, courtMode: e.target.value as FixtureTiming["courtMode"] })}
        className="min-h-[42px] rounded-md border bg-white px-2 text-sm">
        <option value="single">A구장 한 면 · 조별 교대 진행</option>
        <option value="per-group">조별 구장 · 동시 진행</option>
      </select>
    </label>
    <label className="grid gap-1 text-xs">첫 경기 시작
      <input type="time" value={value.startTime} onChange={(e) => onChange({ ...value, startTime: e.target.value })}
        className="min-h-[42px] rounded-md border bg-white px-2 text-sm" />
    </label>
    <label className="grid gap-1 text-xs">점심 시작
      <input type="time" value={value.lunchStart} onChange={(e) => onChange({ ...value, lunchStart: e.target.value })}
        className="min-h-[42px] rounded-md border bg-white px-2 text-sm" />
    </label>
    <label className="grid gap-1 text-xs">점심 시간(분)
      <input type="number" min={0} max={180} step={1} value={value.lunchMinutes}
        onChange={(e) => onChange({ ...value, lunchMinutes: Number(e.target.value) })}
        className="min-h-[42px] w-24 rounded-md border bg-white px-2 text-sm" />
    </label>
  </fieldset>;
}
