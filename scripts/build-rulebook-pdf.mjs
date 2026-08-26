#!/usr/bin/env node
/**
 * build-rulebook-pdf.mjs — 배포용 규정 PDF 생성기
 * =============================================================================
 * 사용법
 *   node scripts/build-rulebook-pdf.mjs            # 등록된 모든 문서 생성
 *   node scripts/build-rulebook-pdf.mjs match      # 특정 키만 생성
 *   node scripts/build-rulebook-pdf.mjs --keep-html  # 중간 HTML을 .build/ 에 남김
 *
 * 동작
 *   public/document/files 2/*.md (규정 원본)
 *     → 브랜드 스타일 HTML
 *     → Chrome 헤드리스 print-to-PDF (CDP Page.printToPDF)
 *     → public/document/*.pdf
 *
 * 규정이 바뀌면 MD 원본만 고치고 이 스크립트를 다시 실행하면 된다.
 * MD 원본의 정답(single source of truth)은 웹 룰북
 *   src/app/rulebook/rulebook-client.tsx
 * 이며, MD 는 그 내용을 그대로 옮긴 배포본이다. 내용을 여기서 창작하지 말 것.
 *
 * 검증
 *   pdftotext public/document/fairground-match-rulebook-v2.4.pdf - | less
 *
 * 요구 사항
 *   - Google Chrome (macOS 기본 경로. CHROME_PATH 환경변수로 덮어쓸 수 있음)
 *   - Pretendard 폰트 설치 (~/Library/Fonts/Pretendard-*.otf). 없으면 시스템
 *     한글 폰트로 폴백하지만 브랜드 타이포가 달라진다.
 *   - Node 18+ (전역 fetch / WebSocket 사용. Node 22 에서 검증)
 * =============================================================================
 */

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ---------------------------------------------------------------- 문서 등록부 */
/** 새 규정 PDF를 추가하려면 여기에 항목 하나만 더 넣으면 된다. */
const DOCS = [
  {
    key: "match",
    src: "public/document/files 2/페어그라운드_경기_운영규정_v2_4.md",
    out: "public/document/fairground-match-rulebook-v2.4.pdf",
    // 표지/머리말 표기. src/app/rulebook/rulebook-client.tsx 의 doc.title 과 맞춘다.
    title: "경기 · 운영 규정",
    subtitle: "Fair Ground 혼성 풋살 페스티벌 공식 규정",
    version: "v2.4",
    footerLabel: "Fair Ground · 경기 · 운영 규정 v2.4",
  },
  {
    key: "tournament",
    src: "public/document/files 2/페어그라운드_대회규정_v1_2.md",
    out: "public/document/fairground-tournament-rulebook-v1.2.pdf",
    title: "대회 규정",
    subtitle: "Fair Ground 혼성 풋살 페스티벌 공식 대회 규정",
    version: "v1.2",
    footerLabel: "Fair Ground · 대회 규정 v1.2",
  },
  {
    key: "referee",
    src: "public/document/files 2/페어그라운드_심판교육가이드_v2_3.md",
    out: "public/document/fairground-referee-guide-v2.3.pdf",
    title: "심판 교육 가이드",
    subtitle: "Fair Ground 혼성 풋살 페스티벌 심판 집행 매뉴얼",
    version: "v2.3",
    footerLabel: "Fair Ground · 심판 교육 가이드 v2.3",
  },
  {
    key: "captain",
    src: "public/document/files 2/페어그라운드_주장교육가이드_v1_0.md",
    out: "public/document/fairground-captain-guide-v1.0.pdf",
    title: "주장 교육 가이드",
    subtitle: "Fair Ground 혼성 풋살 페스티벌 — 팀 주장을 위한 안내",
    version: "v1.0",
    footerLabel: "Fair Ground · 주장 교육 가이드 v1.0",
  },
];

/* --------------------------------------------------------------- 브랜드 토큰 */
const BRAND = {
  royal: "#0047AB", // Royal Blue
  deep: "#003080", // Deep Blue
  navy: "#0D1B2A", // Dark Navy
  ice: "#EEF3FF", // Ice Blue
  border: "#D0D8E8", // Border
  ink: "#16233A",
  muted: "#5B6B85",
  paper: "#FFFFFF",
};

/* ============================================================ 마크다운 파서 */
/**
 * 규정 문서에 쓰이는 마크다운 부분집합만 다룬다.
 *   # 제목 / 소제목 문단 / > 철학 / --- / ## 제N부 · 제N장 / #### 절
 *   **제N조 (이름)** / **소제목** / ①②③ 항 / - 목록 / 표 / *꼬리말*
 */
const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const front = { title: "", subtitle: "", philosophy: "", philosophyLabel: "대회 철학" };
  const blocks = [];
  let seenBody = false; // 첫 부/장 헤딩 이후부터가 본문
  let i = 0;

  const headingKind = (text, level) => {
    if (/^제\s*\d+\s*부/.test(text)) return "part";
    if (/^제\s*\d+\s*장/.test(text)) return "chapter";
    return level <= 2 ? "chapter" : "section";
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    // 표: 연속된 | 행을 모은다
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].trim());
        i += 1;
      }
      const cells = (r) =>
        r
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows
        .slice(1)
        .filter((r) => !/^\|[\s:|-]+\|$/.test(r))
        .map(cells);
      blocks.push({ k: "table", head, body });
      continue;
    }

    // 목록: 연속된 - 행을 모은다
    if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2).trim());
        i += 1;
      }
      blocks.push({ k: "list", items });
      continue;
    }

    i += 1;

    if (line === "---") {
      blocks.push({ k: "hr" });
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      if (level === 1 && !seenBody) {
        front.title = text;
        continue;
      }
      const kind = headingKind(text, level);
      if (kind === "part" || kind === "chapter") seenBody = true;
      blocks.push({ k: kind, x: text });
      continue;
    }

    if (line.startsWith(">")) {
      // 연속된 > 행은 한 인용 블록으로 묶는다(가이드 문서의 여러 줄 원칙 박스).
      const quoted = [line.replace(/^>\s*/, "")];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoted.push(lines[i].trim().replace(/^>\s*/, ""));
        i += 1;
      }
      const q = quoted.join(" ").trim();
      // 표지 철학은 문서 첫 인용문 하나만. 심판·주장 가이드처럼 본문 시작 전
      // 인용 박스가 더 있으면(핵심 원칙 등) 표지를 덮어쓰지 않고 본문 note 로 낸다.
      if (!seenBody && !front.philosophy) {
        // "> **대회 철학** \"…\"" — 굵은 라벨과 본문을 분리한다(표지에서 라벨 중복 방지)
        const m = q.match(/^\*\*(.+?)\*\*\s*(.*)$/);
        front.philosophyLabel = m ? m[1].trim() : "대회 철학";
        front.philosophy = (m ? m[2] : q).trim();
      } else {
        blocks.push({ k: "note", x: q.replace(/\*\*(.+?)\*\*/g, "$1") });
      }
      continue;
    }

    // **제N조 (이름)**
    const art = line.match(/^\*\*(제\s*\d+\s*조)\s*\(([^)]+)\)\*\*$/);
    if (art) {
      blocks.push({ k: "article", no: art[1].replace(/\s+/g, ""), name: art[2].trim() });
      continue;
    }

    // **소제목**
    const strong = line.match(/^\*\*(.+?)\*\*$/);
    if (strong) {
      blocks.push({ k: "label", x: strong[1].trim() });
      continue;
    }

    // *꼬리말*
    const em = line.match(/^\*(.+?)\*$/);
    if (em) {
      blocks.push({ k: "colophon", x: em[1].trim() });
      continue;
    }

    // ① 항
    if (CIRCLED.includes(line[0])) {
      blocks.push({ k: "clause", mark: line[0], x: line.slice(1).trim() });
      continue;
    }

    if (!seenBody && !front.subtitle) {
      front.subtitle = line;
      continue;
    }
    blocks.push({ k: "p", x: line });
  }

  return { front, blocks };
}

/* =============================================================== HTML 렌더러 */
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** 곧은 겹따옴표를 활자용 따옴표로. 표기만 바꾸고 내용은 건드리지 않는다. */
const quotes = (s) => s.replace(/"([^"]*)"/g, "\u201C$1\u201D");

/** 굵게/따옴표 등 인라인 표기만 최소 지원 */
const inline = (s) => quotes(esc(s)).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

function buildToc(blocks) {
  const entries = [];
  let current = null;
  for (const b of blocks) {
    if (b.k === "part") {
      entries.push({ kind: "part", text: b.x });
      current = null;
    } else if (b.k === "chapter") {
      current = { kind: "chapter", text: b.x, first: null, last: null };
      entries.push(current);
    } else if (b.k === "article" && current) {
      if (!current.first) current.first = b.no;
      current.last = b.no;
    }
  }
  return entries;
}

function articleStats(blocks) {
  const nums = blocks.filter((b) => b.k === "article").map((b) => Number(b.no.match(/\d+/)[0]));
  const parts = blocks.filter((b) => b.k === "part").length;
  const chapters = blocks.filter((b) => b.k === "chapter").length;
  return {
    // 심판·주장 가이드처럼 '제N조' 가 없는 문서는 min/max 가 ±Infinity 가 되므로
    // null 로 두고, 표지·로그에서 장 수만 쓰게 한다.
    min: nums.length ? Math.min(...nums) : null,
    max: nums.length ? Math.max(...nums) : null,
    count: nums.length,
    parts,
    chapters,
  };
}

function renderBody(blocks) {
  const out = [];
  const lastArticle = blocks.reduce((acc, b, i) => (b.k === "article" ? i : acc), -1);
  blocks = blocks.map((b, i) => ({ ...b, i }));
  let open = false; // .article 컨테이너 열림 여부
  const closeArticle = () => {
    if (open) {
      out.push("</section>");
      open = false;
    }
  };

  for (const b of blocks) {
    switch (b.k) {
      case "part":
        closeArticle();
        out.push(`<h2 class="part">${inline(b.x)}</h2>`);
        break;
      case "chapter":
        closeArticle();
        out.push(`<h3 class="chapter">${inline(b.x)}</h3>`);
        break;
      case "section":
        closeArticle();
        out.push(`<h4 class="section">${inline(b.x)}</h4>`);
        break;
      case "article":
        closeArticle();
        out.push(
          `<section class="article"><h5 class="art-h"><span class="art-no">${inline(
            b.no
          )}</span><span class="art-name">${inline(b.name)}</span></h5>`
        );
        open = true;
        break;
      case "clause":
        out.push(
          `<p class="clause"><span class="mark">${inline(b.mark)}</span><span class="body">${inline(
            b.x
          )}</span></p>`
        );
        break;
      case "label":
        out.push(`<p class="label">${inline(b.x)}</p>`);
        break;
      case "list":
        out.push(
          `<ul class="bullets">${b.items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`
        );
        break;
      case "table":
        out.push(
          `<table><thead><tr>${b.head
            .map((c) => `<th>${inline(c)}</th>`)
            .join("")}</tr></thead><tbody>${b.body
            .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`
        );
        break;
      case "note":
        out.push(`<p class="note">${inline(b.x)}</p>`);
        break;
      case "colophon":
        closeArticle();
        out.push(`<p class="colophon">${inline(b.x)}</p>`);
        break;
      case "p":
        out.push(`<p class="${b.i > lastArticle ? "closing" : "para"}">${inline(b.x)}</p>`);
        break;
      case "hr":
        closeArticle();
        break;
      default:
        break;
    }
  }
  closeArticle();
  return out.join("\n");
}

function effectiveDate(blocks) {
  for (const b of blocks) {
    if (b.k !== "p" && b.k !== "note") continue;
    const m = String(b.x).match(/(\d{4})년\s*(\d{1,2})월부터\s*시행/);
    if (m) return `${m[1]}년 ${Number(m[2])}월 시행`;
  }
  return "";
}

function buildHtml(doc, parsed) {
  const { front, blocks } = parsed;
  const stats = articleStats(blocks);
  const toc = buildToc(blocks);
  const eff = effectiveDate(blocks);
  const structure = stats.parts
    ? `${stats.parts}부 ${stats.chapters}장`
    : `${stats.chapters}장`;
  const scope = stats.count
    ? `제${stats.min}조 ~ 제${stats.max}조 (전 ${stats.count}개 조문 · ${structure})`
    : `전 ${structure}`;

  const tocHtml = toc
    .map((e) => {
      if (e.kind === "part") return `<li class="toc-part">${esc(e.text)}</li>`;
      const range = e.first ? (e.first === e.last ? e.first : `${e.first}–${e.last}`) : "";
      return `<li class="toc-ch"><span>${esc(e.text)}</span><span class="toc-dot"></span><span class="toc-range">${esc(
        range
      )}</span></li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${esc(doc.title)} ${esc(doc.version)}</title>
<style>
  /* Pretendard 는 시스템 설치본(~/Library/Fonts)을 사용한다. */
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Pretendard", "Pretendard Variable", "Apple SD Gothic Neo", "AppleGothic", sans-serif;
    font-size: 10.5pt;
    line-height: 1.72;
    color: ${BRAND.ink};
    background: ${BRAND.paper};
    -webkit-font-smoothing: antialiased;
    word-break: keep-all;
    overflow-wrap: anywhere;
    orphans: 2;
    widows: 2;
  }
  strong { font-weight: 700; }

  /* ---------------------------------------------------------------- 표지 */
  .cover { break-after: page; padding-top: 4mm; }
  .cover-band {
    background: linear-gradient(100deg, ${BRAND.royal} 0%, ${BRAND.deep} 100%);
    color: #fff; padding: 13mm 12mm 12mm;
  }
  .cover-mark {
    font-size: 11pt; font-weight: 800; letter-spacing: .34em; text-transform: uppercase;
  }
  .cover-kicker {
    margin-top: 3mm; font-size: 9.5pt; letter-spacing: .05em; color: rgba(255,255,255,.82);
  }
  .cover-title {
    margin: 9mm 0 0; font-size: 30pt; font-weight: 800; letter-spacing: -.02em; line-height: 1.2;
  }
  .cover-sub { margin: 4mm 0 0; font-size: 11pt; font-weight: 400; color: rgba(255,255,255,.88); }

  .cover-meta { margin-top: 10mm; border: 1px solid ${BRAND.border}; }
  .cover-meta div { display: flex; border-bottom: 1px solid ${BRAND.border}; }
  .cover-meta div:last-child { border-bottom: 0; }
  .cover-meta dt {
    width: 30mm; flex: none; margin: 0; padding: 3.4mm 5mm;
    background: ${BRAND.ice}; color: ${BRAND.deep};
    font-size: 10pt; font-weight: 700;
  }
  .cover-meta dd { margin: 0; padding: 3.4mm 5mm; font-size: 10.5pt; font-weight: 700; color: ${BRAND.navy}; }

  .cover-philo {
    margin-top: 8mm; padding: 5mm 6mm;
    background: ${BRAND.ice}; border-left: 3mm solid ${BRAND.royal};
    color: ${BRAND.deep}; font-size: 11pt; font-weight: 700;
  }
  .cover-note {
    margin-top: 7mm; font-size: 9.5pt; color: ${BRAND.muted}; line-height: 1.7;
  }

  /* ---------------------------------------------------------------- 목차 */
  .toc { break-after: page; }
  .toc h2 {
    margin: 0 0 5mm; padding-bottom: 3mm; border-bottom: 1.2pt solid ${BRAND.royal};
    font-size: 16pt; font-weight: 800; color: ${BRAND.navy}; letter-spacing: -.01em;
  }
  .toc ul { list-style: none; margin: 0; padding: 0; }
  .toc-part {
    margin: 6mm 0 2.5mm; padding: 2.2mm 4mm;
    background: ${BRAND.navy}; color: #fff;
    font-size: 11pt; font-weight: 800; letter-spacing: .01em;
  }
  .toc-ch {
    display: flex; align-items: baseline; gap: 2mm;
    padding: 1.9mm 0 1.9mm 4mm; border-bottom: .6pt dotted ${BRAND.border};
    font-size: 10.5pt; color: ${BRAND.ink};
  }
  .toc-dot { flex: 1 1 auto; }
  .toc-range { flex: none; font-size: 10pt; font-weight: 700; color: ${BRAND.royal}; }

  /* ---------------------------------------------------------------- 본문 */
  .part {
    break-before: page; break-after: avoid;
    margin: 0 0 6mm; padding: 4mm 6mm;
    background: ${BRAND.navy}; color: #fff;
    font-size: 15pt; font-weight: 800; letter-spacing: -.01em;
  }
  .chapter {
    break-after: avoid;
    margin: 8mm 0 3.5mm; padding: 0 0 0 4.5mm;
    border-left: 2.6mm solid ${BRAND.royal};
    font-size: 13pt; font-weight: 800; color: ${BRAND.deep}; letter-spacing: -.01em;
  }
  .section {
    break-after: avoid;
    margin: 7mm 0 3mm; padding: 2.4mm 4mm;
    background: ${BRAND.ice}; color: ${BRAND.deep};
    font-size: 11.5pt; font-weight: 800;
  }
  .article { margin: 0 0 4.5mm; }
  .art-h {
    break-after: avoid;
    display: flex; align-items: baseline; gap: 2.6mm;
    margin: 5mm 0 2.2mm; padding-bottom: 1.6mm;
    border-bottom: .8pt solid ${BRAND.border};
    font-size: 11.5pt; font-weight: 800; color: ${BRAND.navy};
  }
  .art-no {
    flex: none; padding: .6mm 2.2mm;
    background: ${BRAND.royal}; color: #fff;
    font-size: 9.5pt; font-weight: 800; letter-spacing: .01em;
  }
  .art-name { letter-spacing: -.01em; }

  .clause { display: flex; gap: 2.2mm; margin: 0 0 1.6mm; padding-left: 1mm; break-inside: avoid; }
  .clause .mark { flex: none; color: ${BRAND.royal}; font-weight: 700; }
  .clause .body { flex: 1 1 auto; }

  .label {
    margin: 4.5mm 0 1.8mm; padding-left: 1mm;
    font-size: 10.5pt; font-weight: 800; color: ${BRAND.deep};
  }
  .para { margin: 0 0 2mm; padding-left: 1mm; }

  ul.bullets { margin: 0 0 3mm; padding-left: 6mm; }
  ul.bullets li { margin: 0 0 1.3mm; padding-left: 1mm; }
  ul.bullets li::marker { color: ${BRAND.royal}; }

  table {
    width: 100%; border-collapse: collapse; break-inside: avoid;
    margin: 3mm 0 4mm; font-size: 10pt;
  }
  th, td { border: .7pt solid ${BRAND.border}; padding: 2.2mm 3mm; text-align: left; vertical-align: top; }
  th { background: ${BRAND.ice}; color: ${BRAND.deep}; font-weight: 800; }
  tbody tr:nth-child(even) td { background: #F8FAFF; }

  .note {
    margin: 3mm 0; padding: 3mm 4mm;
    background: ${BRAND.ice}; border-left: 2mm solid ${BRAND.royal};
    color: ${BRAND.deep}; font-weight: 700;
  }
  .closing {
    margin: 6mm 0 0; padding: 3.4mm 4.5mm;
    background: ${BRAND.ice}; border-left: 2mm solid ${BRAND.royal};
    color: ${BRAND.deep}; font-weight: 700; break-inside: avoid;
  }
  .colophon {
    margin: 9mm 0 0; padding-top: 3mm; border-top: .8pt solid ${BRAND.border};
    font-size: 9.5pt; color: ${BRAND.muted};
  }
</style>
</head>
<body>

<section class="cover">
  <div class="cover-band">
    <div class="cover-mark">Fair Ground</div>
    <div class="cover-kicker">공식 배포용 규정집 · Official Rulebook</div>
    <h1 class="cover-title">${esc(doc.title)}</h1>
    <p class="cover-sub">${esc(doc.subtitle)}</p>
  </div>

  <dl class="cover-meta">
    <div><dt>버전</dt><dd>${esc(doc.version)}</dd></div>
    <div><dt>시행일</dt><dd>${esc(eff || "-")}</dd></div>
    <div><dt>수록 범위</dt><dd>${esc(scope)}</dd></div>
  </dl>

  ${front.philosophy ? `<p class="cover-philo">${esc(front.philosophyLabel)} · ${quotes(esc(front.philosophy))}</p>` : ""}

  <p class="cover-note">
    본 문서는 Fair Ground 운영진이 확정한 공식 규정의 배포본입니다.
    최신본은 fairground-kor.com 룰북 페이지에서 확인할 수 있으며, 웹 룰북과 본 문서의 내용이
    상이한 경우 웹 룰북을 우선 적용합니다.
  </p>
</section>

<section class="toc">
  <h2>목차</h2>
  <ul>${tocHtml}</ul>
</section>

${renderBody(blocks)}

</body>
</html>`;
}

/* ================================================= Chrome 헤드리스 print-to-PDF */
const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let id = 0;
    const listeners = new Map();

    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { ok, fail } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) fail(new Error(JSON.stringify(msg.error)));
        else ok(msg.result);
      } else if (msg.method && listeners.has(msg.method)) {
        listeners.get(msg.method).forEach((fn) => fn(msg.params));
        listeners.delete(msg.method);
      }
    });
    ws.addEventListener("error", (e) => reject(new Error(`CDP 소켓 오류: ${e.message ?? e}`)));
    ws.addEventListener("open", () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((ok, fail) => {
            id += 1;
            pending.set(id, { ok, fail });
            ws.send(JSON.stringify({ id, method, params }));
          }),
        once: (method) =>
          new Promise((ok) => {
            if (!listeners.has(method)) listeners.set(method, []);
            listeners.get(method).push(ok);
          }),
        close: () => ws.close(),
      })
    );
  });
}

async function launchChrome(profileDir) {
  const proc = spawn(
    CHROME,
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error("Chrome DevTools 엔드포인트 대기 시간 초과")), 30000);
    proc.stderr.on("data", (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/ws:\/\/[^\s]+/);
      if (m) {
        clearTimeout(timer);
        resolve(m[0]);
      }
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome 종료 (code ${code})\n${buf}`));
    });
  });

  const base = new URL(wsUrl);
  const listRes = await fetch(`http://${base.host}/json/list`);
  const targets = await listRes.json();
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("Chrome 페이지 타깃을 찾지 못했다");
  return { proc, pageWs: page.webSocketDebuggerUrl };
}

async function printPdf(htmlPath, footerLabel) {
  const profileDir = path.join(tmpdir(), `fg-rulebook-${process.pid}-${Date.now()}`);
  mkdirSync(profileDir, { recursive: true });
  const { proc, pageWs } = await launchChrome(profileDir);
  try {
    const cdp = await connect(pageWs);
    await cdp.send("Page.enable");
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: pathToFileURL(htmlPath).href });
    await loaded;
    // 웹폰트/시스템 폰트 로딩 완료까지 대기 — 한글 폴백 방지
    await cdp.send("Runtime.evaluate", {
      expression: "document.fonts.ready.then(() => true)",
      awaitPromise: true,
    });

    const footer = `<div style="width:100%;padding:0 16mm;font-family:'Pretendard','Apple SD Gothic Neo',sans-serif;font-size:8pt;color:${BRAND.muted};display:flex;justify-content:space-between;align-items:center;">
        <span>${footerLabel}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`;

    const { data } = await cdp.send("Page.printToPDF", {
      paperWidth: 8.27, // A4
      paperHeight: 11.69,
      marginTop: 0.55,
      marginBottom: 0.62,
      marginLeft: 0.63,
      marginRight: 0.63,
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
    });
    cdp.close();
    return Buffer.from(data, "base64");
  } finally {
    proc.kill();
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch {
      /* 프로필 정리 실패는 무시 */
    }
  }
}

/* ========================================================================= main */
const args = process.argv.slice(2);
const keepHtml = args.includes("--keep-html");
const keys = args.filter((a) => !a.startsWith("--"));
const targets = keys.length ? DOCS.filter((d) => keys.includes(d.key)) : DOCS;

if (!targets.length) {
  console.error(`대상 문서를 찾지 못했다. 사용 가능한 키: ${DOCS.map((d) => d.key).join(", ")}`);
  process.exit(1);
}

// 중간 HTML은 기본적으로 OS 임시 디렉터리에 쓴다.
// --keep-html 을 주면 .build/rulebook/ 에 남겨 레이아웃을 직접 열어볼 수 있다.
const buildDir = keepHtml
  ? path.join(ROOT, ".build", "rulebook")
  : path.join(tmpdir(), `fg-rulebook-html-${process.pid}`);
mkdirSync(buildDir, { recursive: true });

for (const doc of targets) {
  const srcPath = path.join(ROOT, doc.src);
  const outPath = path.join(ROOT, doc.out);
  const md = readFileSync(srcPath, "utf8");
  const parsed = parseMarkdown(md);
  const stats = articleStats(parsed.blocks);
  const html = buildHtml(doc, parsed);

  const htmlPath = path.join(buildDir, `${doc.key}.html`);
  writeFileSync(htmlPath, html, "utf8");

  const pdf = await printPdf(htmlPath, doc.footerLabel);
  writeFileSync(outPath, pdf);

  console.log(
    `[${doc.key}] ${doc.out} · ${(pdf.length / 1024).toFixed(0)}KB · ${
      stats.count
        ? `제${stats.min}조~제${stats.max}조 (${stats.count}개 조문)`
        : `${stats.chapters}개 장`
    }`
  );
}

if (!keepHtml) rmSync(buildDir, { recursive: true, force: true });
