"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { GalleryUploader } from "@/components/gallery-uploader";
import { GalleryGrid } from "@/components/gallery-grid";
import type { TeamPhoto, Team } from "@/types";

export default function TeamGalleryPage() {
  const { id } = useParams<{ id: string }>();
  const { player } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [photos, setPhotos] = useState<TeamPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchTeam = useDataStore((s) => s.fetchTeam);
  const fetchPhotos = useDataStore((s) => s.fetchTeamPhotos);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, p] = await Promise.all([fetchTeam(id), fetchPhotos(id, 60)]);
      if (!cancelled) {
        setTeam(t);
        setPhotos(p);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, fetchTeam, fetchPhotos]);

  const isTeamMember = Boolean(player && team && player.teamId === team.id);
  const isStaff = Boolean(
    player &&
      team &&
      (player.id === team.captainId ||
        player.role === "admin" ||
        (player.teamId === team.id &&
          (player.teamRole === "manager" || player.teamRole === "coach"))),
  );

  if (loading) {
    return (
      <main
        className="min-h-screen px-5 py-12"
        style={{ background: "var(--color-fg-paper)" }}
      />
    );
  }
  if (!team) {
    return (
      <main
        className="min-h-screen px-5 py-12"
        style={{
          background: "var(--color-fg-paper)",
          color: "var(--color-fg-ink-muted)",
        }}
      >
        팀을 찾을 수 없습니다
      </main>
    );
  }

  return (
    <main
      className="min-h-screen px-5 py-10 md:px-10"
      style={{ background: "var(--color-fg-paper)" }}
    >
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/teams/${team.id}`}
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold"
          style={{ color: "var(--primary)" }}
        >
          <ArrowLeft width={16} height={16} /> 팀 홈
        </Link>
        <h1
          className="fg-display mb-1 text-3xl font-black"
          style={{ color: "var(--color-fg-ink)" }}
        >
          {team.name} 갤러리
        </h1>
        <p className="mb-8 text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
          경기·훈련·일상 사진을 함께 남깁니다.
        </p>

        {isTeamMember && (
          <div className="mb-8">
            <GalleryUploader
              teamId={team.id}
              onUploaded={(p) => setPhotos((xs) => [p, ...xs])}
            />
          </div>
        )}

        <GalleryGrid photos={photos} isStaff={isStaff} />
      </div>
    </main>
  );
}
