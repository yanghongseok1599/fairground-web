"use client";

import React, { useState } from "react";
import { X, Trash2 } from "lucide-react";
import type { TeamPhoto } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";

export function GalleryGrid({
  photos: initial,
  isStaff,
}: {
  photos: TeamPhoto[];
  isStaff: boolean;
}) {
  const [photos, setPhotos] = useState(initial);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const { player } = useAuth();
  const del = useDataStore((s) => s.deleteTeamPhoto);

  React.useEffect(() => setPhotos(initial), [initial]);

  const remove = async (p: TeamPhoto) => {
    if (!confirm("사진을 삭제할까요?")) return;
    try {
      await del(p.id, p.storagePath);
      setPhotos((xs) => xs.filter((x) => x.id !== p.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  if (photos.length === 0) {
    return (
      <div
        className="rounded-md border py-16 text-center text-sm"
        style={{
          borderColor: "var(--color-fg-line-soft)",
          color: "var(--color-fg-ink-muted)",
        }}
      >
        아직 사진이 없습니다
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {photos.map((p, i) => {
          const canDelete = isStaff || player?.id === p.uploadedBy;
          return (
            <figure
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-md border"
              style={{ borderColor: "var(--color-fg-line-soft)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.publicUrl}
                alt={p.caption ?? ""}
                loading="lazy"
                className="h-full w-full cursor-zoom-in object-cover transition-transform group-hover:scale-105"
                onClick={() => setLightbox(i)}
              />
              {canDelete && (
                <button
                  type="button"
                  onClick={() => remove(p)}
                  aria-label="사진 삭제"
                  className="absolute right-1 top-1 rounded-md bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 width={14} height={14} />
                </button>
              )}
            </figure>
          );
        })}
      </div>
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-label="사진 확대 보기"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-white"
          >
            <X width={20} height={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[lightbox].publicUrl}
            alt={photos[lightbox].caption ?? ""}
            className="max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          />
          {photos[lightbox].caption && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-sm text-white">
              {photos[lightbox].caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
