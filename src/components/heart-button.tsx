"use client";

import React, { useState } from "react";
import { Heart } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";

interface Props {
  target: "post" | "comment";
  id: string;
  initialLiked: boolean;
  initialCount: number;
  size?: "sm" | "md";
}

export function HeartButton({ target, id, initialLiked, initialCount, size = "md" }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const toggle = useDataStore((s) => s.toggleReaction);

  const onClick = async () => {
    if (pending) return;
    // optimistic
    const prev = { liked, count };
    setLiked(!liked);
    setCount(count + (liked ? -1 : 1));
    setPending(true);
    try {
      const r = await toggle(target, id);
      setLiked(r.liked);
      setCount(r.count);
    } catch (err) {
      console.error(err);
      setLiked(prev.liked);
      setCount(prev.count);
    } finally {
      setPending(false);
    }
  };

  const px = size === "sm" ? 14 : 16;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ outlineColor: "var(--color-ring)" }}
    >
      <Heart
        width={px}
        height={px}
        fill={liked ? "var(--primary)" : "none"}
        stroke={liked ? "var(--primary)" : "var(--color-fg-ink-muted)"}
        strokeWidth={2}
      />
      <span
        className="text-sm tabular-nums"
        style={{ color: liked ? "var(--primary)" : "var(--color-fg-ink-muted)" }}
      >
        {count}
      </span>
    </button>
  );
}
