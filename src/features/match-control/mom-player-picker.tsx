"use client";

import { useId, useState } from "react";
import { filterMomPlayerOptions, type MomPlayerOption } from "./mom-player-options";

/** Keep the list inside the dialog so live refreshes cannot reposition its scroll. */
export function MomPlayerPicker({ value, onValueChange, options, teams, disabled }: {
  value: string;
  onValueChange: (value: string) => void;
  options: MomPlayerOption[];
  teams: { id: string; name: string }[];
  disabled: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [teamId, setTeamId] = useState("");
  const filtered = filterMomPlayerOptions(options, query, teamId);
  const selected = options.find((option) => option.value === value);

  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="sr-only">최종 MOM 선택</legend>
      <label htmlFor={`${id}-search`} className="sr-only">MOM 선수 검색</label>
      <input
        id={`${id}-search`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="등번호·선수명·팀명 검색"
        autoComplete="off"
        className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
      />
      <div className="flex flex-wrap gap-1.5" aria-label="MOM 팀 필터">
        {[{ id: "", name: "전체" }, ...teams].map((team) => (
          <button
            key={team.id}
            type="button"
            aria-pressed={teamId === team.id}
            onClick={() => setTeamId(team.id)}
            className={`min-h-11 rounded-md border px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${teamId === team.id ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
          >
            {team.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {selected ? `현재 선택: ${selected.label}` : "MOM 선수 또는 MOM 없음 선택"}
      </p>
      <div className="max-h-48 space-y-1 overflow-y-auto overscroll-contain rounded-md border p-1 [scrollbar-gutter:stable] sm:max-h-60">
        {filtered.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-2 text-sm has-checked:border-primary has-checked:bg-primary/10"
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onValueChange(option.value)}
              className="shrink-0 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p role="status" className="px-2 py-3 text-sm text-muted-foreground">검색 결과가 없습니다.</p>
        )}
      </div>
    </fieldset>
  );
}
