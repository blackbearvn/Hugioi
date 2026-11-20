const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = file => readFileSync(new URL('../' + file, 'file://' + __filename), 'utf8');
const screens = ['authGate', 'mainMenu', 'welcome', 'game'];
const account = { id: 'new', email: 'new@example.test' };
const saved = { id: 'saved', email: 'saved@example.test' };

function fixture({ restored, failLoad, consent = true } = {}) {
  const elements = new Map();
  const storage = new Map(), bodyClasses = new Set();
  let focused, login = account, writes = 0, preparations = 0, snapshot, syncError;
  const classList = { add() {}, remove() {}, toggle() {} };
  const $ = id => {
    if (!elements.has(id)) {
      const listeners = {};
      elements.set(id, {
        hidden: id !== 'authGate', dataset: {}, classList, value: '',
        focus() { focused = id; }, reset() {}, setAttribute() {}, removeAttribute() {},
        addEventListener(event, fn) { listeners[event] = fn; },
        showModal() { this.open = true; },
        close() { this.open = false; this.fire('close'); },
        fire(event = 'click') { return listeners[event]({ preventDefault() {} }); }
      });
    }
    return elements.get(id);
  };
  const signupTab = $('signupTab');
  signupTab.dataset.authView = 'signup';
  $('authTabs').querySelectorAll = () => [signupTab];
  const session = {
    subscribe() {},
    disconnect() { this.accountId = this.playerId = this.ticket = snapshot = null; },
    async pause() {},
    async loadDaily() {},
    async create() { writes++; }
  };
  const store = {
    async setAccount(id) {
      session.disconnect();
      session.accountId = id;
      if (failLoad) throw Error('Lỗi tải bản lưu');
      if (id === saved.id) {
        session.playerId = 'player';
        snapshot = { created: true };
      } else session.ticket = { preview: { name: 'Đạo thân mẫu' } };
    },
    load: () => snapshot,
    async synchronize() { if (syncError) throw Error(syncError); },
    write() {}
  };
  const ctx = vm.createContext({
    document: { getElementById: $, querySelectorAll: selector => selector === '[data-auth-view]' ? [signupTab] : [], addEventListener() {},
      body: { classList: { ...classList, toggle(key, on) { on ? bodyClasses.add(key) : bodyClasses.delete(key); } }, dataset: {}, toggleAttribute() {} } },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    location: { protocol: 'http:', pathname: '/', search: '', hash: '' },
    history: { replaceState() {} }, fetch() {}, addEventListener() {},
    HU_SUPABASE: {
      user: async () => restored, hasSession: () => !!restored, validEmail: () => true,
      accepted: async () => new Set(consent ? ['privacy', 'release_terms'] : []),
      login: async () => login,
      signup: async () => ({ access_token: 'mock', user: account }), logout: async () => {}, accept: async () => {}
    },
    HU_GAME: { READY: true, F: {}, TALENT_INFO: [], TALENT_MAX: 0,
      randomName: () => 'Mẫu', rollRace: () => 'nhan', rollRoots: () => ({}),
      raceName: String, rootLabel: () => '', cleanName: String,
      PAVILION: { starterTalentMax: 0, starter: {}, stats: {} } },
    HU_ASSETS: { heroPortrait: () => '', INTRO: [], zoneBg: () => '', heroFrames: () => 0 },
    HU_LOADER: { enter: async () => { preparations++; } },
    HU_UI: { store, session, screens: {}, kit: { $, $$: () => [], esc: String, num: String },
      data: {}, s: () => snapshot, g: () => ({ isDead: () => false }),
      go() {}, applySettings() {}, toast() {} }
  });
  for (const path of ['client/route.js', 'client/auth/auth.js', 'client/ui/boot.js']) {
    vm.runInContext(source(path), ctx, { filename: path });
  }
  ctx.HU_UI.boot();
  return {
    $, session, store, storage, bodyClasses, writes: () => writes, preparations: () => preparations, focused: () => focused,
    screen: (id, page) => {
      assert.deepEqual(screens.filter(key => !$(key).hidden), [id]);
      assert.equal(ctx.HU_ROUTE.page, page);
    },
    login: async (as = account) => { login = as; await $('authForm').fire('submit'); },
    failSync: msg => { syncError = msg; }
  };
}

test('tài khoản mới vào menu, mở tạo đạo thân và quay lại', async () => {
  const f = fixture();
  await f.login();
  f.screen('mainMenu', 'menu');
  assert.equal(f.focused(), 'menuTitle');
  assert.equal(f.$('menuStart').disabled, false);
  f.$('menuStart').fire();
  f.screen('welcome', 'create');
  assert.equal(f.focused(), 'nameInput');
  f.$('backToMenu').fire();
  f.screen('mainMenu', 'menu');
});

test('phiên có save khôi phục vào menu, lỗi đồng bộ giữ menu, thử lại vào game', async () => {
  const f = fixture({ restored: saved });
  await new Promise(setImmediate);
  f.screen('mainMenu', 'menu');
  assert.equal(f.$('menuStart').disabled, false);
  f.failSync('Lỗi đồng bộ');
  await f.$('menuStart').fire();
  f.screen('mainMenu', 'menu');
  assert.match(f.$('menuStatus').textContent, /Lỗi đồng bộ/);
  f.failSync('');
  await f.$('menuStart').fire();
  f.screen('game', 'game');
});

test('đăng xuất rồi đổi tài khoản, chặn gửi form tạo khi đã có nhân vật', async () => {
  const f = fixture();
  await f.login(saved);
  f.screen('mainMenu', 'menu');
  await f.$('menuExit').fire();
  f.screen('authGate', 'login');
  assert.equal(f.store.load(), null);
  assert.equal(f.focused(), 'authEmail');
  await f.login();
  assert.equal(f.$('menuStart').disabled, false);
  f.$('menuStart').fire();
  f.screen('welcome', 'create');
  f.session.playerId = 'existing-player';
  await f.$('createForm').fire('submit');
  assert.equal(f.preparations(), 0);
  assert.equal(f.writes(), 0);
});

test('menu có đúng ba nhãn và thiết lập chuyển động có hiệu lực trước khi tạo', async () => {
  const menu = source('index.html').match(/<section id="mainMenu"[\s\S]+?<\/nav>/)[0];
  assert.deepEqual([...menu.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map(m => m[1]),
    ['Bước vào Hư giới', 'Thiết lập thế giới', 'Trở về Lam Tinh']);
  const f = fixture();
  await f.login();
  f.$('menuSettings').fire();
  assert.equal(f.$('menuSettingsDialog').open, true);
  f.$('menuReduceMotion').checked = true;
  f.$('menuReduceMotion').fire('change');
  assert.equal(f.bodyClasses.has('device-reduced-motion'), true);
  assert.equal(f.storage.get('hu-device-reduce-motion'), '1');
  f.$('menuSettingsBack').fire();
  assert.equal(f.$('menuSettingsDialog').open, false);
  assert.equal(f.focused(), 'menuSettings');
  f.screen('mainMenu', 'menu');
  assert.equal(f.writes(), 0);
});

test('lỗi tải save hoặc thiếu consent giữ màn xác thực', async () => {
  const f = fixture({ failLoad: true });
  await f.login(saved);
  f.screen('authGate', 'login');
  assert.match(f.$('authMessage').textContent, /Lỗi tải bản lưu/);
  const g = fixture({ consent: false });
  await g.login();
  g.screen('authGate', 'login');
  assert.equal(g.$('authConsentGate').hidden, false);
  g.$('authConsentPrivacy').checked = g.$('authConsentRelease').checked = true;
  await g.$('authConsentContinue').fire();
  g.screen('mainMenu', 'menu');
});

test('đăng ký nhận phiên ngay mở menu sau xác nhận chính sách', async () => {
  const f = fixture();
  f.$('signupTab').fire();
  f.$('authPrivacy').checked = f.$('authRelease').checked = true;
  await f.$('authForm').fire('submit');
  f.screen('mainMenu', 'menu');
});
