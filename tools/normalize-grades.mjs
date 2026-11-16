#!/usr/bin/env node
/* Chuẩn hóa `grade` của toàn bộ data/items.js:
   - PILL giữ thang 14 bậc phẩm chất trong data/schema.js (GRADES).
   - Mọi loại khác dùng thang 8 bậc độ hiếm (RARITIES): Phàm, Linh, Huyền,
     Địa, Thiên, Tiên, Thần, Thánh.
   Dữ liệu cũ trộn ba nguồn: độ hiếm thiết kế (phàm/linh/...), tên cảnh giới
   (Luyện Khí, Đạo Tổ...) và tên 8 bậc viết hoa (Hoàng/Thiên/Thánh...). Công cụ
   suy lại theo thứ tự: độ hiếm thiết kế -> grade gốc -> tier.
   Chạy: node tools/normalize-grades.mjs [--check]
   Idempotent, không sửa trường nào khác. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const S = require('../data/schema.js');
const DESIGN = require('../data/design.js');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, 'data/items.js');
const PREFIX = '(function(root){const data=';
const MARK = ';root.TIEN_VAN_ITEMS=';

/* Cùng quy tắc với data/catalog.js để dữ liệu thô và dữ liệu chạy không lệch. */
export function gradeOf(x, design = DESIGN.byCode(x.code)) {
  if (x.kind === 'PILL') return S.gradeLabel(S.gradeIdFor(x.grade) || x.gradeId) || x.grade;
  const id = S.rarityIdFor(design?.['độ hiếm']) || S.rarityIdFor(x.grade) || S.rarityForTier(x.tier);
  return S.rarityLabel(id) || x.grade;
}

export function normalizeGrades(items) {
  return items.map(x => ({ ...x, grade: gradeOf(x) }));
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
  const next = PREFIX + JSON.stringify(normalizeGrades(items)) + source.slice(source.indexOf(MARK));
  const changed = items.filter(x => gradeOf(x) !== x.grade).length;
  if (check) {
    if (next !== source) {
      console.error('normalize-grades: data/items.js chưa chuẩn hóa (' + changed + ' item). Chạy node tools/normalize-grades.mjs');
      process.exitCode = 1;
    } else console.log('normalize-grades: ' + items.length + ' vật phẩm đã chuẩn hóa.');
  } else if (next === source) {
    console.log('normalize-grades: không có thay đổi (' + items.length + ' vật phẩm).');
  } else {
    writeFileSync(FILE, next);
    console.log('normalize-grades: đã cập nhật ' + changed + '/' + items.length + ' vật phẩm.');
  }
}
