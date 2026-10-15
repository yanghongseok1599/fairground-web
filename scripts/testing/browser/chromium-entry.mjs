import { runIsolatedChromiumSession } from './chromium.mjs';

// The parent writes one bounded JSON object to stdin. Credentials never appear
// in command arguments, environment configuration, or a source-code artifact.
let credentials;
const controller = new AbortController();
const stop = () => controller.abort();
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
process.once('SIGHUP', stop);

try {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString('utf8');
    if (Buffer.byteLength(input) > 64 * 1024) throw new Error('Chromium session input is too large');
  }
  let parsed;
  try { parsed = JSON.parse(input); }
  catch { throw new Error('Invalid Chromium session JSON input'); }
  input = '';
  credentials = parsed.credentials;
  await runIsolatedChromiumSession({ config: parsed.config, credentials, signal: controller.signal });
} catch (error) {
  let message = String(error.message);
  for (const value of [credentials?.password, credentials?.protectionBypass]) {
    if (typeof value === 'string' && value) {
      for (const secret of [value, JSON.stringify(value).slice(1, -1)]) {
        message = message.split(secret).join('[REDACTED]');
      }
    }
  }
  console.error(message.replace(/https?:\/\/[^\s]+/g, '[URL]'));
  process.exitCode = 1;
} finally {
  process.removeListener('SIGTERM', stop);
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGHUP', stop);
}

// Playwright registers a process-exit cleanup for its owned detached browser
// process and temporary profile. A failed cleanup must not leave IPC keeping
// this isolated worker alive after its receipt has been written.
if (process.exitCode) process.exit(process.exitCode);
