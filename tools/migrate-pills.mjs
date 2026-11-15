#!/usr/bin/env node
/* Sinh phần chuẩn hóa cho 60 đan trong data/items.js: number, gradeId, tags, useReq, recipe.
   Chạy: node tools/migrate-pills.mjs [--check]
   --check chỉ kiểm tra file đã chuẩn hóa chưa, không ghi.
   Công cụ idempotent: chạy lại cho ra đúng cùng nội dung. Không sửa name/description/lore.
   Recipe: 25 đan lấy đúng DESIGN.recipes; 35 đan còn lại sinh công thức tất định theo mã đan:
   2-4 loại linh thảo, số lượng 2-4 mỗi loại, càng lên tier và càng hiếm thì càng nhiều loại
   và càng nặng nguyên liệu. Không dùng random lúc chơi; công thức nằm cố định trong data. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { tagsFor, gradeIdFor } = require('../data/schema.js');
const { isRarePill } = require('../data/manuals.js');
const DESIGN = require('../data/design.js');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, 'data/items.js');
const PREFIX = '(function(root){const data=';
const MARK = ';root.TIEN_VAN_ITEMS=';

/* Băm mã đan thành seed 32 bit. Cùng mã luôn ra cùng công thức. */
function seedOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) || 0x9e3779b9;
}

/* xorshift32: đủ để xáo nguyên liệu, không phụ thuộc Math.random. */
function randomOf(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function shuffled(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* Số loại linh thảo: 2 ở Hạ Giới (tier 0-4), 3 ở Linh Giới (5-8), 4 ở Tiên Giới (9-13);
   đan hiếm được thêm một loại trước khi chạm trần 4. */
export function herbTypeCount(x, rare) {
  const base = x.tier < 5 ? 2 : x.tier < 9 ? 3 : 4;
  return Math.min(4, base + (rare && x.tier < 9 ? 1 : 0));
}

/* Công thức tự sinh: chọn linh thảo cùng tier trước, thiếu thì lấy tier gần nhất bên dưới.
   Mỗi loại 2-4 cây; đan hiếm nặng hơn đan thường cùng tier. */
export function generatedHerbs(x, items) {
  const rare = isRarePill(x);
  const rng = randomOf(seedOf(x.code + ':' + x.tier));
  const same = items.filter(y => y.kind === 'HERB' && y.tier === x.tier);
  const lowerTiers = [...new Set(items.filter(y => y.kind === 'HERB' && y.tier < x.tier).map(y => y.tier))]
    .sort((a, b) => b - a);
  const pool = shuffled(same, rng);
  for (const tier of lowerTiers)
    pool.push(...shuffled(items.filter(y => y.kind === 'HERB' && y.tier === tier), rng));
  const types = herbTypeCount(x, rare);
  if (pool.length < types) throw Error(x.code + ': không đủ linh thảo để tạo ' + types + ' loại');
  const need = {};
  for (const herb of pool.slice(0, types)) {
    const base = 2 + (rare ? 1 : 0);
    need[herb.code] = Math.min(4, base + (rng() < .5 ? 1 : 0));
  }
  return need;
}

/* Công thức chốt cho một đan: DESIGN.recipes là nguồn cố định, còn lại sinh theo quy tắc trên. */
export function recipeFor(x, items) {
  const defined = DESIGN.recipes[x.code];
  return defined ? { ...defined } : generatedHerbs(x, items);
}

/* Trả về mảng mới: bản ghi PILL có thêm năm khóa, mọi bản ghi khác giữ nguyên.
   Khóa đã có được ghi đè bằng cùng giá trị suy ra, nên chạy lại không đổi kết quả. */
export function migratePills(items) {
  const numbers = new Set();
  return items.map(x => {
    if (!x || x.kind !== 'PILL') return x;
    const number = x.sourceNumber;
    if (!Number.isInteger(number) || number < 1) throw Error(x.code + ': thiếu sourceNumber hợp lệ');
    if (numbers.has(number)) throw Error(x.code + ': sourceNumber bị trùng ' + number);
    numbers.add(number);
    const gradeId = gradeIdFor(x.grade);
    if (!gradeId) throw Error(x.code + ': không ánh xạ được grade ' + JSON.stringify(x.grade));
    return {
      ...x,
      number,
      gradeId,
      tags: tagsFor(x.effect, x.tier, isRarePill(x)),
      useReq: { realmMin: x.tier },
      recipe: { herbs: recipeFor(x, items) }
    };
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const check = process.argv.includes('--check');
  const source = readFileSync(FILE, 'utf8');
  if (!source.startsWith(PREFIX) || !source.includes(MARK))
    throw Error('data/items.js không đúng dạng UMD mong đợi');
  const items = require(FILE);
  const before = source.slice(PREFIX.length, source.indexOf(MARK));
  if (before !== JSON.stringify(items)) throw Error('data/items.js không phải JSON.stringify chuẩn, dừng để tránh phá định dạng');
  const next = PREFIX + JSON.stringify(migratePills(items)) + source.slice(source.indexOf(MARK));
  const pills = items.filter(x => x.kind === 'PILL').length;
  if (check) {
    if (next !== source) {
      console.error('migrate-pills: data/items.js chưa chuẩn hóa. Chạy node tools/migrate-pills.mjs');
      process.exitCode = 1;
    } else console.log('migrate-pills: ' + pills + ' đan đã chuẩn hóa.');
  } else if (next === source) {
    console.log('migrate-pills: không có thay đổi (' + pills + ' đan).');
  } else {
    writeFileSync(FILE, next);
    console.log('migrate-pills: đã cập nhật ' + pills + ' đan.');
  }
}
