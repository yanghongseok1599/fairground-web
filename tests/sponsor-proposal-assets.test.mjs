import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkProposalMediaAssets } from "../scripts/proposals/check-media-assets.mjs";

function fixture(t, { git = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fairground-proposal-assets-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (filename, contents) => {
    fs.mkdirSync(path.dirname(path.join(root, filename)), { recursive: true });
    fs.writeFileSync(path.join(root, filename), contents);
  };
  write("src/features/sponsor-proposal/data/example.ts", [
    'const asset = (filename: string) => `/proposals/example/${filename}`;',
    'export const image = asset("photo.webp");',
    'export const player = { photoUrl: "/proposals/example/player.png" };',
    '// asset("comment-does-not-exist.png")',
  ].join("\n"));
  if (git) execFileSync("git", ["init", "--quiet", root]);
  const track = (...filenames) => execFileSync("git", ["-C", root, "add", "--", ...filenames]);
  return { root, write, track };
}

test("a missing image blocks deployment even when the proposal data is tracked", (t) => {
  const f = fixture(t);
  f.write("public/proposals/example/photo.webp", "image");
  f.track("src", "public");
  const result = checkProposalMediaAssets(f.root);
  assert.equal(result.gitTrackingChecked, true);
  assert.equal(result.references.length, 2);
  assert.deepEqual(result.issues.map(({ code, url }) => ({ code, url })), [
    { code: "missing", url: "/proposals/example/player.png" },
  ]);
});

test("an existing but untracked image blocks deployment until it is staged", (t) => {
  const f = fixture(t);
  f.write("public/proposals/example/photo.webp", "image");
  f.write("public/proposals/example/player.png", "image");
  f.track("src", "public/proposals/example/player.png");
  assert.deepEqual(checkProposalMediaAssets(f.root).issues.map(({ code, url }) => ({ code, url })), [
    { code: "untracked", url: "/proposals/example/photo.webp" },
  ]);
  f.track("public/proposals/example/photo.webp");
  assert.deepEqual(checkProposalMediaAssets(f.root).issues, []);
});

test("a clean deployment archive still checks that all referenced files exist", (t) => {
  const f = fixture(t, { git: false });
  f.write("public/proposals/example/photo.webp", "image");
  f.write("public/proposals/example/player.png", "image");
  assert.equal(checkProposalMediaAssets(f.root).gitTrackingChecked, false);
  assert.deepEqual(checkProposalMediaAssets(f.root).issues, []);
  fs.unlinkSync(path.join(f.root, "public/proposals/example/photo.webp"));
  assert.equal(checkProposalMediaAssets(f.root).issues[0].code, "missing");
});
