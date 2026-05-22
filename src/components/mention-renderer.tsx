"use client";

import React from "react";
import Link from "next/link";
import { MENTION_REGEX } from "@/lib/mention-parser";

/**
 * 본문(plain-text + @[name](uuid)) 을 안전하게 렌더.
 * - HTML/markdown 무해석 (XSS 방지)
 * - `\n` → pre-wrap 으로 처리
 * - 멘션 칩은 /players/{uuid} 링크
 */
export function MentionRenderer({ body }: { body: string }) {
  const nodes: React.ReactNode[] = [];
  const re = new RegExp(MENTION_REGEX.source, "g");
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(<TextWithBr key={key++} text={body.slice(lastIndex, m.index)} />);
    }
    const [, name, uuid] = m;
    nodes.push(
      <Link
        key={key++}
        href={`/players/${uuid}`}
        className="inline-flex items-baseline rounded-md px-1.5 py-0.5 text-[0.95em] font-semibold"
        style={{ color: "var(--primary)", background: "var(--color-fg-paper-3, #EEF3FF)" }}
      >
        @{name}
      </Link>,
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < body.length) {
    nodes.push(<TextWithBr key={key++} text={body.slice(lastIndex)} />);
  }
  return <span style={{ whiteSpace: "pre-wrap" }}>{nodes}</span>;
}

function TextWithBr({ text }: { text: string }) {
  // pre-wrap 이 \n 처리하므로 단순 문자열 반환.
  return <>{text}</>;
}
