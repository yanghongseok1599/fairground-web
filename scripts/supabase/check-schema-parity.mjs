#!/usr/bin/env node

/**
 * FairGround — 코드/DB 스키마 정합성 게이트
 *
 * 코드가 참조하는 Supabase 객체(RPC 함수, public 릴레이션, 스토리지 버킷)가
 * 대상 프로젝트에 실제로 존재하는지 확인한다. 하나라도 없으면 exit 1 로
 * 빌드를 세운다. 읽기 전용: SELECT 만 수행하며 스키마도 데이터도 건드리지 않는다.
 *
 *   node scripts/supabase/check-schema-parity.mjs [--json]
 *
 * 종료 코드: 0 = 통과 또는 검사 생략(사유 출력) / 1 = 불일치 또는 검사 불가
 *
 * 배경: 2026-09-03 장애 — 프런트엔드가 아직 DB에 적용되지 않은 마이그레이션의
 * RPC·뷰를 전제로 배포됐다. 마이그레이션 이력 자체의 드리프트 점검은
 * scripts/check-migration-drift.sh 가 담당한다. 이 스크립트는 이력이 아니라
 * "코드가 부르는 객체가 지금 DB에 있는가"만 본다.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SKIP_KEY = "FAIRGROUND_SKIP_DB_PARITY";
const DB_URL_KEY = "SUPABASE_DB_URL";
const CONNECT_TIMEOUT_MS = 10_000;
const SOURCE_DIRECTORY = "src";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORE_FILE = path.join("scripts", "supabase", "parity-ignore.json");
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".next", ".git", "dist", "build", "out"]);

/** `.from(` 앞에 오더라도 Supabase 호출이 아닌 수신자 (Array.from 등). */
const NON_SUPABASE_RECEIVERS = new Set(["Array"]);

const KIND_LABELS = {
  function: "함수",
  relation: "릴레이션",
  bucket: "버킷",
};

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));

// ---------------------------------------------------------------------------
// 주석 제거 — 인덱스와 줄 번호를 보존하기 위해 길이를 바꾸지 않고 공백으로 덮는다.
// ---------------------------------------------------------------------------

const REGEX_PRECEDING_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "case",
  "delete",
  "void",
  "do",
  "else",
  "yield",
  "await",
  "new",
]);

const REGEX_PRECEDING_CHARACTERS = "(,=:[!&|?{};+-*%^~<>";

function isRegexStart(previousCharacter, previousWord) {
  if (previousCharacter === "") return true;
  if (REGEX_PRECEDING_KEYWORDS.has(previousWord)) return true;
  return REGEX_PRECEDING_CHARACTERS.includes(previousCharacter);
}

/** 여는 따옴표 위치에서 시작해 닫는 따옴표 다음 인덱스를 돌려준다. */
function skipQuoted(source, startIndex, quote) {
  let index = startIndex + 1;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === quote) return index + 1;
    if (quote !== "`" && character === "\n") return index; // 종료되지 않은 리터럴 방어
    index += 1;
  }
  return source.length;
}

/** `/` 위치에서 시작해 정규식 리터럴(플래그 포함) 다음 인덱스를 돌려준다. */
function skipRegexLiteral(source, startIndex) {
  let index = startIndex + 1;
  let inCharacterClass = false;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "\n") return index;
    if (character === "[") inCharacterClass = true;
    else if (character === "]") inCharacterClass = false;
    else if (character === "/" && !inCharacterClass) {
      index += 1;
      while (index < source.length && /[a-z]/i.test(source[index])) index += 1;
      return index;
    }
    index += 1;
  }
  return source.length;
}

export function stripComments(source) {
  const characters = source.split("");
  const blankOut = (from, to) => {
    for (let position = from; position < to; position += 1) {
      if (characters[position] !== "\n") characters[position] = " ";
    }
  };

  const stack = [{ kind: "code", braces: 0 }];
  let index = 0;
  let previousCharacter = "";
  let previousWord = "";

  while (index < source.length) {
    const frame = stack[stack.length - 1];
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (frame.kind === "template") {
      if (character === "\\") {
        index += 2;
        continue;
      }
      if (character === "`") {
        stack.pop();
        index += 1;
        continue;
      }
      if (character === "$" && nextCharacter === "{") {
        stack.push({ kind: "expression", braces: 0 });
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      let end = index;
      while (end < source.length && source[end] !== "\n") end += 1;
      blankOut(index, end);
      index = end;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      let end = index + 2;
      while (end < source.length && !(source[end] === "*" && source[end + 1] === "/")) end += 1;
      end = Math.min(end + 2, source.length);
      blankOut(index, end);
      index = end;
      continue;
    }

    if (character === "/" && isRegexStart(previousCharacter, previousWord)) {
      index = skipRegexLiteral(source, index);
      previousCharacter = "/";
      previousWord = "";
      continue;
    }

    if (character === '"' || character === "'") {
      index = skipQuoted(source, index, character);
      previousCharacter = character;
      previousWord = "";
      continue;
    }

    if (character === "`") {
      stack.push({ kind: "template" });
      index += 1;
      previousCharacter = "`";
      previousWord = "";
      continue;
    }

    if (frame.kind === "expression") {
      if (character === "{") {
        frame.braces += 1;
      } else if (character === "}") {
        if (frame.braces === 0) {
          stack.pop();
          index += 1;
          previousCharacter = "}";
          previousWord = "";
          continue;
        }
        frame.braces -= 1;
      }
    }

    if (!/\s/.test(character)) {
      previousCharacter = character;
      previousWord = /[A-Za-z0-9_$]/.test(character) ? previousWord + character : "";
    }
    index += 1;
  }

  return characters.join("");
}

// ---------------------------------------------------------------------------
// 정적 스캔
// ---------------------------------------------------------------------------

const CALL_PATTERN = /\.\s*(rpc|from)\s*\(/g;

function buildLineOffsets(text) {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") offsets.push(index + 1);
  }
  return offsets;
}

function lineNumberAt(lineOffsets, index) {
  let low = 0;
  let high = lineOffsets.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (lineOffsets[middle] <= index) low = middle;
    else high = middle - 1;
  }
  return low + 1;
}

function readReceiver(text, dotIndex) {
  let index = dotIndex - 1;
  while (index >= 0 && /\s/.test(text[index])) index -= 1;
  if (text[index] === "?") {
    index -= 1;
    while (index >= 0 && /\s/.test(text[index])) index -= 1;
  }
  const end = index + 1;
  while (index >= 0 && /[A-Za-z0-9_$]/.test(text[index])) index -= 1;
  return text.slice(index + 1, end);
}

function readLiteral(text, quoteIndex, quote) {
  let index = quoteIndex + 1;
  let value = "";
  while (index < text.length) {
    const character = text[index];
    if (character === "\\") {
      value += text[index + 1] ?? "";
      index += 2;
      continue;
    }
    if (character === quote) return value;
    if (quote !== "`" && character === "\n") return null;
    value += character;
    index += 1;
  }
  return null;
}

function readFirstArgument(text, openIndex) {
  let index = openIndex;
  while (index < text.length && /\s/.test(text[index])) index += 1;
  const quote = text[index];

  if (quote === '"' || quote === "'") {
    const value = readLiteral(text, index, quote);
    return value ? { dynamic: false, value } : { dynamic: true };
  }

  if (quote === "`") {
    const value = readLiteral(text, index, "`");
    if (!value || value.includes("${")) return { dynamic: true };
    return { dynamic: false, value };
  }

  return { dynamic: true };
}

function lineSnippet(source, index) {
  const start = source.lastIndexOf("\n", index) + 1;
  let end = source.indexOf("\n", index);
  if (end === -1) end = source.length;
  const line = source.slice(start, end).trim();
  return line.length > 100 ? `${line.slice(0, 97)}...` : line;
}

/**
 * 소스 한 개에서 Supabase 객체 참조를 수집한다.
 *
 * - `.rpc("name")` → 함수
 * - `.from("name")` → 릴레이션. 단 수신자가 `storage` 면 스토리지 버킷
 * - 주석 안의 호출은 수집하지 않는다
 * - 변수·보간 템플릿 인자는 dynamic 으로 분류한다(검증 불가, 실패 사유 아님)
 */
export function extractReferences(sourceText, filePath) {
  const stripped = stripComments(sourceText);
  const lineOffsets = buildLineOffsets(stripped);
  const references = [];
  const dynamic = [];

  CALL_PATTERN.lastIndex = 0;
  let match = CALL_PATTERN.exec(stripped);
  while (match !== null) {
    const receiver = readReceiver(stripped, match.index);
    if (!NON_SUPABASE_RECEIVERS.has(receiver)) {
      const kind =
        match[1] === "rpc" ? "function" : receiver === "storage" ? "bucket" : "relation";
      const argument = readFirstArgument(stripped, match.index + match[0].length);
      const line = lineNumberAt(lineOffsets, match.index);

      if (argument.dynamic) {
        dynamic.push({ kind, file: filePath, line, snippet: lineSnippet(sourceText, match.index) });
      } else {
        references.push({ kind, name: argument.value, file: filePath, line });
      }
    }
    match = CALL_PATTERN.exec(stripped);
  }

  return { references, dynamic };
}

/**
 * parity-ignore.json 의 제외 목록을 적용한다.
 * 제외된 항목은 사유와 함께 그대로 돌려줘서 출력에 남긴다 — 조용히 사라지지 않도록.
 */
export function filterIgnored(references, ignore) {
  const lists = {
    function: new Map((ignore?.functions ?? []).map((entry) => [entry.name, entry.reason ?? ""])),
    relation: new Map((ignore?.relations ?? []).map((entry) => [entry.name, entry.reason ?? ""])),
    bucket: new Map((ignore?.buckets ?? []).map((entry) => [entry.name, entry.reason ?? ""])),
  };

  const kept = [];
  const ignored = new Map();

  for (const reference of references) {
    const reasons = lists[reference.kind];
    if (reasons?.has(reference.name)) {
      const key = `${reference.kind}:${reference.name}`;
      if (!ignored.has(key)) {
        ignored.set(key, {
          kind: reference.kind,
          name: reference.name,
          reason: reasons.get(reference.name),
        });
      }
      continue;
    }
    kept.push(reference);
  }

  return { kept, ignored: [...ignored.values()] };
}

/**
 * 코드 참조와 DB 실존 객체를 대조해 "코드에는 있는데 DB에 없는" 목록을 만든다.
 * 반대 방향(DB에만 있는 객체)은 게이트의 관심사가 아니다 — 배포를 깨지 않는다.
 */
export function diffAgainstDatabase(byKind, existing) {
  const missing = { function: [], relation: [], bucket: [] };

  for (const kind of ["function", "relation", "bucket"]) {
    for (const [name, references] of byKind[kind]) {
      if (!existing[kind].has(name)) missing[kind].push({ name, references });
    }
    missing[kind].sort((left, right) => left.name.localeCompare(right.name));
  }

  return missing;
}

function listSourceFiles(directory) {
  const found = [];
  const stack = [directory];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        stack.push(fullPath);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        found.push(fullPath);
      }
    }
  }

  return found.sort();
}

function readIgnoreFile(projectRoot) {
  const filePath = path.join(projectRoot, IGNORE_FILE);
  if (!fs.existsSync(filePath)) return { relations: [], functions: [], buckets: [] };

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      relations: parsed.relations ?? [],
      functions: parsed.functions ?? [],
      buckets: parsed.buckets ?? [],
    };
  } catch (error) {
    console.error(`오류: ${IGNORE_FILE} 을 읽을 수 없습니다 — ${error.message}`);
    process.exit(1);
  }
}

function scanProject(projectRoot) {
  const sourceRoot = path.join(projectRoot, SOURCE_DIRECTORY);
  const files = listSourceFiles(sourceRoot);
  const allReferences = [];
  const dynamic = [];

  for (const file of files) {
    const relativePath = path.relative(projectRoot, file);
    const { references, dynamic: dynamicReferences } = extractReferences(
      fs.readFileSync(file, "utf8"),
      relativePath,
    );
    allReferences.push(...references);
    dynamic.push(...dynamicReferences);
  }

  const { kept, ignored } = filterIgnored(allReferences, readIgnoreFile(projectRoot));

  const byKind = { function: new Map(), relation: new Map(), bucket: new Map() };
  for (const reference of kept) {
    const bucket = byKind[reference.kind];
    if (!bucket.has(reference.name)) bucket.set(reference.name, []);
    bucket.get(reference.name).push({ file: reference.file, line: reference.line });
  }

  return { fileCount: files.length, byKind, dynamic, ignored };
}

// ---------------------------------------------------------------------------
// DB 조회 — SELECT 전용
// ---------------------------------------------------------------------------

const FUNCTION_SQL = `
  select p.proname as name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
`;

const RELATION_SQL = `
  select c.relname as name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'v', 'm', 'p', 'f')
`;

const BUCKET_SQL = `select id, name from storage.buckets`;

async function fetchDatabaseObjects(connectionString) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: CONNECT_TIMEOUT_MS,
    statement_timeout: CONNECT_TIMEOUT_MS,
  });

  await client.connect();
  try {
    const [functions, relations, buckets] = await Promise.all([
      client.query(FUNCTION_SQL),
      client.query(RELATION_SQL),
      client.query(BUCKET_SQL),
    ]);

    return {
      function: new Set(functions.rows.map((row) => row.name)),
      relation: new Set(relations.rows.map((row) => row.name)),
      bucket: new Set(buckets.rows.flatMap((row) => [row.id, row.name].filter(Boolean))),
    };
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// 출력
// ---------------------------------------------------------------------------

function printScanSummary(scan) {
  console.log("FairGround — 코드/DB 스키마 정합성 검사");
  console.log(
    `정적 스캔: ${SOURCE_DIRECTORY}/ 하위 ${scan.fileCount}개 파일 — ` +
      `함수 ${scan.byKind.function.size}개 / 릴레이션 ${scan.byKind.relation.size}개 / ` +
      `버킷 ${scan.byKind.bucket.size}개`,
  );
}

function printDynamic(scan) {
  if (scan.dynamic.length === 0) return;
  console.warn(`\n경고: 이름을 정적으로 알 수 없어 검증하지 못한 호출 ${scan.dynamic.length}건`);
  for (const entry of scan.dynamic) {
    console.warn(`  ${entry.file}:${entry.line} (${KIND_LABELS[entry.kind]}) — ${entry.snippet}`);
  }
}

function printIgnored(scan) {
  if (scan.ignored.length === 0) return;
  console.warn(`\n무시됨 ${scan.ignored.length}건 (${IGNORE_FILE})`);
  for (const entry of scan.ignored) {
    console.warn(`  ${KIND_LABELS[entry.kind]} ${entry.name} — ${entry.reason || "사유 없음"}`);
  }
}

function printMissing(missing) {
  for (const kind of ["function", "relation", "bucket"]) {
    const entries = missing[kind];
    if (entries.length === 0) continue;
    console.error(`\n없는 ${KIND_LABELS[kind]} ${entries.length}개:`);
    for (const entry of entries) {
      console.error(`  ${entry.name}`);
      for (const reference of entry.references) {
        console.error(`    ← ${reference.file}:${reference.line}`);
      }
    }
  }
}

function buildJsonReport({ scan, status, missing = null, message = null }) {
  return {
    ok: status.exitCode === 0,
    checked: status.checked,
    skipped: status.skipped,
    message,
    scanned: {
      files: scan.fileCount,
      functions: scan.byKind.function.size,
      relations: scan.byKind.relation.size,
      buckets: scan.byKind.bucket.size,
    },
    references: {
      functions: [...scan.byKind.function.keys()].sort(),
      relations: [...scan.byKind.relation.keys()].sort(),
      buckets: [...scan.byKind.bucket.keys()].sort(),
    },
    missing: missing ?? { function: [], relation: [], bucket: [] },
    dynamic: scan.dynamic,
    ignored: scan.ignored,
    exitCode: status.exitCode,
  };
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------

// 검사를 생략할 수 없는 환경인지 판정한다.
//
// CI 값은 시스템마다 다르다 — GitHub Actions 는 "true", Vercel 은 "1" 을 넣는다.
// `CI === "true"` 로만 보면 Vercel Preview 빌드가 게이트를 통과해 버린다.
// 그래서 "비어 있지 않고 명시적 거짓이 아닌 값"을 전부 참으로 취급한다.
//
// VERCEL_ENV 는 production·preview 만 엄격 대상이다. `vercel dev` 는
// development 를 넣으므로 로컬 개발을 막지 않는다.
export function isTruthyFlag(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return false;
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
}

export function isStrictEnvironment(env = process.env) {
  if (isTruthyFlag(env.CI)) return true;
  const vercelEnv = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  return vercelEnv === "production" || vercelEnv === "preview";
}

function emptyScan() {
  return {
    fileCount: 0,
    byKind: { function: new Map(), relation: new Map(), bucket: new Map() },
    dynamic: [],
    ignored: [],
  };
}

async function main() {
  const asJson = process.argv.includes("--json");
  const emit = (report) => {
    if (asJson) console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.exitCode;
  };

  // 긴급 탈출구. 조용히 통과시키지 않고 반드시 이유를 남긴다.
  if (process.env[SKIP_KEY] === "1") {
    const message = `${SKIP_KEY}=1 이 설정되어 스키마 정합성 검사를 건너뛰었습니다. 코드가 참조하는 DB 객체의 실존 여부를 확인하지 않은 채 빌드가 진행됩니다.`;
    if (!asJson) {
      console.warn("################################################################");
      console.warn(`## 경고: ${SKIP_KEY}=1 — 스키마 정합성 검사를 건너뜁니다.`);
      console.warn("## 코드가 참조하는 DB 객체의 실존 여부를 확인하지 않았습니다.");
      console.warn("## 배포 후 반드시 마이그레이션 적용 상태를 직접 확인하고,");
      console.warn("## 이 플래그를 제거하십시오. 근거: docs/supabase-deploy-gate.md");
      console.warn("################################################################");
    }
    emit(
      buildJsonReport({
        scan: emptyScan(),
        status: { checked: false, skipped: SKIP_KEY, exitCode: 0 },
        message,
      }),
    );
    return;
  }

  const scan = scanProject(PROJECT_ROOT);
  if (!asJson) printScanSummary(scan);

  const connectionString = process.env[DB_URL_KEY];

  if (!connectionString) {
    const strict = isStrictEnvironment();
    const message = `${DB_URL_KEY} 가 설정되지 않아 DB 조회를 수행하지 못했습니다.`;

    if (!asJson) {
      console.error(`\n${strict ? "차단" : "경고"}: ${message}`);
      if (strict) {
        console.error("CI 또는 프로덕션 빌드에서는 검사를 생략할 수 없습니다. 해결 방법 2가지:");
        console.error(
          `  1) ${DB_URL_KEY} 를 설정한다 — GitHub repo secret 및 Vercel 환경변수(Production/Preview).`,
        );
        console.error(
          `     Supabase 대시보드 → Project Settings → Database → Connection string (Session pooler, 5432)`,
        );
        console.error(
          `  2) 긴급 배포라면 ${SKIP_KEY}=1 을 설정한다 — 검사를 포기하는 것이므로 사후 확인 필수.`,
        );
        console.error("  자세한 절차: docs/supabase-deploy-gate.md");
      } else {
        console.error(
          `로컬 실행이므로 통과시킵니다. 실제 검증을 하려면 ${DB_URL_KEY} 를 설정한 뒤 다시 실행하십시오.`,
        );
      }
      printDynamic(scan);
      printIgnored(scan);
    }

    emit(
      buildJsonReport({
        scan,
        status: { checked: false, skipped: `no-${DB_URL_KEY}`, exitCode: strict ? 1 : 0 },
        message,
      }),
    );
    return;
  }

  let existing;
  try {
    existing = await fetchDatabaseObjects(connectionString);
  } catch (error) {
    const strict = isStrictEnvironment();
    const message = `DB 연결 또는 조회에 실패했습니다 — ${error.message}`;

    if (!asJson) {
      console.error(`\n${strict ? "차단" : "경고"}: ${message}`);
      if (strict) {
        console.error(
          `CI 또는 프로덕션 빌드에서는 검사를 생략할 수 없습니다. ${DB_URL_KEY} 값과 네트워크를 확인하십시오.`,
        );
        console.error(`긴급 배포라면 ${SKIP_KEY}=1 로 우회할 수 있으나 사후 확인이 필요합니다.`);
      } else {
        console.error("로컬 실행이므로 통과시킵니다.");
      }
      printDynamic(scan);
      printIgnored(scan);
    }

    emit(
      buildJsonReport({
        scan,
        status: { checked: false, skipped: "db-unreachable", exitCode: strict ? 1 : 0 },
        message,
      }),
    );
    return;
  }

  const missing = diffAgainstDatabase(scan.byKind, existing);
  const missingCount =
    missing.function.length + missing.relation.length + missing.bucket.length;

  if (!asJson) {
    console.log(
      `DB 조회: 함수 ${existing.function.size}개 / 릴레이션 ${existing.relation.size}개 / 버킷 ${existing.bucket.size}개`,
    );
    printDynamic(scan);
    printIgnored(scan);

    if (missingCount === 0) {
      console.log("\n통과: 코드가 참조하는 DB 객체가 모두 존재합니다.");
    } else {
      printMissing(missing);
      console.error(
        `\n차단: 코드가 참조하지만 DB에 없는 객체 ${missingCount}개. 마이그레이션을 먼저 적용한 뒤 배포하십시오.`,
      );
      console.error("  이력 드리프트 점검: ./scripts/check-migration-drift.sh");
      console.error("  절차: docs/supabase-deploy-gate.md");
    }
  }

  emit(
    buildJsonReport({
      scan,
      status: { checked: true, skipped: null, exitCode: missingCount === 0 ? 0 : 1 },
      missing,
    }),
  );
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  await main();
}
