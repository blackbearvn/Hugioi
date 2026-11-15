#!/usr/bin/env node
/* Sinh phần chuẩn hóa cho 60 đan trong data/items.js: number, gradeId, tags, useReq.
   Chạy: node tools/migrate-pills.mjs [--check]
   --check chỉ kiểm tra file đã chuẩn hóa chưa, không ghi.
   Công cụ idempotent: chạy lại cho ra đúng cùng nội dung. Không sửa name/description/lore. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { tagsFor, gradeIdFor } = require('../data/schema.js');
const { isRarePill } = require('../data/manuals.js');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, 'data/items.js');
const PREFIX = '(function(root){const data=';
const MARK = ';root.TIEN_VAN_ITEMS=';

/* Trả về mảng mới: bản ghi PILL có thêm bốn khóa, mọi bản ghi khác giữ nguyên.
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
      useReq: { realmMin: x.tier }
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
