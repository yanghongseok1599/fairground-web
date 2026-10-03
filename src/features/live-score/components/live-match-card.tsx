"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Radio, Users } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import type { LiveMatch, MatchLineupEntry, Tournament } from "@/types";
import { formatTime } from "@/utils/formatters";
import { LiveLineupPanel } from "./live-lineup-panel";
import { getTournamentDisplayName } from "@/features/tournaments/public-fixtures";
import { ShootoutResultBadge } from "@/features/match-shootout/result-badge";

export function LiveMatchCard({ match, tournament }: { match: LiveMatch; tournament?: Tournament }) {
  const [elapsed, setElapsed] = useState(match.elapsedSeconds);
  const [expanded, setExpanded] = useState(false);
  const [lineup, setLineup] = useState<MatchLineupEntry[] | "loading">("loading");
  const [lineupError, setLineupError] = useState(false);
  const fetchLineup = useDataStore((s) => s.fetchMatchLineup);
  const groupName = tournament?.groups.find((g) => g.id === match.groupId)?.name;

  useEffect(() => {
    let active = true;
    const started = Date.now();
    const tick = () => setElapsed(match.elapsedSeconds + (match.isRunning ? Math.floor((Date.now() - started) / 1000) : 0));
    queueMicrotask(() => { if (active) tick(); });
    const timer = match.isRunning ? setInterval(tick, 1000) : undefined;
    return () => { active = false; clearInterval(timer); };
  }, [match.elapsedSeconds, match.isRunning]);

  useEffect(() => {
    if (!expanded) return;
    let active = true;
    void fetchLineup(match.id).then((rows) => { if (active) { setLineup(rows); setLineupError(false); } })
      .catch(() => { if (active) setLineupError(true); });
    return () => { active = false; };
  }, [expanded, fetchLineup, match.id]);

  return (
    <article className="overflow-hidden rounded-xl border border-destructive bg-card" aria-label={`${match.homeTeamName} 대 ${match.awayTeamName} 진행 중`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-destructive/5 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-destructive">
          <span className="h-2 w-2 rounded-full bg-destructive motion-safe:animate-pulse" aria-hidden="true" />진행 중
        </span>
        <span className="text-xs text-muted-foreground">{groupName ? `${groupName} · ` : ""}R{match.round}</span>
      </div>
      {tournament && <p className="px-4 pt-4 text-xs font-medium text-muted-foreground">{getTournamentDisplayName(tournament)}</p>}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5">
        <p className="min-w-0 break-words text-center text-base font-bold sm:text-lg">{match.homeTeamName}</p>
        <div className="text-center">
          <p className="text-3xl font-extrabold tabular-nums sm:text-4xl" role="status" aria-label={`스코어 ${match.homeScore} 대 ${match.awayScore}`}>
            {match.homeScore}<span className="mx-2 text-muted-foreground" aria-hidden="true">:</span>{match.awayScore}
          </p>
          <p className="mt-2 text-sm font-bold tabular-nums text-primary"><span className="sr-only">경과 시간 </span>{formatTime(elapsed)}</p>
          {!match.isRunning && <p className="mt-1 text-xs text-muted-foreground">일시 정지</p>}
        </div>
        <p className="min-w-0 break-words text-center text-base font-bold sm:text-lg">{match.awayTeamName}</p>
      </div>
      <ShootoutResultBadge match={match} className="px-4 pb-4 text-center" />
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <Link href={`/matches/${match.id}/watch`} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground"><Radio className="h-4 w-4" />중계 보기</Link>
        <Link href={`/matches/${match.id}`} className="flex min-h-11 items-center justify-center rounded-lg border border-border px-3 text-sm font-bold">경기 상세</Link>
      </div>
      <div className="border-t border-border">
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={`lineup-panel-${match.id}`} className="flex min-h-11 w-full items-center justify-between px-4 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />출전 명단</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {expanded && <div id={`lineup-panel-${match.id}`} className="px-4 pb-4">
          {lineupError ? <p role="alert" className="text-xs text-destructive">명단을 불러오지 못했습니다. 다시 펼쳐 확인해주세요.</p> : <LiveLineupPanel match={match} data={lineup} />}
          <Link href={`/matches/${match.id}`} className="mt-3 block text-right text-xs text-primary underline underline-offset-2">경기 상세 보기</Link>
        </div>}
      </div>
    </article>
  );
}
