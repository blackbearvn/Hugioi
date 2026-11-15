#!/usr/bin/env node
/* Kiểm tra toàn vẹn dữ liệu vật phẩm: mã trùng, enum, tier, công thức và yêu cầu cảnh giới.
   Chạy: node tools/check-data.mjs [--strict]
   --strict bắt buộc mọi đan có đủ gradeId, tags, useReq, recipe (dùng từ bước 5). */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { EFFECTS, GRADES, TAGS } = require('../data/schema.js');
const { REALMS } = require('../data/balance.js');

const EFFECT_IDS = new Set(Object.keys(EFFECTS));
const GRADE_IDS = new Set(GRADES.map(g => g.id));
const TAG_IDS = new Set(Object.keys(TAGS));
const MAX_ERRORS = 80;

const isPlainObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = v => Number.isInteger(v);

/* Trả về mảng lỗi dạng "MÃ: khóa ...". Không ném lỗi để test và CLI dùng chung. */
export function validateItems(items, { strict = false } = {}) {
  const errors = [];
  const fail = (code, message) => errors.push((code || '(không mã)') + ': ' + message);
  if (!Array.isArray(items)) {
    fail('', 'ITEMS phải là mảng');
    return errors;
  }

  const byCode = new Map();
  for (const x of items) {
    if (!x || typeof x !== 'object') { fail('', 'bản ghi không phải object'); continue; }
    const code = x.code;
    if (typeof code !== 'string' || !code.trim()) { fail('', 'code thiếu hoặc không phải chuỗi'); continue; }
    if (byCode.has(code)) fail(code, 'code bị trùng');
    else byCode.set(code, x);
  }

  for (const x of items) {
    if (!x || typeof x !== 'object' || typeof x.code !== 'string') continue;
    const code = x.code;
    if (!isInt(x.tier) || x.tier < 0 || x.tier > 13)
      fail(code, 'tier phải là số nguyên 0-13, nhận: ' + JSON.stringify(x.tier));
    if (x.kind !== 'PILL') continue;

    if (x.effect === undefined) fail(code, 'effect thiếu');
    else if (!EFFECT_IDS.has(x.effect)) fail(code, 'effect ngoài enum: ' + JSON.stringify(x.effect));

    if (x.gradeId === undefined) {
      if (strict) fail(code, 'gradeId thiếu');
    } else if (!GRADE_IDS.has(x.gradeId)) fail(code, 'gradeId ngoài enum: ' + JSON.stringify(x.gradeId));

    if (x.tags === undefined) {
      if (strict) fail(code, 'tags thiếu');
    } else if (!Array.isArray(x.tags)) {
      fail(code, 'tags phải là mảng');
    } else {
      if (!x.tags.length) fail(code, 'tags rỗng');
      const seen = new Set();
      for (const tag of x.tags) {
        if (!TAG_IDS.has(tag)) fail(code, 'tag ngoài enum: ' + JSON.stringify(tag));
        if (seen.has(tag)) fail(code, 'tag bị lặp: ' + JSON.stringify(tag));
        seen.add(tag);
      }
    }

    if (x.useReq === undefined) {
      if (strict) fail(code, 'useReq thiếu');
    } else if (!isPlainObject(x.useReq)) {
      fail(code, 'useReq phải là object');
    } else if (!isInt(x.useReq.realmMin) || x.useReq.realmMin < 0 || x.useReq.realmMin >= REALMS.length) {
      fail(code, 'useReq.realmMin ngoài phạm vi 0-' + (REALMS.length - 1) + ', nhận: ' + JSON.stringify(x.useReq.realmMin));
    }

    if (x.recipe === undefined) {
      if (strict) fail(code, 'recipe thiếu');
      continue;
    }
    if (!isPlainObject(x.recipe) || !isPlainObject(x.recipe.herbs)) {
      fail(code, 'recipe.herbs phải là object');
      continue;
    }
    const herbs = Object.entries(x.recipe.herbs);
    if (!herbs.length) fail(code, 'recipe.herbs rỗng');
    for (const [herbCode, n] of herbs) {
      const herb = byCode.get(herbCode);
      if (!herb) fail(code, 'recipe.herbs trỏ tới mã không tồn tại: ' + herbCode);
      else if (herb.kind !== 'HERB') fail(code, 'recipe.herbs trỏ tới vật phẩm không phải HERB: ' + herbCode + ' (' + herb.kind + ')');
      if (!isInt(n) || n < 1) fail(code, 'recipe.herbs.' + herbCode + ' phải là số nguyên >= 1, nhận: ' + JSON.stringify(n));
    }
  }

  return errors;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const strict = process.argv.includes('--strict');
  const { ITEMS } = require('../data/catalog.js');
  const errors = validateItems(ITEMS, { strict });
  if (errors.length) {
    console.error('check-data: ' + errors.length + ' lỗi' + (strict ? ' (strict)' : ''));
    for (const error of errors.slice(0, MAX_ERRORS)) console.error('  - ' + error);
    if (errors.length > MAX_ERRORS) console.error('  ... còn ' + (errors.length - MAX_ERRORS) + ' lỗi');
    process.exitCode = 1;
  } else {
    console.log('check-data: ' + ITEMS.length + ' vật phẩm hợp lệ' + (strict ? ' (strict)' : '') + '.');
  }
}
