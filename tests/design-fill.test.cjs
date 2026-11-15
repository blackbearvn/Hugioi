/* Dữ liệu thiết kế: mọi đan có đan phương riêng, mọi pháp bảo có thông số và công thức rèn, mọi ngoại tu có chiêu. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../engine/game.js');

test('mỗi pháp bảo có thông số theo loại và công thức rèn', () => {
  const eq = H.ITEMS.filter(x => x.kind === 'EQ');
  for (const x of eq) {
    const d = x.design;
    assert.ok(d && d.group === 'pháp bảo' && d['hp cộng'] > 0 && d['atk cộng'] > 0 && d['def cộng'] > 0, x.code + ' thiếu thông số');
    assert.ok(H.DESIGN.forge[x.code]?.herb, x.code + ' thiếu công thức rèn');
    assert.ok(H.DESIGN.effects[x.code], x.code + ' thiếu hiệu ứng');
  }
  const weapon = eq.find(x => x.design.loại === 'vũ khí' && x.tier === 8), armor = eq.find(x => x.design.loại === 'giáp' && x.tier === 8);
  if (weapon && armor) assert.ok(weapon.design['atk cộng'] / weapon.design['def cộng'] > armor.design['atk cộng'] / armor.design['def cộng']);
});

test('mỗi ngoại tu có chiêu thức hợp lệ', () => {
  for (const x of H.ITEMS.filter(y => y.kind === 'BT' && H.MANUALS.school(y) === 'ngoai')) {
    const k = H.MANUALS.skillOf(x);
    assert.ok(['attack', 'guard', 'heal', 'evade'].includes(k.kind) && k.cooldown > 0, x.code);
    if (k.kind === 'attack') assert.ok(k.multiplier > 1);
    if (k.kind === 'guard' || k.kind === 'heal') assert.ok(k.value > 0);
  }
});
