import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { moduleLoader, storeFixture } from './helpers/load-ts-module.mjs';

// adding-korean-site-essentials 키트 적용분: 비밀번호 정책·변경·재설정, 가입 오류 문구, 로그아웃 실패.
const load = moduleLoader();
const { passwordPolicyError, PASSWORD_MIN_LENGTH } = load('src/lib/password-policy.ts');
const { signupErrorMessage, loginErrorMessage, AUTH_COPY } = load('src/lib/auth-messages.ts');
const { isRecentEmailLinkSession } = load('src/lib/recovery-session.ts');
const token = (amr) => `x.${Buffer.from(JSON.stringify({ amr })).toString('base64url')}.y`;

test('one length-based password policy for signup, reset and change', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 10);
  assert.equal(passwordPolicyError('correct horse battery'), null, 'no composition rules');
  assert.match(passwordPolicyError('Ab1!Ab1!') ?? '', /10자 이상/);
  for (const file of ['src/app/register/page.tsx', 'src/stores/authStore.ts', 'src/app/auth/reset-password/page.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\(\?=\.\*\[A-Za-z\]\)|length < 8|minLength=\{8\}/, `${file} still has its own policy`);
  }
  assert.equal((readFileSync('src/stores/authStore.ts', 'utf8').match(/passwordPolicyError\(/g) ?? []).length, 3, 'updatePassword, completePasswordReset, changePassword');
});

test('signup and login errors never leak raw Supabase text or account existence', () => {
  assert.equal(signupErrorMessage({ code: 'user_already_exists', message: 'User already registered' }), null);
  assert.equal(signupErrorMessage({ message: 'some raw supabase text' }), AUTH_COPY.generic);
  assert.equal(signupErrorMessage({ status: 429 }), AUTH_COPY.rateLimited);
  assert.equal(loginErrorMessage({ code: 'email_not_confirmed' }), loginErrorMessage({ code: 'invalid_credentials' }));
});

test('duplicate signup: email ends on the neutral screen, a taken short ID is reported, raw text never shown', async () => {
  const f = storeFixture();
  f.supabase.auth.signUp = async () => ({ data: { user: null, session: null }, error: { code: 'user_already_exists', message: 'User already registered', status: 422 } });
  await f.auth.getState().register({ email: 'someone@synthetic.invalid', password: 'x'.repeat(12), name: '선수', consents: [] });
  assert.equal(f.auth.getState().user, null);
  assert.equal(f.auth.getState().error, null);
  await assert.rejects(f.auth.getState().register({ email: 'shortid', password: 'x'.repeat(12), name: '선수', consents: [] }), (e) => e.message === AUTH_COPY.loginIdTaken);
  f.supabase.auth.signUp = async () => ({ data: { user: null, session: null }, error: { message: 'Database error saving new user', status: 500 } });
  await assert.rejects(f.auth.getState().register({ email: 'a@synthetic.invalid', password: 'x'.repeat(12), name: '선수', consents: [] }), (e) => e.message === AUTH_COPY.generic);
});

test('a failed sign-out keeps the signed-in state and reports it', async () => {
  const f = storeFixture();
  f.supabase.auth.signOut = async () => ({ error: { message: 'fetch failed' } });
  await assert.rejects(f.auth.getState().logout(), (e) => e.message === AUTH_COPY.logoutFailed);
  assert.equal(f.auth.getState().user.uid, 'player-1');
  f.supabase.auth.signOut = async () => ({ error: null });
  await f.auth.getState().logout();
  assert.equal(f.auth.getState().user, null);
});

function passwordStore() {
  const calls = [];
  const verifier = { auth: {
    signInWithPassword: async ({ password }) => { calls.push(['signIn', password]); return password === 'current-secret' ? { data: { user: { id: 'player-1' } }, error: null } : { data: { user: null }, error: { code: 'invalid_credentials', status: 400 } }; },
    updateUser: async (attrs) => { calls.push(['update', attrs]); return { error: null }; },
    signOut: async (o) => { calls.push(['signOut', o.scope]); return { error: null }; },
  } };
  const main = { auth: { getSession: async () => main.session, updateUser: async (a) => { calls.push(['main-update', a]); return { error: null }; },
    signOut: async (o) => { calls.push(['main-signOut', o?.scope]); return { error: null }; } }, rpc: () => { throw new Error('unexpected'); }, from: () => { throw new Error('unexpected'); } };
  const store = moduleLoader({ '@/config/supabase': { supabase: main, isDemoMode: false }, '@supabase/supabase-js': { createClient: () => verifier } })('src/stores/authStore.ts').useAuthStore;
  store.setState({ user: { uid: 'player-1', email: 'member@synthetic.invalid' }, player: { id: 'player-1' }, initialized: true });
  return { store, calls, main };
}

test('changing a password re-verifies the current one on a throwaway session', async () => {
  const { store, calls } = passwordStore();
  await assert.rejects(store.getState().changePassword('wrong', 'a brand new passphrase'), (e) => e.message === AUTH_COPY.currentPasswordWrong);
  assert.equal(calls.some(([c]) => c === 'update' || c === 'main-update'), false);
  await assert.rejects(store.getState().changePassword('current-secret', 'short'), /10자 이상/);
  await store.getState().changePassword('current-secret', 'a brand new passphrase');
  assert.deepEqual(calls.find(([c]) => c === 'update')[1], { password: 'a brand new passphrase', current_password: 'current-secret' });
  assert.equal(calls.filter(([c]) => c === 'signOut').every(([, scope]) => scope === 'local'), true);
  assert.equal(calls.some(([c]) => c === 'main-update'), false, 'the logged-in session alone never sets a password');
});

test('the reset screen only accepts a fresh email-link session', async () => {
  const now = Date.now() / 1000;
  assert.equal(isRecentEmailLinkSession(token([{ method: 'otp', timestamp: now - 60 }])), true);
  assert.equal(isRecentEmailLinkSession(token([{ method: 'recovery', timestamp: now - 60 }])), true);
  assert.equal(isRecentEmailLinkSession(token([{ method: 'password', timestamp: now - 60 }])), false);
  assert.equal(isRecentEmailLinkSession(token([{ method: 'otp', timestamp: now - 31 * 60 }])), false);
  assert.equal(isRecentEmailLinkSession('not-a-jwt'), false);
  const { store, calls, main } = passwordStore();
  main.session = { data: { session: { access_token: token([{ method: 'password', timestamp: now }]) } } };
  await assert.rejects(store.getState().completePasswordReset('a brand new passphrase'), (e) => e.message === AUTH_COPY.linkExpired);
  main.session = { data: { session: { access_token: token([{ method: 'otp', timestamp: now - 5 }]) } } };
  await store.getState().completePasswordReset('a brand new passphrase');
  assert.deepEqual(calls.filter(([c]) => c.startsWith('main')), [['main-update', { password: 'a brand new passphrase' }], ['main-signOut', 'others']]);
});
