/* Tự động giao chiến: chính sách chọn hành động mỗi lượt. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { choose } = require('../client/ui/auto-battle.js');

const B = { powerMp: .12, healMp: .18 };
const base = (over = {}) => ({
  mode: 'explore', battle: B, hp: 900, maxHp: 1000, mp: 500, maxMp: 500, healCd: 0, powerCd: 0, heavy: false,
  manuals: [], artifacts: [], items: [], ...over
});

test('không có gì đặc biệt thì ưu tiên trọng kích khi dư linh lực, thiếu linh lực thì đánh thường', () => {
  assert.equal(choose(base()).action, 'power');
  assert.equal(choose(base({ mp: 60 })).action, 'attack');
  assert.equal(choose(base({ powerCd: 1 })).action, 'attack');
});

test('trận đã kết thúc thì không chọn gì', () => {
  assert.equal(choose(base({ over: true })), null);
  assert.equal(choose(null), null);
});

test('sắp gục: dùng đan hồi phục trước, rồi công pháp hồi, rồi vận công', () => {
  const pill = { code: 'PILL-1', n: 2, restores: 'hp' };
  const heal = { code: 'BT-9', kind: 'heal', cd: 0, mpCost: 40 };
  assert.deepEqual(pick(choose(base({ hp: 300, items: [pill], manuals: [heal] }))), ['item', 'PILL-1']);
  assert.deepEqual(pick(choose(base({ hp: 300, manuals: [heal] }))), ['manual', 'BT-9']);
  assert.equal(choose(base({ hp: 300 })).action, 'heal');
  assert.notEqual(choose(base({ hp: 300, healCd: 2 })).action, 'heal');
});

test('tắt dùng vật phẩm thì không bao giờ trả về đan; tắt kỹ năng thì không thi triển công pháp', () => {
  const pill = { code: 'PILL-1', n: 2, restores: 'hp' };
  const atk = { code: 'BT-2', kind: 'attack', cd: 0, mpCost: 30, damage: 2 };
  assert.equal(choose(base({ hp: 300, items: [pill] }), { items: false }).action, 'heal');
  assert.equal(choose(base({ manuals: [atk] }), { skills: false }).action, 'power');
  assert.deepEqual(pick(choose(base({ manuals: [atk] }))), ['manual', 'BT-2']);
});

test('chọn công pháp công kích mạnh nhất đang sẵn sàng, bỏ qua chiêu đang hồi hoặc thiếu linh lực', () => {
  const list = [
    { code: 'A', kind: 'attack', cd: 0, mpCost: 30, damage: 1.5 },
    { code: 'B', kind: 'attack', cd: 0, mpCost: 30, damage: 3 },
    { code: 'C', kind: 'attack', cd: 2, mpCost: 30, damage: 9 },
    { code: 'D', kind: 'attack', cd: 0, mpCost: 9999, damage: 9 }
  ];
  assert.equal(choose(base({ manuals: list })).code, 'B');
});

test('linh lực thấp thì uống đan hồi linh; địch dồn đòn nặng khi sinh lực chưa dày thì thủ thế', () => {
  assert.deepEqual(pick(choose(base({ mp: 30, items: [{ code: 'MP-1', n: 1, restores: 'mp' }] }))), ['item', 'MP-1']);
  assert.equal(choose(base({ hp: 600, heavy: true })).action, 'guard');
  assert.notEqual(choose(base({ hp: 950, heavy: true })).action, 'guard');
});

test('bí cảnh: hết thể lực thì thủ thế, đủ thể lực thì trọng kích, sinh lực thấp thì hồi phục', () => {
  const R = { attack: 8, power: 24, healMp: .18 };
  const run = (over = {}) => ({ mode: 'dungeon', run: R, hp: 900, maxHp: 1000, mp: 400, maxMp: 500, sta: 60, healCd: 0, heavy: false, ...over });
  assert.equal(choose(run()).action, 'power');
  assert.equal(choose(run({ sta: 20 })).action, 'attack');
  assert.equal(choose(run({ sta: 4 })).action, 'guard');
  assert.equal(choose(run({ hp: 300 })).action, 'heal');
  assert.equal(choose(run({ hp: 300, healCd: 2 })).action, 'power');
  assert.equal(choose(run({ hp: 300, healCd: 2, heavy: true })).action, 'guard');
});

function pick(c) { return [c.action, c.code]; }
