const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');

/* Danh sách bạn đọc từ game.players (không phải Thiên Bảng) để bạn đã tọa hóa không biến mất khỏi danh sách,
   vẫn chiếm chỗ trong giới hạn mà không thể xóa hay bỏ chặn. */
const src = fs.readFileSync(__dirname + '/../supabase/functions/api/friends.ts', 'utf8');
const PEOPLE_ANY = /const PEOPLE_ANY = `([\s\S]*?)`;/.exec(src)?.[1];

test('friends.ts: danh sách và tra theo id dùng PEOPLE_ANY, gợi ý vẫn chỉ lấy người còn sống', () => {
  assert.ok(PEOPLE_ANY, 'thiếu PEOPLE_ANY');
  const list = src.slice(src.indexOf('async function listAll'), src.indexOf('const areFriends'));
  assert.equal((list.match(/\$\{PEOPLE_ANY\}/g) || []).length, 4, 'bốn danh sách đều đọc từ players');
  assert.doesNotMatch(list, /\$\{PEOPLE\}/);
  assert.match(src, /\$\{PEOPLE_ANY\} WHERE l\.owner_id = \$1/);
  assert.match(src, /\$\{PEOPLE\} WHERE \$\{filter\}/, 'gợi ý vẫn lọc trên Thiên Bảng');
  assert.match(src, /suggestCache\.delete\(ownerId\)/, 'đổi quan hệ phải bỏ lượt gợi ý đã nhớ');
});

test('PEOPLE_ANY trả bạn đã tọa hóa kèm cờ dead', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`CREATE SCHEMA auth; CREATE SCHEMA game;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE game.players(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid UNIQUE NOT NULL, name text NOT NULL, state jsonb NOT NULL);
    CREATE TABLE game.world_chat_presence(owner_id uuid PRIMARY KEY, seen_at bigint NOT NULL);
    CREATE TABLE game.friendships(owner_a uuid, owner_b uuid, created_at bigint);`);
  const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', C = '00000000-0000-0000-0000-00000000000c';
  const people = [[A, 'Alpha', { realm: 1, stage: 2 }], [B, 'Beta', { realm: 0, stage: 13, death: { cause: 'lifespan' } }],
    [C, 'Gamma', { realm: 2, stage: 1, death: null, sect: { joined: true, id: 's1' } }]];
  for (const [id, name, state] of people) {
    await db.query('INSERT INTO auth.users VALUES ($1)', [id]);
    await db.query('INSERT INTO game.players (owner_id,name,state) VALUES ($1,$2,$3)', [id, name, JSON.stringify(state)]);
  }
  await db.query('INSERT INTO game.friendships VALUES ($1,$2,1),($1,$3,1)', [A, B, C]);
  const { rows } = await db.query(`${PEOPLE_ANY}
    JOIN game.friendships f ON f.owner_a = $1 AND f.owner_b = l.owner_id ORDER BY l.name`, [A]);
  assert.deepEqual(rows.map(r => [r.name, r.dead, r.sect_id]), [['Beta', true, null], ['Gamma', false, 's1']]);
  await db.close();
});
