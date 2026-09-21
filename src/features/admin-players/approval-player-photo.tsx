"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { PlayerProfilePhoto } from "@/components/player-profile-photo";
import { fetchApprovalPhoto } from "./api";

export function ApprovalPlayerPhoto({ id, name }: { id: string; name: string }) {
  const [photo, setPhoto] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const cancel = () => active.current?.abort();
    return cancel;
  }, []);
  const load = async () => {
    if (active.current && !active.current.signal.aborted) return;
    const request = new AbortController();
    active.current = request;
    setLoading(true);
    setError("");
    try {
      const url = await fetchApprovalPhoto(id, request.signal);
      if (request.signal.aborted) return;
      setPhoto(url);
      setLoaded(true);
    } catch {
      if (!request.signal.aborted) setError("사진을 불러오지 못했습니다.");
    } finally {
      if (!request.signal.aborted) {
        active.current = null;
        setLoading(false);
      }
    }
  };
  return <div className="flex shrink-0 flex-col items-center gap-1">
    <PlayerProfilePhoto src={photo} alt={name} />
    {!loaded ? <button type="button" onClick={() => void load()} disabled={loading}
      aria-label={`${name} 선수 사진 ${error ? "다시 보기" : "보기"}`}
      className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold text-primary disabled:opacity-60">
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}{loading ? "불러오는 중" : error ? "다시 보기" : "사진 보기"}
    </button> : !photo && <span className="py-2 text-xs text-muted-foreground">사진 없음</span>}
    {error && <span role="alert" className="max-w-28 text-center text-xs text-destructive">{error}</span>}
  </div>;
}
