"use client";

import { supabase, isDemoMode } from "@/config/supabase";
import type { Player, PlayerRole, Team, TournamentGroup } from "@/types";
import type { Database } from "@/lib/database.types";

const LS_PLAYERS = "fg_players";
const LS_TEAMS = "fg_teams";
const LS_TOURNAMENTS = "fg_tournaments";

function getLocalPlayers(): Record<string, Player> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_PLAYERS) || "{}"); } catch { return {}; }
}

function saveLocalPlayers(players: Record<string, Player>) {
  localStorage.setItem(LS_PLAYERS, JSON.stringify(players));
}

function getLocalTeams(): Record<string, Team> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_TEAMS) || "{}"); } catch { return {}; }
}

function saveLocalTeams(teams: Record<string, Team>) {
  localStorage.setItem(LS_TEAMS, JSON.stringify(teams));
}

function getLocalTournaments(): Record<string, { groups?: TournamentGroup[]; [key: string]: unknown }> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_TOURNAMENTS) || "{}"); } catch { return {}; }
}

function saveLocalTournaments(tournaments: Record<string, { groups?: TournamentGroup[]; [key: string]: unknown }>) {
  localStorage.setItem(LS_TOURNAMENTS, JSON.stringify(tournaments));
}

export async function setPlayerApproval(playerId: string, approved: boolean) {
  if (isDemoMode) {
    const players = getLocalPlayers();
    if (players[playerId]) {
      players[playerId] = { ...players[playerId], isApproved: approved };
      saveLocalPlayers(players);
    }
    return;
  }
  const { error } = await supabase.rpc("set_player_approval", {
    p_player_id: playerId,
    p_is_approved: approved,
  });
  if (error) throw new Error(error.message);
}

export async function setPlayerRole(playerId: string, role: PlayerRole) {
  if (isDemoMode) {
    const players = getLocalPlayers();
    if (players[playerId]) {
      players[playerId] = { ...players[playerId], role };
      saveLocalPlayers(players);
    }
    return;
  }
  const { error } = await supabase.rpc("set_player_role", {
    p_player_id: playerId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
}

/**
 * 참가 자격(선출 여부) 지정 — 규정 제22조.
 * 자기신고만으로는 걸러지지 않으므로, 운영진이 JOIN KFA(대한축구협회) 등록
 * 정보를 확인한 결과를 반영한다. true 로 지정되면 출전 명단 등재와 경기
 * 이벤트 기록이 DB 레벨에서 거부된다.
 */
export async function setPlayerEligibility(playerId: string, isRegisteredPlayer: boolean) {
  if (isDemoMode) {
    const players = getLocalPlayers();
    if (players[playerId]) {
      players[playerId] = { ...players[playerId], hasPlayerExperience: isRegisteredPlayer };
      saveLocalPlayers(players);
    }
    return;
  }
  const { error } = await supabase.rpc("set_player_eligibility", {
    p_player_id: playerId,
    p_is_registered_player: isRegisteredPlayer,
  });
  if (error) throw new Error(error.message);
}

export async function setTeamApproval(teamId: string, approved: boolean) {
  if (isDemoMode) {
    const teams = getLocalTeams();
    if (teams[teamId]) {
      teams[teamId] = { ...teams[teamId], isApproved: approved };
      saveLocalTeams(teams);
    }
    return;
  }
  const { error } = await supabase.from("teams").update({ is_approved: approved }).eq("id", teamId);
  if (error) throw new Error(error.message);
}

/** 팀 삭제 — 잘못 만든 팀을 목록에서 없앤다. */
export async function deleteTeam(teamId: string) {
  if (isDemoMode) {
    const teams = getLocalTeams();
    delete teams[teamId];
    saveLocalTeams(teams);
    return;
  }
  // 경기 기록이 있는 팀을 지우면 matches.home/away_team_id 가 NULL 이 되어
  // 팀 없는 유령 경기가 남는다. 그 경우는 삭제가 아니라 "승인 취소"가 정답.
  // ponytail: 운영자 실수 방지용 클라이언트 가드(삭제 권한 자체는 RLS
  // p_teams_write = is_referee_or_admin 이 강제). 서버 강제가 필요해지면
  // delete_team RPC 로 옮길 것.
  const { count, error: countError } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
  if (countError) throw new Error(countError.message);
  if (count && count > 0) {
    throw new Error(`경기 기록이 ${count}건 있어 삭제할 수 없습니다. "승인 취소"를 사용하세요.`);
  }

  // RLS 로 거부되면 delete 는 에러 없이 0행을 지운다 — 조용한 실패를 막기 위해
  // 삭제된 행을 돌려받아 확인한다.
  const { data, error } = await supabase.from("teams").delete().eq("id", teamId).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("삭제되지 않았습니다. 관리자 권한을 확인해 주세요.");
  }
}

export async function setTournamentGroups(tournamentId: string, groups: TournamentGroup[]) {
  if (isDemoMode) {
    const tournaments = getLocalTournaments();
    if (tournaments[tournamentId]) {
      tournaments[tournamentId] = { ...tournaments[tournamentId], groups };
      saveLocalTournaments(tournaments);
    }
    return;
  }
  const { error } = await supabase
    .from("tournaments")
    .update({ groups: groups as unknown as Database["public"]["Tables"]["tournaments"]["Update"]["groups"] })
    .eq("id", tournamentId);
  if (error) throw new Error(error.message);
}

/**
 * 대진(예정 경기) 공개 여부.
 * 공개 페이지 /tournaments/[id] 는 이 값이 true 일 때만 예정 경기를 보여준다.
 * 대진 초안이 참가팀에게 먼저 새어 나가면 조정할 때마다 혼선이 생긴다.
 */
export async function setTournamentFixturesPublished(tournamentId: string, published: boolean) {
  if (isDemoMode) {
    const tournaments = getLocalTournaments();
    if (tournaments[tournamentId]) {
      tournaments[tournamentId] = { ...tournaments[tournamentId], fixturesPublished: published };
      saveLocalTournaments(tournaments);
    }
    return;
  }
  const { error } = await supabase
    .from("tournaments")
    .update({ fixtures_published: published })
    .eq("id", tournamentId);
  if (error) throw new Error(error.message);
}

export async function setPlayerBan(playerId: string, banned: boolean, banMatchesRemaining: number) {
  if (isDemoMode) {
    const players = getLocalPlayers();
    if (players[playerId]) {
      players[playerId] = {
        ...players[playerId],
        penaltyStatus: {
          ...players[playerId].penaltyStatus,
          isBanned: banned,
          banMatchesRemaining,
        },
      };
      saveLocalPlayers(players);
    }
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ is_banned: banned, ban_matches_remaining: banMatchesRemaining })
    .eq("id", playerId);
  if (error) throw new Error(error.message);
}
