import assert from 'node:assert/strict';
import test from 'node:test';
import proxyaddr from 'proxy-addr';
import { SourceMapConsumer } from 'source-map-js';
import sharp from 'sharp';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';

test('mapped IPv6 trust prefixes do not trust arbitrary IPv4 callers', () => {
  for (const subnet of ['::ffff:10.0.0.0/8', '::/1']) {
    assert.equal(proxyaddr.compile(subnet)('203.0.113.17'), false);
    assert.equal(proxyaddr({ socket: { remoteAddress: '203.0.113.17' }, headers: { 'x-forwarded-for': '10.0.0.7' } }, subnet), '203.0.113.17');
  }
  for (const subnet of ['10.0.0.0/8', '::ffff:10.0.0.0/104']) {
    assert.equal(proxyaddr.compile(subnet)('10.2.3.4'), true);
    assert.equal(proxyaddr.compile(subnet)('203.0.113.17'), false);
  }
});

test('indexed source maps reject invalid and excessive offsets and preserve ordinary mappings', () => {
  const map = { version: 3, sources: ['input.js'], names: [], mappings: 'AAAA' };
  for (const line of [1e12, -1, 1.5, Infinity, NaN]) {
    assert.throws(() => new SourceMapConsumer({ version: 3, sections: [{ offset: { line, column: 0 }, map }] }), /offset/i);
  }
  const consumer = new SourceMapConsumer({ version: 3, sections: [{ offset: { line: 0, column: 0 }, map }] });
  const mappings = [];
  consumer.eachMapping(mapping => mappings.push(mapping));
  assert.equal(mappings.length, 1);
  assert.equal(mappings[0].source, 'input.js');
  assert.equal(mappings[0].originalLine, 1);
});

test('patched sharp retains SVG decoding, resizing and WebP conversion', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>');
  const encoded = await sharp(svg).resize(10, 10).webp().toBuffer();
  const metadata = await sharp(encoded).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 10);
  assert.equal(metadata.height, 10);
});

test('MCP OAuth refuses credentials bound to a different issuer without sending a request', async () => {
  let requests = 0;
  const provider = {
    clientMetadata: {},
    clientInformation: () => ({ client_id: 'synthetic-client', client_secret: 'synthetic-secret', issuer: 'https://trusted.invalid' }),
    discoveryState: () => ({
      authorizationServerUrl: 'https://untrusted.invalid',
      authorizationServerMetadata: { issuer: 'https://untrusted.invalid', token_endpoint: 'https://untrusted.invalid/token' },
      resourceMetadata: { resource: 'https://resource.invalid/mcp' },
    }),
  };
  await assert.rejects(auth(provider, {
    serverUrl: 'https://resource.invalid/mcp',
    fetchFn: async () => { requests++; throw new Error('No network permitted in this test'); },
  }), /bound to authorization server/);
  assert.equal(requests, 0);
});
