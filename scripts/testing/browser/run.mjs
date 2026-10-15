import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { deploymentReadArgs, parseConfig, validateDeploymentMetadata } from "./config.mjs";
import { armBrowserWatchdog } from "./watchdog.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const browserTimeoutMs = 180_000;

function redact(value) {
  // Runtime failures can echo either plain text or a JSON-escaped stdin source.
  return [process.env.FAIRGROUND_BROWSER_CAPTAIN_PASSWORD, process.env.FAIRGROUND_BROWSER_PREVIEW_BYPASS]
    .filter(Boolean).flatMap((secret) => [secret, JSON.stringify(secret).slice(1, -1)])
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
  const suiteUrl = pathToFileURL(resolve(repositoryRoot, "scripts/testing/browser/session.mjs")).href;
  // Ego's isolated execution runtime does not inherit the CLI environment.
  // Credentials travel only through stdin, never argv, config or an artifact.
  const credentials = {
    email: process.env.FAIRGROUND_BROWSER_CAPTAIN_EMAIL,
    password: process.env.FAIRGROUND_BROWSER_CAPTAIN_PASSWORD,
    protectionBypass: config.engine === "chromium" ? process.env.FAIRGROUND_BROWSER_PREVIEW_BYPASS : undefined,
  };
  const isolated = config.engine === "chromium";
  const source = isolated ? JSON.stringify({ config, credentials }) : `const { runRegressionSession } = await import(${JSON.stringify(suiteUrl)});\nawait runRegressionSession({ taskSpace, config: ${JSON.stringify(config)}, credentials: ${JSON.stringify(credentials)} });\n`;
  await new Promise((resolveRun, reject) => {
    const command = isolated ? process.execPath : "ego-browser";
    const args = isolated ? [resolve(repositoryRoot, "scripts/testing/browser/chromium-entry.mjs")] : ["nodejs"];
    const childEnvironment = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
      !["FAIRGROUND_BROWSER_CAPTAIN_EMAIL", "FAIRGROUND_BROWSER_CAPTAIN_PASSWORD", "FAIRGROUND_BROWSER_PREVIEW_BYPASS"].includes(name)));
    const child = spawn(command, args, {
      cwd: repositoryRoot, env: childEnvironment, stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let forcedTermination;
    const cancelWatchdog = armBrowserWatchdog(child, {
      engine: config.engine, timeoutMs: browserTimeoutMs,
      onTimeout: () => { timedOut = true; },
      onForceTermination: (receipt) => { forcedTermination = receipt; },
    });
    child.stdout.setEncoding("utf8").on("data", (data) => { stdout += data; });
    child.stderr.setEncoding("utf8").on("data", (data) => { stderr += data; });
    child.once("error", (error) => {
      cancelWatchdog();
      reject(new Error(`Could not start ${config.engine} (${error.code ?? "unknown error"}); no retry was attempted.`));
    });
    child.once("close", (code, signal) => {
      cancelWatchdog();
      if (stdout) process.stdout.write(redact(stdout));
      if (stderr) process.stderr.write(redact(stderr));
      if (timedOut) {
        const failure = new Error(`Browser run exceeded ${browserTimeoutMs / 1000}s. Inspect the evidence and ${isolated ? "Chromium cleanup receipt" : `existing TaskSpace ${config.space}`} for possible late app effects; no app input is retried.`);
        writeFile(resolve(config.output, "runner-timeout.json"), JSON.stringify({
          status: "failed", engine: config.engine, timeoutMs: browserTimeoutMs,
          forcedTermination: forcedTermination ?? null,
        }, null, 2) + "\n", { mode: 0o600 }).then(() => reject(failure), reject);
      } else if (code !== 0) {
        reject(new Error(`Browser regression failed (${signal ?? `exit ${code}`}). Inspect the ${config.engine} evidence; no app retry was attempted.`));
      } else resolveRun();
    });
    child.stdin.on("error", () => {}); // A failed launch can close stdin before write completes.
    child.stdin.end(source);
  });
}

async function restoreInterruptedIsolation(config) {
  if (config.isolateExtension !== 'aliprice') return;
  let receipt;
  try {
    receipt = JSON.parse(await readFile(resolve(config.output, 'extension-receipt.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return; // No mutation is allowed before a receipt.
    throw error;
  }
  if (receipt.controlPageClosed === true && ['restored', 'unchanged', 'untouched'].includes(receipt.phase)) return;
  const moduleUrl = pathToFileURL(resolve(repositoryRoot, 'scripts/testing/browser/session.mjs')).href;
  const source = `const { recoverExtensionSession } = await import(${JSON.stringify(moduleUrl)});\nawait recoverExtensionSession({ taskSpace, config: ${JSON.stringify(config)}, receipt: ${JSON.stringify(receipt)} });`;
  // No credentials, page input, navigation to the app, or whole-run retry. This
  // addresses only the owned extension control page from the persisted receipt.
  await execFileAsync('ego-browser', ['nodejs', '-e', source], {
    cwd: repositoryRoot, timeout: 30_000, maxBuffer: 1024 * 1024, encoding: 'utf8',
  });
  console.log('Interrupted-run extension restoration verified. App verification remains failed.');
}

async function main() {
  const config = parseConfig(process.argv.slice(2), { repositoryRoot });
  const deployment = await verifyDeployment(config);
  await mkdir(config.output, { recursive: true, mode: 0o700 });
  if ((await readdir(config.output)).length !== 0) throw new Error("--output must be empty; use a fresh external evidence directory for each run.");
  await writeFile(resolve(config.output, "deployment.json"), `${JSON.stringify(deployment, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(`Verified READY Preview ${deployment.id} at ${deployment.sha}. ${config.engine === "chromium" ? "Using isolated Chromium." : `Reusing TaskSpace ${config.space}.`}`);
  let failure;
  try {
    await runBrowser(config);
  } catch (error) {
    failure = error;
  } finally {
    try {
      await restoreInterruptedIsolation(config);
    } catch (error) {
      failure = new Error(`${failure?.message ?? 'Browser verification stopped.'} Extension restoration could not be verified: ${error.name}. Inspect extension-receipt.json in the same TaskSpace.`);
    }
  }
  if (failure) throw failure;
  console.log(`Browser regression completed. Evidence: ${config.output}.${config.engine === "ego" ? " Caller must inspect the result and finish the same TaskSpace once." : ""}`);
}

main().catch((error) => {
  console.error(redact(error.message));
  process.exitCode = 1;
});
