/* Đóng gói tài nguyên ảnh thành tệp .bin mã hóa cho bản dựng phát hành.
 * Mỗi nhóm trong GROUPS thành một tệp: [IV 12 byte][AES-256-GCM(độ dài chỉ mục u32 | chỉ mục JSON | dữ liệu)].
 * Tệp rời của nhóm bị xóa khỏi dist/, cấu hình (đường dẫn gói, khóa chia đôi) ghi vào dist/client/assets/packs.js.
 * Khóa nằm trong mã client vì trình duyệt phải giải mã để vẽ; đây là rào cản chứ không phải bảo mật tuyệt đối.
 * Đặt MEDIA_PACK_KEY (64 ký tự hex) để các lần build cho cùng một khóa; mặc định khóa ngẫu nhiên mỗi lần. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/* Chỉ gom ảnh chỉ được nạp qua HU_ASSETS.mediaSrc. Tệp bị tham chiếu thẳng từ HTML/CSS/loader
   (ảnh chân dung, khung nhập định đầu tiên) để lại dạng tệp rời. */
const GROUPS = [
  {
    id: 'player',
    prefix: 'media/assets/chars/player/realistic/',
    include: /\.webp$/i,
    keepLoose: /(?:^|\/)portrait\.webp$|(?:^|\/)thien_dinh\/00\.webp$/i
  }
];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

function packMedia({ root, out, log = console.log }) {
  const keyHex = process.env.MEDIA_PACK_KEY;
  if (keyHex && !/^[0-9a-f]{64}$/i.test(keyHex)) throw Error('MEDIA_PACK_KEY phải gồm 64 ký tự hex.');
  const key = keyHex ? Buffer.from(keyHex, 'hex') : crypto.randomBytes(32);
  const mask = crypto.randomBytes(32);
  const k = [Buffer.from(key.map((v, i) => v ^ mask[i])).toString('base64'), mask.toString('base64')];
  const config = [];
  for (const group of GROUPS) {
    const dir = path.join(root, group.prefix);
    if (!fs.existsSync(dir)) continue;
    const files = [...walk(dir)].map(f => ({ full: f, rel: path.relative(dir, f).split(path.sep).join('/') }))
      .filter(f => group.include.test(f.rel) && !group.keepLoose.test(f.rel))
      .sort((a, b) => a.rel.localeCompare(b.rel));
    if (!files.length) continue;
    const index = {}, blobs = [];
    let offset = 0;
    for (const f of files) {
      const data = fs.readFileSync(f.full);
      index[f.rel] = [offset, data.length];
      blobs.push(data); offset += data.length;
    }
    const head = Buffer.from(JSON.stringify(index));
    const len = Buffer.alloc(4); len.writeUInt32LE(head.length);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(Buffer.concat([len, head, ...blobs])), cipher.final()]);
    const packed = Buffer.concat([iv, body, cipher.getAuthTag()]);
    const name = group.id + '.' + crypto.createHash('sha256').update(packed).digest('hex').slice(0, 10) + '.bin';
    fs.mkdirSync(path.join(out, 'media', 'pk'), { recursive: true });
    fs.writeFileSync(path.join(out, 'media', 'pk', name), packed);
    for (const f of files) fs.rmSync(path.join(out, group.prefix, f.rel), { force: true });
    /* Bảng liệt kê khung hình không client nào đọc, không cần phục vụ công khai. */
    fs.rmSync(path.join(out, group.prefix, 'manifest.json'), { force: true });
    config.push({ prefix: group.prefix, file: 'media/pk/' + name, k });
    log(`Gói ${group.id}: ${files.length} ảnh → media/pk/${name} (${packed.length} byte, mã hóa AES-256-GCM).`);
  }
  const target = path.join(out, 'client', 'assets', 'packs.js');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '(function(r){r.HU_PACKS=' + JSON.stringify(config) + ';})(typeof window!=="undefined"?window:globalThis);\n');
  return config;
}

module.exports = { packMedia, GROUPS };
