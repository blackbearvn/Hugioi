/* Kiểm tra bản CSS production: Vite dùng tên có dấu vân tay nội dung,
 * giữ CSS pháp lý độc lập và loại các stylesheet trang game đã được gộp. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const sourceHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const releaseHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const pattern = /<link rel="stylesheet"(?: crossorigin)? href="([^"]+)">/g;
const sourceSheets = [...sourceHtml.matchAll(pattern)].map(match => match[1]);
const builtSheets = [...releaseHtml.matchAll(pattern)].map(match => match[1]);

assert.ok(sourceSheets.length > 1, 'Bản nguồn phải chứa nhiều stylesheet riêng.');
assert.deepEqual(builtSheets.length, 1, 'Production chỉ tải một stylesheet cho trang game.');
const href = builtSheets[0];
assert.match(href, /^\/assets\/index-[\w-]+\.css$/);
const content = fs.readFileSync(path.join(dist, href));
assert.ok(content.length > 0);
assert.match(content.toString(), /@font-face/);
for (const [, asset] of content.toString().matchAll(/url\(["']?(\/assets\/[^"')]+)["']?\)/g))
  assert.ok(fs.existsSync(path.join(dist, asset)), 'Thiếu tài nguyên CSS: ' + asset);
assert.ok(fs.existsSync(path.join(dist, 'css/legal.css')), 'Không được bỏ CSS trang pháp lý.');
for (const file of sourceSheets) {
  assert.ok(file.startsWith('css/'), 'Stylesheet nằm ngoài css/: ' + file);
  assert.equal(fs.existsSync(path.join(dist, file)), false, 'Stylesheet cũ chưa được bỏ khỏi dist/: ' + file);
}
assert.match(fs.readFileSync(path.join(dist, '_headers'), 'utf8'),
  /\/assets\/\*\s+Cache-Control: public, max-age=31536000, immutable/);
console.log('CSS release: ' + sourceSheets.length + ' → ' + builtSheets.length +
  ' request, ' + content.length + ' bytes trước nén HTTP.');
