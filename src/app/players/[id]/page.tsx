"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { PlayerCard } from "@/components/player-card";
import type { Player, Team } from "@/types";
import { ArrowLeft, Download, Share2, Loader2, Pencil } from "lucide-react";

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDataStore();
  const { user } = useAuth();
  const isOwn = user?.uid === id;
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const cardBoxRef = useRef<HTMLDivElement>(null);

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
    if (!cardBoxRef.current || !player) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardBoxRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `${player.name}-fairground.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
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
      <div className="flex-1 flex flex-col items-center px-6 py-10">
        {/* Back */}
        <div className="w-full max-w-sm mb-8">
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

        {/* Space background card */}
        <div
          ref={cardBoxRef}
          className="relative overflow-hidden rounded-2xl"
          style={{ width: 320, height: 320 }}
        >
          {/* Space bg */}
          <img
            src="/images/space-bg.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
          {/* Dark overlay */}
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />
          {/* Gold glow */}
          <div
            className="absolute"
            style={{
              left: "50%", top: "45%",
              transform: "translate(-50%, -50%)",
              width: "80%", height: "80%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(201,168,76,0.28) 0%, rgba(201,168,76,0.08) 40%, transparent 65%)",
            }}
          />
          {/* Light rays */}
          {[-18, -6, 0, 6, 18].map((deg, i) => (
            <div key={i} className="absolute" style={{
              left: "50%", top: 0,
              width: i === 2 ? 3 : 2,
              height: "130%",
              background: `linear-gradient(to bottom, transparent 0%, rgba(201,168,76,${i === 2 ? 0.1 : 0.04}) 30%, rgba(201,168,76,${i === 2 ? 0.15 : 0.06}) 48%, rgba(201,168,76,${i === 2 ? 0.1 : 0.04}) 66%, transparent 100%)`,
              transform: `translateX(-50%) rotate(${deg}deg)`,
              transformOrigin: "50% 45%",
            }} />
          ))}
          {/* Card centered */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: "6%" }}>
            <div style={{ transform: "scale(0.92)", transformOrigin: "center center" }}>
              <PlayerCard player={player} size="lg" teamLogo={team?.logo} />
            </div>
          </div>
          {/* Bottom logo */}
          <div
            className="absolute pointer-events-none flex justify-center"
            style={{ left: 0, right: 0, bottom: "4%", zIndex: 3 }}
          >
            <img
              src="/images/logo-horizontal.png"
              alt="FAIRGROUND"
              style={{ height: 16, opacity: 0.9 }}
              draggable={false}
            />
          </div>
          {/* Edge vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 65% 60% at 50% 45%, transparent 35%, rgba(0,0,0,0.55) 100%)" }}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6 w-full max-w-sm">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "#FFD700", color: "#0D1B2A" }}
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />}
            이미지 저장
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFCFF" }}
          >
            <Share2 className="w-4 h-4" />
            공유하기
          </button>
        </div>

        {/* 카드 수정 (본인만) */}
        {isOwn && (
          <Link
            href="/my/card-edit"
            className="flex items-center justify-center gap-2 mt-3 w-full max-w-sm py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: "rgba(0,200,83,0.08)", border: "1px solid rgba(0,200,83,0.25)", color: "#00C853" }}
          >
            <Pencil className="w-4 h-4" />
            카드 수정
          </Link>
        )}
      </div>
    </div>
  );
}
