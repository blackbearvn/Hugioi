/* Chế tạo: luyện đan cần sách nghề, rèn pháp bảo cần Kết Đan, linh điền cần hạt giống. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/play.js');

test('luyện đan chưa mượn sách nghề thì bị từ chối', async () => {
  const t = await setup(); await t.create();
  await assert.rejects(t.cmd('craft', { code: 'PILL-001' }), /sách nghề/);
});

test('rèn pháp bảo chưa tới Kết Đan thì bị từ chối', async () => {
  const t = await setup(); await t.create();
  await assert.rejects(t.cmd('forge', { code: 'EQ-001' }), /Kết Đan/);
});

test('linh điền trống thì không tưới được', async () => {
  const t = await setup(); await t.create();
  await assert.rejects(t.cmd('garden', { slot: 0, action: 'water' }), /trống/);
});

test('luyện thủ công: sai công thức thì mất nguyên liệu và nổ lò hoặc phế đan', async () => {
  const t = await setup(); await t.create();
  await t.patch(st => { st.bag['HERB-001'] = 5; });
  const out = await t.cmd('mixCraft', { mix: { 'HERB-001': 1 } });
  assert.match(JSON.stringify(out), /explode|waste/);
  assert.equal((await t.state()).bag['HERB-001'], 4);
  await assert.rejects(t.cmd('mixCraft', { mix: { 'HERB-001': 9 } }), /Thiếu/);
});

test('engine đọc đan phương từ dữ liệu, không tự sinh theo sourceNumber', () => {
  const H = require('../engine/game.js');
  const NOW = 1800000000000;
  const profile = { name: 'Lý Vô Thường', gender: 'nam', age: 18, race: 'nhan', roots: [72, 61, 45, 44, 33], rootType: 'Song', talent: { tuongMao: 2, phucDuyen: 2, canCot: 2, ngoTinh: 1, vanKhi: 1 }, destiny: 'exp' };
  const game = new H.Game(H.createCharacter(profile, NOW, () => 0), () => 0);
  const pills = H.ITEMS.filter(x => x.kind === 'PILL');
  for (const p of pills) assert.deepEqual(game.recipe(p.code).herbs, p.recipe.herbs, p.code);
  const fallbackPill = pills.find(x => x.code === 'PILL-029');
  const saved = fallbackPill.recipe;
  try {
    delete fallbackPill.recipe;
    assert.throws(() => game.recipe('PILL-029'), /chưa có đan phương/);
  } finally {
    fallbackPill.recipe = saved;
  }
});
