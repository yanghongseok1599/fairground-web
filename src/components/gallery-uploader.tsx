"use client";

import React, { useState } from "react";
import { Upload } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { compressImageBlob } from "@/lib/image-compression";
import type { TeamPhoto } from "@/types";

const GALLERY_MAX_PX = 1600;
const GALLERY_QUALITY = 0.78;

async function compressForGallery(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 업로드할 수 있습니다");
  const blob = await compressImageBlob(file, {
    maxPx: GALLERY_MAX_PX,
    mimeType: "image/webp",
    quality: GALLERY_QUALITY,
  });
  return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function GalleryUploader({
  teamId,
  onUploaded,
}: {
  teamId: string;
  onUploaded: (p: TeamPhoto) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [stat, setStat] = useState<{ before: number; after: number; n: number } | null>(null);
  const upload = useDataStore((s) => s.uploadTeamPhoto);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    setStat(null);
    setUploading(true);
    let before = 0;
    let after = 0;
    let n = 0;
    try {
      for (const f of Array.from(files)) {
        before += f.size;
        const webp = await compressForGallery(f);
        after += webp.size;
        n += 1;
        const p = await upload(teamId, webp, caption.trim() || undefined);
        onUploaded(p);
      }
      setCaption("");
      setStat({ before, after, n });
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="rounded-md border p-4"
      style={{ background: "var(--color-fg-paper)", borderColor: "var(--color-fg-line-soft)" }}
    >
      <label
        className="block text-sm font-semibold mb-2"
        style={{ color: "var(--color-fg-ink)" }}
      >
        사진 업로드
      </label>
      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={500}
        placeholder="캡션 (선택)"
        className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
        style={{
          borderColor: "var(--color-fg-line-soft)",
          background: "var(--color-fg-paper)",
        }}
      />
      <label
        className="flex min-h-[88px] cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-3 text-sm"
        style={{
          borderColor: "var(--color-fg-line-soft)",
          color: "var(--color-fg-ink-muted)",
        }}
      >
        <Upload width={16} height={16} />
        {uploading ? "업로드 중..." : "사진 선택 또는 드래그"}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-fg-red, #dc2626)" }}>
          {error}
        </p>
      )}
      {stat && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
          {stat.n}장 자동 압축: {fmtSize(stat.before)} → {fmtSize(stat.after)} (
          {stat.before > 0 ? Math.round((1 - stat.after / stat.before) * 100) : 0}% 절감)
        </p>
      )}
      <p className="mt-2 text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
        업로드 시 자동으로 webp 압축 (최대 {GALLERY_MAX_PX}px)
      </p>
    </div>
  );
}
