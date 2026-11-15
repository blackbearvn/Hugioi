/* Validator dữ liệu: phải bắt được bản ghi đan hỏng bằng dữ liệu giả, không sửa data thật. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const validator = () => import('../tools/check-data.mjs');

const herb = (code, kind = 'HERB') => ({ code, name: 'Linh thảo ' + code, kind, tier: 0 });
const pill = (over = {}) => ({
  code: 'PILL-T1', name: 'Đan thử', kind: 'PILL', tier: 0, effect: 'TU_VI', gradeId: 'pham',
  tags: ['tu-vi', 'ha-gioi', 'dan-thuong'], useReq: { realmMin: 0 }, recipe: { herbs: { 'HERB-T1': 2 } }, ...over
});
const run = async (items, options) => (await validator()).validateItems(items, options);

test('bộ dữ liệu giả hợp lệ thì không có lỗi', async () => {
  assert.deepEqual(await run([herb('HERB-T1'), pill()]), []);
});

test('bắt code trùng trong toàn bộ ITEMS', async () => {
  const errors = await run([herb('HERB-T1'), pill(), pill({ name: 'Bản sao' })]);
  assert.ok(errors.some(e => /PILL-T1: code bị trùng/.test(e)), errors.join('\n'));
});

test('bắt effect, gradeId và tag ngoài enum', async () => {
  const errors = await run([herb('HERB-T1'), pill({ effect: 'KHONG_CO', gradeId: 'khong_co', tags: ['tu-vi', 'tag-la'] })]);
  assert.ok(errors.some(e => /effect ngoài enum: "KHONG_CO"/.test(e)), errors.join('\n'));
  assert.ok(errors.some(e => /gradeId ngoài enum: "khong_co"/.test(e)), errors.join('\n'));
  assert.ok(errors.some(e => /tag ngoài enum: "tag-la"/.test(e)), errors.join('\n'));
});

test('bắt tier ngoài 0-13 và tier không nguyên', async () => {
  const errors = await run([herb('HERB-T1'), pill({ code: 'PILL-T2', tier: 14 }), pill({ code: 'PILL-T3', tier: 1.5 })]);
  assert.ok(errors.some(e => /PILL-T2: tier phải là số nguyên 0-13/.test(e)), errors.join('\n'));
  assert.ok(errors.some(e => /PILL-T3: tier phải là số nguyên 0-13/.test(e)), errors.join('\n'));
});

test('bắt nguyên liệu không tồn tại, không phải HERB và số lượng hỏng', async () => {
  const errors = await run([
    herb('HERB-T1'), herb('HERB-T2'),
    pill({ recipe: { herbs: { 'HERB-T1': 2, 'HERB-T2': 0, 'HERB-MA': 1, 'EQ-T1': 1 } } }),
    { code: 'EQ-T1', name: 'Kiếm thử', kind: 'EQ', tier: 0 }
  ]);
  assert.ok(errors.some(e => /trỏ tới mã không tồn tại: HERB-MA/.test(e)), errors.join('\n'));
  assert.ok(errors.some(e => /không phải HERB: EQ-T1 \(EQ\)/.test(e)), errors.join('\n'));
  assert.ok(errors.some(e => /recipe\.herbs\.HERB-T2 phải là số nguyên >= 1/.test(e)), errors.join('\n'));
});

test('bắt useReq.realmMin ngoài phạm vi REALMS', async () => {
  const errors = await run([herb('HERB-T1'), pill({ useReq: { realmMin: 14 } })]);
  assert.ok(errors.some(e => /useReq\.realmMin ngoài phạm vi 0-13, nhận: 14/.test(e)), errors.join('\n'));
});

test('non-strict bỏ qua khóa mới còn thiếu, strict thì bắt buộc đủ bốn khóa', async () => {
  const bare = { code: 'PILL-T1', name: 'Đan thử', kind: 'PILL', tier: 0, effect: 'TU_VI' };
  assert.deepEqual(await run([herb('HERB-T1'), bare]), []);
  const strict = await run([herb('HERB-T1'), bare], { strict: true });
  for (const key of ['gradeId', 'tags', 'useReq', 'recipe'])
    assert.ok(strict.some(e => e.includes(key + ' thiếu')), JSON.stringify(strict));
});

test('CLI chạy trên dữ liệu thật và trả mã 0 khi chưa strict', () => {
  const out = spawnSync(process.execPath, ['tools/check-data.mjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr || out.stdout);
  assert.match(out.stdout, /vật phẩm hợp lệ/);
});
