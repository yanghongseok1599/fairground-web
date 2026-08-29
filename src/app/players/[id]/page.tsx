"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { PlayerCardCaptureFrame } from "@/components/player-card-capture-frame";
import type { Player, Team } from "@/types";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Share2,
  Loader2,
  Pencil,
  UserPlus,
} from "lucide-react";
import { savePngBlob } from "@/lib/card-download";
import { usePreparedElementPng } from "@/hooks/usePreparedElementPng";
import { PLAYER_CARD_CREATE_FROM_SHARE_PATH } from "@/lib/player-card-share-links";

const RESULT_CARD_BOX_SIZE = 560;
const RESULT_CARD_SCALE = 0.51;
const RESULT_CARD_LOGO_HEIGHT = 30;

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDataStore();
  const { user, player: authPlayer } = useAuth();
  const isOwn = user?.uid === id;
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const exportCardRef = useRef<HTMLDivElement>(null);

  const cardExportRevision = JSON.stringify({ player, teamLogo: team?.logo });
  const {
    blob: preparedCardBlob,
    error: cardImageError,
    isPreparing: cardImagePreparing,
    retry: retryCardImage,
  } = usePreparedElementPng(
    exportCardRef,
    cardExportRevision,
    Boolean(!loading && player),
  );

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
    if (!player) return;
    if (!preparedCardBlob) {
      setSaveMessage("카드 이미지를 다시 준비하고 있습니다.");
      retryCardImage();
      return;
    }

    setSaveMessage("");
    setSaving(true);
    try {
      const result = await savePngBlob(preparedCardBlob, `${player.name}-fairground.png`);
      setSaveMessage(
        result === "native-save"
          ? "열린 메뉴에서 ‘이미지 저장’을 누르면 사진 앱에 저장됩니다."
          : "카드 이미지 저장을 시작했습니다.",
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setSaveMessage("이미지를 저장하지 못했습니다. 다시 시도해주세요.");
      console.error(error);
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaveMessage(""), 5000);
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
            href="/players"
            className="inline-flex items-center gap-2 text-sm transition-colors"
            style={{ color: "#627D98" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#00C853"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#627D98"; }}
          >
            <ArrowLeft className="h-4 w-4" />
            선수 목록
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
              disabled={saving || cardImagePreparing || !preparedCardBlob}
              className="flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "#FFD700", color: "#0D1B2A" }}
            >
              {saving || cardImagePreparing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />}
              {cardImagePreparing ? "준비 중" : saving ? "저장 중" : "이미지 저장"}
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

            <Link
              href={PLAYER_CARD_CREATE_FROM_SHARE_PATH}
              className="col-span-2 flex min-h-[56px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition-all hover:-translate-y-0.5 lg:col-span-1"
              style={{
                background: "#0047AB",
                color: "#FFFFFF",
                boxShadow: "0 12px 30px rgba(0,71,171,0.28)",
              }}
            >
              <UserPlus className="h-4 w-4" />
              {authPlayer ? "내 선수카드 보기" : "선수카드 만들러 가기"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {!authPlayer && (
              <p className="col-span-2 text-center text-[11px] leading-relaxed lg:col-span-1" style={{ color: "#A8B7C7" }}>
                내 사진으로 FairGround 선수카드를 만들어보세요
              </p>
            )}

            {saveMessage && (
              <p className="col-span-2 text-center text-xs lg:col-span-1" style={{ color: "#A8B7C7" }}>
                {saveMessage}
              </p>
            )}
            {cardImageError && !saveMessage && (
              <button
                type="button"
                onClick={retryCardImage}
                className="col-span-2 text-xs font-bold underline underline-offset-4 lg:col-span-1"
                style={{ color: "#FFD700" }}
              >
                카드 이미지 준비 실패 · 다시 시도
              </button>
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
