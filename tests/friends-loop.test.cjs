const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const more = fs.readFileSync(__dirname + '/../client/ui/screens/more.js', 'utf8');
const shell = fs.readFileSync(__dirname + '/../client/ui/shell.js', 'utf8');

/* Lỗi cũ: danh sách gợi ý rỗng khiến mount gọi lại API ở mỗi lần vẽ lại, API xong lại vẽ lại ...
   đến khi máy chủ báo "Thao tác quá nhanh", menu thả xuống của tab đóng mở liên tục. */
test('loadSuggest luôn tôn trọng thời gian chờ, kể cả khi danh sách gợi ý rỗng hoặc vừa lỗi', () => {
  const fn = more.slice(more.indexOf('async function loadSuggest'), more.indexOf('const loadBuddies'));
  assert.match(fn, /!force && Date\.now\(\) < buddy\.nextAt/, 'chỉ lượt ép buộc (nút Làm mới) mới được bỏ qua thời gian chờ');
  assert.doesNotMatch(fn, /buddy\.sugg\.length && Date\.now\(\) < buddy\.nextAt/, 'không được chỉ chặn khi đã có gợi ý');
  assert.match(fn, /catch \(error\)[^]*buddy\.nextAt = Date\.now\(\) \+ 15000/, 'lỗi cũng phải bắt đầu thời gian chờ');
});

test('vẽ lại cửa sổ giữ nguyên menu thả xuống đang mở của tab', () => {
  const fn = shell.slice(shell.indexOf('    render(id) {'), shell.indexOf('refreshAll()'));
  assert.match(fn, /oldTabOpen = !!w\.body\.querySelector\('\.tabbar\.open'\)/);
  assert.match(fn, /if \(oldTabOpen\) \{ tabbar\.classList\.add\('open'\)/);
});

test('màn bạn bè: không còn Đổi lượt khác và nhãn 5 người mỗi lượt; Làm mới chỉ được bấm 30 giây một lần', () => {
  assert.doesNotMatch(more, /Đổi lượt khác|NGƯỜI MỖI LƯỢT|buddySuggest/);
  const act = more.slice(more.indexOf("UI.action('buddyRefresh'"), more.indexOf("UI.action('buddyInvite'"));
  assert.match(act, /Date\.now\(\) < buddy\.refreshAt/, 'bấm trong thời gian chờ phải bị bỏ qua');
  assert.match(act, /buddy\.refreshAt = Date\.now\(\) \+ 30000/);
  assert.match(more, /data-act="buddyRefresh"' \+ \(refreshCooling/, 'nút khóa kèm đếm ngược khi đang chờ');
});
