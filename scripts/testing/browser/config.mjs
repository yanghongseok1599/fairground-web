import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export const PREVIEW_PROJECT_ID = "prj_B7H9QQfzNk3k7wGMChAlDkHwJmmp";
export const PREVIEW_TEAM_ID = "team_R2Rnj6bZAoy7zwFFdA8NSccB";
export const PREVIEW_SCOPE = "milestones-projects-d52c4dda";
export const SYNTHETIC_CAPTAIN_EMAIL = "captain@example.com";
const DEPLOYMENT_HOST = /^fairground-[a-z0-9]{9}-milestones-projects-d52c4dda\.vercel\.app$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;

export function validatePreviewUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("--url must be an absolute immutable FairGround Preview URL.");
  }
  if (
    typeof value !== "string" ||
    !DEPLOYMENT_HOST.test(url.hostname) ||
    url.protocol !== "https:" ||
    url.username || url.password || url.port || url.search || url.hash ||
    url.pathname !== "/" ||
    (value !== url.origin && value !== `${url.origin}/`)
  ) {
    throw new Error("Only an exact generated FairGround Preview origin is allowed; aliases, production, credentials, ports and paths are forbidden.");
  }
  return url.origin;
}

function strictInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (!/^[1-9]\d*$/.test(value ?? "") || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}.`);
  }
  return Number(value);
}

function canonicalFuturePath(path) {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  if (parent === path) throw new Error("Cannot resolve output directory.");
  return resolve(canonicalFuturePath(parent), relative(parent, path));
}

export function validateOutputPath(output, repositoryRoot) {
  if (typeof output !== "string" || !isAbsolute(output)) {
    throw new Error("--output must be an absolute directory outside this repository.");
  }
  const canonicalRoot = realpathSync(repositoryRoot);
  const canonicalOutput = canonicalFuturePath(resolve(output));
  const fromRoot = relative(canonicalRoot, canonicalOutput);
  if (fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !isAbsolute(fromRoot))) {
    throw new Error("Browser evidence must be outside the repository, including through symlinks.");
  }
  if (existsSync(canonicalOutput) && !statSync(canonicalOutput).isDirectory()) {
    throw new Error("--output must name a directory.");
  }
  return canonicalOutput;
}

export function validateCredentials(environment) {
  if (environment.FAIRGROUND_BROWSER_CAPTAIN_EMAIL !== SYNTHETIC_CAPTAIN_EMAIL) {
    throw new Error("Set FAIRGROUND_BROWSER_CAPTAIN_EMAIL to the synthetic development captain account.");
  }
  if (!environment.FAIRGROUND_BROWSER_CAPTAIN_PASSWORD?.trim()) {
    throw new Error("Set FAIRGROUND_BROWSER_CAPTAIN_PASSWORD in the environment; never pass credentials as CLI arguments.");
  }
  return { email: SYNTHETIC_CAPTAIN_EMAIL };
}

export function parseConfig(argv, { repositoryRoot, environment = process.env } = {}) {
  const options = {};
  const allowed = new Set(["--url", "--space", "--page", "--output", "--repeat", "--sha"]);
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    if (!allowed.has(option)) throw new Error("Unknown argument; supported options are --url, --space, --page, --output, --repeat and --sha.");
    if (Object.hasOwn(options, option)) throw new Error(`Duplicate option ${option}.`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${option}.`);
    options[option] = value;
  }
  if (!COMMIT_SHA.test(options["--sha"] ?? "")) throw new Error("--sha must be the full lowercase 40-character expected Preview commit SHA.");
  const page = options["--page"] ?? "p1";
  if (!/^p[1-9]\d*$/.test(page)) throw new Error("--page must be an existing permanent Page label such as p1 or p2.");
  return {
    url: validatePreviewUrl(options["--url"]),
    space: strictInteger(options["--space"], "--space"),
    page,
    output: validateOutputPath(options["--output"], repositoryRoot),
    repeat: strictInteger(options["--repeat"] ?? "3", "--repeat", 10),
    sha: options["--sha"],
    repositoryRoot: realpathSync(repositoryRoot),
    ...validateCredentials(environment),
  };
}

export function deploymentReadArgs(url) {
  const hostname = new URL(validatePreviewUrl(url)).hostname;
  return [
    "api", `/v13/deployments/${hostname}?teamId=${PREVIEW_TEAM_ID}`,
    "--method", "GET", "--raw", "--scope", PREVIEW_SCOPE,
  ];
}

export function validateDeploymentMetadata(metadata, { url, sha }) {
  const hostname = new URL(validatePreviewUrl(url)).hostname;
  if (!COMMIT_SHA.test(sha ?? "")) throw new Error("Expected deployment commit SHA is required.");
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("Vercel returned no unambiguous deployment metadata.");
  if (metadata.projectId !== PREVIEW_PROJECT_ID || (metadata.project && metadata.project.id !== PREVIEW_PROJECT_ID)) {
    throw new Error("Deployment does not belong to the expected FairGround Vercel project.");
  }
  if (metadata.target !== null && metadata.target !== "preview") throw new Error("Deployment is not explicitly a Preview; refusing browser access.");
  if (metadata.readyState !== "READY") throw new Error("Preview deployment is not READY.");
  if (metadata.url !== hostname) throw new Error("Vercel deployment URL does not exactly match the requested immutable Preview.");
  if (metadata.meta?.githubCommitSha !== sha) throw new Error("Preview deployment commit does not match --sha.");
  if (typeof metadata.id !== "string" || !/^dpl_[A-Za-z0-9]+$/.test(metadata.id)) throw new Error("Vercel deployment identity is missing or invalid.");
  // Never return env, tokens, creator details or other raw API response fields.
  return {
    id: metadata.id, url: metadata.url, projectId: metadata.projectId,
    target: metadata.target, readyState: metadata.readyState,
    sha: metadata.meta.githubCommitSha,
  };
}
