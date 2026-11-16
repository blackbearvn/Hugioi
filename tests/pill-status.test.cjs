/* Đan hồi riêng sinh lực / linh khí và đan xử lý hiệu ứng xấu. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/play.js');
const H = require('../engine/game.js');

test('đan hồi sinh lực chỉ hồi HP, không đụng linh lực', async () => {
  const t = await setup(); await t.create();
  await t.patch(s => { s.bag['PILL-006'] = 2; s.hp = 1; s.mp = 1; });
  const before = await t.state();
  await t.cmd('use', { code: 'PILL-006' });
  const after = await t.state();
  assert.ok(after.hp > before.hp);
  assert.equal(after.mp, before.mp);
});

test('đan hồi linh lực chỉ hồi MP, không đụng sinh lực', async () => {
  const t = await setup(); await t.create();
  await t.patch(s => { s.bag['PILL-009'] = 2; s.hp = 1; s.mp = 1; });
  const before = await t.state();
  await t.cmd('use', { code: 'PILL-009' });
  const after = await t.state();
  assert.ok(after.mp > before.mp);
  assert.equal(after.hp, before.hp);
});

test('đan giải độc xóa chảy máu và hiệu ứng xấu, giảm tâm ma', async () => {
  const t = await setup(); await t.create();
  await t.patch(s => {
    s.bag['PILL-013'] = 1;
    s.realm = 1; s.stage = 1;
    s.designCombat.bleed = { pct: .01, last: t.clock.now, end: t.clock.now + 5000 };
    s.debuffs = ['freeze', 'stun'];
    s.tamMa = 40;
  });
  await t.cmd('use', { code: 'PILL-013' });
  const after = await t.state();
  assert.equal(after.designCombat.bleed, null);
  assert.deepEqual(after.debuffs, []);
  assert.ok(after.tamMa < 40);
});

test('đan kháng hiệu ứng xấu xóa hiệu ứng hiện có và đặt khiên giảm thời gian', async () => {
  const t = await setup(); await t.create();
  await t.patch(s => {
    s.bag['PILL-031'] = 1;
    s.realm = 5; s.stage = 1;
    s.designCombat.bleed = { pct: .01, last: t.clock.now, end: t.clock.now + 5000 };
    s.debuffs = ['freeze'];
  });
  await t.cmd('use', { code: 'PILL-031' });
  const after = await t.state();
  assert.equal(after.designCombat.bleed, null);
  assert.deepEqual(after.debuffs, []);
  assert.ok(after.designCombat.ward);
  assert.equal(after.designCombat.ward.reduce, .15);
  assert.ok(after.designCombat.ward.end > t.clock.now);
});

test('khiên kháng hiệu ứng giảm thời gian chảy máu thực tế trong giao chiến', async () => {
  const t = await setup(); await t.create();
  const g = new H.Game(structuredClone(await t.state()), () => .999999);
  const now = t.clock.now;
  Object.assign(g.s, { realm: 5, stage: 1, zone: 0, enemyKind: 'thường', hp: 1e9 });
  g.s.bag['PILL-031'] = 1;
  g.use({ code: 'PILL-031' }, now);
  g._strike(0, now + 1000, true);
  assert.ok(g.s.designCombat.bleed, 'Hắc Lang gây chảy máu');
  const duration = g.s.designCombat.bleed.end - (now + 1000);
  assert.ok(Math.abs(duration - 3000 * .85) < 1, 'thời gian chảy máu giảm 15%: ' + duration);
});
