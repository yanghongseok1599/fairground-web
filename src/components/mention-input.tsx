"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDataStore } from "@/stores/dataStore";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  id?: string;
  "aria-describedby"?: string;
}

interface Candidate {
  id: string;
  name: string;
  photoUrl: string;
  teamId: string;
}

export function MentionInput({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength = 8000,
  className,
  id,
  "aria-describedby": ariaDesc,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<string | null>(null); // null = 비활성
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [highlight, setHighlight] = useState(0);
  const search = useDataStore((s) => s.searchProfilesByName);

  // value/커서가 변할 때 마지막 @토큰 추출
  useEffect(() => {
    const ta = taRef.current;
    if (!ta || document.activeElement !== ta) {
      setQuery(null);
      return;
    }
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)@([^\s@\[\]()]{0,30})$/);
    setQuery(m ? m[1] : null);
  }, [value]);

  // 검색
  useEffect(() => {
    if (query === null) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await search(query);
      if (!cancelled) {
        setCandidates(r);
        setHighlight(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, search]);

  const insertMention = (c: Candidate) => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const m = before.match(/(^|\s)@([^\s@\[\]()]{0,30})$/);
    if (!m || m.index === undefined) return;
    const replaced = before.slice(0, m.index + m[1].length) + `@[${c.name}](${c.id}) `;
    const next = replaced + after;
    if (next.length <= maxLength) onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = replaced.length;
    });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query === null || candidates.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % candidates.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + candidates.length) % candidates.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(candidates[highlight]);
    } else if (e.key === "Escape") {
      setQuery(null);
    }
  };

  return (
    <div className="relative">
      <textarea
        id={id}
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        aria-describedby={ariaDesc}
        className={
          className ??
          "flex w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        }
        style={{
          borderColor: "var(--border)",
          background: "var(--color-fg-paper)",
          color: "var(--color-fg-ink)",
        }}
      />
      {query !== null && candidates.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border shadow-lg"
          style={{
            background: "var(--color-fg-paper)",
            borderColor: "var(--color-fg-line-soft)",
          }}
        >
          {candidates.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(c);
              }}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
              style={{
                background: i === highlight ? "var(--color-fg-paper-3, #EEF3FF)" : "transparent",
                color: "var(--color-fg-ink)",
              }}
            >
              {c.photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={c.photoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span
                  className="h-6 w-6 rounded-full"
                  style={{ background: "var(--color-fg-paper-3)" }}
                />
              )}
              <span className="font-semibold">@{c.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
