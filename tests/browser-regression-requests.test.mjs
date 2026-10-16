import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeRequests, isUnexpectedWrite } from '../scripts/testing/browser/suite.mjs';

const host = 'fhytkbjadhnmozppolrv.supabase.co';
const app = 'fairground-c03qbcg49-milestones-projects-d52c4dda.vercel.app';

test('cancel request evidence strips credentials, payloads and query strings', () => {
  const events = [{ method: 'Network.requestWillBeSent', params: { request: {
    url: `https://${host}/rest/v1/teams?id=eq.synthetic&apikey=secret`, method: 'PATCH',
    headers: { Authorization: 'Bearer secret' }, postData: '{"name":"private"}',
  } } }, { method: 'Runtime.consoleAPICalled', params: { args: ['secret'] } }];
  assert.deepEqual(summarizeRequests(events), [{ method: 'PATCH', host, path: '/rest/v1/teams' }]);
});

test('cancel rejects table writes, storage upload and unknown RPCs even with read-looking names', () => {
  for (const [method, path] of [
    ['POST', '/rest/v1/teams'], ['PATCH', '/rest/v1/teams'], ['DELETE', '/rest/v1/teams'],
    ['POST', '/storage/v1/object/team-logo/logo.png'], ['POST', '/rest/v1/rpc/update_team'],
    ['POST', '/rest/v1/rpc/get_and_mutate_team'], ['POST', '/rest/v1/rpc/list_and_delete_teams'],
    ['DELETE', '/rest/v1/rpc/get_my_profile'],
  ]) assert.equal(isUnexpectedWrite({ method, host, path }, app), true, `${method} ${path}`);
  assert.equal(isUnexpectedWrite({ method: 'POST', host: app, path: '/api/teams' }, app), true);
});

test('cancel permits ordinary reads, exact reviewed read RPCs and auth refresh only', () => {
  for (const [method, path] of [
    ['GET', '/rest/v1/teams'], ['POST', '/rest/v1/rpc/get_my_profile'],
    ['POST', '/rest/v1/rpc/get_team_member_profiles'],
  ]) assert.equal(isUnexpectedWrite({ method, host, path }, app), false);
});

test('cancel rejects auth mutations and page-route Server Actions', () => {
  for (const [method, path] of [
    ['PUT', '/auth/v1/user'], ['POST', '/auth/v1/logout'], ['POST', '/auth/v1/signup'],
    ['DELETE', '/auth/v1/admin/users/synthetic'], ['POST', '/auth/v1/token'],
    ['DELETE', '/auth/v1/token'],
  ]) assert.equal(isUnexpectedWrite({ method, host, path }, app), true, `${method} ${path}`);
  for (const path of ['/my/team', '/teams/synthetic', '/api/teams']) {
    assert.equal(isUnexpectedWrite({ method: 'POST', host: app, path }, app), true, path);
  }
});

test('only an exact refresh-token request is exempted without retaining query or body', () => {
  const request = query => summarizeRequests([{ method: 'Network.requestWillBeSent', params: { request: {
    url: `https://${host}/auth/v1/token${query}`, method: 'POST',
    postData: '{"refresh_token":"secret"}', headers: { apikey: 'secret' },
  } } }])[0];
  const refresh = request('?grant_type=refresh_token');
  assert.deepEqual(refresh, { method: 'POST', host, path: '/auth/v1/token', authRefresh: true });
  assert.equal(isUnexpectedWrite(refresh, app), false);
  for (const query of ['', '?grant_type=password', '?grant_type=refresh_token&grant_type=password']) {
    const summary = request(query);
    assert.equal(isUnexpectedWrite(summary, app), true, query);
    assert.equal(JSON.stringify(summary).includes('secret'), false);
  }
  assert.equal(isUnexpectedWrite({ ...refresh, method: 'PUT' }, app), true);
  assert.equal(isUnexpectedWrite({ ...refresh, path: '/auth/v1/user' }, app), true);
});
