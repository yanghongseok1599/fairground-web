"use client";

import { useParams, useSearchParams } from "next/navigation";
import { AdminGuard } from "@/components/admin-guard";
import { MatchControlScreen } from "@/features/match-control/match-control-screen";

export default function AdminMatchControlPage() {
  return <AdminGuard><MatchRoute /></AdminGuard>;
}

function MatchRoute() {
  const params = useParams();
  const searchParams = useSearchParams();
  return <MatchControlScreen matchId={params.matchId as string} tournamentId={searchParams.get("tournament") || ""} />;
}
