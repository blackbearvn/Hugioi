#!/usr/bin/env node
/* Sinh phần chuẩn hóa cho 60 đan trong data/items.js: number, gradeId, tags, useReq, recipe.
   Chạy: node tools/migrate-pills.mjs [--check]
   --check chỉ kiểm tra file đã chuẩn hóa chưa, không ghi.
   Công cụ idempotent: chạy lại cho ra đúng cùng nội dung. Không sửa name/description/lore.
   Recipe: 25 đan lấy đúng DESIGN.recipes; 35 đan còn lại giữ nguyên công thức mà nhánh
   fallback cũ của engine đang sinh, để không đổi nguyên liệu người chơi phải bỏ vào lò. */
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

/* Công thức fallback cũ của engine, chép nguyên quy tắc để dữ liệu không đổi nguyên liệu. */
export function fallbackHerbs(x, items) {
  const pool = items.filter(y => y.kind === 'HERB' && y.tier === x.tier);
  const fallback = items.filter(y => y.kind === 'HERB' && y.tier <= x.tier).slice(-2);
  const herbs = pool.length ? pool : fallback;
  if (!herbs.length) throw Error(x.code + ': không có linh thảo cùng tier để tạo công thức');
  const a = herbs[(x.sourceNumber - 1) % herbs.length], b = herbs[x.sourceNumber % herbs.length];
  const need = {};
  need[a.code] = 2;
  need[b.code] = (need[b.code] || 0) + 2;
  return need;
}

/* Công thức chốt cho một đan: ưu tiên DESIGN.recipes, còn lại giữ đúng fallback cũ. */
export function recipeFor(x, items) {
  const defined = DESIGN.recipes[x.code];
  return defined ? { ...defined } : fallbackHerbs(x, items);
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
    const hasRecipe = x.recipe && x.recipe.herbs && Object.keys(x.recipe.herbs).length;
    return {
      ...x,
      number,
      gradeId,
      tags: tagsFor(x.effect, x.tier, isRarePill(x)),
      useReq: { realmMin: x.tier },
      recipe: hasRecipe ? x.recipe : { herbs: recipeFor(x, items) }
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
