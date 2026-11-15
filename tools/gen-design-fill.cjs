/* Sinh data/design-fill.js: công thức, thông số pháp bảo và chiêu ngoại tu còn thiếu trong bảng thiết kế gốc.
   Chạy lại: node tools/gen-design-fill.cjs. Kết quả là dữ liệu tường minh để chỉnh tay. */
'use strict';
process.env.HU_NO_FILL = '1'; // đọc bảng gốc, không đọc lại chính file sinh ra
const fs = require('fs'), path = require('path');
const H = require('../engine/game.js'), F = require('../data/formulas.js'), M = H.MANUALS;
const scale = t => F.stat_scale(t, 0);
const rows = {}, recipes = {}, forge = {}, effects = {};
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/* 1. Pháp bảo: hồ sơ chỉ số theo loại, ngân sách mỗi món = 5% chỉ số người chơi cùng cảnh giới, nhân đôi mỗi bậc phẩm. */
const KIND = [
  [/(Kiếm|Đao|Cung|Chùy|Thương|Trượng|Bút|Tiêu|Phiến)$/, 'vũ khí'],
  [/(Thuẫn|Pháp Y|Ngoa|Giáp|Tháp|Chung|Tán)$/, 'giáp'],
  [/(Bội|Giới|Hoàn|Châu|Ấn|Kính)$/, 'trang sức']
];
const PROFILE = {
  'vũ khí': { hp: .6, mp: .5, atk: 1.6, def: .5, eva: .8, sta: .8, crit: 1.6 },
  'giáp': { hp: 1.5, mp: .6, atk: .4, def: 1.9, eva: .6, sta: 1.2, crit: .5 },
  'trang sức': { hp: .9, mp: 1.4, atk: .9, def: .8, eva: 1.5, sta: 1, crit: 1.4 },
  'pháp khí hỗ trợ': { hp: 1, mp: 2, atk: .6, def: 1, eva: 1.3, sta: 1.6, crit: .8 }
};
const kindOf = n => (KIND.find(([re]) => re.test(n)) || [0, 'pháp khí hỗ trợ'])[1];
const USE = { 'vũ khí': ['chảy máu', 'gây độc', 'gây choáng', 'đóng băng'], 'giáp': ['giáp ảo', 'hồi máu', 'giáp ảo', 'đóng băng'],
  'trang sức': ['gây độc', 'chảy máu', 'giáp ảo', 'gây choáng'], 'pháp khí hỗ trợ': ['hồi máu', 'đóng băng', 'gây choáng', 'giáp ảo'] };
const EFFECT = {
  'giáp ảo': { cond: 'khi kích hoạt', cd: 15, rate: 100, sec: 3, shield: 10 },
  'hồi máu': { cond: 'khi kích hoạt', cd: 15, rate: 100, sec: 3, heal: 1, every: 1 },
  'đóng băng': { cond: 'khi đánh trúng', cd: 0, rate: 10, sec: 1 },
  'gây choáng': { cond: 'khi đánh trúng', cd: 0, rate: 10, sec: 1 },
  'gây độc': { cond: 'khi đánh trúng', cd: 0, rate: 100, sec: 3, poison: 1, stacks: 3 },
  'chảy máu': { cond: 'khi đánh trúng', cd: 0, rate: 100, sec: 3, bleed: 1 }
};
const eqs = H.ITEMS.filter(x => x.kind === 'EQ');
eqs.forEach((x, i) => {
  const old = H.DESIGN.byLegacy[x.code] || {}, kind = kindOf(x.name), p = PROFILE[kind], t = x.tier;
  const budget = scale(t) * .05 * 2 ** x.sub, early = t === 0 ? 1.5 : 1; // bậc đầu giữ cảm giác cũ
  const row = {
    ...old,
    'mã PB': old['mã PB'] || 'PB' + x.code.slice(3), designId: old.designId || 'PB' + x.code.slice(3), group: 'pháp bảo',
    'tên pháp bảo': x.name, loại: kind, 'công dụng': old['công dụng'] || USE[kind][(x.sourceNumber || i) % 4],
    'hp cộng': Math.max(Math.round(F.P.HP0 * budget * p.hp * early), Math.round((old['hp cộng'] || 0) * p.hp)), 'mp cộng': Math.max(Math.round(F.P.HP0 * budget * p.mp * .25 * early), Math.round((old['mp cộng'] || 0) * p.mp)),
    'atk cộng': Math.max(Math.round(F.P.ATK0 * budget * p.atk * early), Math.round((old['atk cộng'] || 0) * p.atk)), 'def cộng': Math.max(Math.round(F.P.DEF0 * budget * p.def * early), Math.round((old['def cộng'] || 0) * p.def)),
    'eva cộng (%)': round((1 + t * .5) * p.eva * (1 + x.sub * .15)), 'sta cộng': Math.round((5 + t * 6) * p.sta),
    'crit cộng (%)': round((1 + t * .5) * p.crit * (1 + x.sub * .15)), 'crit_dame cơ bản (%)': 150 + t * 3 + x.sub * 5,
    'yêu cầu': old['yêu cầu'] || 'cảnh giới ' + x.realm, 'nguồn gốc': old['nguồn gốc'] || 'chế tạo; rơi từ boss'
  };
  rows[x.code] = row;
  const e = EFFECT[row['công dụng']] || EFFECT['giáp ảo'], flat = scale(t);
  const old2 = H.DESIGN.effects[x.code];
  effects[x.code] = old2 && t < 5 ? scaleEffect(old2, flat) : {
    'mã PB': row['mã PB'], 'hiệu ứng': row['công dụng'], 'điều kiện kích hoạt': e.cond, 'hồi chiêu (giây)': e.cd,
    'tỉ lệ kích hoạt (%)': Math.min(35, e.rate === 100 ? 100 : e.rate + t), 'thời gian (giây)': e.sec,
    'lá chắn (% hp tối đa)': e.shield ? e.shield + t : null, 'hồi máu (hp)': e.heal ? Math.round(F.P.HP0 * flat * .1 * 2 ** x.sub) : null,
    'chu kỳ hồi (giây)': e.every || null, 'độc (sát thương/giây)': e.poison ? Math.round(F.P.ATK0 * flat * .3 * 2 ** x.sub) : null,
    'số lớp tối đa': e.stacks || null, 'chảy máu (% hp hiện tại/giây)': e.bleed ? 1 : null
  };
});
function scaleEffect(o, flat) {
  const r = { ...o };
  if (r['hồi máu (hp)']) r['hồi máu (hp)'] = Math.round(r['hồi máu (hp)'] * flat * 2);
  if (r['độc (sát thương/giây)']) r['độc (sát thương/giây)'] = Math.round(r['độc (sát thương/giây)'] * flat * 2);
  return r;
}

/* 2. Ngoại tu chưa có chiêu: gán loại chiêu, hệ, hồi chiêu và độ mạnh theo cảnh giới. */
const SKILL = {
  'BT-038': ['attack', 'kim'], 'BT-042': ['heal', 'mộc'], 'BT-046': ['guard', 'thủy'], 'BT-034': ['attack', 'mộc'],
  'BT-050': ['guard', 'thủy'], 'BT-054': ['attack', 'hỏa'], 'BT-058': ['attack', 'hỏa'], 'BT-062': ['attack', 'kim'],
  'BT-066': ['attack', 'kim'], 'BT-022': ['attack', 'hỏa'], 'BT-070': ['guard', 'thủy'], 'BT-074': ['evade', 'thủy'],
  'BT-026': ['guard', 'thổ'], 'BT-078': ['heal', 'thủy'], 'BT-030': ['guard', 'thổ']
};
const USEWORD = { attack: 'công kích', guard: 'phòng ngự', heal: 'hồi phục', evade: 'thân pháp' };
for (const x of H.ITEMS.filter(y => y.kind === 'BT' && M.school(y) === 'ngoai')) {
  const [kind, el] = SKILL[x.code] || [null, null], old = H.DESIGN.byLegacy[x.code] || {}, t = x.tier;
  const hasDesign = !!old['tên công pháp'];
  if (!hasDesign && !kind) continue;
  const k = kind || ({ 'công kích': 'attack', 'phòng ngự': 'guard' })[old['công dụng']] || (old.heal ? 'heal' : old['buff stat'] === 'eva' ? 'evade' : 'attack');
  const r = { ...old, group: 'công pháp', 'tên công pháp': old['tên công pháp'] || x.name.replace(/^Bí tịch · /, '').replace(/^Cổ Bản /, ''),
    hệ: old.hệ || el, 'công dụng': USEWORD[k], 'tiêu hao mp': old['tiêu hao mp'] || 10 + 4 * t,
    'hồi chiêu (giây)': k === 'attack' ? 6 + Math.ceil(t / 2) : k === 'guard' ? 12 : k === 'heal' ? 14 : 12 };
  if (k === 'attack') r.atk_multiplier = round(old.atk_multiplier || 1.15 + .14 * t, 2);
  if (k === 'guard') { r.def_bonus = Math.round(F.P.DEF0 * scale(t) * .6); r['thời gian buff (giây)'] = old['thời gian buff (giây)'] || 6; }
  if (k === 'heal') r.heal = Math.round(F.P.HP0 * scale(t) * .3);
  if (k === 'evade') { r['buff stat'] = 'eva'; r['buff giá trị'] = 15 + t; r['thời gian buff (giây)'] = 10; }
  rows[x.code] = r;
}

/* 3. Đan phương: mỗi đan một tổ hợp riêng (khác cả tỷ lệ), vì luyện thủ công nhận diện đan theo nguyên liệu bỏ vào lò. */
const herbs = H.ITEMS.filter(x => x.kind === 'HERB'), pool = t => herbs.filter(h => h.tier === t).sort((a, b) => a.sub - b.sub || a.code.localeCompare(b.code));
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const sig = r => { const e = Object.entries(r).sort(([x], [y]) => x.localeCompare(y)), g = e.map(([, n]) => n).reduce(gcd); return e.map(([k, n]) => k + ':' + n / g).join('+'); };
const used = new Set();
const AMOUNTS = [[2, 2], [3, 1], [1, 3], [3, 2], [2, 3], [4, 2], [2, 4], [3, 3], [4, 1], [1, 4]];
for (const x of H.ITEMS.filter(y => y.kind === 'PILL').sort((a, b) => a.code.localeCompare(b.code))) {
  const cur = H.DESIGN.recipes[x.code];
  if (cur && !used.has(sig(cur))) { used.add(sig(cur)); continue; }
  const p = pool(x.tier), n = (x.sourceNumber || 1) - 1, lo = pool(Math.max(0, x.tier - 1));
  if (p.length < 2) throw Error('Thiếu linh thảo bậc ' + x.tier);
  let set = null;
  search: for (let shift = 0; shift < p.length * p.length; shift++) for (const [qa, qb] of AMOUNTS) {
    const a = p[(n + shift) % p.length], b = p[(n + 1 + Math.floor(shift / p.length) + shift) % p.length];
    if (a.code === b.code) continue;
    const need = { [a.code]: qa, [b.code]: qb };
    if (x.tier >= 9 && lo.length) need[lo[(n + shift) % lo.length].code] = 1;
    if (H.MANUALS.isRarePill(x)) { const top = p.at(-1); need[top.code] = (need[top.code] || 0) + 1; }
    if (!used.has(sig(need))) { set = need; break search; }
  }
  if (!set) throw Error('Không tìm được đan phương riêng cho ' + x.code);
  used.add(sig(set)); recipes[x.code] = set;
}

/* 4. Rèn pháp bảo còn thiếu: nguyên liệu cùng bậc, cần bí tịch luyện pháp bảo. */
const mats = H.ITEMS.filter(x => x.kind === 'MAT'), mpool = t => mats.filter(m => m.tier === t);
for (const x of eqs.filter(y => !H.DESIGN.forge[y.code])) {
  const p = mpool(x.tier).length ? mpool(x.tier) : mpool(Math.max(0, x.tier - 1)), n = (x.sourceNumber || 1) - 1;
  forge[x.code] = { manual: 'BT-900', herb: p[n % p.length].code, count: 3 + Math.floor(x.tier / 2) };
}

const out = `/* Dữ liệu thiết kế bổ sung (sinh bởi tools/gen-design-fill.cjs): pháp bảo, chiêu ngoại tu, đan phương, rèn pháp bảo. */
(function (root) {
  'use strict';
  const API = ${JSON.stringify({ rows, recipes, forge, effects })};
  root.HU_DESIGN_FILL = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(path.join(__dirname, '../data/design-fill.js'), out);
console.log('EQ', eqs.length, 'rows', Object.keys(rows).length, 'recipes', Object.keys(recipes).length, 'forge', Object.keys(forge).length);
