/* Tông môn: gia nhập, ủy thác, rời tông. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/play.js');
const H = require('../engine/game.js');

test('gia nhập tông môn rồi rời tông', async () => {
  const t = await setup(); await t.create();
  const id = H.SECTS[0].id;
  await t.cmd('joinSect', { id });
  assert.equal((await t.state()).sect.joined, true);
  assert.equal((await t.state()).sect.id, id);
  await t.cmd('leaveSect');
  assert.equal((await t.state()).sect.joined, false);
});

test('tông môn không tồn tại bị từ chối', async () => {
  const t = await setup(); await t.create();
  await assert.rejects(t.cmd('joinSect', { id: 'khong-co' }), /không hợp lệ/);
});

test('chưa vào tông thì không nhận ủy thác', async () => {
  const t = await setup(); await t.create();
  await assert.rejects(t.cmd('startSectMission', { id: H.SECT_MISSIONS[0].id }));
});

test('tri kỷ: nhận thưởng mốc tình nghĩa một lần; đạo lữ: kết duyên, song tu, ly duyên', async () => {
  const t = await setup(); await t.create();
  await t.patch(st => { st.realm = 3; st.stone = 1e12; st.qi = 0; });
  await t.cmd('meetFriend', { id: 'trieu-nguyet' });
  await assert.rejects(t.cmd('claimBond', { id: 'trieu-nguyet', at: 50 }), /chưa đạt/);
  await t.patch(st => { st.social.friends['trieu-nguyet'].affinity = 30; });
  const got = await t.cmd('claimBond', { id: 'trieu-nguyet', at: 25 });
  assert.ok(got.result.stone > 0);
  await assert.rejects(t.cmd('claimBond', { id: 'trieu-nguyet', at: 25 }), /Đã nhận/);
  await assert.rejects(t.cmd('bindPartner', { id: 'trieu-nguyet' }), /tình nghĩa/);
  await t.patch(st => { st.social.friends['trieu-nguyet'].affinity = 85; });
  const before = (await t.state()).stone;
  await t.cmd('bindPartner', { id: 'trieu-nguyet' });
  assert.ok((await t.state()).stone < before);
  await assert.rejects(t.cmd('bindPartner', { id: 'trieu-nguyet' }), /đạo lữ/);
  const r = await t.cmd('songTu', {});
  assert.ok(r.result.gain > 0);
  await assert.rejects(t.cmd('songTu', {}), /điều tức/);
  await t.cmd('breakPartner', {});
  const st = await t.state();
  assert.equal(st.social.partner, null);
  assert.equal(st.social.friends['trieu-nguyet'].affinity, 30);
  await assert.rejects(t.cmd('bindPartner', { id: 'trieu-nguyet' }), /ly duyên|chờ|tình nghĩa/);
});
