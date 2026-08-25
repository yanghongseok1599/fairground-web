"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { PlayerCardCaptureFrame } from "@/components/player-card-capture-frame";
import type { Player, Team } from "@/types";
import { ArrowLeft, Download, Share2, Loader2, Pencil } from "lucide-react";
import { downloadElementAsPng } from "@/lib/card-download";

const RESULT_CARD_BOX_SIZE = 560;
const RESULT_CARD_SCALE = 0.51;
const RESULT_CARD_LOGO_HEIGHT = 30;

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDataStore();
  const { user } = useAuth();
  const isOwn = user?.uid === id;
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const exportCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const p = await store.fetchPlayer(id);
      setPlayer(p);
      if (p?.teamId) {
        const t = await store.fetchTeam(p.teamId);
        setTeam(t);
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async () => {
    if (!exportCardRef.current || !player) return;
    setSaving(true);
    try {
      await downloadElementAsPng(exportCardRef.current, `${player.name}-fairground.png`);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!player) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${player.name} - FairGround`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return; // 사용자가 공유 취소
    }
  };

  if (loading) return (
    <div className="pt-[60px] flex items-center justify-center min-h-screen" style={{ background: "#0D1B2A" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "#00C853", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "#627D98" }}>불러오는 중...</p>
      </div>
    </div>
  );

  if (!player) return (
    <div className="pt-[60px] flex items-center justify-center min-h-screen" style={{ background: "#0D1B2A" }}>
      <p style={{ color: "#627D98" }}>선수를 찾을 수 없습니다</p>
    </div>
  );

  return (
    <div className="pt-[60px] min-h-screen flex flex-col" style={{ background: "#0D1B2A" }}>
      <div className="flex-1 w-full px-5 py-10 sm:px-8 md:px-10">
        <div className="mx-auto w-full max-w-[1100px]">
        {/* Back */}
        <div className="mb-8 w-full">
          <Link
            href="/my"
            className="inline-flex items-center gap-2 text-sm transition-colors"
            style={{ color: "#627D98" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#00C853"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#627D98"; }}
          >
            <ArrowLeft className="h-4 w-4" />
            마이페이지
          </Link>
        </div>

        <div className="grid w-full gap-7 lg:grid-cols-[minmax(0,620px)_260px] lg:items-center lg:justify-center lg:gap-10">
          {/* Space background card */}
          <div className="flex w-full justify-center lg:justify-end">
            <div ref={exportCardRef} className="w-full max-w-[560px]">
              <PlayerCardCaptureFrame
                player={player}
                teamLogo={team?.logo}
                boxSize={RESULT_CARD_BOX_SIZE}
                cardSize="export"
                cardScale={RESULT_CARD_SCALE}
                logoHeight={RESULT_CARD_LOGO_HEIGHT}
                displayWidth="100%"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 gap-3 lg:mx-0 lg:max-w-[260px] lg:grid-cols-1 lg:self-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "#FFD700", color: "#0D1B2A" }}
            >
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />}
              이미지 저장
            </button>
            <button
              onClick={handleShare}
              className="flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold transition-all hover:opacity-90"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFCFF" }}
            >
              <Share2 className="w-4 h-4" />
              공유하기
            </button>

            {/* 카드 수정 (본인만) */}
            {isOwn && (
              <Link
                href="/my/card-edit"
                className="col-span-2 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold transition-all hover:opacity-90 lg:col-span-1"
                style={{ background: "rgba(0,200,83,0.08)", border: "1px solid rgba(0,200,83,0.25)", color: "#00C853" }}
              >
                <Pencil className="w-4 h-4" />
                카드 수정
              </Link>
            )}
          </div>
        </div>

        {/* 프로필 보강(있는 것만 표시) */}
        {(player.mbti || player.disposition || player.personalValues || player.bio) && (
          <div className="mx-auto mt-8 w-full max-w-[560px] space-y-4">
            {(player.mbti || player.disposition) && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {player.mbti && (
                  <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                    style={{ background: "rgba(79,195,247,0.12)", color: "#4FC3F7", fontFamily: "var(--font-space-mono)" }}>
                    MBTI · {player.mbti}
                  </span>
                )}
                {player.disposition && (
                  <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                    style={{ background: "rgba(0,200,83,0.12)", color: "#00C853", fontFamily: "var(--font-space-mono)" }}>
                    성향 · {player.disposition}
                  </span>
                )}
              </div>
            )}

            {player.personalValues && (
              <div className="rounded-2xl px-5 py-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[10px] uppercase tracking-[2px] mb-2"
                  style={{ fontFamily: "var(--font-space-mono)", color: "#00C853" }}>Values</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#FAFCFF" }}>
                  {player.personalValues}
                </p>
              </div>
            )}

            {player.bio && (
              <div className="rounded-2xl px-5 py-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[10px] uppercase tracking-[2px] mb-2"
                  style={{ fontFamily: "var(--font-space-mono)", color: "#00C853" }}>About Me</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#FAFCFF" }}>
                  {player.bio}
                </p>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
