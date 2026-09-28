"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { AdminLoading } from "@/components/admin-loading";
import { AdminGuard } from "@/components/admin-guard";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Circle, Wand2 } from "lucide-react";
import type { Tournament, Match, Team, MatchLineupEntry } from "@/types";
import { buildAutoGroups, buildGroupRoundRobinMatches, recommendGroupCount } from "@/lib/auto-matchmaking";
import { buildRestOptimizedMatches } from "@/lib/fixture-scheduler";
import { buildTournamentDraft, isValidTournamentDraft } from "@/lib/tournament-admin";
import { setTournamentGroups } from "@/lib/admin-actions";
import { computeLineupReadiness } from "@/lib/lineup-readiness";
import { resolveMatchTrack } from "@/lib/match-operation-access";

type MatchFilter = "all" | "scheduled" | "live" | "finished";

export default function AdminMatchesPage() {
  return (
    <AdminGuard>
      <AdminMatches />
    </AdminGuard>
  );
}

function AdminMatches() {
  const router = useRouter();
  const { player } = useAuth();
  const store = useDataStore();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matchesByTournament, setMatchesByTournament] = useState<
    Record<string, Match[]>
  >({});
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [loading, setLoading] = useState(true);
  const [lineupsByMatch, setLineupsByMatch] = useState<Record<string, MatchLineupEntry[]>>({});

  // New tournament dialog
  const [tournamentDialogOpen, setTournamentDialogOpen] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState("");
  const [newTournamentStartDate, setNewTournamentStartDate] = useState("");
  const [newTournamentEndDate, setNewTournamentEndDate] = useState("");
  const [newTournamentLocation, setNewTournamentLocation] = useState("");
  const [creatingTournament, setCreatingTournament] = useState(false);
  const [tournamentMessage, setTournamentMessage] = useState("");

  // New match dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTournamentId, setNewTournamentId] = useState("");
  const [newHomeTeamId, setNewHomeTeamId] = useState("");
  const [newAwayTeamId, setNewAwayTeamId] = useState("");
  const [newRound, setNewRound] = useState("1");
  const [creating, setCreating] = useState(false);
  const [matchMessage, setMatchMessage] = useState("");

  // Auto grouping/matching dialog
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoTournamentId, setAutoTournamentId] = useState("");
  const [autoGroupCount, setAutoGroupCount] = useState("2");
  const [autoStartRound, setAutoStartRound] = useState("1");
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoMessage, setAutoMessage] = useState("");
  // 대진 모드: group=조 편성(승점 시드) / rest=휴식 최적 단일 풀리그(연속참가 시드).
  const [autoMode, setAutoMode] = useState<"group" | "rest">("group");
  const [restPreview, setRestPreview] = useState<
    ReturnType<typeof buildRestOptimizedMatches>["assignments"] | null
  >(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [tournamentList, teamList] = await Promise.all([
          store.fetchAllTournaments(),
          store.fetchTeams(),
        ]);
        setTournaments(tournamentList);
        // fetchTeams 의 반환값(배열)으로 채운다. store.teams 스냅샷은 이 async
        // 클로저에서 마운트 시점 값({})으로 고정돼 있어, 그걸 쓰면 동기화 effect가
        // 채운 값을 빈 객체로 덮어쓴다(팀 드롭다운이 비는 원인).
        const teamRecord: Record<string, Team> = {};
        for (const t of teamList) teamRecord[t.id] = t;
        setTeams(teamRecord);

        // Fetch matches for each tournament
        const matchMap: Record<string, Match[]> = {};
        await Promise.all(
          tournamentList.map(async (t) => {
            matchMap[t.id] = await store.fetchMatches(t.id);
          }),
        );
        setMatchesByTournament(matchMap);

        // Fetch lineups for scheduled matches only
        const allMatches = Object.values(matchMap).flat();
        const scheduledMatches = allMatches.filter((m) => m.status === "scheduled");
        const lineupMap: Record<string, MatchLineupEntry[]> = {};
        await Promise.all(
          scheduledMatches.map(async (m) => {
            try {
              lineupMap[m.id] = await store.fetchMatchLineup(m.id);
            } catch {
              lineupMap[m.id] = [];
            }
          }),
        );
        setLineupsByMatch(lineupMap);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync teams from store
  useEffect(() => {
    setTeams(store.teams);
  }, [store.teams]);

  const statusLabel = (status: string) => {
    switch (status) {
      case "scheduled":
        return "예정";
      case "live":
        return "진행중";
      case "finished":
        return "종료";
      case "cancelled":
        return "취소";
      default:
        return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-700";
      case "live":
        return "bg-red-100 text-red-700";
      case "finished":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const tournamentStatusColor = (status: string) => {
    switch (status) {
      case "upcoming":
        return "bg-blue-100 text-blue-700";
      case "ongoing":
        return "bg-green-100 text-green-700";
      case "completed":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const tournamentStatusLabel = (status: string) => {
    switch (status) {
      case "upcoming":
        return "예정";
      case "ongoing":
        return "진행중";
      case "completed":
        return "종료";
      default:
        return status;
    }
  };

  const handleCreateTournament = async () => {
    const draft = buildTournamentDraft({
      name: newTournamentName,
      startDate: newTournamentStartDate,
      endDate: newTournamentEndDate,
      location: newTournamentLocation,
    });
    if (!isValidTournamentDraft(draft)) {
      setTournamentMessage("대회명, 시작일, 장소를 모두 입력해주세요.");
      return;
    }

    setCreatingTournament(true);
    setTournamentMessage("");
    try {
      const tournamentId = await store.createTournament(draft);
      const createdTournament = { ...draft, id: tournamentId };
      setTournaments((prev) => [createdTournament, ...prev]);
      setMatchesByTournament((prev) => ({ ...prev, [tournamentId]: [] }));
      setNewTournamentId(tournamentId);
      setAutoTournamentId(tournamentId);
      setNewTournamentName("");
      setNewTournamentStartDate("");
      setNewTournamentEndDate("");
      setNewTournamentLocation("");
      setTournamentMessage("대회가 추가되었습니다.");
      setTournamentDialogOpen(false);
    } catch (error) {
      setTournamentMessage(error instanceof Error ? error.message : "대회 추가에 실패했습니다.");
    } finally {
      setCreatingTournament(false);
    }
  };

  const handleCreateMatch = async () => {
    if (!newTournamentId || !newHomeTeamId || !newAwayTeamId) return;
    if (newHomeTeamId === newAwayTeamId) return;

    setCreating(true);
    setMatchMessage("");
    try {
      const homeTeam = teams[newHomeTeamId];
      const awayTeam = teams[newAwayTeamId];
      const matchId = await store.createMatch(newTournamentId, {
        tournamentId: newTournamentId,
        round: parseInt(newRound, 10) || 1,
        homeTeamId: newHomeTeamId,
        awayTeamId: newAwayTeamId,
        homeTeamName: homeTeam?.name || "홈",
        awayTeamName: awayTeam?.name || "원정",
        homeScore: 0,
        awayScore: 0,
        status: "scheduled",
        scheduledAt: Date.now(),
        events: [],
      });

      // Add to local state
      setMatchesByTournament((prev) => ({
        ...prev,
        [newTournamentId]: [
          ...(prev[newTournamentId] || []),
          {
            id: matchId,
            tournamentId: newTournamentId,
            round: parseInt(newRound, 10) || 1,
            homeTeamId: newHomeTeamId,
            awayTeamId: newAwayTeamId,
            homeTeamName: homeTeam?.name || "홈",
            awayTeamName: awayTeam?.name || "원정",
            homeScore: 0,
            awayScore: 0,
            status: "scheduled",
            scheduledAt: Date.now(),
            events: [],
          },
        ],
      }));

      setDialogOpen(false);
      setNewHomeTeamId("");
      setNewAwayTeamId("");
      setNewRound("1");
    } catch (error) {
      setMatchMessage(
        error instanceof Error ? error.message : "경기 생성에 실패했습니다.",
      );
    } finally {
      setCreating(false);
    }
  };

  // Get available team IDs from tournament groups
  const getTeamsForTournament = (tournamentId: string): string[] => {
    const t = tournaments.find((t) => t.id === tournamentId);
    if (!t) return [];
    const teamIds = new Set<string>();
    t.groups?.forEach((g) => g.teamIds?.forEach((id) => teamIds.add(id)));
    return Array.from(teamIds);
  };

  const selectedTournamentTeamIds = newTournamentId
    ? getTeamsForTournament(newTournamentId)
    : [];
  const teamList = Object.values(teams);
  const approvedTeamList = teamList.filter((team) => team.isApproved);
  // 새 경기 추가 드롭다운에 쓸 팀 목록. 선택한 대회의 그룹에 묶인 팀이 있으면 그걸,
  // 그룹이 비었거나 묶인 팀 ID가 현재 팀 목록에서 안 풀리면(편성 전/시드 불일치)
  // 전체 승인 팀으로 폴백한다 — 그래야 드롭다운이 비지 않는다.
  const resolvedTournamentTeams = selectedTournamentTeamIds
    .map((id) => teams[id])
    .filter(Boolean);
  const matchTeamOptions =
    resolvedTournamentTeams.length > 0 ? resolvedTournamentTeams : approvedTeamList;
  const selectedAutoTournament = tournaments.find((t) => t.id === autoTournamentId);
  const recommendedAutoGroupCount = recommendGroupCount(approvedTeamList.length);

  const handleAutoGenerate = async () => {
    if (!autoTournamentId) return;
    setAutoMessage("");
    const eligibleTeams = approvedTeamList.map((team) => ({
      id: team.id,
      name: team.name,
      points: team.seasonStats?.points ?? 0,
      goalDifference: team.seasonStats?.goalDifference ?? 0,
      goalsFor: team.seasonStats?.goalsFor ?? 0,
    }));
    if (eligibleTeams.length < 2) {
      setAutoMessage("승인된 팀이 2팀 이상 필요합니다.");
      return;
    }

    // 휴식 최적 모드는 짝수 팀만(써클 라운드로빈 + 피벗).
    if (autoMode === "rest" && eligibleTeams.length % 2 !== 0) {
      setAutoMessage(`휴식 최적 대진은 짝수 팀만 가능합니다. (현재 ${eligibleTeams.length}팀)`);
      return;
    }

    setAutoGenerating(true);
    setRestPreview(null);
    try {
      const startRound = parseInt(autoStartRound, 10) || 1;
      let groups: ReturnType<typeof buildAutoGroups>;
      let generatedMatches: Array<Omit<Match, "id">>;

      if (autoMode === "rest") {
        // 연속참가 시드 배정 → 휴식 최적 단일 풀리그(1개 조).
        groups = buildAutoGroups(eligibleTeams, 1);
        const restTeams = approvedTeamList.map((team) => ({
          id: team.id,
          name: team.name,
          participationStreak: team.participationStreak ?? 0,
        }));
        const built = buildRestOptimizedMatches(restTeams, autoTournamentId, { startRound });
        generatedMatches = built.matches;
        setRestPreview(built.assignments);
      } else {
        const groupCount = Math.max(1, Math.min(parseInt(autoGroupCount, 10) || recommendedAutoGroupCount, eligibleTeams.length));
        groups = buildAutoGroups(eligibleTeams, groupCount);
        generatedMatches = buildGroupRoundRobinMatches(groups, eligibleTeams, autoTournamentId, startRound);
      }
      const existingMatches = matchesByTournament[autoTournamentId] || [];
      const existingPairKeys = new Set(
        existingMatches.map((match) => [match.homeTeamId, match.awayTeamId].sort().join(":"))
      );
      const matchesToCreate = generatedMatches.filter(
        (match) => !existingPairKeys.has([match.homeTeamId, match.awayTeamId].sort().join(":"))
      );

      await setTournamentGroups(autoTournamentId, groups);
      const createdMatches: Match[] = [];
      for (const match of matchesToCreate) {
        const matchId = await store.createMatch(autoTournamentId, match);
        createdMatches.push({ ...match, id: matchId });
      }

      setTournaments((prev) => prev.map((tournament) => tournament.id === autoTournamentId ? { ...tournament, groups } : tournament));
      setMatchesByTournament((prev) => ({
        ...prev,
        [autoTournamentId]: [...(prev[autoTournamentId] || []), ...createdMatches],
      }));
      setAutoMessage(
        autoMode === "rest"
          ? `휴식 최적 단일 풀리그 · 예정 경기 ${createdMatches.length}개 생성 완료 (연속참가 시드)`
          : `${groups.length}개 조 편성, 예정 경기 ${createdMatches.length}개 생성 완료`,
      );
    } catch (error) {
      setAutoMessage(error instanceof Error ? error.message : "자동 조편성에 실패했습니다.");
    } finally {
      setAutoGenerating(false);
    }
  };

  return (
    <AdminShell
      eyebrow="MATCH OPERATIONS"
      title="경기 관리"
      description="대회 생성부터 자동 조편성, 경기 생성, 라이브 스코어 입력까지 현장 운영 흐름을 한 화면에서 처리합니다."
    >
      <div className="space-y-6">
        {/* Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "scheduled", "live", "finished"] as MatchFilter[]).map(
            (f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className="min-h-[44px] text-xs"
              >
                {f === "all"
                  ? "전체"
                  : f === "scheduled"
                    ? "예정"
                    : f === "live"
                      ? "진행중"
                      : "종료"}
              </Button>
            ),
          )}
        </div>

        {loading ? (
          <AdminLoading />
        ) : tournaments.length === 0 ? (
          <div
            className="py-12 text-center text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            등록된 대회가 없습니다
          </div>
        ) : (
          tournaments.map((tournament) => {
            const matches = (matchesByTournament[tournament.id] || []).filter(
              (m) => filter === "all" || m.status === filter,
            );

            return (
              <Card key={tournament.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      {tournament.name}
                    </CardTitle>
                    <Badge
                      className={`text-[10px] ${tournamentStatusColor(tournament.status)}`}
                    >
                      {tournamentStatusLabel(tournament.status)}
                    </Badge>
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {tournament.date} · {tournament.location}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {matches.length === 0 ? (
                    <p
                      className="py-2 text-center text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {filter === "all"
                        ? "경기가 없습니다"
                        : `${statusLabel(filter)} 경기가 없습니다`}
                    </p>
                  ) : (
                    matches.map((match) => (
                      <button
                        key={match.id}
                        className="flex min-h-[44px] w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                        onClick={() =>
                          router.push(
                            `/admin/match/${match.id}?tournament=${tournament.id}`,
                          )
                        }
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {match.status === "live" && (
                              <Circle className="h-2 w-2 animate-pulse fill-red-500 text-red-500" />
                            )}
                            <span className="text-sm font-medium">
                              {match.homeTeamName}
                            </span>
                            <span className="text-sm font-black tabular-nums">
                              {match.homeScore}
                            </span>
                            <span
                              className="text-xs"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              :
                            </span>
                            <span className="text-sm font-black tabular-nums">
                              {match.awayScore}
                            </span>
                            <span className="text-sm font-medium">
                              {match.awayTeamName}
                            </span>
                          </div>
                          <div
                            className="mt-0.5 flex items-center gap-2 text-[10px]"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            <span>R{match.round}</span>
                          </div>
                          {match.status === "scheduled" && (() => {
                            const entries = lineupsByMatch[match.id] ?? [];
                            const home = computeLineupReadiness(match.homeTeamId, entries);
                            const away = computeLineupReadiness(match.awayTeamId, entries);
                            return (
                              <div className="flex gap-1 text-xs">
                                <span className={home.ready ? "text-green-700" : "text-amber-600"}>
                                  HOME {home.ready ? "✅" : "⏳"} {home.label}
                                </span>
                                <span className={away.ready ? "text-green-700" : "text-amber-600"}>
                                  AWAY {away.ready ? "✅" : "⏳"} {away.label}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            className={`text-[10px] ${statusColor(match.status)}`}
                          >
                            {statusLabel(match.status)}
                          </Badge>
                          <span className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                            {resolveMatchTrack(player, match) === "referee" ? "경기 운영" : "관리"}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        {player?.role === "admin" && (
          <div className="grid gap-3 md:grid-cols-3">
          <Dialog open={tournamentDialogOpen} onOpenChange={(open) => {
            setTournamentDialogOpen(open);
            if (open) setTournamentMessage("");
          }}>
            <DialogTrigger asChild>
              <Button className="min-h-[44px] w-full">
                <Plus className="mr-2 h-4 w-4" />대회 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>대회 추가</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">대회명</label>
                  <Input
                    value={newTournamentName}
                    onChange={(event) => setNewTournamentName(event.target.value)}
                    placeholder="예: 2026 봄 리그"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">시작일</label>
                    <Input
                      type="date"
                      value={newTournamentStartDate}
                      onChange={(event) => {
                        const value = event.target.value;
                        setNewTournamentStartDate(value);
                        if (newTournamentEndDate && value && newTournamentEndDate < value) {
                          setNewTournamentEndDate(value);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">종료일 <span style={{ color: "var(--muted-foreground)" }}>(선택)</span></label>
                    <Input
                      type="date"
                      value={newTournamentEndDate}
                      min={newTournamentStartDate || undefined}
                      onChange={(event) => setNewTournamentEndDate(event.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  하루 대회는 시작일만 선택하고, 양일 이상 대회는 종료일도 선택하세요.
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">장소</label>
                  <Input
                    value={newTournamentLocation}
                    onChange={(event) => setNewTournamentLocation(event.target.value)}
                    placeholder="예: 서울 풋살파크"
                  />
                </div>
                {tournamentMessage && (
                  <p className="text-sm" style={{ color: tournamentMessage.includes("추가") ? "var(--primary)" : "var(--destructive)" }}>
                    {tournamentMessage}
                  </p>
                )}
                <Button
                  className="min-h-[44px] w-full"
                  onClick={handleCreateTournament}
                  disabled={creatingTournament}
                >
                  {creatingTournament ? "추가 중..." : "대회 생성"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={autoDialogOpen} onOpenChange={setAutoDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="min-h-[44px] w-full">
                <Wand2 className="mr-2 h-4 w-4" />신청팀 자동 조편성/매칭
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>신청팀 자동 조편성/매칭</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">대회</label>
                  <Select
                    value={autoTournamentId}
                    onValueChange={(v) => {
                      setAutoTournamentId(v);
                      setAutoMessage("");
                      const recommended = recommendGroupCount(approvedTeamList.length);
                      setAutoGroupCount(String(recommended));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="대회 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {tournaments.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 대진 모드 토글 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">대진 방식</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: "group", label: "조 편성", desc: "승점 시드" },
                      { v: "rest", label: "휴식 최적", desc: "연속참가 시드" },
                    ] as const).map((m) => (
                      <button
                        key={m.v}
                        type="button"
                        onClick={() => { setAutoMode(m.v); setAutoMessage(""); setRestPreview(null); }}
                        className="min-h-[44px] rounded-lg border px-3 py-2 text-left transition-colors"
                        style={
                          autoMode === m.v
                            ? { borderColor: "var(--primary)", background: "var(--secondary)" }
                            : { borderColor: "var(--border)" }
                        }
                        aria-pressed={autoMode === m.v}
                      >
                        <div className="text-sm font-semibold">{m.label}</div>
                        <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">조 개수</label>
                    <Select value={autoGroupCount} onValueChange={setAutoGroupCount} disabled={autoMode === "rest"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                          <SelectItem key={count} value={String(count)} disabled={count > Math.max(approvedTeamList.length, 1)}>
                            {count}개 조
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">시작 라운드</label>
                    <Select value={autoStartRound} onValueChange={setAutoStartRound}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((round) => (
                          <SelectItem key={round} value={String(round)}>
                            R{round}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg border p-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {autoMode === "rest"
                    ? `승인된 신청팀 ${approvedTeamList.length}개를 연속참가 기준으로 시드 배정합니다. 연속참가가 길수록 휴식이 많은 시드를 우선 배정하고, 써클 방식 단일 풀리그(피벗 고정) 예정 경기를 생성합니다. 짝수 팀만 가능.`
                    : `승인된 신청팀 ${approvedTeamList.length}개를 시즌 승점 기준으로 시드 배정하고, 지그재그 방식으로 조를 나눈 뒤 조별 풀리그 예정 경기를 생성합니다.`}
                  {selectedAutoTournament && (
                    <div className="mt-2 font-medium" style={{ color: "var(--foreground)" }}>
                      대상: {selectedAutoTournament.name}
                      {autoMode === "group" && ` · 권장 ${recommendedAutoGroupCount}개 조`}
                    </div>
                  )}
                </div>

                {autoMessage && (
                  <p className="text-sm" style={{ color: autoMessage.includes("완료") ? "var(--primary)" : "var(--destructive)" }}>
                    {autoMessage}
                  </p>
                )}

                {/* 휴식 시드 배정 미리보기 — 연속참가 시드/휴식 패턴 */}
                {restPreview && restPreview.length > 0 && (
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                    <p className="mb-2 text-xs font-semibold">휴식 시드 배정 (연속참가 순)</p>
                    <div className="space-y-1">
                      {[...restPreview]
                        .sort((a, b) => b.totalRest - a.totalRest)
                        .map((a) => (
                          <div key={a.team.id} className="flex items-center justify-between gap-2 text-xs tabular-nums">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "var(--secondary)" }}>
                                {a.seed}
                              </span>
                              <span className="truncate font-medium" style={{ color: "var(--foreground)" }}>{a.team.name}</span>
                              <span style={{ color: "var(--muted-foreground)" }}>연속 {a.team.participationStreak ?? 0}</span>
                            </span>
                            <span className="shrink-0" style={{ color: "var(--muted-foreground)" }}>
                              {a.rests.join("·")}분 · 총 {a.totalRest}분
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <Button
                  className="min-h-[44px] w-full"
                  onClick={handleAutoGenerate}
                  disabled={autoGenerating || !autoTournamentId || approvedTeamList.length < 2}
                >
                  {autoGenerating
                    ? "자동 생성 중..."
                    : autoMode === "rest"
                      ? "휴식 최적 대진 + 예정 경기 생성"
                      : "조편성 + 예정 경기 생성"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setMatchMessage("");
            }}
          >
            <DialogTrigger asChild>
              <Button className="min-h-[44px] w-full">
                <Plus className="mr-2 h-4 w-4" />새 경기 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 경기 추가</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">대회</label>
                  <Select
                    value={newTournamentId}
                    onValueChange={(v) => {
                      setNewTournamentId(v);
                      setNewHomeTeamId("");
                      setNewAwayTeamId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="대회 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {tournaments.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">라운드</label>
                  <Select value={newRound} onValueChange={setNewRound}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((r) => (
                        <SelectItem key={r} value={r.toString()}>
                          {r}라운드
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium">홈 팀</label>
                  <Select
                    value={newHomeTeamId}
                    onValueChange={setNewHomeTeamId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="홈 팀 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {matchTeamOptions.map((t) => (
                        <SelectItem
                          key={t.id}
                          value={t.id}
                          disabled={t.id === newAwayTeamId}
                        >
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">원정 팀</label>
                  <Select
                    value={newAwayTeamId}
                    onValueChange={setNewAwayTeamId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="원정 팀 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {matchTeamOptions.map((t) => (
                        <SelectItem
                          key={t.id}
                          value={t.id}
                          disabled={t.id === newHomeTeamId}
                        >
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="min-h-[44px] w-full"
                  onClick={handleCreateMatch}
                  disabled={
                    creating ||
                    !newTournamentId ||
                    !newHomeTeamId ||
                    !newAwayTeamId ||
                    newHomeTeamId === newAwayTeamId
                  }
                >
                  {creating ? "생성 중..." : "경기 생성"}
                </Button>
                {matchMessage && (
                  <p className="text-sm" style={{ color: "var(--destructive)" }}>
                    {matchMessage}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
