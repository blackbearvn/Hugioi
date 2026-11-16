/* Tooltip đan/phù: giá trị phải là số cụ thể, đổi theo phẩm chất và cảnh giới. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const H = require('../engine/game.js');

function setup() {
  const ui = {};
  const assets = { BG: { forge: '', talisman: '', tribulation: '', home: '' }, farm: () => '', itemImg: () => ({ src: '' }), moneyIcon: () => '' };
  const env = {
    HU_GAME: H,
    HU_ASSETS: assets,
    HU_UI: ui,
    HU_REMOTE_SESSION: { RemoteSession: class { subscribe() {} } },
    HU_REMOTE_STORE: { createStore: () => ({ dispatch() {}, preference() {} }) },
    document: { getElementById: () => null, querySelectorAll: () => [], baseURI: 'http://local/' }
  };
  env.window = env;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../client/ui/core.js'), 'utf8'), env);
  return ui;
}

test('tooltip đan hồi phục hiện phần trăm cụ thể và tăng theo phẩm chất', () => {
  const ui = setup(), text = ui.kit.pillEffectText;
  const low = H.item('PILL-001'), high = H.item('PILL-001@2');
  assert.equal(text(low, { realm: 0, stage: 1, pillUses: 0 }), 'Hồi 20% sinh lực và linh lực');
  assert.equal(text(high, { realm: 0, stage: 1, pillUses: 0 }), 'Hồi 80% sinh lực và linh lực');
  const hp = H.item('PILL-027'), mp = H.item('PILL-009');
  assert.equal(text(hp, { realm: 4, stage: 1, pillUses: 0 }), 'Hồi 20% sinh lực');
  assert.equal(text(mp, { realm: 0, stage: 1, pillUses: 0 }), 'Hồi 20% linh lực');
});

test('tooltip đan kháng hiệu ứng xấu nêu mức giảm và thời gian cụ thể', () => {
  const ui = setup(), text = ui.kit.pillEffectText;
  const ward = H.item('PILL-031');
  assert.equal(ward.effect, 'KHANG_HIEU_UNG');
  assert.equal(text(ward, { realm: 5, stage: 1 }),
    'Giải hiệu ứng xấu · giảm 15% thời gian đóng băng/choáng/độc/chảy máu trong 12 giây');
  const high = H.item('PILL-031@4');
  assert.match(text(high, { realm: 5, stage: 1 }), /giảm 80% .* trong 24 giây/);
  assert.match(text(ward, { realm: 8, stage: 1 }), /không giảm vì lệch cảnh giới/);
});

test('tooltip đan giải độc liệt kê hiệu ứng xấu và tâm ma', () => {
  const ui = setup(), text = ui.kit.pillEffectText;
  const anti = H.item('PILL-013');
  assert.equal(anti.effect, 'GIAI_DOC');
  assert.equal(text(anti, { realm: 1, stage: 1 }), 'Giải đóng băng, choáng, độc, chảy máu · giảm 20 Tâm ma');
});

test('tooltip đan tu vi dùng đúng trần cảnh giới và số đan đã dùng', () => {
  const ui = setup(), text = ui.kit.pillEffectText, pill = H.item('PILL-002');
  const state = { realm: 0, stage: 1, pillUses: 0, pillRealmExp: 0 };
  const base = H.F.dan_exp_gain_capped(0, 0, pill.sub, 0, 0, 0);
  assert.equal(text(pill, state), `Tu vi +${H.F.fmt(base)}`);
  state.pillUses = 4;
  const used = H.F.dan_exp_gain_capped(0, 0, pill.sub, 4, 0, 0);
  assert.equal(text(pill, state), `Tu vi +${H.F.fmt(used)}`);
  state.pillRealmExp = H.F.realm_exp_total(0) * H.F.P.DAN_REALM_CAP;
  assert.match(text(pill, state), /chạm trần đan cảnh giới/);
});

test('tooltip đan lệch cảnh giới ghi rõ mức giảm; phù hộ kiếp không bị giảm', () => {
  const ui = setup(), text = ui.kit.pillEffectText;
  const pill = H.item('PILL-001'), same = { realm: 0, stage: 1 }, high = { realm: 6, stage: 1 };
  assert.doesNotMatch(text(pill, same), /lệch/);
  assert.match(text(pill, high), /lệch 6 cảnh giới/);
  const ward = H.item('TAL-001');
  assert.equal(text(ward, high), text(ward, same));
  assert.match(text(ward, high), /không giảm vì lệch cảnh giới/);
});

test('tooltip củng cố vĩnh viễn không vượt trần mỗi cảnh giới', () => {
  const ui = setup(), text = ui.kit.pillEffectText;
  const pill = H.item('PILL-030@4');
  assert.ok(pill && pill.effect === 'CUNG_CO');
  assert.match(text(pill, { realm: 0, stage: 1 }), /\+15% · trần 15% mỗi cảnh giới/);
  assert.match(text(pill, { realm: 0, stage: 1, permanent: .10 }), /\+5% · trần 15%/);
  assert.match(text(pill, { realm: 0, stage: 1, permanent: .15 }), /Đã đạt trần củng cố 15%/);
});

test('tooltip đan/phù không còn trả về mô tả enum chung', () => {
  const ui = setup(), effect = ui.kit.itemEffectText;
  assert.notEqual(effect(H.item('PILL-001')), H.SCHEMA.EFFECTS.HOI_HP);
  assert.match(effect(H.item('TAL-002')), /^Sát thương ×/);
});
