/* PB_1.webp: đúng 25 ô ảnh, tên Việt/Hán và luồng mua, rèn, trang bị, lưu game. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PGlite } = require('@electric-sql/pglite');
const H = require('../engine/game.js');
const C = require('../engine/protocol/commands.js');
const ROOT = path.join(__dirname, '..'), NOW = 1800000000000;
const EXPECTED = [
  ['Thanh Long Ngọc Bội', '青龙玉佩'], ['Càn Khôn Ngọc Hoàn', '乾坤玉环'],
  ['Tử Kim Hồ Lô', '紫金葫芦'], ['Thất Bảo Linh Lung Tháp', '七宝玲珑塔'],
  ['Trấn Thiên Thần Ấn', '镇天神印'], ['Bích Ngọc Giản', '碧玉简'],
  ['Thái Cực Thiên Phù', '太极天符'], ['Cửu Long Luyện Đan Lô', '九龙炼丹炉'],
  ['Hỗn Nguyên Linh Châu', '混元灵珠'], ['Phượng Hoàng Hương Lô', '凤凰香炉'],
  ['Niết Bàn Liên Đăng', '涅槃莲灯'], ['Bích Hải Linh Bình', '碧海灵瓶'],
  ['Bàn Đào Tiên Quả', '蟠桃仙果'], ['Cửu U Băng Liên', '九幽冰莲'],
  ['Tụ Linh Bảo Nang', '聚灵宝囊'], ['Thiên Cơ Tinh Bàn', '天机星盘'],
  ['Chu Thiên Tinh Đồ', '周天星图'], ['Kim Cương Phật Châu', '金刚佛珠'],
  ['Nhiếp Hồn Linh Chung', '摄魂灵钟'], ['Thiên Thư Ngọc Quyển', '天书玉卷'],
  ['Tử Tinh Tiên Tủy', '紫晶仙髓'], ['Cửu Chuyển Đan Lô', '九转丹炉'],
  ['Thanh Loan Ngọc Trâm', '青鸾玉簪'], ['Huyền Quang Bảo Kính', '玄光宝镜'],
  ['Vạn Linh Tiên Bình', '万灵仙瓶']
];
const codeAt = i => 'EQ-' + String(83 + i).padStart(3, '0');
const fresh = () => EXPECTED.map((_, i) => H.item(codeAt(i)));
const profile = { name: 'Vân Lam', gender: 'nu', age: 18, race: 'nhan', roots: [72, 61, 45, 44, 33], rootType: 'Song', talent: { tuongMao: 2, phucDuyen: 2, canCot: 2, ngoTinh: 1, vanKhi: 1 }, destiny: 'exp' };
function gameAt(realm) {
  const g = new H.Game(H.createCharacter(profile, NOW, () => .5), () => .5);
  g.s.realm = realm; g.s.zone = realm;
  g.s.hp = g.stats().HP; g.s.mp = g.maxMp();
  return g;
}
function uiFixture() {
  const env = { HU_GAME: H, HU_COMMANDS: C,
    HU_REMOTE_SESSION: { RemoteSession: class { constructor() { this.game = gameAt(0); } subscribe() {} } },
    HU_REMOTE_STORE: { createStore: () => ({ dispatch() {}, preference() {} }) },
    document: { getElementById: () => null, querySelectorAll: () => [], baseURI: 'http://local/' }
  };
  env.window = env;
  for (const file of ['client/assets/item-index.js', 'client/assets/asset-index.js', 'client/assets/assets.js', 'client/ui/core.js'])
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), env, { filename: file });
  return { ui: env.HU_UI, assets: env.HU_ASSETS, index: env.HU_ITEM_INDEX };
}

test('bộ mới có đủ 25 tên Việt/Hán đúng thứ tự, mã riêng EQ-083 đến EQ-107', () => {
  const items = H.ITEMS.filter(x => x.source === 'media/assets/item/PB_1.webp');
  assert.equal(items.length, 25);
  assert.equal(H.ITEMS.filter(x => x.kind === 'EQ').length, 107);
  for (const [i, x] of items.entries()) {
    assert.equal(x.code, codeAt(i));
    assert.equal(x.name, EXPECTED[i][0]);
    assert.equal(x.nameZh, EXPECTED[i][1]);
    assert.equal(x.originalName, EXPECTED[i][1]);
    assert.equal(x.kind, 'EQ');
    assert.equal(H.DESIGN.legacy('PB' + x.code.slice(3)), x.code);
    assert.equal(x.design['tên pháp bảo'], x.name);
    assert.equal(x.design['tên chữ Hán'], x.nameZh);
  }
});

test('25 ô ảnh là lưới 5×5, từ trái qua phải rồi xuống hàng, không lẫn atlas cũ', () => {
  const { assets: A, index } = uiFixture(), atlas = require('../media/assets/item/atlas.json');
  const cuts = [[0,131,250,375,490,640], [0,128,253,377,486,640], [0,126,256,372,491,640], [0,132,249,370,492,640], [0,124,256,383,493,640]];
  assert.equal(index.sheets['PB_1.png'].join(','), '5,5');
  assert.deepEqual(atlas.sheets['PB_1.png'], { columns: 5, rows: 5, count: 25 });
  for (const [i, x] of fresh().entries()) {
    const tile = A.itemTile(x), meta = atlas.items[x.code], image = A.itemImg(x);
    assert.equal(tile.sheet, 'PB_1.png');
    assert.equal(tile.id, i + 1);
    assert.equal(tile.column, i % 5 + 1);
    assert.equal(tile.row, Math.floor(i / 5) + 1);
    const row = Math.floor(i / 5), col = i % 5;
    const rect = [col * 128, cuts[col][row], 128, cuts[col][row + 1] - cuts[col][row]];
    assert.deepEqual(meta.rect, rect);
    assert.equal(tile.x, rect[0]); assert.equal(tile.y, rect[1]);
    assert.equal(tile.width, rect[2]); assert.equal(tile.height, rect[3]);
    assert.ok(tile.x + tile.width <= 640 && tile.y + tile.height <= 640);
    assert.equal(meta.name, x.name); assert.equal(meta.nameZh, x.nameZh);
    assert.equal(meta.row, tile.row); assert.equal(meta.column, tile.column);
    assert.ok(image.style.includes('media/assets/item/PB_1.webp'));
    const size = (64000 / Math.max(tile.width, tile.height)).toFixed(6);
    assert.ok(image.style.includes('background-size:' + size + '% ' + size + '%'));
    assert.ok(image.style.includes('clip-path:inset('));
    const variant = A.itemTile(H.item(x.code + '@4'));
    assert.equal(variant.id, tile.id);
    assert.equal(variant.sheet, tile.sheet);
  }
  assert.equal(A.itemTile(H.item('EQ-001')).sheet, 'PB.png');
  assert.equal(A.itemTile(H.item('EQ-082')).id, 82);
  assert.ok(!A.itemImg(H.item('EQ-001')).style.includes('clip-path'));
});

test('tọa độ cắt lỗi bị từ chối thay vì lấy nhầm ảnh bên cạnh', () => {
  const { assets: A, index } = uiFixture();
  for (const rect of [[0,0,641,128], [0,639,128,2], [-1,0,128,128], [0,0,0,128], [0,0,128.5,128]]) {
    index.rects['PB_1.png#1'] = rect;
    assert.equal(A.itemTile(H.item('EQ-083')), null);
    assert.equal(A.itemImg(H.item('EQ-083')).style, '');
  }
});

test('ảnh PB_1 là WebP thật và các mã tra cứu dùng đúng tên mới', () => {
  const data = fs.readFileSync(path.join(ROOT, 'media/assets/item/PB_1.webp'));
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(data.toString('ascii', 8, 12), 'WEBP');
  const lookup = require('../media/assets/bang_tra_cuu.json');
  for (const x of fresh()) assert.equal(lookup[x.code], x.name);
});

test('pháp bảo mới phân bổ trong ba giới, giữ khung rank/quality và loại trang sức của ngọc trâm', () => {
  const worlds = new Set();
  for (const x of fresh()) {
    worlds.add(H.F.realm_map(x.tier));
    assert.equal(x.rank, H.SCHEMA.rankForTier(x.tier));
    assert.equal(x.quality, 1);
    assert.equal(x.sub, 0);
    assert.equal(x.design.loại, x.equipmentType);
    for (let q = 0; q < 5; q++) {
      const v = H.item(x.code + '@' + q);
      assert.equal(v.sub, q); assert.equal(v.quality, q + 1);
    }
  }
  assert.deepEqual([...worlds], ['Hạ Giới', 'Linh Giới', 'Tiên Giới']);
  assert.equal(H.item('EQ-105').design.loại, 'trang sức');
  for (const code of ['EQ-089', 'EQ-095', 'EQ-102']) assert.equal(H.item(code).kind, 'EQ');
});

test('mọi món mới mua, rèn, trang bị và bán được qua lệnh game thật', () => {
  for (const x of fresh()) {
    const g = gameAt(Math.max(2, x.tier));
    g.s.stone = g.price(x.code) * 10;
    g.s.borrowedBook = H.SECT_BOOKS.find(b => b.kind === 'EQ' && x.tier >= b.minRealm && x.tier <= b.maxRealm).id;
    g.s.learned['BT-900'] = 0;
    const before = g.s.stone, price = H.F.shop_buy_price(g.price(x.code));
    C.execute(g, { type: 'buy', payload: { code: x.code } }, NOW);
    assert.equal(g.count(x.code), 1, x.code);
    assert.equal(g.s.stone, before - price);
    const power = g.stats().CP;
    C.execute(g, { type: 'equip', payload: { code: x.code } }, NOW);
    assert.ok(g.s.equipment.includes(x.code));
    assert.ok(g.stats().CP > power);
    C.execute(g, { type: 'equip', payload: { code: x.code } }, NOW);
    const recipe = g.forgeRecipe(x.code);
    assert.ok(g.hasCraftRecipe(x.code));
    assert.equal(H.item(recipe.herb).kind, 'MAT');
    g.add(recipe.herb, recipe.count);
    C.execute(g, { type: 'forge', payload: { code: x.code } }, NOW);
    assert.equal(g.count(x.code), 2);
    C.execute(g, { type: 'sell', payload: { code: x.code } }, NOW);
    assert.equal(g.count(x.code), 1);
  }
});

test('lưu game giữ được pháp bảo mới, biến thể Tuyệt phẩm và mã pháp bảo cũ', () => {
  const g = gameAt(13);
  g.s.bag['EQ-001'] = 2; g.add('EQ-083@4'); g.add('EQ-107');
  C.execute(g, { type: 'equip', payload: { code: 'EQ-083@4' } }, NOW);
  const restored = H.normalize(JSON.parse(JSON.stringify(g.s)), NOW);
  assert.equal(restored.bag['EQ-001'], 2);
  assert.equal(restored.bag['EQ-083@4'], 1);
  assert.equal(restored.bag['EQ-107'], 1);
  assert.ok(restored.equipment.includes('EQ-083@4'));
  assert.equal(H.item('EQ-001').name, 'Thanh Vân Sư Tử Ấn');
  assert.equal(H.item('EQ-082').name, 'Quy Hương Bạch Ngọc Ấn');
});

test('chi tiết hiện chữ Hán; tìm kiếm nhận tên Việt không dấu và tên Hán', () => {
  const { ui } = uiFixture();
  for (const x of fresh()) {
    const sheet = ui.kit.itemSheet(x);
    assert.ok(sheet.includes('lang="zh-Hans"'));
    assert.ok(sheet.includes(x.nameZh));
    assert.ok(sheet.includes('PB_1.webp'));
    ui.view.query = x.nameZh;
    assert.equal(ui.lists.matches(x), true);
  }
  ui.view.query = 'thanh loan ngoc tram';
  assert.equal(ui.lists.matches(H.item('EQ-105')), true);
  assert.equal(ui.lists.matches(H.item('EQ-083')), false);
});

test('khóa cảnh giới vẫn chặn mua/rèn pháp bảo bậc cao', () => {
  const g = gameAt(0);
  g.s.stone = 1e30;
  assert.throws(() => C.execute(g, { type: 'buy', payload: { code: 'EQ-107' } }, NOW), /chưa mở khóa/);
  assert.throws(() => C.execute(g, { type: 'forge', payload: { code: 'EQ-107' } }, NOW));
  assert.equal(g.count('EQ-107'), 0);
});

test('migration admin thêm đúng 25 món, chạy lại an toàn và giữ danh mục cũ', async () => {
  const db = new PGlite();
  try {
    await db.exec('create schema game; create table game.item_catalog (code text primary key, name text not null, category text not null);');
    await db.query('insert into game.item_catalog values ($1, $2, $3)', ['EQ-001', 'Pháp bảo đang có', 'Pháp bảo']);
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261120090000_pb1_artifact_catalog.sql'), 'utf8');
    await db.exec(sql); await db.exec(sql);
    const { rows } = await db.query("select code, name, category from game.item_catalog where code >= 'EQ-083' order by code");
    assert.equal(rows.length, 25);
    for (const [i, row] of rows.entries()) {
      assert.equal(row.code, codeAt(i));
      assert.equal(row.name, EXPECTED[i][0]);
      assert.equal(row.category, 'Pháp bảo');
    }
    const old = await db.query("select name from game.item_catalog where code = 'EQ-001'");
    assert.equal(old.rows[0].name, 'Pháp bảo đang có');
  } finally { await db.close(); }
});
