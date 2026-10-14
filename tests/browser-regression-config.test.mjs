import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import {
  deploymentReadArgs, parseConfig, PREVIEW_PROJECT_ID, PREVIEW_TEAM_ID,
  validateCredentials, validateDeploymentMetadata, validateOutputPath, validatePreviewUrl,
} from "../scripts/testing/browser/config.mjs";

const temp = mkdtempSync(join(tmpdir(), "fairground-browser-config-"));
const repo = join(temp, "repository");
mkdirSync(repo);
after(() => rmSync(temp, { recursive: true, force: true }));
const url = "https://fairground-c03qbcg49-milestones-projects-d52c4dda.vercel.app";
const sha = "22e311819265e59fd6acb219ea79fb46144ea191";
const environment = {
  FAIRGROUND_BROWSER_CAPTAIN_EMAIL: "captain@example.com",
  FAIRGROUND_BROWSER_CAPTAIN_PASSWORD: "synthetic-test-password",
};
const argv = () => ["--url", url, "--space", "67", "--output", join(temp, "evidence"), "--sha", sha];
const metadata = () => ({
  id: "dpl_test123", projectId: PREVIEW_PROJECT_ID, project: { id: PREVIEW_PROJECT_ID },
  target: null, readyState: "READY", url: new URL(url).hostname,
  meta: { githubCommitSha: sha },
});

test("accepts only an exact immutable FairGround generated HTTPS origin", () => {
  assert.equal(validatePreviewUrl(url), url);
  assert.equal(validatePreviewUrl(`${url}/`), url);
});

for (const [label, value] of [
  ["production canonical domain", "https://fairground.run"],
  ["Vercel canonical alias", "https://fairground.vercel.app"],
  ["branch alias", "https://fairground-git-development-milestones-projects-d52c4dda.vercel.app"],
  ["other project", "https://another-c03qbcg49-milestones-projects-d52c4dda.vercel.app"],
  ["other team", "https://fairground-c03qbcg49-other-team.vercel.app"],
  ["lookalike suffix", `${url}.example.com`],
  ["HTTP", url.replace("https:", "http:")],
  ["credentials", url.replace("https://", "https://user:password@")],
  ["port", `${url}:443`],
  ["path", `${url}/teams`],
  ["normalized dot path", `${url}/teams/..`],
  ["query", `${url}?environment=preview`],
  ["fragment", `${url}#preview`],
  ["whitespace", ` ${url}`],
  ["relative URL", "/teams"],
]) {
  test(`rejects ${label} before any browser access`, () => assert.throws(() => validatePreviewUrl(value)));
}

test("parses a bounded run and keeps the password out of serialized config", () => {
  const config = parseConfig(argv(), { repositoryRoot: repo, environment });
  assert.equal(config.repeat, 3);
  assert.equal(config.space, 67);
  assert.equal(config.page, "p1");
  assert.equal(config.sha, sha);
  assert.equal(config.email, "captain@example.com");
  assert.ok(!JSON.stringify(config).includes(environment.FAIRGROUND_BROWSER_CAPTAIN_PASSWORD));
});

for (const value of ["0", "-1", "11", "3.5", "03", "1e1", "NaN"]) {
  test(`rejects invalid repeat ${value}`, () => {
    assert.throws(() => parseConfig([...argv(), "--repeat", value], { repositoryRoot: repo, environment }), /--repeat/);
  });
}

test("accepts an explicit existing permanent Page label and rejects malformed labels", () => {
  assert.equal(parseConfig([...argv(), "--page", "p2"], { repositoryRoot: repo, environment }).page, "p2");
  for (const value of ["p0", "p01", "p-1", "p1.5", "P2", "page2", "2", "p2/foo", "p2 "]) {
    assert.throws(() => parseConfig([...argv(), "--page", value], { repositoryRoot: repo, environment }), /--page/);
  }
});

test("requires a caller-owned space id and full expected commit SHA", () => {
  for (const value of ["0", "-1", "1.5", "1e3", "9007199254740992", "named-space"]) {
    const args = argv();
    args[3] = value;
    assert.throws(() => parseConfig(args, { repositoryRoot: repo, environment }), /--space/);
  }
  for (const value of ["", "22e3118", sha.toUpperCase()]) {
    const args = argv();
    args[7] = value;
    assert.throws(() => parseConfig(args, { repositoryRoot: repo, environment }));
  }
});

test("rejects ambiguous and unexpected CLI flags without echoing credentials", () => {
  assert.throws(() => parseConfig([...argv(), "--url", url], { repositoryRoot: repo, environment }), /Duplicate/);
  assert.throws(() => parseConfig([...argv(), "--repeat"], { repositoryRoot: repo, environment }), /Missing/);
  assert.throws(() => parseConfig([...argv(), "--password", "secret"], { repositoryRoot: repo, environment }), (error) => !error.message.includes("secret"));
});

test("requires the synthetic development captain and a nonempty password", () => {
  assert.deepEqual(validateCredentials(environment), { email: "captain@example.com" });
  for (const email of ["admin@example.com", "real-user@example.com", "", undefined]) {
    assert.throws(() => validateCredentials({ ...environment, FAIRGROUND_BROWSER_CAPTAIN_EMAIL: email }));
  }
  for (const password of ["", "   ", undefined]) {
    assert.throws(() => validateCredentials({ ...environment, FAIRGROUND_BROWSER_CAPTAIN_PASSWORD: password }));
  }
});

test("evidence must be outside the repository, even via existing or future symlink paths", () => {
  assert.equal(validateOutputPath(join(temp, "outside", "future"), repo), join(realpathSync(temp), "outside", "future"));
  for (const output of [repo, join(repo, "artifacts"), "relative-evidence"]) {
    assert.throws(() => validateOutputPath(output, repo));
  }
  const alias = join(temp, "repo-alias");
  symlinkSync(repo, alias, "dir");
  assert.throws(() => validateOutputPath(alias, repo));
  assert.throws(() => validateOutputPath(join(alias, "future", "evidence"), repo));
  const file = join(temp, "file.txt");
  writeFileSync(file, "not a directory");
  assert.throws(() => validateOutputPath(file, repo));
});

test("Vercel metadata lookup is an explicit GET scoped to the fixed team", () => {
  const args = deploymentReadArgs(url);
  assert.equal(args[0], "api");
  assert.equal(args[1], `/v13/deployments/${new URL(url).hostname}?teamId=${PREVIEW_TEAM_ID}`);
  assert.equal(args[args.indexOf("--method") + 1], "GET");
  assert.ok(!args.includes("--token"));
  assert.throws(() => deploymentReadArgs("https://fairground.vercel.app"));
});

test("accepts READY Preview metadata with matching project, immutable URL and commit", () => {
  for (const target of [null, "preview"]) {
    const result = validateDeploymentMetadata({ ...metadata(), target }, { url, sha });
    assert.equal(result.sha, sha);
    assert.equal(result.target, target);
  }
});

for (const [label, change] of [
  ["production target on generated URL", { target: "production" }],
  ["missing target", { target: undefined }],
  ["custom environment target", { target: "staging" }],
  ["other project id", { projectId: "prj_other" }],
  ["conflicting nested project id", { project: { id: "prj_other" } }],
  ["pending deployment", { readyState: "BUILDING" }],
  ["missing state", { readyState: undefined }],
  ["alias resolution to a different immutable deployment", { url: "fairground-a03qbcg49-milestones-projects-d52c4dda.vercel.app" }],
  ["missing source commit", { meta: {} }],
  ["different source commit", { meta: { githubCommitSha: "a".repeat(40) } }],
  ["missing deployment identity", { id: undefined }],
]) {
  test(`fails closed for ${label}`, () => {
    assert.throws(() => validateDeploymentMetadata({ ...metadata(), ...change }, { url, sha }));
  });
}

test("rejects missing metadata and strips secret or irrelevant fields from evidence", () => {
  for (const value of [null, undefined, [], "preview"]) {
    assert.throws(() => validateDeploymentMetadata(value, { url, sha }));
  }
  const result = validateDeploymentMetadata({ ...metadata(), env: ["SECRET"], token: "SECRET", meta: { githubCommitSha: sha, privateDetail: "SECRET" } }, { url, sha });
  assert.ok(!JSON.stringify(result).includes("SECRET"));
  assert.deepEqual(Object.keys(result).sort(), ["id", "projectId", "readyState", "sha", "target", "url"]);
});
