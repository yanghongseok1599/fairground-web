"use client";

import { useMemo, useState } from "react";
import type { MatchEvent, Player } from "@/types";
import { ROSTER_EVENTS, rosterPlayers, rosterStats, type RosterEventType } from "./roster-stats";

export function RosterEventBoard({ teams, events, disabled, onRecord, compact = false }: {
  teams: { id: string; name: string; players: Player[] }[];
  events: MatchEvent[];
  disabled: boolean;
  onRecord: (type: RosterEventType, player: Player, teamId: string) => void | Promise<void>;
  compact?: boolean;
}) {
  const stats = useMemo(() => rosterStats(events), [events]);
  const [selectedTeam, setSelectedTeam] = useState(teams[0]?.id);
  return <section className="space-y-3" aria-label="팀별 전체 선수 기록">
    {!compact && <div><h2 className="text-lg font-black">선수별 빠른 기록</h2><p className="mt-1 text-sm text-muted-foreground">선수의 버튼을 누르면 바로 기록됩니다. 버튼의 숫자는 이번 경기 누적 기록입니다.</p></div>}
    <div className={`sticky ${compact ? "top-0" : "top-16"} z-10 grid grid-cols-2 gap-2 bg-background py-2 md:hidden`} aria-label="기록할 팀 선택">{teams.map((team, side) => <button key={team.id} type="button" aria-pressed={selectedTeam === team.id} onClick={() => setSelectedTeam(team.id)} className={`min-h-11 truncate rounded-lg border px-3 text-sm font-bold ${selectedTeam === team.id ? side ? "border-red-700 bg-red-700 text-white" : "border-blue-700 bg-blue-700 text-white" : "bg-card"}`}>{team.name}</button>)}</div>
    <div className="grid gap-4 md:grid-cols-2">{teams.map((team, side) => {
      const players = rosterPlayers(team.players, team.id);
      return <section key={team.id} className={`min-w-0 overflow-hidden rounded-xl border bg-card ${selectedTeam === team.id ? "" : "hidden md:block"}`} aria-label={`${team.name} 전체 선수`}>
        <header className={`flex items-center justify-between gap-2 border-b px-4 py-3 font-bold ${side ? "bg-red-50 text-red-900" : "bg-blue-50 text-blue-900"}`}><h3 className="truncate">{team.name}</h3><span className="shrink-0 text-xs">{players.length}명</span></header>
        <ul className="divide-y">{players.map(player => {
          const counts = stats.get(player.id) ?? {};
          return <li key={player.id} className="space-y-2 p-3" data-roster-player={player.id}>
            <div className="flex min-w-0 items-center gap-2"><span className={`flex h-8 min-w-8 items-center justify-center rounded-full px-1 text-sm font-black text-white ${side ? "bg-red-700" : "bg-blue-700"}`}>{player.number || "—"}</span><strong className="truncate text-sm">{player.name}</strong>{(counts.red_card ?? 0) > 0 && <span className="ml-auto rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-800">퇴장</span>}</div>
            <div className="grid grid-cols-5 gap-1.5">{ROSTER_EVENTS.map(event => <button key={event.type} type="button" disabled={disabled}
              aria-label={`${player.name} ${event.label} 기록`}
              onClick={() => void onRecord(event.type, player, team.id)}
              className={`flex min-h-12 scroll-mt-36 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-xs font-semibold transition active:scale-95 disabled:cursor-default disabled:opacity-50 ${event.type === "yellow_card" ? "border-amber-200 bg-amber-50 text-amber-950" : event.type === "red_card" ? "border-red-200 bg-red-50 text-red-900" : "bg-background hover:bg-secondary"}`}>
              <span><span aria-hidden="true">{event.symbol}</span> {event.label}</span><span className="mt-0.5 text-base font-black tabular-nums" aria-label={`${event.label} ${counts[event.type] ?? 0}회`}>{counts[event.type] ?? 0}</span>
            </button>)}</div>
          </li>;
        })}</ul>
        {players.length === 0 && <p className="p-5 text-sm text-muted-foreground">등록된 선수가 없습니다.</p>}
      </section>;
    })}</div>
  </section>;
}
