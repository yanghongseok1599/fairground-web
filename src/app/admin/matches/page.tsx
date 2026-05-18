"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { AdminHeader } from "@/components/admin-header";
import { AdminLoading } from "@/components/admin-loading";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
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
import { Plus, Circle } from "lucide-react";
import type { Tournament, Match, Team } from "@/types";

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

  // New match dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTournamentId, setNewTournamentId] = useState("");
  const [newHomeTeamId, setNewHomeTeamId] = useState("");
  const [newAwayTeamId, setNewAwayTeamId] = useState("");
  const [newRound, setNewRound] = useState("1");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [tournamentList] = await Promise.all([
          store.fetchAllTournaments(),
          store.fetchTeams(),
        ]);
        setTournaments(tournamentList);
        setTeams(store.teams);

        // Fetch matches for each tournament
        const matchMap: Record<string, Match[]> = {};
        await Promise.all(
          tournamentList.map(async (t) => {
            matchMap[t.id] = await store.fetchMatches(t.id);
          }),
        );
        setMatchesByTournament(matchMap);
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

  const handleCreateMatch = async () => {
    if (!newTournamentId || !newHomeTeamId || !newAwayTeamId) return;
    if (newHomeTeamId === newAwayTeamId) return;

    setCreating(true);
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
    } catch {
      // silent
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

  return (
    <div className="min-h-screen pb-4" style={{ background: "var(--background)" }}>
      <AdminHeader title="경기 관리" />

      <div className="mx-auto max-w-md space-y-4 p-4">
        {/* Filter */}
        <div className="flex items-center gap-2">
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
                        </div>
                        <Badge
                          className={`text-[10px] ${statusColor(match.status)}`}
                        >
                          {statusLabel(match.status)}
                        </Badge>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        {/* New Match Button */}
        {player?.role === "admin" && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                      {(selectedTournamentTeamIds.length > 0
                        ? selectedTournamentTeamIds
                            .map((id) => teams[id])
                            .filter(Boolean)
                        : teamList
                      ).map((t) => (
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
                      {(selectedTournamentTeamIds.length > 0
                        ? selectedTournamentTeamIds
                            .map((id) => teams[id])
                            .filter(Boolean)
                        : teamList
                      ).map((t) => (
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
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
