"use client";

import { useState } from "react";
import { StandingsTable } from "@/components/standings-table";
import type { TeamStanding, TournamentGroup } from "@/types";
import { filterGroupStandings } from "./group-filter";

interface Props {
  standings: TeamStanding[];
  groups?: TournamentGroup[];
  groupSourceName?: string;
}

export function GroupedStandingsTable({ standings, groups = [], groupSourceName }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = groups.some(group => group.id === selected) ? selected : null;
  const rows = active ? filterGroupStandings(standings, groups, active) : standings;
  const choices = [{ id: null, name: "전체", count: standings.length }, ...groups.map(group => ({
    id: group.id, name: group.name,
    count: standings.filter(team => group.teamIds.includes(team.teamId)).length,
  }))];

  return (
    <div className="min-w-0 space-y-3">
      {groups.length > 0 && (
        <>
          <div role="group" aria-label="순위표 조 선택" className="flex flex-wrap gap-2">
            {choices.map(choice => (
              <button key={choice.id ?? "all"} type="button" aria-pressed={active === choice.id}
                onClick={() => setSelected(choice.id)}
                className="min-h-11 min-w-20 flex-1 rounded-lg border px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-none"
                style={{ background: active === choice.id ? "var(--primary)" : "var(--color-fg-paper)",
                  color: active === choice.id ? "var(--primary-foreground)" : "var(--color-fg-ink)",
                  borderColor: active === choice.id ? "var(--primary)" : "var(--color-fg-line-soft)" }}>
                {choice.name} <span className="ml-1 text-xs opacity-75">{choice.count}</span>
              </button>
            ))}
          </div>
          {groupSourceName && <p className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>시즌 누적 기록 · {groupSourceName} 조 편성</p>}
        </>
      )}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {choices.find(choice => choice.id === active)?.name} 순위, {rows.length}팀
      </div>
      {rows.length > 0 ? <StandingsTable standings={rows} showPromotionSplit={!active} />
        : <p className="py-8 text-center text-sm text-muted-foreground">이 조에 표시할 팀이 없습니다.</p>}
    </div>
  );
}
