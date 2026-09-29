"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Loader2, Radio, RefreshCw } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { useLiveScoreboard } from "./use-live-scoreboard";
import { LiveMatchCard } from "./components/live-match-card";
import { UpcomingMatchCard } from "./components/upcoming-match-card";
import { getTournamentDisplayName, isTournamentFixturesPublic } from "@/features/tournaments/public-fixtures";

export function LiveScorePage() {
  const { live, upcoming, recent, tournaments, loading, error, refresh } = useLiveScoreboard();
  const fixtureTournaments = tournaments.filter((tournament) => isTournamentFixturesPublic(tournament) && tournament.status !== "completed");
  return (
    <div className="pt-[60px]">
      <div className="bg-[var(--color-fg-ink)] px-5 py-10 md:px-10 md:py-14">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold text-destructive"><Radio className="h-4 w-4" />실시간 중계</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-fg-paper)] md:text-6xl">라이브 스코어</h1>
          <p className="mt-3 text-sm text-[var(--color-fg-ink-dim)]">진행 중인 경기와 다음 대기 경기를 한눈에 확인하세요.</p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 md:px-10">
        {loading ? <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />경기를 불러오는 중입니다</p> : <>
          {fixtureTournaments.length > 0 && <section aria-labelledby="public-fixtures-title">
            <div className="mb-4">
              <h2 id="public-fixtures-title" className="text-xl font-bold">대회 대진표</h2>
              <p className="mt-1 text-xs text-muted-foreground">참가팀별 경기 일정과 순서를 확인하세요.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {fixtureTournaments.map((tournament) => <Link key={tournament.id} href={`/tournaments/${tournament.id}#fixtures`} className="flex min-h-20 items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-snug">{getTournamentDisplayName(tournament)}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{tournament.date}<span aria-hidden="true">·</span>{tournament.location}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary">대진표 보기<ArrowRight className="h-4 w-4" /></span>
              </Link>)}
            </div>
          </section>}
          {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p>최신 경기 정보를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p>
            <button type="button" onClick={refresh} className="inline-flex min-h-11 items-center gap-2 font-bold text-primary"><RefreshCw className="h-4 w-4" />다시 확인</button>
          </div>}
          <section aria-labelledby="live-matches-title">
            <h2 id="live-matches-title" className="mb-4 text-xl font-bold">진행 중인 경기 <span className="ml-1 text-base text-destructive">{live.length}</span></h2>
            {live.length > 0 ? <div className="grid gap-4 lg:grid-cols-2">{live.map((match) => <LiveMatchCard key={match.id} match={match} tournament={tournaments.find((t) => t.id === match.tournamentId)} />)}</div>
              : <p className="rounded-xl border border-border bg-muted/30 px-5 py-6 text-sm text-muted-foreground">{error ? "진행 중인 경기를 확인할 수 없습니다." : "현재 진행 중인 경기가 없습니다."}</p>}
          </section>
          <section aria-labelledby="upcoming-matches-title">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div><h2 id="upcoming-matches-title" className="text-xl font-bold">대기 중인 다음 경기 <span className="ml-1 text-base text-primary">{upcoming.length}</span></h2><p className="mt-1 text-xs text-muted-foreground">대회별 다음 순서 · 동시간 경기는 함께 표시합니다.</p></div>
              <Link href="/tournaments" className="text-xs font-semibold text-primary underline underline-offset-4">전체 경기 일정</Link>
            </div>
            {upcoming.length > 0 ? <div className="grid gap-4 md:grid-cols-2">{upcoming.map((item) => <UpcomingMatchCard key={item.match.id} item={item} />)}</div>
              : <p className="rounded-xl border border-border bg-muted/30 px-5 py-6 text-sm text-muted-foreground">{error ? "다음 경기를 확인할 수 없습니다." : "공개된 다음 대기 경기가 없습니다. 대진이 공개되면 이곳에 표시됩니다."}</p>}
          </section>
          {recent.length > 0 && <section aria-labelledby="recent-matches-title">
            <h2 id="recent-matches-title" className="mb-4 text-xl font-bold">최근 경기 결과</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{recent.map((match) => <Link href={`/matches/${match.id}`} key={match.id} aria-label={`${match.homeTeamName} 대 ${match.awayTeamName} 경기 결과`}><MatchCard match={match} /></Link>)}</div>
          </section>}
        </>}
      </div>
    </div>
  );
}
