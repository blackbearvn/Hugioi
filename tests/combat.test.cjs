/* Chiến đấu và bản đồ: đánh quái, đổi vùng, bí cảnh. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/play.js');
const H = require('../engine/game.js');

test('ra đòn đánh quái được', async () => {
  const t = await setup(); await t.create();
  await t.cmd('strike');
  assert.ok((await t.state()).enemyHp >= 0);
});

test('đổi sang vùng cao hơn khi chưa đủ cảnh giới bị từ chối', async () => {
  const t = await setup(); await t.create();
  await assert.rejects(t.cmd('travel', { zone: 1 }), /Cảnh giới chưa đủ/);
});

test('bí cảnh chưa mở thì không vào được', async () => {
  const t = await setup(); await t.create();
  const high = H.DUNGEONS.find(d => d.realm > 0);
  await assert.rejects(t.cmd('startDungeon', { id: high.id }), /chưa mở/);
});

test('lệnh không có trong danh sách bị từ chối', async () => {
  const t = await setup(); await t.create();
  await assert.rejects(t.cmd('hackGold', { amount: 999 }));
});

test('quái có tên suy ra HP/ATK/DEF từ cảnh giới và khu vực', async () => {
  const t = await setup(); await t.create();
  const g = new H.Game(structuredClone(await t.state()));
  for (let zone = 0; zone < 5; zone++) {
    for (const stage of [1, H.F.STAGES[zone]]) {
      g.s.zone = zone; g.s.stage = stage; g.s.enemyKind = 'thường';
      const e = g.enemy(), base = H.F.stats(zone, stage - 1), mult = H.F.MONSTER_MULT['thường'];
      assert.ok(e.designId, 'giữ hồ sơ thiết kế của quái có tên');
      assert.ok(Math.abs(e.HP - base.HP * mult) < base.HP * 1e-9, 'HP quái theo công thức cảnh giới');
      assert.ok(Math.abs(e.ATK - base.ATK * mult) < base.ATK * 1e-9, 'ATK quái theo công thức cảnh giới');
      assert.ok(Math.abs(e.DEF - base.DEF * mult) < base.DEF * 1e-9, 'DEF quái theo công thức cảnh giới');
      const playerCp = H.F.combat_power(base.HP, base.ATK, base.DEF, base.CRIT, base.CRIT_DMG);
      const ratio = e.CP / playerCp;
      assert.ok(ratio > .45 && ratio < .8, `${H.ZONES[zone].name} tầng ${stage}: tỉ lệ sức mạnh ${ratio.toFixed(2)}`);
    }
  }
});

test('boss khu vực dùng hệ số boss thay vì chỉ số tuyệt đối trong thiết kế', async () => {
  const t = await setup(); await t.create();
  const g = new H.Game(structuredClone(await t.state()));
  g.s.zone = 4; g.s.stage = 1;
  for (const [kind, mult] of [['boss', 2], ['boss kiếp', 3]]) {
    g.s.enemyKind = kind;
    const e = g.enemy(), base = H.F.stats(4, 0);
    assert.ok(Math.abs(e.HP - base.HP * mult) < base.HP * 1e-9);
    assert.equal(e.name, 'Cáo Truyền Thuyết');
    assert.equal(e.designId, 'BS001');
  }
});

test('thủ lĩnh bí cảnh quy theo cảnh giới, không dùng HP tuyệt đối của thiết kế', async () => {
  const t = await setup(); await t.create();
  const g = new H.Game(structuredClone(await t.state()));
  for (const d of H.DUNGEONS) {
    const base = H.F.stats(d.realm, 0);
    const playerCp = H.F.combat_power(base.HP, base.ATK, base.DEF, base.CRIT, base.CRIT_DMG);
    const first = g.dungeonEnemy(d, 1);
    const last = g.dungeonEnemy(d, d.floors);
    assert.ok(Math.abs(first - playerCp * .48) < playerCp * 1e-9, d.id + ': tầng đầu theo công thức');
    const mult = (.48 + .12 * (d.floors - 1)) * 1.5;
    assert.ok(Math.abs(last - playerCp * mult) < playerCp * 1e-9, d.id + ': thủ lĩnh theo công thức');
    assert.ok(last / playerCp < 4, d.id + ': thủ lĩnh không vượt xa người cùng cảnh giới');
  }
});
