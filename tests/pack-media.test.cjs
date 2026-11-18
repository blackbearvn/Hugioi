/* Gói tài nguyên mã hóa: giải mã lại đúng từng ảnh và không để lại tệp rời trong dist. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { packMedia, GROUPS } = require('../tools/pack-media.cjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-'));
  const g = GROUPS[0], dir = path.join(root, g.prefix);
  const files = { 'nam/di_bo/00.webp': 'AAAA', 'nam/di_bo/01.webp': 'BBBBBB', 'nam/portrait.webp': 'PORT', 'nam/thien_dinh/00.webp': 'IDLE0', 'nam/thien_dinh/01.webp': 'IDLE1', 'manifest.json': '{}' };
  for (const [rel, data] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), data); }
  const out = path.join(root, 'dist');
  fs.cpSync(path.join(root, 'media'), path.join(out, 'media'), { recursive: true });
  return { root, out, g, files };
}

test('gói giải mã lại đúng từng ảnh; tệp rời của nhóm bị gỡ, tệp tham chiếu trực tiếp được giữ', () => {
  const { root, out, g, files } = fixture();
  try {
    const cfg = packMedia({ root, out, log: () => {} });
    assert.equal(cfg.length, 1);
    const key = Buffer.from(Buffer.from(cfg[0].k[0], 'base64').map((v, i) => v ^ Buffer.from(cfg[0].k[1], 'base64')[i]));
    const raw = fs.readFileSync(path.join(out, cfg[0].file));
    const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(raw.length - 16));
    const plain = Buffer.concat([d.update(raw.subarray(12, raw.length - 16)), d.final()]);
    const headLen = plain.readUInt32LE(0), index = JSON.parse(plain.subarray(4, 4 + headLen));
    assert.deepEqual(Object.keys(index).sort(), ['nam/di_bo/00.webp', 'nam/di_bo/01.webp', 'nam/thien_dinh/01.webp']);
    for (const [rel, [off, len]] of Object.entries(index)) assert.equal(plain.subarray(4 + headLen + off, 4 + headLen + off + len).toString(), files[rel]);
    const left = rel => fs.existsSync(path.join(out, g.prefix, rel));
    assert.equal(left('nam/di_bo/00.webp'), false);
    assert.equal(left('manifest.json'), false);
    assert.equal(left('nam/portrait.webp'), true);
    assert.equal(left('nam/thien_dinh/00.webp'), true);
    assert.match(fs.readFileSync(path.join(out, 'client/assets/packs.js'), 'utf8'), /HU_PACKS=\[\{"prefix":"media\/assets\/chars\/player\/realistic\/"/);
    /* Dữ liệu trong gói không lộ dạng chữ thường. */
    assert.ok(!raw.includes(Buffer.from('BBBBBB')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('khóa cố định qua MEDIA_PACK_KEY cho cùng khóa; khóa sai định dạng bị từ chối', () => {
  const { root, out } = fixture();
  try {
    process.env.MEDIA_PACK_KEY = 'ab'.repeat(32);
    const a = packMedia({ root, out, log: () => {} });
    const key = Buffer.from(Buffer.from(a[0].k[0], 'base64').map((v, i) => v ^ Buffer.from(a[0].k[1], 'base64')[i]));
    assert.equal(key.toString('hex'), 'ab'.repeat(32));
    process.env.MEDIA_PACK_KEY = 'xyz';
    assert.throws(() => packMedia({ root, out, log: () => {} }), /64 ký tự hex/);
  } finally { delete process.env.MEDIA_PACK_KEY; fs.rmSync(root, { recursive: true, force: true }); }
});
