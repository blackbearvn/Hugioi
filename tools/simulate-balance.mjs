#!/usr/bin/env node
/* Mô phỏng cân bằng: in ra đường cong tiến trình, thuộc tính, đối thủ, lôi kiếp,
   xác suất đột phá và kinh tế theo đúng mô hình số học trong data/.
   Chỉ đọc dữ liệu, không sửa repo, không kết nối mạng.
   Dùng: node tools/simulate-balance.mjs [--json] */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const F = require('../data/formulas.js');
const D = require('../data/balance.js');

const { REALMS, STAGES, P, MONSTER_MULT } = D;
const KINDS = ['thường', 'tinh anh', 'boss', 'boss kiếp'];
const json = process.argv.includes('--json');
const pad = (v, n) => String(v).padEnd(n);
const num = v => F.fmt(v);
const hours = s => (s / 3600).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' h';
const pct = v => (v * 100).toFixed(1) + '%';

/* Lôi kiếp thật của engine: mỗi đợt được thử độc lập trên toàn bộ HP + khiên. */
function tribulationSurvives(realm, hp, shield, reduction, rootType = 'Song') {
  return F.tribulation_events(realm).every(([,], i) => {
    const fn = i === 1 ? F.survive_ascension : F.survive_tribulation;
    return fn(realm, hp, hp * shield, reduction, 0, rootType)[0];
  });
}
function minimumShield(realm, hp, reduction = 0) {
  if (!F.tribulation_events(realm).length) return 0;
  if (tribulationSurvives(realm, hp, 0, reduction)) return 0;
  let lo = 0, hi = 1;
  while (!tribulationSurvives(realm, hp, hi, reduction) && hi < 1024) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (tribulationSurvives(realm, hp, mid, reduction)) hi = mid; else lo = mid;
  }
  return hi;
}
function damageRatio(realm, hp, rootType = 'Song') {
  /* Mỗi đợt lôi kiếp được thử độc lập trên toàn bộ HP + khiên, nên yêu cầu
     thực tế là đợt nặng nhất chứ không phải tổng cộng dồn. */
  return Math.max(0, ...F.tribulation_events(realm).map(([,], i) => {
    const bolts = i === 1 ? F.ascension_bolts(realm, rootType) : F.tribulation_bolts(realm, rootType);
    return bolts.reduce((a, b) => a + b, 0) / hp;
  }));
}
function minimumReduction(realm, hp) {
  if (!F.tribulation_events(realm).length) return 0;
  if (tribulationSurvives(realm, hp, 0, 0)) return 0;
  let lo = 0, hi = P.KIEP_RED_MAX;
  if (!tribulationSurvives(realm, hp, 0, hi)) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (tribulationSurvives(realm, hp, 0, mid)) hi = mid; else lo = mid;
  }
  return hi;
}

const rows = [];
let runTime = 0, prevCp = null;
for (let r = 0; r < REALMS.length; r++) {
  const peak = F.stats(r, STAGES[r] - 1);
  const peakCp = F.combat_power(peak.HP, peak.ATK, peak.DEF);
  const rt = F.realm_time(r);
  runTime += rt;
  const row = {
    realm: r, name: REALMS[r], stages: STAGES[r],
    stageTime: F.avg_stage_time(r), realmTime: rt,
    qiFirst: F.exp_need(r, 0), qiPeak: F.exp_need(r, STAGES[r] - 1),
    peak: { HP: peak.HP, ATK: peak.ATK, DEF: peak.DEF, CP: peakCp },
    growth: prevCp ? peakCp / prevCp : null,
    income: F.income_rate(r),
    enemies: {}, tribulation: {}, breakthrough: {}
  };
  prevCp = peakCp;
  const playerCp = F.combat_power(peak.HP, peak.ATK, peak.DEF);
  for (const kind of KINDS) {
    const enemyCp = F.monster_cp(r, STAGES[r] - 1, kind);
    row.enemies[kind] = { CP: enemyCp, ratio: enemyCp / playerCp, win: F.win_probability(playerCp, enemyCp) };
  }
  const bolts = F.tribulation_events(r).map(([name, n]) => ({ name, bolts: n }));
  const minShield = minimumShield(r, peak.HP);
  row.tribulation = {
    bolts, minimumShield: minShield, minimumReduction: minimumReduction(r, peak.HP),
    baseline: tribulationSurvives(r, peak.HP, 0, 0),
    damageRatio: damageRatio(r, peak.HP),
    /* Khiên của đan/phù hộ kiếp theo phẩm chất (2^sub), không phụ thuộc cảnh giới. */
    kiep: [0, 1, 2, 3, 4].map(sub => ({
      quality: sub + 1, shield: P.KIEP_SHIELD * 2 ** sub,
      reduction: Math.min(P.KIEP_RED_MAX, P.KIEP_RED * 2 ** sub)
    }))
  };
  row.breakthrough = {
    base: F.p_breakthrough(r, STAGES[r] - 1, 0, 0),
    withBonus: F.p_breakthrough(r, STAGES[r] - 1, P.BONUS_MAX, 0),
    withPity: F.p_breakthrough(r, STAGES[r] - 1, 0, P.PITY_MAX),
    withBoth: F.p_breakthrough(r, STAGES[r] - 1, P.BONUS_MAX, P.PITY_MAX)
  };
  rows.push(row);
}

if (json) {
  fs.writeSync(1, JSON.stringify({
    constants: {
      TRIB_MULT: P.TRIB_MULT, ASCEND_TRIB_MULT: P.ASCEND_TRIB_MULT,
      MONSTER_MULT, PITY_MAX: P.PITY_MAX, PITY_STEP: P.PITY_STEP,
      FAIL_EXP_LOSS: P.FAIL_EXP_LOSS, KIEP_SHIELD: P.KIEP_SHIELD,
      KIEP_RED: P.KIEP_RED, KIEP_RED_MAX: P.KIEP_RED_MAX
    },
    totalRunSeconds: runTime, realms: rows
  }, null, 2) + '\n');
  process.exit(0);
}

console.log('HƯ GIỚI · MÔ PHỎNG CÂN BẰNG');
console.log('='.repeat(78));
console.log(`Cảnh giới: ${REALMS.length} · Tầng: ${STAGES.reduce((a, b) => a + b, 0)} · Hành trình lý thuyết: ${hours(runTime)} (${(runTime / 86400).toFixed(1)} ngày)`);
console.log(`Lôi kiếp: ×${P.TRIB_MULT} HP nền · Phi Thăng: ×${P.ASCEND_TRIB_MULT} · Hộ kiếp: khiên ${P.KIEP_SHIELD} HP/phẩm, giảm tối đa ${pct(P.KIEP_RED_MAX)}`);
console.log(`Đột phá: may mắn tối đa +${P.PITY_MAX * P.PITY_STEP * 100}% · trượt xác suất mất ${pct(P.FAIL_EXP_LOSS)} tu vi (không chết)`);
console.log(`Quái: ${KINDS.map(k => k + ' ×' + MONSTER_MULT[k]).join(' · ')}`);

console.log('\n1. TIẾN TRÌNH & THU NHẬP');
console.log(pad('Cảnh giới', 14) + pad('Tầng', 6) + pad('TB/tầng', 11) + pad('Cả giới', 12) + pad('Tu vi đỉnh', 14) + pad('Linh thạch/h', 14) + 'CP đỉnh');
for (const x of rows)
  console.log(pad(x.name, 14) + pad(x.stages, 6) + pad(hours(x.stageTime), 11) + pad(hours(x.realmTime), 12) +
    pad(num(x.qiPeak), 14) + pad(num(x.income), 14) + num(x.peak.CP));

console.log('\n2. ĐƯỜNG CONG THUỘC TÍNH (đỉnh cảnh giới)');
console.log(pad('Cảnh giới', 14) + pad('HP', 14) + pad('ATK', 14) + pad('DEF', 14) + 'CP');
for (const x of rows)
  console.log(pad(x.name, 14) + pad(num(x.peak.HP), 14) + pad(num(x.peak.ATK), 14) + pad(num(x.peak.DEF), 14) + num(x.peak.CP));

console.log('\n3. ĐỐI THỦ NGANG TẦNG (tỉ lệ CP địch/người chơi → xác suất thắng)');
console.log(pad('Cảnh giới', 14) + KINDS.map(k => pad(k, 22)).join(''));
for (const x of rows)
  console.log(pad(x.name, 14) + KINDS.map(k => {
    const e = x.enemies[k];
    return pad('×' + e.ratio.toFixed(2) + ' → ' + pct(e.win), 22);
  }).join(''));

console.log('\n4. LÔI KIẾP (không chuẩn bị, linh căn Song)');
console.log(pad('Cảnh giới', 14) + pad('Đợt', 6) + pad('Đạo lôi', 10) + pad('ST/HP', 10) + pad('Sống?', 8) + pad('Khiên tối thiểu', 16) + 'Giảm sát thương');
for (const x of rows) {
  const t = x.tribulation, total = t.bolts.reduce((n, e) => n + e.bolts, 0);
  console.log(pad(x.name, 14) + pad(t.bolts.length, 6) + pad(total, 10) + pad(t.damageRatio.toFixed(2) + '×', 10) +
    pad(t.baseline ? 'có' : 'không', 8) + pad(t.minimumShield ? pct(t.minimumShield) : '0%', 16) +
    (t.minimumReduction === null ? 'không cứu được' : t.minimumReduction ? pct(t.minimumReduction) : '0%'));
}

console.log('\n5. HỘ KIẾP THEO PHẨM CHẤT (khiên % HP · giảm sát thương)');
console.log(pad('Phẩm', 12) + rows[0].tribulation.kiep.map(k => pad('Q' + k.quality, 18)).join(''));
console.log(pad('Hạ → Tuyệt', 12) + rows[0].tribulation.kiep.map(k => pad(pct(k.shield) + ' · ' + pct(k.reduction), 18)).join(''));

console.log('\n6. XÁC SUẤT ĐỘT PHÁ TẠI ĐỈNH');
console.log(pad('Cảnh giới', 14) + pad('Nền', 9) + pad('+buff', 9) + pad('+may mắn', 11) + pad('+cả hai', 10) + 'Kỳ vọng thử');
for (const x of rows) {
  const b = x.breakthrough;
  /* Số lần thử kỳ vọng khi mỗi lần trượt đều cộng may mắn; xấp xỉ 1/p trung bình. */
  const expected = 1 / Math.min(.98, F.p_breakthrough(x.realm, STAGES[x.realm] - 1, 0, P.PITY_MAX / 2));
  console.log(pad(x.name, 14) + pad(pct(b.base), 9) + pad(pct(b.withBonus), 9) + pad(pct(b.withPity), 11) +
    pad(pct(b.withBoth), 10) + (Number.isFinite(expected) ? expected.toFixed(2) + ' lần' : '—'));
}

console.log('\n7. ĐIỂM CẦN THEO DÕI');
const broke = rows.filter(x => x.tribulation.bolts.length && !x.tribulation.baseline && x.tribulation.minimumShield > .35);
console.log(`- Cảnh giới cần khiên > 35% HP: ${broke.length ? broke.map(x => x.name).join(', ') : 'không có'}`);
const earlyDeath = rows.filter(x => x.tribulation.bolts.length && !x.tribulation.baseline && x.realm <= 2);
console.log(`- Cảnh giới đầu (0–2) chết nếu không hộ kiếp: ${earlyDeath.length ? earlyDeath.map(x => x.name).join(', ') : 'không có'}`);
const harsh = rows.filter(x => x.breakthrough.base < .3);
console.log(`- Đột phá nền dưới 30%: ${harsh.length ? harsh.map(x => x.name).join(', ') : 'không có'}`);
const weak = rows.filter(x => x.enemies['thường'].win > .95);
console.log(`- Quái thường quá yếu (thắng >95%): ${weak.length ? weak.map(x => x.name).join(', ') : 'không có'}`);
console.log('- Mọi bảng trên suy ra từ data/formulas.js; sửa hằng số trong data/balance.js rồi chạy lại lệnh này.');
