"use client";

import React, { useState } from "react";
import { Upload } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import type { TeamPhoto } from "@/types";

async function compressToWebp(file: File, maxPx = 1920, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 업로드할 수 있습니다");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("이미지를 불러오지 못했습니다"));
      i.src = url;
    });
    let { width, height } = img;
    if (Math.max(width, height) > maxPx) {
      const ratio = maxPx / Math.max(width, height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 컨텍스트 실패");
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/webp", quality),
    );
    if (!blob) throw new Error("압축 실패");
    return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(url);
  }
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
  const upload = useDataStore((s) => s.uploadTeamPhoto);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const webp = await compressToWebp(f);
        const p = await upload(teamId, webp, caption.trim() || undefined);
        onUploaded(p);
      }
      setCaption("");
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
    </div>
  );
}
