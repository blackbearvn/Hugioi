const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { resolve } = require('node:path');
const { stripTypeScriptTypes } = require('node:module');

const source = path => fs.readFileSync(resolve(__dirname, '..', path), 'utf8');
const config = stripTypeScriptTypes(source('client/config/public.ts'))
  .replaceAll('import.meta.env', 'testEnv');
const supabase = source('client/auth/supabase.js');
const captcha = source('client/auth/captcha.js');
const url = 'https://test-only.supabase.co';
const key = 'sb_publishable_' + 'testFixtureOnly123';
const sitekey = '12345678-1234-1234-1234-123456789abc';
const valid = { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key };

function load(testEnv, overrides = {}) {
  const sandbox = vm.createContext({
    testEnv, atob, URLSearchParams,
    HU_HCAPTCHA_SITEKEY: sitekey,
    fetch: () => assert.fail('Unexpected network request'),
    ...overrides,
  });
  if (testEnv) vm.runInContext(config, sandbox);
  vm.runInContext(supabase, sandbox);
  vm.runInContext(captcha, sandbox);
  return sandbox;
}

test('configured URL and key reach the adapter; CAPTCHA uses the configured sitekey', async () => {
  const sandbox = load({ ...valid, VITE_SUPABASE_URL: ' ' + url + '/ ', VITE_HCAPTCHA_SITEKEY: sitekey }, {
    fetch: async (target, options) => {
      assert.equal(target, url + '/auth/v1/signup');
      assert.equal(options.headers.apikey, key);
      return { ok: true, text: async () => '{"ok":true}' };
    },
    hcaptcha: { render: (_, options) => { assert.equal(options.sitekey, sitekey); return 0; } },
  });
  assert.equal(sandbox.HU_SUPABASE.publishableKey, key);
  assert.equal((await sandbox.HU_SUPABASE.signup('test@example.com', 'test-password')).ok, true);
  const container = { hidden: true };
  await sandbox.HU_CAPTCHA.mount(container);
  assert.equal(container.hidden, false);
});

test('missing configuration rejects cleanly without old defaults', async () => {
  for (const env of [undefined, {}, { VITE_SUPABASE_URL: url }, { VITE_SUPABASE_PUBLISHABLE_KEY: key }]) {
    const { HU_SUPABASE, HU_CAPTCHA } = load(env);
    await assert.rejects(HU_SUPABASE.user(), /Thiếu cấu hình đăng nhập/);
    await assert.rejects(HU_SUPABASE.login('test@example.com', 'test-password'), /VITE_SUPABASE_URL/);
    await assert.rejects(HU_SUPABASE.loginGoogle(), /VITE_SUPABASE_URL/);
    assert.equal(HU_CAPTCHA.enabled, false);
  }
  assert.equal(load({}).HU_SUPABASE.publishableKey, '');
});

test('invalid URL or key is rejected and invalid CAPTCHA is disabled', async () => {
  await assert.rejects(load({ ...valid, VITE_SUPABASE_URL: 'http://wrong.invalid' }).HU_SUPABASE.user(), /VITE_SUPABASE_URL/);
  for (const invalid of ['placeholder', 'sb_secret_fake_only', 'header.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.signature']) {
    await assert.rejects(load({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: invalid }).HU_SUPABASE.user(), /VITE_SUPABASE_PUBLISHABLE_KEY/);
  }
  const anon = 'header.' + Buffer.from('{"role":"anon"}').toString('base64url') + '.signature';
  assert.equal(await load({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: anon }).HU_SUPABASE.user(), null);
  const { HU_CAPTCHA } = load({ ...valid, VITE_HCAPTCHA_SITEKEY: 'invalid' });
  assert.equal(HU_CAPTCHA.enabled, false);
  await HU_CAPTCHA.mount({});
});

test('auth boot leaves the login gate visible and displays the configuration error', async () => {
  const nodes = new Map();
  const getElementById = id => {
    if (!nodes.has(id)) nodes.set(id, { dataset: {}, querySelectorAll: () => [], addEventListener() {}, reset() {}, setAttribute() {} });
    return nodes.get(id);
  };
  const sandbox = load({}, {
    location: { protocol: 'https:', search: '', hash: '' },
    document: { getElementById, querySelectorAll: () => [], body: { toggleAttribute() {}, classList: { remove() {} } } },
  });
  vm.runInContext(source('client/auth/auth.js'), sandbox);
  sandbox.HU_AUTH.boot();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(getElementById('authGate').hidden, false);
  assert.equal(getElementById('authConsentGate').hidden, true);
  assert.match(getElementById('authMessage').textContent, /Thiếu cấu hình đăng nhập/);
});
