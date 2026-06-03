"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, Image as ImageIcon, Upload } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { GalleryUploader } from "@/components/gallery-uploader";
import { GalleryGrid } from "@/components/gallery-grid";
import {
  canManageTeam,
  isTeamMemberOf,
} from "@/lib/team-permissions";
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

  const isTeamMember = isTeamMemberOf(player, team);
  const isStaff = canManageTeam(player, team);

  const uploaderCount = useMemo(() => {
    const ids = new Set(photos.map((p) => p.uploadedBy).filter(Boolean));
    return ids.size;
  }, [photos]);

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
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/teams/${team.id}`}
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold"
          style={{ color: "var(--primary)" }}
        >
          <ArrowLeft width={16} height={16} /> 팀 홈
        </Link>

        {/* Visual-first header — distinct from the text-led 자유게시판.
            Camera mark, photo+contributor counts make this immediately
            readable as "the photo space," not a generic board. */}
        <header
          className="mb-8 flex flex-col gap-5 border p-6 md:flex-row md:items-end md:justify-between md:p-8"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,71,171,0.08), rgba(255,255,255,0.92))",
            borderColor: "rgba(0,71,171,0.16)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              <Camera className="h-7 w-7" />
            </div>
            <div>
              <p
                className="fg-label text-[10px]"
                style={{ color: "var(--primary)" }}
              >
                TEAM GALLERY
              </p>
              <h1
                className="fg-display mt-1 text-2xl font-black md:text-4xl"
                style={{ color: "var(--color-fg-ink)" }}
              >
                {team.name} 갤러리
              </h1>
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--color-fg-ink-muted)" }}
              >
                경기·훈련·일상 사진을 함께 남깁니다.
              </p>
            </div>
          </div>
          {photos.length > 0 && (
            <div className="flex gap-4 md:gap-6">
              <div>
                <div
                  className="fg-mono text-[10px]"
                  style={{ color: "var(--color-fg-ink-muted)" }}
                >
                  PHOTOS
                </div>
                <div
                  className="fg-display text-3xl font-black tabular-nums"
                  style={{ color: "var(--color-fg-ink)" }}
                >
                  {photos.length}
                </div>
              </div>
              <div>
                <div
                  className="fg-mono text-[10px]"
                  style={{ color: "var(--color-fg-ink-muted)" }}
                >
                  CONTRIBUTORS
                </div>
                <div
                  className="fg-display text-3xl font-black tabular-nums"
                  style={{ color: "var(--color-fg-ink)" }}
                >
                  {uploaderCount || "-"}
                </div>
              </div>
            </div>
          )}
        </header>

        {isTeamMember && photos.length > 0 && (
          <div className="mb-8">
            <GalleryUploader
              teamId={team.id}
              onUploaded={(p) => setPhotos((xs) => [p, ...xs])}
            />
          </div>
        )}

        {photos.length === 0 ? (
          /* Hero empty state — encourages the first upload instead of a flat
             "사진 없음" line. Members get a big CTA + uploader; non-members
             get an explanatory placeholder. */
          <div
            className="flex flex-col items-center gap-6 border-2 border-dashed px-6 py-16 text-center md:py-24"
            style={{
              borderColor: "rgba(0,71,171,0.20)",
              background: "rgba(0,71,171,0.02)",
            }}
          >
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background: "rgba(0,71,171,0.08)",
                color: "var(--primary)",
              }}
            >
              <ImageIcon className="h-10 w-10" />
            </div>
            <div>
              <h2
                className="fg-display text-xl font-black md:text-2xl"
                style={{ color: "var(--color-fg-ink)" }}
              >
                팀의 첫 사진을 올려보세요
              </h2>
              <p
                className="mt-2 max-w-md text-sm leading-relaxed"
                style={{ color: "var(--color-fg-ink-muted)" }}
              >
                경기 후 단체 샷, 훈련 모먼트, 뒷풀이 한 컷까지 — 팀원 모두가 함께 보는 시간 캡슐.
              </p>
            </div>
            {isTeamMember ? (
              <GalleryUploader
                teamId={team.id}
                onUploaded={(p) => setPhotos((xs) => [p, ...xs])}
              />
            ) : (
              <p
                className="inline-flex items-center gap-2 text-xs"
                style={{ color: "var(--color-fg-ink-muted)" }}
              >
                <Upload className="h-3 w-3" />
                팀 멤버만 사진을 올릴 수 있어요.
              </p>
            )}
          </div>
        ) : (
          <GalleryGrid photos={photos} isStaff={isStaff} />
        )}
      </div>
    </main>
  );
}
