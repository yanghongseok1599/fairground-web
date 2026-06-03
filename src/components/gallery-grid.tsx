"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import type { TeamPhoto } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";

function PhotoTile({
  photo,
  index,
  canDelete,
  onOpen,
  onDelete,
  className = "",
}: {
  photo: TeamPhoto;
  index: number;
  canDelete: boolean;
  onOpen: (i: number) => void;
  onDelete: (p: TeamPhoto) => void;
  className?: string;
}) {
  return (
    <figure
      className={`group relative overflow-hidden rounded-md border ${className}`}
      style={{ borderColor: "var(--color-fg-line-soft)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.publicUrl}
        alt={photo.caption ?? ""}
        loading="lazy"
        className="h-full w-full cursor-zoom-in object-cover transition-transform group-hover:scale-105"
        onClick={() => onOpen(index)}
      />
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(photo)}
          aria-label="사진 삭제"
          className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 width={14} height={14} />
        </button>
      )}
    </figure>
  );
}

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

  useEffect(() => setPhotos(initial), [initial]);

  const remove = async (p: TeamPhoto) => {
    if (!confirm("사진을 삭제할까요?")) return;
    try {
      await del(p.id, p.storagePath);
      setPhotos((xs) => xs.filter((x) => x.id !== p.id));
      // Close or shift lightbox if its current photo was removed.
      setLightbox((cur) => {
        if (cur === null) return null;
        const next = photos.findIndex((x) => x.id === p.id);
        if (next === -1) return cur;
        const remaining = photos.length - 1;
        if (remaining <= 0) return null;
        if (cur >= remaining) return remaining - 1;
        return cur;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  const prev = useCallback(() => {
    setLightbox((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);
  const next = useCallback(() => {
    setLightbox((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  // Keyboard nav for lightbox: ←/→ to step, Esc to close.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "Escape") {
        setLightbox(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, prev, next]);

  if (photos.length === 0) return null;

  const hasHero = photos.length >= 5;
  const hero = hasHero ? photos[0] : null;
  const rest = hasHero ? photos.slice(1) : photos;

  return (
    <>
      {hero && (
        <PhotoTile
          photo={hero}
          index={0}
          canDelete={isStaff || player?.id === hero.uploadedBy}
          onOpen={setLightbox}
          onDelete={remove}
          className="mb-2 md:mb-3 aspect-[3/2] w-full"
        />
      )}
      <div
        className={`grid gap-2 md:gap-3 ${
          hasHero
            ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6"
            : "grid-cols-2 md:grid-cols-4"
        }`}
      >
        {rest.map((p, i) => {
          const realIndex = hasHero ? i + 1 : i;
          return (
            <PhotoTile
              key={p.id}
              photo={p}
              index={realIndex}
              canDelete={isStaff || player?.id === p.uploadedBy}
              onOpen={setLightbox}
              onDelete={remove}
              className="aspect-square"
            />
          );
        })}
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-label="사진 확대 보기"
          onClick={() => setLightbox(null)}
        >
          {/* Counter */}
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums text-white">
            {lightbox + 1} / {photos.length}
          </div>

          {/* Close */}
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X width={20} height={20} />
          </button>

          {/* Prev / Next */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="이전 사진"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:left-6"
              >
                <ChevronLeft width={24} height={24} />
              </button>
              <button
                type="button"
                aria-label="다음 사진"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:right-6"
              >
                <ChevronRight width={24} height={24} />
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[lightbox].publicUrl}
            alt={photos[lightbox].caption ?? ""}
            className="max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          />
          {photos[lightbox].caption && (
            <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[90vw] truncate text-center text-sm text-white">
              {photos[lightbox].caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
