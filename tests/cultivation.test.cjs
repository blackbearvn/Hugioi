/* Tu luyện: hấp thu, tu vi theo thời gian online, đột phá, bế quan. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/play.js');
const H = require('../engine/game.js');
const { seededRng } = require('../server/services/player-service.js');

/* Dựng đúng trạng thái đỉnh cảnh giới và chọn seed sao cho lần gieo đầu tiên
   rơi vào nhánh mong muốn. Nhờ vậy test không phụ thuộc may mắn. */
async function peak(t, realm, { shield = 0, tamMa = 0 } = {}) {
  const stage = H.F.STAGES[realm];
  await t.patch(s => {
    s.realm = realm; s.stage = stage; s.zone = realm;
    s.qi = H.F.exp_need(realm, stage - 1);
    s.shield = shield; s.reduction = 0; s.tamMa = tamMa;
    s.death = null; s.completed = false; s.pity = 0;
    /* Cố định linh căn/huyết mạch để phép thử lôi kiếp không phụ thuộc
       phần thưởng ngẫu nhiên lúc tạo nhân vật. */
    s.rootType = 'Song'; s.rootSub = ''; s.roots = [0, 0, 0, 0, 0];
    s.race = 'nhan'; s.equipment = []; s.permanent = 0;
  });
}
function seededFirstAbove(cut, from = 1) {
  for (let i = from; i < from + 5000; i++) {
    const seed = i.toString(16).padStart(64, '0');
    if (seededRng(seed, 0)() >= cut) return seed;
  }
  throw Error('Không tìm được seed phù hợp');
}

test('online thì tu vi tăng theo thời gian', async () => {
  const t = await setup(); await t.create();
  await t.tick(30);
  assert.ok((await t.state()).qi > 0);
});

test('offline không tích lũy tu vi', async () => {
  const t = await setup(); await t.create();
  await t.tick(20); const before = (await t.state()).qi;
  await t.tick(3 * 3600); // vắng 3 giờ rồi quay lại
  assert.ok((await t.state()).qi - before < 5, 'không cộng ba giờ offline');
});

test('hấp thu linh thạch tăng tu vi và trừ linh thạch', async () => {
  const t = await setup(); await t.create();
  const before = await t.state();
  await t.cmd('absorb', { index: 0 });
  const after = await t.state();
  assert.ok(after.qi > before.qi);
  assert.ok(after.stone < before.stone);
});

test('chưa đủ tu vi thì không đột phá được', async () => {
  const t = await setup(); await t.create();
  await assert.rejects(t.cmd('breakthrough'), { code: 'GAME_RULE_VIOLATION' });
});

test('bế quan bắt đầu rồi dừng được', async () => {
  const t = await setup(); await t.create();
  await t.patch(s => { s.progress.meditate = 60; });
  await t.cmd('startRetreat', { duration: 1800 });
  assert.ok((await t.state()).retreat);
  await t.cmd('stopRetreat');
});

test('bật tự động và đổi cài đặt hiệu ứng', async () => {
  const t = await setup(); await t.create();
  await t.cmd('setAuto', { enabled: true });
  await t.cmd('setPreference', { key: 'cultivationEffects', value: false });
  const s = await t.state();
  assert.equal(s.auto, true);
  assert.equal(s.settings.cultivationEffects, false);
});

test('trượt xác suất phá cảnh vẫn sống, mất tu vi và tăng may mắn', async () => {
  const t = await setup(); await t.create();
  await peak(t, 0, { tamMa: 100 }); // đỉnh Luyện Khí không có lôi kiếp
  const before = new H.Game(structuredClone(await t.state()));
  const cut = before.chance();
  t.repo.testSetSeed(t.id, seededFirstAbove(cut + .02));

  const out = await t.cmd('breakthrough');
  assert.equal(out.result.success, false);
  assert.equal(out.result.died, false);
  assert.equal(out.result.survived, true);

  const s = await t.state();
  assert.equal(s.death, null, 'không chết khi chỉ trượt xác suất');
  assert.equal(s.pity, 1, 'tích lũy may mắn đột phá');
  assert.equal(s.realm, 0);
  assert.equal(s.stage, H.F.STAGES[0], 'vẫn ở đỉnh cảnh giới cũ');
  assert.ok(Math.abs(s.qi - H.F.exp_need(0, H.F.STAGES[0] - 1) * (1 - H.F.P.FAIL_EXP_LOSS)) < 1e-6);
  assert.ok(s.hp > 0 && s.hp <= new H.Game(s).stats().HP);
  assert.ok(new H.Game(s).chance() > cut, 'lần sau xác suất cao hơn nhờ may mắn');
});

test('hộ kiếp vỡ trong lôi kiếp khiến đạo thân tọa hóa', async () => {
  const t = await setup(); await t.create();
  await peak(t, 4); // Hóa Thần: lôi kiếp vượt sinh lực nền khi không có hộ kiếp
  const out = await t.cmd('breakthrough');
  assert.equal(out.result.died, true);
  assert.equal(out.result.success, false);
  const s = await t.state();
  assert.equal(s.death?.cause, 'tribulation');
  assert.equal(new H.Game(s).isDead(), true);
});

test('lôi kiếp đầu cảnh giới chịu được khi không có hộ kiếp', async () => {
  const t = await setup(); await t.create();
  await peak(t, 1); // Trúc Cơ: ba đạo lôi, tổng sát thương dưới sinh lực nền
  const out = await t.cmd('breakthrough');
  assert.notEqual(out.result.died, true);
  assert.equal((await t.state()).death, null);
});
