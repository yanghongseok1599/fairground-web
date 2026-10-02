"use client";

import { useParams, useSearchParams } from "next/navigation";
import { MatchRecordingProvider } from "@/features/match-recording/provider";
import { MatchControlScreen } from "@/features/match-control/match-control-screen";

export default function AdminMatchControlPage() {
  return <MatchRoute />;
}

function MatchRoute() {
  const params = useParams();
  const searchParams = useSearchParams();
  return <MatchRecordingProvider matchId={params.matchId as string}><MatchControlScreen matchId={params.matchId as string} tournamentId={searchParams.get("tournament") || ""} /></MatchRecordingProvider>;
}
