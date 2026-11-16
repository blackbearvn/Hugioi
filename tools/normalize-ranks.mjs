#!/usr/bin/env node
/* Chuẩn hóa hai trục mới cho data/items.js:
   - `rank` 1-7, suy từ cảnh giới yêu cầu (`tier`) theo bảng RANK_BY_TIER.
   - `quality` 1-5, suy từ `sub` 0-4; `qualityLabel` là chuỗi hiển thị chuẩn.
   `sub` được giữ làm chỉ số phẩm chất 0-4 cho inventory/giá/công thức cũ, và
   luôn bằng `quality - 1`.
   Chạy: node tools/normalize-ranks.mjs [--check]
   Idempotent, không sửa name/description/lore hay bất kỳ trường gameplay nào khác. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const S = require('../data/schema.js');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, 'data/items.js');
const PREFIX = '(function(root){const data=';
const MARK = ';root.TIEN_VAN_ITEMS=';

export function rankOf(x) {
  return S.rankForTier(x.tier) || 1;
}

export function qualityOf(x) {
  return S.qualityOf(x) || S.qualityForSub(x.sub) || 1;
}

/* Giữ nguyên thứ tự khóa cũ, chỉ thay giá trị quality/sub và bổ sung hai khóa
   mới ở cuối. Nhờ vậy diff trên items.js chỉ đụng đúng các trường liên quan. */
export function normalizeRanks(items) {
  return items.map(x => {
    const quality = qualityOf(x);
    const sub = S.subForQuality(quality);
    const out = {};
    for (const key of Object.keys(x)) {
      if (key === 'quality') out.quality = quality;
      else if (key === 'sub') out.sub = sub;
      else if (key === 'rank') out.rank = rankOf(x);
      else if (key === 'qualityLabel') out.qualityLabel = S.qualityLabel(quality);
      else out[key] = x[key];
    }
    if (!Object.hasOwn(out, 'quality')) out.quality = quality;
    if (!Object.hasOwn(out, 'rank')) out.rank = rankOf(x);
    if (!Object.hasOwn(out, 'qualityLabel')) out.qualityLabel = S.qualityLabel(quality);
    return out;
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
  const next = PREFIX + JSON.stringify(normalizeRanks(items)) + source.slice(source.indexOf(MARK));
  const changed = items.filter(x => qualityOf(x) !== x.quality || x.sub !== S.subForQuality(qualityOf(x)) || x.rank !== rankOf(x) || x.qualityLabel !== S.qualityLabel(qualityOf(x))).length;
  if (check) {
    if (next !== source) {
      console.error('normalize-ranks: data/items.js chưa chuẩn hóa (' + changed + ' item). Chạy node tools/normalize-ranks.mjs');
      process.exitCode = 1;
    } else console.log('normalize-ranks: ' + items.length + ' vật phẩm đã chuẩn hóa rank/quality.');
  } else if (next === source) {
    console.log('normalize-ranks: không có thay đổi (' + items.length + ' vật phẩm).');
  } else {
    writeFileSync(FILE, next);
    console.log('normalize-ranks: đã cập nhật ' + changed + '/' + items.length + ' vật phẩm.');
  }
}
