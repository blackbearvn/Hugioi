/* Giao chiến theo lượt trong Lịch luyện: mở trận, thủ thế, thắng, rút lui,
   đóng băng đồng hồ và lưu/tải an toàn. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/play.js');
const H = require('../engine/game.js');

async function fresh() {
  const t = await setup(); await t.create();
  const now = t.clock.now, g = new H.Game(structuredClone(await t.state()));
  g.s.lastUpdate = now;
  return { t, g, now };
}

/* Ép sự kiện đầu tiên là quái thường, rồi tắt ngẫu nhiên để kết quả tất định. */
function startFight(g, now) {
  const seq = [.1, .1, .99];
  let i = 0;
  g.rng = () => seq[Math.min(seq.length - 1, i++)];
  g.startExploration({}, now);
  assert.equal(g.s.exploration.active.kind, 'monster');
  g.s.enemyKind = 'thường';
  g.exploreChoice({ index: 0 }, now);
  g.rng = () => .99;
  g.s.hp = g.stats(now).HP;
  g.s.mp = g.maxMp();
  return g.s.exploration.active.battle;
}

test('chọn giao chiến mở trận theo lượt với chỉ số địch suy từ cảnh giới', async () => {
  const { g, now } = await fresh();
  const b = startFight(g, now);
  assert.ok(b, 'có trạng thái trận');
  assert.equal(b.state, 'active');
  assert.equal(b.turn, 1);
  assert.equal(g.s.exploration.active.choice, 0);
  assert.ok(b.enemyMax > 0 && b.enemyHp === b.enemyMax);
  assert.ok(['light', 'heavy'].includes(b.intent));
});

test('thủ thế giảm sát thương nhận so với tấn công thường', async () => {
  const one = await fresh(), two = await fresh();
  const b1 = startFight(one.g, one.now), b2 = startFight(two.g, two.now);
  b1.intent = 'heavy'; b2.intent = 'heavy';
  const guard = one.g.battleAct({ action: 'guard' }, one.now);
  const attack = two.g.battleAct({ action: 'attack' }, two.now);
  assert.ok(guard.taken > 0, 'đòn nặng vẫn xuyên thủ thế một phần');
  assert.ok(guard.taken < attack.taken, 'thủ thế nhận ít hơn tấn công thường');
});

test('hạ địch nhận chiến lợi phẩm và chốt kết quả khi tiếp tục', async () => {
  const { g, now } = await fresh();
  const b = startFight(g, now), stone = g.s.stone;
  b.enemyHp = 1;
  const out = g.battleAct({ action: 'attack' }, now);
  assert.equal(out.won, true);
  assert.equal(b.state, 'won');
  assert.equal(g.s.exploration.active.cleared, true);
  assert.ok(g.s.stone >= stone, 'không mất linh thạch khi thắng');
  assert.match(g.s.exploration.active.text, /Đánh bại/);
  const done = g.battleAct({ action: 'continue' }, now);
  assert.equal(done.finished, true);
  assert.equal(g.s.exploration.active.battle, null);
});

test('rút lui thành công chuyển sự kiện sang né tránh', async () => {
  const { g, now } = await fresh();
  const b = startFight(g, now);
  g.rng = () => 0;
  const out = g.battleAct({ action: 'flee' }, now);
  assert.equal(out.fled, true);
  assert.equal(b.state, 'fled');
  assert.equal(g.s.exploration.active.choice, 1);
  assert.equal(g.s.exploration.active.cleared, true);
  g.battleAct({ action: 'continue' }, now);
  assert.equal(g.s.exploration.active.battle, null);
});

test('đồng hồ lịch luyện đóng băng khi trận đang diễn ra', async () => {
  const { g, now } = await fresh();
  const b = startFight(g, now), e = g.s.exploration.active;
  const remain = b.remaining;
  const report = g.advance(now + 120000, false);
  assert.equal(report.battle, true);
  assert.equal(e.battle, b);
  assert.equal(b.remaining, remain);
  assert.equal(e.end, now + 120000 + remain);
  assert.equal(e.start, e.end - 600000);
});

test('dùng đan hồi sinh lực trong trận và trừ vật phẩm', async () => {
  const { g, now } = await fresh();
  startFight(g, now);
  const code = Object.keys(g.s.bag).find(k => H.item(k)?.effect === 'HOI_PHUC' && H.item(k).tier <= g.s.realm + 1);
  assert.ok(code, 'có đan hồi phục trong túi ban đầu');
  const before = g.count(code);
  g.s.hp = 1;
  const out = g.battleAct({ action: 'item', code }, now);
  assert.ok(out.healed > 0);
  assert.ok(g.s.hp > 1);
  assert.equal(g.count(code), before - 1);
});

test('lưu và tải giữa trận chỉ giữ hiệu ứng hợp lệ', async () => {
  const { g, now } = await fresh();
  const b = startFight(g, now);
  b.statuses = [{ type: 'đóng băng', turns: 2 }, { type: 'hiệu ứng lạ', turns: 9 }];
  b.enemyHp = b.enemyMax * 10;
  const raw = structuredClone(g.s), norm = H.normalize(raw, now);
  const kept = norm.exploration.active.battle;
  assert.ok(kept, 'trận vẫn tồn tại sau chuẩn hóa');
  assert.equal(kept.statuses.length, 1);
  assert.equal(kept.statuses[0].type, 'đóng băng');
  assert.ok(kept.enemyHp <= kept.enemyMax);
  assert.equal(kept.state, 'active');
});
