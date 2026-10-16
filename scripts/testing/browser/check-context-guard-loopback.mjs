#!/usr/bin/env node
// Explicit runtime check: all traffic terminates on loopback, with external DNS
// disabled. No application, Vercel, Supabase or production connection is made.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createContextRequestGuard } from './context-request-guard.mjs';
import { createNetworkGuard } from './network.mjs';

const previewOrigin = 'https://fairground-000000000-milestones-projects-d52c4dda.vercel.app';
const forbiddenOrigin = 'https://blocked.invalid';
const directory = await mkdtemp(path.join(tmpdir(), 'fairground-context-loopback-'));
const sockets = new Set();
const hits = [];
const results = [];
let fixture;
let proxy;
let browser;

function track(socket) {
  sockets.add(socket);
  socket.once('close', () => sockets.delete(socket));
  socket.on('error', () => {});
  return socket;
}

function listen(server) {
  server.on('connection', track);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function deadline(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), 8000); }),
    ]);
  } finally { clearTimeout(timer); }
}

function serve(request, response) {
  const url = new URL(request.url, `https://${request.headers.host}`);
  hits.push({ method: request.method, host: url.hostname, path: url.pathname });
  request.resume();
  if (url.pathname === '/popup-redirect' || url.pathname === '/owned-redirect') {
    response.writeHead(307, { location: `${forbiddenOrigin}${url.pathname}-target` });
    response.end();
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  response.end('<!doctype html><title>Loopback fixture</title><main>Owned local fixture</main>');
}

async function scenario(name, action) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block' });
  context.setDefaultTimeout(8000);
  context.setDefaultNavigationTimeout(8000);
  const receipt = {};
  const contextGuard = createContextRequestGuard(context, { receipt });
  let networkGuard;
  const start = hits.length;
  try {
    await contextGuard.start();
    const page = await context.newPage();
    contextGuard.bindOwnedPage(page);
    const protocol = await context.newCDPSession(page);
    networkGuard = createNetworkGuard(protocol, { previewOrigin, receipt });
    await networkGuard.start();
    await page.goto(previewOrigin + '/fixture');
    await contextGuard.assertHealthy();
    await networkGuard.assertHealthy();
    const details = await action({ page, contextGuard, networkGuard, receipt });
    const observed = hits.slice(start);
    assert.ok(observed.some((request) => request.host === new URL(previewOrigin).hostname && request.path === '/fixture'),
      'The positive owned-page control must reach the local fixture');
    assert.equal(observed.some((request) => request.host === 'blocked.invalid'), false,
      'Forbidden requests must not reach even the local simulated destination');
    results.push({ name, status: 'passed', ...details, requests: observed.map(({ method, path }) => ({ method, path })) });
  } catch (error) {
    console.error(JSON.stringify({ name, status: 'failed', receipt, requests: hits.slice(start) }, null, 2));
    throw error;
  } finally {
    contextGuard.beginClose();
    networkGuard?.beginClose();
    await contextGuard.settle().catch(() => {});
    await context.close();
    await contextGuard.dispose({ contextClosed: true });
    await networkGuard?.dispose({ browserClosed: true });
  }
}

async function rejectedPopup({ page, contextGuard, networkGuard, receipt }, action, destination) {
  if (action === 'blank-fetch') {
    const opened = page.context().waitForEvent('page');
    await page.evaluate(() => { window.open('about:blank'); });
    const popup = await opened;
    // Execute in the popup realm, not by calling popup.fetch from its opener.
    await popup.evaluate((url) => {
      void fetch(url, { method: 'POST', mode: 'no-cors', body: 'synthetic-only' }).catch(() => {});
    }, destination);
  } else await page.evaluate(({ action, destination }) => {
    if (action === 'post') {
      const form = document.createElement('form');
      form.action = destination;
      form.method = 'POST';
      form.target = '_blank';
      const value = document.createElement('input');
      value.name = 'fixture';
      value.value = 'synthetic-only';
      form.append(value);
      document.body.append(form);
      form.submit();
    } else if (!window.open(destination)) throw new Error('Local fixture popup was not created');
  }, { action, destination });
  // Chromium can expose an inherited about:blank document's request first on
  // its opener's CDP session. Either independent guard may reject that request.
  const rejection = action === 'blank-fetch'
    ? Promise.race([contextGuard.failed, networkGuard.failed]) : contextGuard.failed;
  await assert.rejects(deadline(rejection, 'Popup request rejection'), /Context request guard failed|forbidden backend/);
  await contextGuard.settle();
  const contextBlocked = receipt.contextRequestGuard.blockedRequests > 0;
  const parsed = new URL(destination);
  const protocolBlocked = receipt.forbiddenRequests.some(({ host, path }) => host === parsed.hostname && path === parsed.pathname);
  assert.ok(contextBlocked || protocolBlocked, 'A dispatched fixture request must be observed and rejected');
  return { blockedBy: contextBlocked ? 'context-ownership' : 'every-hop-cdp' };
}

try {
  // Disposable fixture certificate, never an application credential.
  await promisify(execFile)('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=loopback.invalid', '-keyout', path.join(directory, 'key.pem'),
    '-out', path.join(directory, 'cert.pem'),
  ], { timeout: 15000 });
  fixture = https.createServer({
    key: await readFile(path.join(directory, 'key.pem')),
    cert: await readFile(path.join(directory, 'cert.pem')),
  }, serve);
  const fixturePort = await listen(fixture);
  proxy = http.createServer(serve);
  proxy.on('connect', (_request, client, head) => {
    // Ignore the requested hostname: no destination DNS or external socket.
    const upstream = track(net.connect({ host: '127.0.0.1', port: fixturePort }, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      client.pipe(upstream);
      upstream.pipe(client);
    }));
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => client.destroy());
  });
  const proxyPort = await listen(proxy);
  browser = await chromium.launch({
    headless: true,
    proxy: { server: `http://127.0.0.1:${proxyPort}`, bypass: '<-loopback>' },
    args: ['--disable-extensions', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP'].includes(key))),
  });
  await scenario('owned-page-positive-control', async ({ page, contextGuard, networkGuard }) => {
    assert.equal(await page.evaluate(async () => (await fetch('/owned-fetch')).status), 200);
    await contextGuard.assertHealthy();
    await networkGuard.assertHealthy();
  });
  await scenario('popup-first-forbidden-get', (state) => rejectedPopup(state, 'get', forbiddenOrigin + '/popup-get'));
  await scenario('same-preview-popup-cannot-follow-redirect', async (state) => {
    const before = hits.length;
    const result = await rejectedPopup(state, 'get', previewOrigin + '/popup-redirect');
    assert.equal(hits.slice(before).some(({ path }) => path === '/popup-redirect'), false,
      'The same-Preview popup must be blocked before its redirect response');
    return result;
  });
  await scenario('owned-page-forbidden-redirect-still-blocked', async ({ page, networkGuard }) => {
    await assert.rejects(page.goto(previewOrigin + '/owned-redirect'));
    await assert.rejects(deadline(networkGuard.failed, 'Every-hop redirect rejection'), /forbidden backend/);
  });
  await scenario('target-blank-post', (state) => rejectedPopup(state, 'post', forbiddenOrigin + '/popup-post'));
  await scenario('about-blank-popup-fetch', (state) => rejectedPopup(state, 'blank-fetch', forbiddenOrigin + '/blank-fetch'));
  console.log(JSON.stringify({ status: 'passed', network: 'loopback-only-proxy-with-external-dns-disabled', cases: results }, null, 2));
} finally {
  await browser?.close();
  for (const socket of sockets) socket.destroy();
  for (const server of [proxy, fixture]) {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
  }
  await rm(directory, { recursive: true, force: true });
}
