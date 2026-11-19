/* Phòng rèn và phù án toàn màn hình: chọn món, gửi lệnh forge, phát hoạt cảnh rồi hiện thành phẩm. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const H = require('../engine/game.js');

const NOW = 1800000000000;
const profile = { name: 'Lý Vô Thường', gender: 'nu', age: 18, race: 'nhan', roots: [72, 61, 45, 44, 33], rootType: 'Song', talent: { tuongMao: 2, phucDuyen: 2, canCot: 2, ngoTinh: 1, vanKhi: 1 }, destiny: 'exp' };
const load = (file, env) => vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), env);

function setup(trade) {
  const game = new H.Game(H.createCharacter(profile, NOW, () => 0), () => 0);
  game.s.realm = H.FEATURES.forge.realm;
  const kind = trade === 'phu' ? 'TAL' : 'EQ';
  const book = H.SECT_BOOKS.find(b => b.kind === kind);
  game.s.borrowedBook = book.id;
  const target = H.ITEMS.find(x => x.kind === kind && x.tier <= game.s.realm && game.hasCraftRecipe(x.code));
  const r = game.forgeRecipe(target.code);
  game.add(r.herb, r.count);
  if (r.ink) game.add(r.ink, 1);
  if (r.manual) game.s.learned[r.manual] = 0;
  game.s.stone = 1e9;

  const nodes = {}, actions = {}, calls = [], toasts = [], gone = [];
  const node = id => nodes[id] || (nodes[id] = {
    id, hidden: true, innerHTML: '', textContent: '', style: { setProperty() {} },
    classList: { add() {}, remove() {} }, lastElementChild: { textContent: '' }
  });
  const str = x => String(x ?? '');
  const kit = { abs: str, $: node, $$: () => [], esc: str, clamp: (n, a, b) => Math.min(b, Math.max(a, n)), num: str, money: str, moneyHTML: str, pct: str, duration: str, row: (a, b) => `${a}${b}`, btn: (a, b, c = '') => `<button data-act="${b}" ${c}>${a}</button>`, img: (c, k = '') => `<img class="${k}" data-item="${c}">`, codeAttr: c => `data-code="${c}"`, bar: () => '', card: (t, b) => t + b, empty: str, tabs: () => '', live: () => '', itemName: x => str(x?.name) };
  const ui = {
    kit, lists: { matches: () => true, controls: () => '' },
    data: { FARM: () => '', INK: {}, ART: { workshop: 'w.webp', talisman: 't.webp' } }, view: {}, tabState: {}, session: {},
    s: () => game.s, g: () => game, register() {}, action(n, f) { actions[n] = f; }, KEEP: Symbol('keep'),
    isReduced: () => true, toast: (...a) => toasts.push(a), go: t => gone.push(t),
    command: async (type, payload) => { calls.push([type, payload]); return game[type](payload, NOW); }
  };
  const env = {
    HU_GAME: H, HU_UI: ui, setTimeout: f => { f(); return 0; },
    HU_CUSTOM_MEDIA: { installed: true, backgrounds: { khi: 'khi.webp', phu: 'phu.webp' }, workshop: (g, tab, animate) => `${g}/${tab}/${animate ? 'anim' : 'still'}.webp` },
    document: { addEventListener() {}, body: { classList: { add() {}, remove() {} } } }
  };
  env.window = env;
  load('client/ui/screens/craft.js', env);
  load('client/ui/forge-page.js', env);
  return { game, ui, actions, nodes, calls, toasts, gone, target, node };
}

for (const trade of ['khi', 'phu']) {
  test(`phòng ${trade}: mở trang, chọn món, gửi lệnh forge rồi hiện thành phẩm`, async () => {
    const { game, actions, nodes, calls, target, ui, node } = setup(trade);
    node('forgePage'); node('forgePageBody'); node('forgePageBack'); node('fpTitle'); node('fpSub'); node('game').hidden = false;
    assert.equal(actions.forgePageOpen({}, { trade }), ui.KEEP);
    assert.equal(nodes.forgePage.hidden, false, 'trang phải hiện');
    assert.equal(nodes.game.hidden, true, 'màn chính phải ẩn');
    assert.equal(nodes.fpTitle.textContent, trade === 'phu' ? 'Phù án' : 'Lò rèn');
    assert.match(nodes.forgePageBody.innerHTML, new RegExp(`data-act="forgePageMake" data-code="${target.code}"`));
    assert.match(nodes.forgePageBody.innerHTML, new RegExp(`nu/${trade}/still\\.webp`), 'giai đoạn chọn dùng ảnh tĩnh của đúng nghề');

    const before = game.count(target.code);
    actions.forgePageMake({}, { code: target.code });
    await new Promise(r => setImmediate(r));
    assert.equal(calls[0][0], 'forge');
    assert.equal(calls[0][1].code, target.code);
    assert.equal(game.count(target.code), before + 1, 'thành phẩm vào túi');
    assert.match(nodes.forgePageBody.innerHTML, /data-act="forgePageAgain"/, 'sau hoạt cảnh hiện nút làm thêm');
    assert.match(nodes.forgePageBody.innerHTML, new RegExp(`data-item="${target.code}"`));
  });
}

test('thiếu nguyên liệu: nút bị khóa và lệnh lỗi không đổi sang hoạt cảnh', async () => {
  const { game, actions, nodes, toasts, target, node } = setup('khi');
  node('forgePage'); node('forgePageBody'); node('forgePageBack'); node('fpTitle'); node('fpSub');
  game.s.bag = {};
  actions.forgePageOpen({}, { trade: 'khi' });
  assert.match(nodes.forgePageBody.innerHTML, new RegExp(`data-code="${target.code}" disabled`));
  actions.forgePageMake({}, { code: target.code });
  await new Promise(r => setImmediate(r));
  assert.equal(toasts.length, 1);
  assert.doesNotMatch(nodes.forgePageBody.innerHTML, /forgePageAgain/);
});

test('chưa mượn sách: trang chỉ dẫn đến Tàng Kinh Các; rời trang quay về đúng tab', () => {
  const { game, actions, nodes, gone, node } = setup('phu');
  node('forgePage'); node('forgePageBody'); node('forgePageBack'); node('fpTitle'); node('fpSub'); node('game');
  game.s.borrowedBook = '';
  actions.forgePageOpen({}, { trade: 'phu' });
  assert.match(nodes.forgePageBody.innerHTML, /forgePageLibrary/);
  actions.forgePageClose();
  assert.equal(gone.join(), 'craft:phu');
  assert.equal(nodes.forgePage.hidden, true);
});

test('chưa đủ cảnh giới: không mở được phòng', () => {
  const { game, actions, nodes, node } = setup('khi');
  node('forgePage'); node('forgePageBody'); node('forgePageBack'); node('fpTitle'); node('fpSub');
  game.s.realm = 0;
  actions.forgePageOpen({}, { trade: 'khi' });
  assert.equal(nodes.forgePage.hidden, true);
});
