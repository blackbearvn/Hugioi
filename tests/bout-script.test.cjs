/* Kịch bản trận đấu theo lượt: khớp kết quả do máy chủ quyết định. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build, seedOf } = require('../client/ui/bout-script.js');

const skills = [{ code: 'BT-2', name: 'Phi Hoa Kiếm', kind: 'attack' }, { code: 'BT-5', name: 'Hộ Thể', kind: 'guard' }, { code: 'BT-6', name: 'Hồi Xuân', kind: 'heal' }, { code: 'BT-7', name: 'Ảnh Bộ', kind: 'evade' }];

test('thắng: lượt cuối hạ gục đối thủ, ta luôn còn sinh lực, đối thủ chưa từng gục sớm', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const b = build({ win: true, seed, myHp: 1000, foeHp: 1400, skills });
    const last = b.rounds.at(-1);
    assert.ok(b.rounds.length >= 4 && b.rounds.length <= 7);
    assert.equal(last.state, 'won'); assert.equal(last.won, true);
    assert.equal(last.foeHp, 0); assert.ok(last.heroHp > 0);
    assert.equal(last.counter, false);
    for (const r of b.rounds.slice(0, -1)) { assert.ok(r.foeHp > 0 && r.heroHp > 0, 'seed ' + seed); assert.equal(r.state, 'active'); }
  }
});

test('thua: lượt cuối ta gục, đối thủ luôn còn sinh lực', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const b = build({ win: false, seed, myHp: 1000, foeHp: 1400, skills });
    const last = b.rounds.at(-1);
    assert.equal(last.state, 'lost'); assert.equal(last.heroHp, 0); assert.ok(last.foeHp > 0);
    assert.equal(last.counter, true); assert.ok(last.taken > 0);
    for (const r of b.rounds.slice(0, -1)) assert.ok(r.heroHp > 0 && r.foeHp > 0, 'seed ' + seed);
    for (const r of b.rounds) assert.equal(r.won, false);
  }
});

test('thanh máu khớp sát thương từng lượt và không bao giờ âm', () => {
  for (const win of [true, false]) for (let seed = 1; seed <= 100; seed++) {
    const b = build({ win, seed, myHp: 800, foeHp: 600, skills });
    let hero = b.heroMax, foe = b.foeMax;
    for (const r of b.rounds) {
      foe -= r.dealt; hero += r.healed - r.taken;
      assert.equal(r.foeHp, foe); assert.equal(r.heroHp, hero);
      assert.ok(r.dealt >= 0 && r.taken >= 0 && r.healed >= 0 && hero >= 0 && foe >= 0 && hero <= b.heroMax);
    }
  }
});

test('cùng seed cho cùng kịch bản, kỹ năng chỉ đến từ danh sách đã đặt và có hồi chiêu', () => {
  const a = build({ win: true, seed: seedOf('hanh-chu', 123, 456), myHp: 900, foeHp: 900, skills });
  const b = build({ win: true, seed: seedOf('hanh-chu', 123, 456), myHp: 900, foeHp: 900, skills });
  assert.deepEqual(a, b);
  for (let seed = 1; seed <= 100; seed++) {
    const rounds = build({ win: true, seed, myHp: 900, foeHp: 900, skills }).rounds;
    const used = rounds.filter(r => r.action === 'manual');
    for (const r of used) assert.ok(skills.some(s => s.code === r.code && s.name === r.cry));
    for (let i = 0; i < rounds.length; i++) for (let j = i + 1; j < Math.min(rounds.length, i + 3); j++)
      assert.ok(!(rounds[i].action === 'manual' && rounds[j].action === 'manual' && rounds[i].code === rounds[j].code), 'hồi chiêu seed ' + seed);
  }
  assert.ok(build({ win: true, seed: 9, myHp: 900, foeHp: 900, skills: [] }).rounds.every(r => r.action !== 'manual'));
});
