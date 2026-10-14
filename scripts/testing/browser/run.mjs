import { execFile, spawn } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { deploymentReadArgs, parseConfig, validateDeploymentMetadata } from "./config.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const browserTimeoutMs = 180_000;

function redact(value) {
  const password = process.env.FAIRGROUND_BROWSER_CAPTAIN_PASSWORD;
  if (!password) return String(value);
  // Runtime failures can echo either plain text or a JSON-escaped stdin source.
  return [password, JSON.stringify(password).slice(1, -1)]
    .reduce((text, secret) => text.split(secret).join("[REDACTED]"), String(value));
}

async function verifyDeployment(config) {
  let response;
  try {
    const result = await execFileAsync("vercel", deploymentReadArgs(config.url), {
      cwd: repositoryRoot, timeout: 30_000, maxBuffer: 10 * 1024 * 1024,
      encoding: "utf8", env: process.env,
    });
    response = JSON.parse(result.stdout);
  } catch {
    // Raw CLI output may contain account/environment metadata. Do not print it.
    throw new Error("Could not read Vercel deployment metadata. Check local Vercel CLI authentication; no browser actions started.");
  }
  return validateDeploymentMetadata(response, config);
}

async function runBrowser(config) {
  const suiteUrl = pathToFileURL(resolve(repositoryRoot, "scripts/testing/browser/suite.mjs")).href;
  // Ego's isolated execution runtime does not inherit the CLI environment.
  // Credentials travel only through stdin, never argv, config or an artifact.
  const credentials = {
    email: process.env.FAIRGROUND_BROWSER_CAPTAIN_EMAIL,
    password: process.env.FAIRGROUND_BROWSER_CAPTAIN_PASSWORD,
  };
  const source = `const { runTeamRegression } = await import(${JSON.stringify(suiteUrl)});\nawait runTeamRegression({ taskSpace, config: ${JSON.stringify(config)}, credentials: ${JSON.stringify(credentials)} });\n`;
  await new Promise((resolveRun, reject) => {
    const child = spawn("ego-browser", ["nodejs"], {
      cwd: repositoryRoot, env: process.env, stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, browserTimeoutMs);
    child.stdout.setEncoding("utf8").on("data", (data) => { stdout += data; });
    child.stderr.setEncoding("utf8").on("data", (data) => { stderr += data; });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Could not start ego-browser (${error.code ?? "unknown error"}); no retry was attempted.`));
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (stdout) process.stdout.write(redact(stdout));
      if (stderr) process.stderr.write(redact(stderr));
      if (timedOut) {
        reject(new Error(`Browser run exceeded ${browserTimeoutMs / 1000}s. The existing TaskSpace ${config.space} must be inspected for possible late effects before continuing; no retry, new space or cleanup was attempted.`));
      } else if (code !== 0) {
        reject(new Error(`Browser regression failed (${signal ?? `exit ${code}`}). Inspect TaskSpace ${config.space} and evidence; no retry or cleanup was attempted.`));
      } else resolveRun();
    });
    child.stdin.on("error", () => {}); // A failed launch can close stdin before write completes.
    child.stdin.end(source);
  });
}

async function main() {
  const config = parseConfig(process.argv.slice(2), { repositoryRoot });
  const deployment = await verifyDeployment(config);
  await mkdir(config.output, { recursive: true, mode: 0o700 });
  if ((await readdir(config.output)).length !== 0) throw new Error("--output must be empty; use a fresh external evidence directory for each run.");
  await writeFile(resolve(config.output, "deployment.json"), `${JSON.stringify(deployment, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(`Verified READY Preview ${deployment.id} at ${deployment.sha}. Reusing TaskSpace ${config.space}.`);
  await runBrowser(config);
  console.log(`Browser regression completed. Evidence: ${config.output}. Caller must inspect the result and finish the same TaskSpace once.`);
}

main().catch((error) => {
  console.error(redact(error.message));
  process.exitCode = 1;
});
