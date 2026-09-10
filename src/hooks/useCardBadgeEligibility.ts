"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/dataStore";

/** Unknown/failed eligibility must never become an empty equipped-badge list. */
export function useCardBadgeEligibility(playerId?: string) {
  const fetchMyBadges = useDataStore((state) => state.fetchMyBadges);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    playerId?: string; revision: number; ids: Set<string> | null; error: string;
  }>({ revision: -1, ids: null, error: "" });
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    void fetchMyBadges(playerId).then((rows) => {
      if (!cancelled) setResult({ playerId, revision, ids: new Set(rows.filter((row) => row.isEarned).map((row) => row.badgeId)), error: "" });
    }).catch(() => {
      if (!cancelled) setResult({ playerId, revision, ids: null, error: "배지를 불러오지 못했습니다. 기존 배지는 유지되며 다른 정보는 저장할 수 있습니다." });
    });
    return () => { cancelled = true; };
  }, [playerId, revision, fetchMyBadges]);
  const current = result.playerId === playerId && result.revision === revision;
  return {
    earnedBadgeIds: current ? result.ids : null,
    badgeError: current ? result.error : "",
    retryBadges: () => setRevision((value) => value + 1),
  };
}
