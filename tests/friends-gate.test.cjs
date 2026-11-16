const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
// Hằng số mở kết bạn ở Edge phải khớp số tầng của Luyện Khí.
test('friends.ts OPEN_STAGE khớp F.STAGES[0]', () => {
  global.window = global;
  const F = require('../data/balance.js');
  const stages = (F.STAGES || global.HU_GAME?.F?.STAGES || global.HU_BALANCE?.STAGES);
  const src = fs.readFileSync(__dirname + '/../supabase/functions/api/friends.ts', 'utf8');
  const n = Number(/const OPEN_STAGE = (\d+);/.exec(src)[1]);
  assert.equal(n, (stages || JSON.parse(/"STAGES":(\[[^\]]*\])/.exec(fs.readFileSync(__dirname + '/../data/balance.js', 'utf8'))[1]))[0]);
});
