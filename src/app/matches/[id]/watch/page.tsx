"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDataStore } from "@/stores/dataStore";
import { MatchControlScreen } from "@/features/match-control/match-control-screen";

export default function MatchWatchPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState({ tournament: "", error: "" });
  useEffect(() => {
    let alive = true;
    void useDataStore.getState().fetchMatch("", id).then(match => {
      if (alive) setState({ tournament: match?.tournamentId ?? "", error: match ? "" : "경기를 찾을 수 없습니다." });
    }).catch(() => { if (alive) setState({ tournament: "", error: "경기 정보를 불러오지 못했습니다. 새로고침해주세요." }); });
    return () => { alive = false; };
  }, [id]);
  return <main className="px-3 py-6">
    <div className="mx-auto mb-4 max-w-6xl"><a href={`/matches/${id}`} className="text-sm underline">경기 상세로</a></div>
    {state.error ? <p role="alert" className="p-6 text-center">{state.error}</p> : state.tournament ?
      <MatchControlScreen key={id} matchId={id} tournamentId={state.tournament} spectator /> : <p role="status" className="p-6 text-center">경기 중계를 연결하고 있습니다…</p>}
  </main>;
}
