/* Tiền theo đại giới: giữ giá trị ví, định dạng số lớn và đồng bộ giao dịch/UI. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const H = require('../engine/game.js');
const C = require('../engine/protocol/commands.js');
const F = H.F, NOW = 1800000000000;
const WORLDS = [
  { realm: 0, name: 'Linh thạch hạ phẩm', icon: 'low', value: 1, index: 0 },
  { realm: 5, name: 'Linh thạch cực phẩm', icon: 'high', value: 1e6, index: 3 },
  { realm: 9, name: 'Tiên ngọc', icon: 'jade', value: 1e18, index: 4 }
];
const profile = { name: 'Vân Lam', gender: 'nu', age: 18, race: 'nhan', roots: [72, 61, 45, 44, 33], rootType: 'Song', talent: { tuongMao: 2, phucDuyen: 2, canCot: 2, ngoTinh: 1, vanKhi: 1 }, destiny: 'exp' };

function gameAt(realm) {
  const g = new H.Game(H.createCharacter(profile, NOW, () => .5), () => .5);
  g.s.realm = realm; g.s.stage = 1; g.s.qi = 0;
  return g;
}

function uiFor(game) {
  const ui = {}, assets = {
    BG: { forge: '', talisman: '', tribulation: '', home: '' }, farm: () => '',
    itemImg: () => ({ src: '/item.webp' }), moneyIcon: tier => '/money/' + tier + '.webp'
  };
  const env = {
    HU_GAME: H, HU_COMMANDS: C, HU_ASSETS: assets, HU_UI: ui,
    HU_REMOTE_SESSION: { RemoteSession: class { constructor() { this.game = game; this.pavilion = { balance: 77 }; } subscribe() {} } },
    HU_REMOTE_STORE: { createStore: () => ({ dispatch() {}, preference() {} }) },
    document: { getElementById: () => null, querySelectorAll: () => [], addEventListener() {}, baseURI: 'http://local/' }
  };
  env.window = env;
  const load = file => vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), env, { filename: file });
  load('client/ui/core.js');
  load('client/ui/screens/world.js');
  load('client/ui/screens/idle.js');
  load('client/ui/screens/settings.js');
  return ui;
}

test('14 cảnh giới chỉ dùng ba loại tiền, đúng ranh giới Hạ/Linh/Tiên', () => {
  assert.equal(F.CURRENCIES.length, 3);
  for (let realm = 0; realm < 14; realm++) {
    const expected = WORLDS[realm < 5 ? 0 : realm < 9 ? 1 : 2], coin = F.currency(realm);
    assert.equal(coin.name, expected.name, F.REALMS[realm]);
    assert.equal(coin.value, expected.value);
    assert.equal(coin.icon, expected.icon);
    assert.equal(coin.index, expected.index);
    assert.equal(coin.world, F.realm_map(realm));
  }
});

test('số lớn dùng vạn, ức… trong cùng loại tiền; số dư lớn không tự đổi tiền', () => {
  assert.equal(F.format_linh_thach(9999, 0), '9.999 linh thạch hạ phẩm');
  assert.equal(F.format_linh_thach(10000, 0), '1 vạn linh thạch hạ phẩm');
  assert.equal(F.format_linh_thach(125000, 0), '12,5 vạn linh thạch hạ phẩm');
  assert.equal(F.format_linh_thach(1e8, 0), '1 ức linh thạch hạ phẩm');
  assert.equal(F.format_linh_thach(1e12, 0), '1 triệu linh thạch hạ phẩm');
  assert.equal(F.format_linh_thach(1e16, 0), '1 kinh linh thạch hạ phẩm');
  assert.equal(F.format_linh_thach(125000 * 1e6, 5), '12,5 vạn linh thạch cực phẩm');
  assert.equal(F.format_linh_thach(1e26, 9), '1 ức tiên ngọc');
  for (const { realm, name } of WORLDS)
    for (const value of [0, 1, 1e8, 1e18, 1e30])
      assert.ok(F.format_linh_thach(value, realm).endsWith(name.toLocaleLowerCase('vi-VN')));
});

test('giữ phần lẻ và số đầy đủ; số dương rất nhỏ không hiện thành số dư 0', () => {
  assert.equal(F.format_linh_thach(0, 9), '0 tiên ngọc');
  assert.equal(F.format_linh_thach(123.45, 0), '123,45 linh thạch hạ phẩm');
  assert.equal(F.format_linh_thach(1, 5), '<0,01 linh thạch cực phẩm');
  assert.equal(F.format_linh_thach(1, 5, false), '0,000001 linh thạch cực phẩm');
  assert.equal(F.format_linh_thach(1, 9, false), '0,000000000000000001 tiên ngọc');
  assert.equal(F.format_linh_thach(-12500, 0), '-1,25 vạn linh thạch hạ phẩm');
  for (const invalid of [NaN, Infinity, -Infinity]) assert.equal(F.money_amount(invalid, 9), '—');
});

test('bản lưu cũ và hai lần chuyển đại giới bảo toàn tiền, yêu đan và tài sản khác', () => {
  for (const realm of [4, 8]) {
    const g = gameAt(realm), s = g.s;
    s.stone = 1.23456789e22; s.yaoValue = 9.87654321e20;
    const before = { stone: s.stone, yaoValue: s.yaoValue, jade: s.jade };
    const restored = H.normalize(JSON.parse(JSON.stringify(s)), NOW);
    for (const [key, value] of Object.entries(before)) assert.equal(restored[key], value, key);
    s.stage = F.STAGES[realm]; s.qi = g.need(); s.shield = g.stats().HP * 100;
    g.rng = () => 0; // Bảo đảm qua xác suất đột phá để kiểm tra việc chuyển đại giới.
    const out = g.breakthrough({}, NOW);
    assert.equal(out.success, true);
    assert.equal(s.realm, realm + 1);
    for (const [key, value] of Object.entries(before)) assert.equal(s[key], value, key);
    assert.equal(F.currency(s.realm).name, realm === 4 ? 'Linh thạch cực phẩm' : 'Tiên ngọc');
  }
});

test('mã lệnh hấp thu giữ nguyên 0/3/4, từ chối các bậc tiền đã bỏ', () => {
  for (const index of [0, 3, 4]) assert.equal(C.validate({ type: 'absorb', payload: { index } }).payload.index, index);
  for (const index of [1, 2, 5, 6, 7, 8, -1, 0.5, '3'])
    assert.throws(() => C.validate({ type: 'absorb', payload: { index } }), { code: 'INVALID_COMMAND' });
});

test('số lượng hấp thu được kiểm tra ở hợp đồng lệnh và engine, không thể tiêu âm hoặc vượt giới hạn', () => {
  const g = gameAt(0);
  g.s.stone = 1e9;
  for (const count of [1, 100, 1e4, 1e8])
    assert.equal(C.validate({ type: 'absorb', payload: { index: 0, count } }).payload.count, count);
  for (const count of [0, -1, 1.5, 1e8 + 1, NaN, null, '100']) {
    assert.throws(() => C.validate({ type: 'absorb', payload: { index: 0, count } }), { code: 'INVALID_COMMAND' });
    assert.throws(() => g.absorb({ index: 0, count }, NOW), /Số lượng hấp thu không hợp lệ/);
    assert.equal(g.s.stone, 1e9);
  }
});

for (const { realm, name, icon, value, index } of WORLDS) {
  test(`${name}: mua/bán giữ giá trị giao dịch và lỗi thiếu tiền gọi đúng tên`, () => {
    const g = gameAt(realm), item = H.ITEMS.find(x => x.kind === 'PILL' && x.tier === realm);
    const price = F.shop_buy_price(g.price(item.code));
    g.s.stone = price * 4;
    const before = g.count(item.code);
    C.execute(g, { type: 'buy', payload: { code: item.code, count: 2 } }, NOW);
    assert.equal(g.s.stone, price * 2);
    assert.equal(g.count(item.code), before + 2);
    const sold = C.execute(g, { type: 'sell', payload: { code: item.code } }, NOW);
    assert.equal(g.s.stone, price * 2 + sold);
    g.s.stone = price / 2;
    assert.throws(() => C.execute(g, { type: 'buy', payload: { code: item.code } }, NOW),
      { message: 'Không đủ ' + name.toLocaleLowerCase('vi-VN') + '.' });
    assert.equal(g.s.stone, price / 2);
  });

  test(`${name}: hấp thu đúng một đơn vị, chặn tiền của đại giới khác`, () => {
    const g = gameAt(realm);
    g.s.stone = value * 2;
    for (const other of WORLDS.filter(c => c.index !== index)) {
      assert.throws(() => C.execute(g, { type: 'absorb', payload: { index: other.index } }, NOW), /Đại giới này chỉ hấp thu/);
      assert.equal(g.s.stone, value * 2);
      assert.equal(g.s.qi, 0);
    }
    const gained = C.execute(g, { type: 'absorb', payload: { index } }, NOW);
    assert.equal(g.s.stone, value);
    assert.ok(gained > 0);
    assert.equal(gained, value * .15 * F.exp_per_ha(realm));
  });

  test(`${name}: hấp thu theo vạn/ức trừ đúng giá máy chủ và không cho tiêu quá số dư`, () => {
    for (const count of [1e4, 1e8]) {
      const g = gameAt(realm), cost = value * count;
      g.s.stone = cost / 2;
      assert.throws(() => C.execute(g, { type: 'absorb', payload: { index, count } }, NOW),
        { message: 'Không đủ ' + name.toLocaleLowerCase('vi-VN') + '.' });
      assert.equal(g.s.stone, cost / 2);
      g.s.stone = cost * 2;
      assert.ok(C.execute(g, { type: 'absorb', payload: { index, count } }, NOW) > 0);
      assert.equal(g.s.stone, cost);
    }
  });

  test(`${name}: UI dùng cùng tên, biểu tượng, giá rút gọn và số đầy đủ`, () => {
    const g = gameAt(realm), ui = uiFor(g);
    g.s.stone = value * 125000;
    const lower = name.toLocaleLowerCase('vi-VN'), html = ui.kit.moneyHTML(g.s.stone);
    assert.equal(ui.kit.money(g.s.stone), '12,5 vạn ' + lower);
    assert.equal(ui.kit.currency().name, name);
    assert.ok(html.includes('/money/' + icon + '.webp'));
    assert.ok(html.includes('title="125.000 ' + lower + '"'));
    assert.ok(html.includes('aria-label="125.000 ' + lower + '"'));
    assert.ok(html.includes('12,5 vạn ' + lower));
    const shop = ui.screens.world.render('shop'), idle = ui.screens.idle.render();
    for (const screen of [shop, idle]) {
      assert.equal((screen.match(/data-act="absorb"/g) || []).length, 4);
      for (const count of [1, 100, 1e4, 1e8])
        assert.ok(screen.includes('data-index="' + index + '" data-count="' + count + '"'));
      assert.ok(screen.includes(lower));
    }
    assert.equal(ui.session.pavilion.balance, 77, 'Thiên Tinh không bị quy đổi');
  });

  test(`${name}: nhật ký nhận thưởng đúng đại giới khi đang ở khu vực thấp hơn`, () => {
    const g = gameAt(realm);
    g.s.zone = 0;
    g.collectLoot(1, false);
    assert.ok(g.s.logs[0].includes(name.toLocaleLowerCase('vi-VN')));
  });
}

test('UI đổi loại tiền ngay khi đổi đại giới mà số dư vẫn giữ nguyên', () => {
  const g = gameAt(4), ui = uiFor(g);
  g.s.stone = 1e18;
  const before = g.s.stone;
  assert.ok(ui.kit.moneyHTML(before).includes('/money/low.webp'));
  g.s.realm = 5;
  assert.ok(ui.kit.moneyHTML(before).includes('/money/high.webp'));
  g.s.realm = 9;
  assert.equal(ui.kit.money(before), '1 tiên ngọc');
  assert.ok(ui.kit.moneyHTML(before).includes('/money/jade.webp'));
  assert.equal(g.s.stone, before);
});

test('hướng dẫn trong game nêu đủ ba loại tiền, đơn vị vạn/ức và Thiên Tinh riêng', () => {
  const ui = uiFor(gameAt(0)), guide = ui.screens.settings.render('guide');
  for (const coin of F.CURRENCIES) {
    assert.ok(guide.includes(coin.world));
    assert.ok(guide.includes(coin.name));
  }
  assert.ok(guide.includes('vạn (10.000)'));
  assert.ok(guide.includes('ức (100.000.000)'));
  assert.ok(guide.includes('Thiên Tinh ở Thiên Mệnh Các'));
});
