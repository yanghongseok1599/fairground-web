#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const projectDirectory = fileURLToPath(new URL("../../", import.meta.url));
const dataDirectory = "src/features/sponsor-proposal/data";
const mediaExtension = /\.(?:avif|gif|ico|jpeg|jpg|png|svg|webp|mp4|webm|mov|m4v|mp3|wav|ogg)(?:[?#]|$)/i;

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(filename) : /\.tsx?$/.test(entry.name) ? [filename] : [];
  }).sort();
}

// Resolve the existing asset(filename) helper without executing proposal modules.
function staticString(node, variables = new Map()) {
  if (!node) return undefined;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isIdentifier(node)) return variables.get(node.text);
  if (ts.isParenthesizedExpression(node)) return staticString(node.expression, variables);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticString(node.left, variables);
    const right = staticString(node.right, variables);
    return left === undefined || right === undefined ? undefined : left + right;
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      const interpolated = staticString(span.expression, variables);
      if (interpolated === undefined) return undefined;
      value += interpolated + span.literal.text;
    }
    return value;
  }
  return undefined;
}

export function collectProposalMediaReferences(root = projectDirectory) {
  const references = new Map();
  const publicDirectory = path.resolve(root, "public");

  for (const filename of sourceFiles(path.join(root, dataDirectory))) {
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
    if (source.parseDiagnostics.length) throw new Error(`제안서 데이터를 파싱할 수 없습니다: ${filename}`);
    let helper;
    function findHelper(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "asset") helper = node.initializer;
      ts.forEachChild(node, findHelper);
    }
    findHelper(source);

    function location(node) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      return `${path.relative(root, filename)}:${line + 1}`;
    }
    function add(url, node) {
      if (!url?.startsWith("/") || url.startsWith("//") || !mediaExtension.test(url)) return;
      const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]);
      const absolutePath = path.resolve(publicDirectory, `.${pathname}`);
      if (!absolutePath.startsWith(`${publicDirectory}${path.sep}`)) throw new Error(`public 폴더 밖의 미디어 경로: ${url} (${location(node)})`);
      const existing = references.get(pathname);
      if (existing) existing.locations.push(location(node));
      else references.set(pathname, { url: pathname, absolutePath, locations: [location(node)] });
    }
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "asset") {
        const argument = node.arguments.length === 1 ? staticString(node.arguments[0]) : undefined;
        const parameter = helper && ts.isArrowFunction(helper) && helper.parameters.length === 1 ? helper.parameters[0].name : undefined;
        const url = argument !== undefined && parameter && ts.isIdentifier(parameter)
          ? staticString(helper.body, new Map([[parameter.text, argument]])) : undefined;
        if (!url?.startsWith("/") || !mediaExtension.test(url)) throw new Error(`asset() 미디어 경로를 정적으로 확인할 수 없습니다: ${location(node)}`);
        add(url, node);
      } else if (ts.isStringLiteralLike(node)) add(node.text, node);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  if (!references.size) throw new Error("제안서 미디어 참조가 없습니다. 데이터 경로와 asset() 정의를 확인하세요.");
  return [...references.values()].sort((left, right) => left.url.localeCompare(right.url));
}

function trackedPublicFiles(root) {
  let gitRoot;
  try {
    gitRoot = execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null; // Clean deployment archives have no Git metadata.
  }
  // Do not accidentally use a parent repository for an extracted archive.
  if (fs.realpathSync(gitRoot) !== fs.realpathSync(root)) return null;
  return new Set(execFileSync("git", ["-C", root, "ls-files", "--cached", "-z", "--", "public"], { encoding: "utf8" }).split("\0").filter(Boolean));
}

export function checkProposalMediaAssets(root = projectDirectory) {
  const references = collectProposalMediaReferences(root);
  const tracked = trackedPublicFiles(root);
  const issues = [];
  for (const reference of references) {
    let exists = false;
    try { exists = fs.statSync(reference.absolutePath).isFile(); } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    }
    const relativePath = path.relative(root, reference.absolutePath).split(path.sep).join("/");
    if (!exists) issues.push({ code: "missing", ...reference });
    else if (tracked && !tracked.has(relativePath)) issues.push({ code: "untracked", ...reference });
  }
  return { references, issues, gitTrackingChecked: tracked !== null };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkProposalMediaAssets();
    if (result.issues.length) {
      console.error(`제안서 미디어 검사 실패: ${result.issues.length}개 파일`);
      for (const issue of result.issues) console.error(`- ${issue.code === "missing" ? "파일 없음" : "Git 미추적"}: ${issue.url} (${issue.locations.join(", ")})`);
      process.exitCode = 1;
    } else {
      console.log(`제안서 미디어 ${result.references.length}개 확인 완료 · ${result.gitTrackingChecked ? "파일 존재와 Git 추적 검사" : "배포 아카이브 파일 존재 검사 (Git 정보 없음)"}`);
    }
  } catch (error) {
    console.error(`제안서 미디어 검사 실패: ${error.message}`);
    process.exitCode = 1;
  }
}
