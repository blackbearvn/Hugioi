/* Dữ liệu đan dược: enum tập trung trong data/schema.js phải khớp balance, items và catalog. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../data/schema.js');
const B = require('../data/balance.js');
const C = require('../data/catalog.js');

const pills = C.ITEMS.filter(x => x.kind === 'PILL');
const danLoai = Object.keys(B.DAN_LOAI);

test('EFFECTS của đan khớp đúng các loại trong DAN_LOAI, TRONG_SINH nằm ngoài enum đan', () => {
  assert.deepEqual(Object.keys(S.EFFECTS).sort(), danLoai.filter(k => k !== 'TRONG_SINH').sort());
  assert.deepEqual(Object.keys(S.ALL_EFFECTS).sort(), danLoai.slice().sort());
  assert.ok(!Object.hasOwn(S.EFFECTS, 'TRONG_SINH'));
  assert.ok(Object.hasOwn(S.NON_PILL_EFFECTS, 'TRONG_SINH'));
});

test('mọi đan đang dùng effect thuộc enum EFFECTS, không viên nào dùng TRONG_SINH', () => {
  assert.equal(pills.length, 60);
  for (const p of pills) {
    assert.ok(Object.hasOwn(S.EFFECTS, p.effect), p.code + ' có effect lạ: ' + p.effect);
    assert.ok(!Object.hasOwn(S.NON_PILL_EFFECTS, p.effect), p.code + ' dùng effect ngoài đan: ' + p.effect);
  }
});

test('GRADES có 14 bậc, id duy nhất và gradeIdFor đọc được cả chuỗi cũ lẫn chuỗi catalog', () => {
  assert.equal(S.GRADES.length, 14);
  assert.equal(new Set(S.GRADES.map(g => g.id)).size, 14);
  const raw = require('../data/items.js');
  for (const p of raw.filter(x => x.kind === 'PILL')) {
    assert.ok(S.gradeIdFor(p.grade), p.code + ' có grade cũ lạ: ' + p.grade);
    assert.ok(S.gradeIdFor(C.item(p.code).grade), p.code + ' có grade catalog lạ: ' + C.item(p.code).grade);
  }
  assert.equal(S.gradeIdFor('Nhất phẩm'), 'pham');
  assert.equal(S.gradeIdFor('Ngũ phẩm'), 'thien');
  assert.equal(S.gradeIdFor('Thánh đan'), 'thanh_dan');
  assert.equal(S.gradeIdFor('không có'), null);
});

test('gradeIdFor ánh xạ đúng thứ tự phẩm chất từ thấp đến cao', () => {
  const order = S.GRADES.map(g => g.id);
  for (let i = 1; i < S.GRADES.length; i++)
    assert.ok(order.indexOf(S.gradeIdFor(S.GRADES[i - 1].label)) < order.indexOf(S.gradeIdFor(S.GRADES[i].label)));
  for (const g of S.GRADES) assert.equal(S.gradeIdFor(g.label), g.id);
});

test('TAGS là bảng kebab-case và tagsFor sinh tag hợp lệ cho mọi đan', () => {
  for (const tag of Object.keys(S.TAGS)) assert.match(tag, /^[a-z]+(-[a-z]+)*$/, tag);
  for (const p of pills) {
    const tags = S.tagsFor(p.effect, p.tier, false);
    assert.equal(tags.length, 3);
    for (const tag of tags) assert.ok(Object.hasOwn(S.TAGS, tag), p.code + ' sinh tag lạ: ' + tag);
    assert.ok(tags.includes(S.EFFECT_TAGS[p.effect]), p.code);
  }
});

test('tierTag chia đúng ba thế giới Hạ - Linh - Tiên', () => {
  assert.equal(S.tierTag(0), 'ha-gioi');
  assert.equal(S.tierTag(4), 'ha-gioi');
  assert.equal(S.tierTag(5), 'linh-gioi');
  assert.equal(S.tierTag(8), 'linh-gioi');
  assert.equal(S.tierTag(9), 'tien-gioi');
  assert.equal(S.tierTag(13), 'tien-gioi');
});

test('dan-hiem là tag tuỳ chọn, không tự gắn cho đan thường', () => {
  assert.ok(!S.tagsFor('TU_VI', 0, false).includes('dan-hiem'));
  assert.ok(S.tagsFor('TU_VI', 0, true).includes('dan-hiem'));
});

test('DAN_TABLE trong balance.js khớp tuyệt đối 60 đan của items.js', () => {
  assert.equal(B.DAN_TABLE.length, 60);
  const byNumber = new Map(pills.map(p => [p.sourceNumber, p]));
  for (const row of B.DAN_TABLE) {
    const [n, name, tier, effect] = row;
    const p = byNumber.get(n);
    assert.ok(p, 'DAN_TABLE có số không ứng với đan nào: ' + n);
    assert.deepEqual(row, [p.sourceNumber, p.name, p.tier, p.effect], p.code + ' lệch DAN_TABLE');
  }
  assert.equal(new Set(B.DAN_TABLE.map(r => r[0])).size, 60);
});

const R = require('../data/items.js');
const M = require('../data/manuals.js');
const rawPills = R.filter(x => x.kind === 'PILL');

test('cả 60 đan có number, gradeId, tags, useReq khớp quy tắc suy ra', () => {
  assert.equal(rawPills.length, 60);
  for (const p of rawPills) {
    assert.equal(p.number, p.sourceNumber, p.code);
    assert.equal(p.gradeId, S.gradeIdFor(p.grade), p.code);
    assert.deepEqual(p.tags, S.tagsFor(p.effect, p.tier, M.isRarePill(p)), p.code);
    assert.deepEqual(p.useReq, { realmMin: p.tier }, p.code);
  }
  const rare = rawPills.filter(M.isRarePill);
  assert.ok(rare.length > 0 && rare.every(p => p.tags.includes('dan-hiem')));
  assert.ok(rawPills.filter(p => !M.isRarePill(p)).every(p => !p.tags.includes('dan-hiem')));
});

test('migrate-pills idempotent: chạy lại trên dữ liệu đã chuẩn hóa không đổi gì', async () => {
  const { migratePills } = await import('../tools/migrate-pills.mjs');
  assert.deepEqual(migratePills(R), R);
});

test('CLI migrate-pills --check xác nhận data/items.js đã chuẩn hóa', () => {
  const out = require('node:child_process').spawnSync(process.execPath, ['tools/migrate-pills.mjs', '--check'], { cwd: require('node:path').join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr || out.stdout);
  assert.match(out.stdout, /60 đan đã chuẩn hóa/);
});
