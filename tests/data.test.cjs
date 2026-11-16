/* Dữ liệu đan dược: enum tập trung trong data/schema.js phải khớp balance, items và catalog. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../data/schema.js');
const B = require('../data/balance.js');
const C = require('../data/catalog.js');
const F = require('../data/formulas.js');

const pills = C.ITEMS.filter(x => x.kind === 'PILL');
const danLoai = Object.keys(B.DAN_LOAI);

test('EFFECTS của đan khớp đúng các loại trong DAN_LOAI, TRONG_SINH nằm ngoài enum đan', () => {
  assert.deepEqual(Object.keys(S.EFFECTS).sort(), danLoai.filter(k => k !== 'TRONG_SINH').sort());
  assert.deepEqual(Object.keys(S.ALL_EFFECTS).sort(), danLoai.slice().sort());
  assert.ok(!Object.hasOwn(S.EFFECTS, 'TRONG_SINH'));
  assert.ok(Object.hasOwn(S.NON_PILL_EFFECTS, 'TRONG_SINH'));
});

test('mọi đan đang dùng effect thuộc enum EFFECTS, không viên nào dùng TRONG_SINH', () => {
  assert.equal(pills.length, 60);
  for (const p of pills) {
    assert.ok(Object.hasOwn(S.EFFECTS, p.effect), p.code + ' có effect lạ: ' + p.effect);
    assert.ok(!Object.hasOwn(S.NON_PILL_EFFECTS, p.effect), p.code + ' dùng effect ngoài đan: ' + p.effect);
  }
});

test('GRADES có 14 bậc, id duy nhất và gradeIdFor đọc được cả chuỗi cũ lẫn chuỗi catalog', () => {
  assert.equal(S.GRADES.length, 14);
  assert.equal(new Set(S.GRADES.map(g => g.id)).size, 14);
  const raw = require('../data/items.js');
  for (const p of raw.filter(x => x.kind === 'PILL')) {
    assert.ok(S.gradeIdFor(p.grade), p.code + ' có grade cũ lạ: ' + p.grade);
    assert.ok(S.gradeIdFor(C.item(p.code).grade), p.code + ' có grade catalog lạ: ' + C.item(p.code).grade);
  }
  assert.equal(S.gradeIdFor('Nhất phẩm'), 'pham');
  assert.equal(S.gradeIdFor('Ngũ phẩm'), 'thien');
  assert.equal(S.gradeIdFor('Thánh đan'), 'thanh_dan');
  assert.equal(S.gradeIdFor('không có'), null);
});

test('gradeIdFor ánh xạ đúng thứ tự phẩm chất từ thấp đến cao', () => {
  const order = S.GRADES.map(g => g.id);
  for (let i = 1; i < S.GRADES.length; i++)
    assert.ok(order.indexOf(S.gradeIdFor(S.GRADES[i - 1].label)) < order.indexOf(S.gradeIdFor(S.GRADES[i].label)));
  for (const g of S.GRADES) assert.equal(S.gradeIdFor(g.label), g.id);
});

test('RARITIES có 8 bậc, nhận tên cũ Hoàng và phủ đủ 14 tier', () => {
  assert.equal(S.RARITIES.length, 8);
  assert.equal(new Set(S.RARITIES.map(r => r.id)).size, 8);
  for (const r of S.RARITIES) assert.equal(S.rarityIdFor(r.label), r.id);
  assert.equal(S.rarityIdFor('Hoàng'), 'linh');
  assert.equal(S.rarityIdFor('Linh'), 'linh');
  assert.equal(S.rarityIdFor('không có'), null);
  assert.deepEqual([...Array(14)].map((_, i) => S.rarityForTier(i)), S.RARITY_BY_TIER);
  assert.equal(S.rarityForTier(14), null);
  assert.equal(S.rarityForTier(1.5), null);
  assert.deepEqual(B.PHAM.map(x => S.rarityIdFor(x)), S.RARITIES.map(r => r.id));
});

test('grade của mọi vật phẩm đã chuẩn hóa: đan theo 14 bậc, loại khác theo 8 bậc', () => {
  for (const x of C.ITEMS) {
    if (x.kind === 'PILL') {
      const id = S.gradeIdFor(x.grade);
      assert.ok(id, x.code + ' có grade lạ: ' + x.grade);
      assert.equal(x.grade, S.gradeLabel(id), x.code);
      if (x.gradeId) assert.equal(x.gradeId, id, x.code);
    } else {
      const id = S.rarityIdFor(x.grade);
      assert.ok(id, x.code + ' có grade lạ: ' + x.grade);
      assert.equal(x.grade, S.rarityLabel(id), x.code);
    }
  }
});

test('RANKS có đúng 7 cấp bậc và phủ kín 14 cảnh giới', () => {
  assert.equal(S.RANKS.length, 7);
  assert.deepEqual(S.RANKS.map(r => r.rank), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(S.RANKS.map(r => r.label), ['Phàm giai', 'Linh giai', 'Huyền giai', 'Địa giai', 'Thiên giai', 'Tiên giai', 'Thần giai']);
  assert.equal(S.RANK_BY_TIER.length, 14);
  assert.deepEqual([...new Set(S.RANK_BY_TIER)], [1, 2, 3, 4, 5, 6, 7]);
  for (let tier = 0; tier < 14; tier++) {
    const rank = S.rankForTier(tier);
    assert.equal(S.RANKS[rank - 1].tierMin <= tier && tier <= S.RANKS[rank - 1].tierMax, true, 'tier ' + tier);
    assert.equal(S.rankIdFor(S.rankLabel(rank)), rank);
  }
  assert.equal(S.rankForTier(14), null);
  assert.equal(S.rankForTier(-1), null);
  assert.equal(S.rankForTier(1.5), null);
  assert.equal(S.rankLabel(0), null);
});

test('QUALITIES có đúng 5 phẩm chất, sub 0-4 và nhãn chuẩn', () => {
  assert.equal(S.QUALITIES.length, 5);
  assert.deepEqual(S.QUALITIES.map(q => q.quality), [1, 2, 3, 4, 5]);
  assert.deepEqual(S.QUALITIES.map(q => q.label), ['Hạ phẩm', 'Trung phẩm', 'Thượng phẩm', 'Cực phẩm', 'Tuyệt phẩm']);
  assert.deepEqual(S.QUALITIES.map(q => q.sub), [0, 1, 2, 3, 4]);
  for (const q of S.QUALITIES) {
    assert.equal(S.qualityForSub(q.sub), q.quality);
    assert.equal(S.subForQuality(q.quality), q.sub);
    assert.equal(S.qualityIdFor(q.label), q.quality);
  }
  assert.equal(S.qualityForSub(5), null);
  assert.equal(S.subForQuality(6), null);
  assert.equal(S.qualityLabel(0), null);
});

test('ngưỡng quay phẩm chất trả đủ 1-5 và không vượt biên', () => {
  assert.equal(S.QUALITY_ROLL_THRESHOLDS.length, 4);
  assert.equal(S.qualityForRoll(0), 1);
  assert.equal(S.qualityForRoll(.399), 1);
  assert.equal(S.qualityForRoll(.4), 2);
  assert.equal(S.qualityForRoll(.85), 4);
  assert.equal(S.qualityForRoll(.96), 5);
  assert.equal(S.qualityForRoll(1), 5);
  assert.equal(S.qualityForRoll(NaN), null);
});

test('mọi vật phẩm có rank 1-7, quality 1-5, qualityLabel và sub khớp quality - 1', () => {
  for (const x of C.ITEMS) {
    assert.ok(Number.isInteger(x.rank) && x.rank >= 1 && x.rank <= 7, x.code + ' rank lạ: ' + x.rank);
    assert.ok(Number.isInteger(x.quality) && x.quality >= 1 && x.quality <= 5, x.code + ' quality lạ: ' + x.quality);
    assert.equal(x.qualityLabel, S.qualityLabel(x.quality), x.code);
    assert.equal(x.sub, x.quality - 1, x.code);
    assert.equal(x.rank, S.rankForTier(x.tier), x.code + ' rank không khớp tier');
  }
});

test('inventory mở được phẩm chất thứ năm qua key @4', () => {
  const base = C.ITEMS.find(x => x.sub === 0);
  assert.equal(C.keyFor(base.code, 4), base.code + '@4');
  const fifth = C.item(base.code + '@4');
  assert.equal(fifth.sub, 4);
  assert.equal(fifth.quality, 5);
  assert.equal(fifth.qualityLabel, 'Tuyệt phẩm');
  assert.equal(C.item(base.code + '@5'), null);
});

test('craft_quality trả sub 0-4 và có thể sinh Tuyệt phẩm', () => {
  const F = require('../data/formulas.js');
  assert.equal(F.SUBPHAM.length, 5);
  const high = F.craft_quality(0, 0, (() => { const xs = [0.0001, 0]; return () => xs.shift(); })());
  assert.equal(high, 4);
  const low = F.craft_quality(0, 0, (() => { const xs = [0.5, 0.5]; return () => xs.shift(); })());
  assert.equal(low, 0);
  for (let i = 0; i < 100; i++) {
    const q = F.craft_quality(5, 3, Math.random);
    assert.ok(Number.isInteger(q) && q >= 0 && q <= 4, 'quality ' + q);
  }
});

test('bảng nhãn giao diện có đủ 5 phẩm chất và 7 cấp bậc, đúng màu chuẩn', () => {
  const L = require('../client/ui/labels.js');
  assert.equal(Object.keys(L.DOMAINS.quality.keys).length, 5);
  assert.equal(Object.keys(L.DOMAINS.rank.keys).length, 7);
  assert.equal(L.resolveKey('quality', 'Tuyệt phẩm'), 'tuyet');
  assert.equal(L.resolveKey('quality', 'Hạ phẩm'), 'ha');
  assert.equal(L.resolveKey('rank', 'Thần giai'), 'than');
  assert.equal(L.DOMAINS.quality.keys.ha.color, '#6fcf7a');
  assert.equal(L.DOMAINS.quality.keys.trung.color, '#b98cff');
  assert.equal(L.DOMAINS.quality.keys.thuong.color, '#f3ca72');
  assert.match(L.DOMAINS.quality.keys.cuc.gradient, /linear-gradient/);
  assert.match(L.DOMAINS.quality.keys.tuyet.gradient, /#111/);
});

test('TAGS là bảng kebab-case và tagsFor sinh tag hợp lệ cho mọi đan', () => {
  for (const tag of Object.keys(S.TAGS)) assert.match(tag, /^[a-z]+(-[a-z]+)*$/, tag);
  for (const p of pills) {
    const tags = S.tagsFor(p.effect, p.tier, false);
    assert.equal(tags.length, 3);
    for (const tag of tags) assert.ok(Object.hasOwn(S.TAGS, tag), p.code + ' sinh tag lạ: ' + tag);
    assert.ok(tags.includes(S.EFFECT_TAGS[p.effect]), p.code);
  }
});

test('tierTag chia đúng ba thế giới Hạ - Linh - Tiên', () => {
  assert.equal(S.tierTag(0), 'ha-gioi');
  assert.equal(S.tierTag(4), 'ha-gioi');
  assert.equal(S.tierTag(5), 'linh-gioi');
  assert.equal(S.tierTag(8), 'linh-gioi');
  assert.equal(S.tierTag(9), 'tien-gioi');
  assert.equal(S.tierTag(13), 'tien-gioi');
});

test('dan-hiem là tag tuỳ chọn, không tự gắn cho đan thường', () => {
  assert.ok(!S.tagsFor('TU_VI', 0, false).includes('dan-hiem'));
  assert.ok(S.tagsFor('TU_VI', 0, true).includes('dan-hiem'));
});

test('DAN_TABLE trong balance.js khớp tuyệt đối 60 đan của items.js', () => {
  assert.equal(B.DAN_TABLE.length, 60);
  const byNumber = new Map(pills.map(p => [p.sourceNumber, p]));
  for (const row of B.DAN_TABLE) {
    const [n, name, tier, effect] = row;
    const p = byNumber.get(n);
    assert.ok(p, 'DAN_TABLE có số không ứng với đan nào: ' + n);
    assert.deepEqual(row, [p.sourceNumber, p.name, p.tier, p.effect], p.code + ' lệch DAN_TABLE');
  }
  assert.equal(new Set(B.DAN_TABLE.map(r => r[0])).size, 60);
});

const R = require('../data/items.js');
const M = require('../data/manuals.js');
const rawPills = R.filter(x => x.kind === 'PILL');

test('cả 60 đan có number, gradeId, tags, useReq khớp quy tắc suy ra', () => {
  assert.equal(rawPills.length, 60);
  for (const p of rawPills) {
    assert.equal(p.number, p.sourceNumber, p.code);
    assert.equal(p.gradeId, S.gradeIdFor(p.grade), p.code);
    assert.deepEqual(p.tags, S.tagsFor(p.effect, p.tier, M.isRarePill(p)), p.code);
    assert.deepEqual(p.useReq, { realmMin: p.tier }, p.code);
  }
  const rare = rawPills.filter(M.isRarePill);
  assert.ok(rare.length > 0 && rare.every(p => p.tags.includes('dan-hiem')));
  assert.ok(rawPills.filter(p => !M.isRarePill(p)).every(p => !p.tags.includes('dan-hiem')));
});

test('migrate-pills idempotent: chạy lại trên dữ liệu đã chuẩn hóa không đổi gì', async () => {
  const { migratePills } = await import('../tools/migrate-pills.mjs');
  assert.deepEqual(migratePills(R), R);
});

test('CLI migrate-pills --check xác nhận data/items.js đã chuẩn hóa', () => {
  const out = require('node:child_process').spawnSync(process.execPath, ['tools/migrate-pills.mjs', '--check'], { cwd: require('node:path').join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr || out.stdout);
  assert.match(out.stdout, /60 đan đã chuẩn hóa/);
});

test('normalize-grades idempotent và dữ liệu thô khớp catalog', async () => {
  const { normalizeGrades } = await import('../tools/normalize-grades.mjs');
  assert.deepEqual(normalizeGrades(R), R);
  for (const x of R) assert.equal(x.grade, C.item(x.code).grade, x.code);
});

test('CLI normalize-grades --check xác nhận data/items.js đã chuẩn hóa', () => {
  const out = require('node:child_process').spawnSync(process.execPath, ['tools/normalize-grades.mjs', '--check'], { cwd: require('node:path').join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr || out.stdout);
  assert.match(out.stdout, /vật phẩm đã chuẩn hóa/);
});

test('normalize-ranks idempotent và dữ liệu thô khớp catalog', async () => {
  const { normalizeRanks } = await import('../tools/normalize-ranks.mjs');
  assert.deepEqual(normalizeRanks(R), R);
  for (const x of R) {
    assert.equal(x.rank, C.item(x.code).rank, x.code);
    assert.equal(x.quality, C.item(x.code).quality, x.code);
    assert.equal(x.qualityLabel, C.item(x.code).qualityLabel, x.code);
  }
});

test('CLI normalize-ranks --check xác nhận data/items.js đã chuẩn hóa rank/quality', () => {
  const out = require('node:child_process').spawnSync(process.execPath, ['tools/normalize-ranks.mjs', '--check'], { cwd: require('node:path').join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr || out.stdout);
  assert.match(out.stdout, /rank\/quality/);
});

const DESIGN = require('../data/design.js');
const byCode = new Map(C.ITEMS.map(x => [x.code, x]));

test('25 đan có đan phương thiết kế thì dùng đúng công thức gốc', () => {
  let count = 0;
  for (const [code, herbs] of Object.entries(DESIGN.recipes)) {
    const p = byCode.get(code);
    assert.equal(p.kind, 'PILL', code);
    assert.deepEqual(p.recipe, { herbs }, code);
    count++;
  }
  assert.equal(count, 25);
});

test('35 công thức tự sinh: 2-4 loại, số lượng 2-4, nặng dần theo tier và độ hiếm', () => {
  const generated = pills.filter(p => !DESIGN.recipes[p.code]);
  assert.equal(generated.length, 35);
  for (const p of generated) {
    const entries = Object.entries(p.recipe.herbs);
    const rare = M.isRarePill(p);
    const baseTypes = p.tier < 5 ? 2 : p.tier < 9 ? 3 : 4;
    const wantTypes = Math.min(4, baseTypes + (rare && p.tier < 9 ? 1 : 0));
    assert.equal(entries.length, wantTypes, p.code);
    assert.equal(new Set(entries.map(([c]) => c)).size, entries.length, p.code + ' lặp linh thảo');
    for (const [herb, n] of entries) {
      assert.equal(byCode.get(herb).kind, 'HERB', p.code + ' dùng ' + herb);
      assert.ok(byCode.get(herb).tier <= p.tier, p.code + ' dùng ' + herb + ' cao hơn tier');
      assert.ok(Number.isInteger(n) && n >= 2 && n <= 4, p.code + ' số lượng ' + herb + ': ' + n);
    }
    const total = entries.reduce((sum, [, n]) => sum + n, 0);
    assert.ok(total >= (p.tier < 5 ? 4 : p.tier < 9 ? 6 : 8), p.code + ' tổng quá ít: ' + total);
    if (rare) assert.ok(total >= 12, p.code + ' đan hiếm quá nhẹ: ' + total);
  }
  const average = list => list.reduce((sum, p) => sum + Object.values(p.recipe.herbs).reduce((a, b) => a + b, 0), 0) / list.length;
  for (const [low, high] of [[5, 8], [9, 13]]) {
    const normal = generated.filter(p => !M.isRarePill(p) && p.tier >= low && p.tier <= high);
    const rare = generated.filter(p => M.isRarePill(p) && p.tier >= low && p.tier <= high);
    assert.ok(normal.length && rare.length, low + '-' + high);
    assert.ok(average(rare) > average(normal), low + '-' + high + ': hiếm phải nặng hơn thường');
  }
  assert.deepEqual(byCode.get('PILL-030').recipe.herbs, { 'HERB-039': 4, 'HERB-031': 3, 'HERB-032': 3, 'HERB-040': 3 });
  assert.deepEqual(byCode.get('PILL-060').recipe.herbs, { 'HERB-065': 3, 'HERB-066': 2, 'HERB-067': 3, 'HERB-069': 2 });
});

test('CLI check-data --strict xanh khi cả 60 đan đã đủ trường', () => {
  const out = require('node:child_process').spawnSync(process.execPath, ['tools/check-data.mjs', '--strict'], { cwd: require('node:path').join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr || out.stdout);
  assert.match(out.stdout, /vật phẩm hợp lệ \(strict\)/);
});

test('chỉ mục đan BY_TIER, BY_EFFECT, BY_TAG phủ đủ 60 viên và xếp theo number', () => {
  assert.equal(C.pills().length, 60);
  assert.deepEqual(C.pills().map(p => p.number), [...Array(60)].map((_, i) => i + 1));
  assert.equal(Object.values(C.BY_TIER).reduce((n, list) => n + list.length, 0), 60);
  assert.equal(Object.values(C.BY_EFFECT).reduce((n, list) => n + list.length, 0), 60);
  assert.equal(Object.values(C.BY_TAG).reduce((n, list) => n + list.length, 0), 180);
  for (const [tier, list] of Object.entries(C.BY_TIER))
    for (const p of list) {
      assert.equal(p.kind, 'PILL', p.code);
      assert.equal(p.tier, Number(tier), p.code);
    }
  assert.deepEqual(Object.keys(C.BY_EFFECT).sort(), [...new Set(pills.map(p => p.effect))].sort());
  for (const tag of Object.keys(C.BY_TAG)) assert.ok(Object.hasOwn(S.TAGS, tag), tag);
  assert.equal(C.BY_TAG['dan-hiem'].length, 24);
  assert.equal(C.BY_TAG['dan-thuong'].length, 36);
});

test('pills({tier, effect, tag}) lọc đúng và không đổi dữ liệu gốc', () => {
  assert.deepEqual(C.pills({ tier: 0 }), C.BY_TIER[0]);
  assert.ok(C.pills({ effect: 'KIEP' }).every(p => p.effect === 'KIEP'));
  assert.equal(C.pills({ tag: 'dan-hiem' }).length, 24);
  assert.deepEqual(
    C.pills({ tier: 8, tag: 'dan-hiem' }).map(p => p.code),
    C.BY_TIER[8].filter(p => p.tags.includes('dan-hiem')).map(p => p.code)
  );
  assert.deepEqual(C.pills({ tag: 'khong-co' }), []);
  const first = C.pills()[0];
  assert.equal(C.item(first.code).code, first.code);
  assert.equal(C.keyFor(first.code, 0), first.code);
  assert.equal(C.keyFor(first.code, 3), first.code + '@3');
  assert.ok(C.BY_ID[first.code]);
});

test('hộ kiếp chỉ theo phẩm chất, không bị lệch cảnh giới làm yếu đi', () => {
  for (const sub of [0, 1, 2, 3, 4]) {
    const low = F.dan_effect('KIEP', 6, 3, sub, 0, 0);
    const far = F.dan_effect('KIEP', 6, 3, sub, 9, 4);
    assert.deepEqual(far, low, 'phẩm ' + (sub + 1) + ' giữ nguyên khi lệch 4 cảnh giới');
    assert.equal(low.khien_theo_HP, B.P.KIEP_SHIELD * 2 ** sub);
    assert.equal(low.giam_sat_thuong, Math.min(B.P.KIEP_RED_MAX, B.P.KIEP_RED * 2 ** sub));
  }
});

test('lôi kiếp mặc định dùng TRIB_MULT tập trung', () => {
  assert.equal(B.P.TRIB_MULT, 1.1);
  const peak = F.stats(4, F.STAGES[4] - 1);
  assert.equal(F.tribulation_total(4, 'Song'), peak.HP * B.P.TRIB_MULT);
});
