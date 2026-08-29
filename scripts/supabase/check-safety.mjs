#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SUPABASE_URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const PRODUCTION_OVERRIDE_KEY = "FAIRGROUND_ALLOW_PRODUCTION_SUPABASE_DEV";

function parseEnv(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    values[match[1]] = value;
  }

  return values;
}

function readFirstValue(projectDirectory, fileNames, key) {
  for (const fileName of fileNames) {
    const filePath = path.join(projectDirectory, fileName);
    if (!fs.existsSync(filePath)) continue;

    const value = parseEnv(fs.readFileSync(filePath, "utf8"))[key];
    if (value) return { fileName, value };
  }

  return null;
}

function parseSupabaseTarget(urlValue) {
  let url;

  try {
    url = new URL(urlValue);
  } catch {
    return { kind: "invalid", projectRef: null };
  }

  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    return { kind: "local", projectRef: null };
  }

  const match = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
  if (!match) return { kind: "invalid", projectRef: null };

  return { kind: "hosted", projectRef: match[1].toLowerCase() };
}

function maskProjectRef(projectRef) {
  if (!projectRef) return "알 수 없음";
  if (projectRef.length <= 9) return `${projectRef.slice(0, 2)}…${projectRef.slice(-2)}`;
  return `${projectRef.slice(0, 5)}…${projectRef.slice(-4)}`;
}

function describeTarget(target) {
  if (target.kind === "local") return "로컬 Supabase";
  if (target.kind === "hosted") return `호스팅 프로젝트 ${maskProjectRef(target.projectRef)}`;
  return "올바르지 않은 URL";
}

function readLinkedProjectRef(projectDirectory) {
  const filePath = path.join(projectDirectory, "supabase", ".temp", "project-ref");
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8").trim().toLowerCase() || null;
}

function inspect(projectDirectory) {
  const developmentSource = readFirstValue(
    projectDirectory,
    [".env.development.local", ".env.local", ".env.development", ".env"],
    SUPABASE_URL_KEY,
  );
  const productionSource = readFirstValue(
    projectDirectory,
    [".env.production.local", ".env.production"],
    SUPABASE_URL_KEY,
  );

  const developmentTarget = developmentSource
    ? parseSupabaseTarget(developmentSource.value)
    : null;
  const productionTarget = productionSource ? parseSupabaseTarget(productionSource.value) : null;
  const linkedProjectRef = readLinkedProjectRef(projectDirectory);

  const issues = [];
  if (!developmentSource) {
    issues.push("개발용 Supabase URL이 없습니다.");
  } else if (developmentTarget?.kind === "invalid") {
    issues.push(`${developmentSource.fileName}의 Supabase URL 형식이 올바르지 않습니다.`);
  }

  if (!productionSource) {
    issues.push("비교 기준인 운영 Supabase URL이 없습니다.");
  } else if (productionTarget?.kind !== "hosted") {
    issues.push(`${productionSource.fileName}의 운영 Supabase URL 형식이 올바르지 않습니다.`);
  }

  const developmentUsesProduction = Boolean(
    developmentTarget?.kind === "hosted" &&
      productionTarget?.kind === "hosted" &&
      developmentTarget.projectRef === productionTarget.projectRef,
  );

  return {
    developmentSource,
    developmentTarget,
    productionSource,
    productionTarget,
    linkedProjectRef,
    developmentUsesProduction,
    issues,
  };
}

function printStatus(result) {
  const developmentDescription = result.developmentTarget
    ? describeTarget(result.developmentTarget)
    : "설정 없음";
  const productionDescription = result.productionTarget
    ? describeTarget(result.productionTarget)
    : "설정 없음";
  const linkedDescription = result.linkedProjectRef
    ? maskProjectRef(result.linkedProjectRef)
    : "연결 안 됨";

  console.log(
    `개발 환경: ${developmentDescription}${result.developmentSource ? ` (${result.developmentSource.fileName})` : ""}`,
  );
  console.log(
    `운영 환경: ${productionDescription}${result.productionSource ? ` (${result.productionSource.fileName})` : ""}`,
  );
  console.log(`Supabase CLI 연결: ${linkedDescription}`);

  if (
    result.linkedProjectRef &&
    result.productionTarget?.kind === "hosted" &&
    result.linkedProjectRef === result.productionTarget.projectRef
  ) {
    console.warn("주의: Supabase CLI가 운영 프로젝트에 연결되어 있습니다.");
  }

  for (const issue of result.issues) console.error(`오류: ${issue}`);
}

function main() {
  const command = process.argv[2] ?? "status";
  if (!new Set(["status", "dev"]).has(command)) {
    console.error("사용법: node scripts/supabase/check-safety.mjs [status|dev]");
    process.exitCode = 2;
    return;
  }

  const result = inspect(process.cwd());
  printStatus(result);

  if (result.issues.length > 0) {
    process.exitCode = 1;
    return;
  }

  if (!result.developmentUsesProduction) {
    console.log("안전 확인: 개발 환경과 운영 Supabase가 분리되어 있습니다.");
    return;
  }

  const overrideEnabled = process.env[PRODUCTION_OVERRIDE_KEY] === "1";
  if (command === "dev" && overrideEnabled) {
    console.warn(
      `경고: ${PRODUCTION_OVERRIDE_KEY}=1 설정으로 운영 DB 연결을 일시 허용했습니다.`,
    );
    return;
  }

  console.error("차단: 개발 환경이 운영 Supabase를 사용하고 있습니다.");
  console.error(
    "별도 개발 프로젝트를 .env.development.local에 설정하세요. 자세한 내용: docs/supabase-safety.md",
  );
  if (command === "dev") {
    console.error(
      `긴급한 읽기 확인에만 ${PRODUCTION_OVERRIDE_KEY}=1 npm run dev 를 일시적으로 사용할 수 있습니다.`,
    );
  }
  process.exitCode = 1;
}

main();
