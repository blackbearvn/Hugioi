/* Bạn bè người chơi thật. Một route POST /social/friends, body {action, ...}.
 * Người chơi được xác định bằng owner_id (đã là id công khai trong chat) hoặc tên đạo thân chính xác.
 * Mọi quyền hạn kiểm ở máy chủ: không tự kết bạn, không gửi cho người đã chặn mình (trả lỗi chung),
 * giới hạn số bạn / lời mời để chống spam. */
import { GameError } from './game.bundle.mjs';

type Row = Record<string, unknown>;
type Db = { queryObject: (q: { text: string; args: unknown[] }) => Promise<{ rows: Row[] }> };
type Database = {
  connection: <T>(work: (db: Db) => Promise<T>) => Promise<T>;
  transaction: <T>(work: (db: Db) => Promise<T>) => Promise<T>;
};
export const FRIEND_LIMITS = { friends: 50, outgoing: 20, incoming: 30 };
const ONLINE_GRACE_MS = 90000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (code: string, msg: string) => { throw new GameError(code, msg); };
const rows = async (c: Db, text: string, args: unknown[] = []): Promise<Row[]> => (await c.queryObject({ text, args })).rows;
const first = async (c: Db, text: string, args: unknown[] = []) => (await rows(c, text, args))[0] || null;
const num = (v: unknown) => { const n = Number(v); return Number.isSafeInteger(n) ? n : 0; };
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const pair = (a: string, b: string) => a < b ? [a, b] : [b, a];

const PEOPLE = `SELECT l.owner_id, l.name, l.realm, l.sect_id,
    COALESCE(pr.seen_at, 0) AS seen_at
  FROM game.player_leaderboard l
  LEFT JOIN game.world_chat_presence pr ON pr.owner_id = l.owner_id`;
const asPerson = (r: Row, now: number) => ({
  id: String(r.owner_id), name: String(r.name), realm: num(r.realm),
  sect: r.sect_id ? String(r.sect_id) : null,
  online: num(r.seen_at) >= now - ONLINE_GRACE_MS
});

async function listAll(c: Db, me: string, now: number) {
  const friends = await rows(c, `${PEOPLE}
    JOIN game.friendships f ON (f.owner_a = $1 AND f.owner_b = l.owner_id) OR (f.owner_b = $1 AND f.owner_a = l.owner_id)
    ORDER BY (COALESCE(pr.seen_at,0) >= $2) DESC, l.name ASC LIMIT ${FRIEND_LIMITS.friends}`, [me, now - ONLINE_GRACE_MS]);
  const incoming = await rows(c, `${PEOPLE}
    JOIN game.friend_requests q ON q.from_owner = l.owner_id AND q.to_owner = $1
    ORDER BY q.created_at DESC LIMIT ${FRIEND_LIMITS.incoming}`, [me]);
  const outgoing = await rows(c, `${PEOPLE}
    JOIN game.friend_requests q ON q.to_owner = l.owner_id AND q.from_owner = $1
    ORDER BY q.created_at DESC LIMIT ${FRIEND_LIMITS.outgoing}`, [me]);
  const blocked = await rows(c, `${PEOPLE}
    JOIN game.friend_blocks b ON b.blocked_id = l.owner_id AND b.owner_id = $1
    ORDER BY l.name ASC LIMIT 100`, [me]);
  return {
    friends: friends.map(r => asPerson(r, now)), incoming: incoming.map(r => asPerson(r, now)),
    outgoing: outgoing.map(r => asPerson(r, now)), blocked: blocked.map(r => asPerson(r, now)),
    limits: FRIEND_LIMITS
  };
}

const areFriends = async (c: Db, a: string, b: string) => {
  const [x, y] = pair(a, b);
  return !!await first(c, 'SELECT 1 AS ok FROM game.friendships WHERE owner_a = $1 AND owner_b = $2', [x, y]);
};
const countFriends = async (c: Db, id: string) => num((await first(c,
  'SELECT count(*)::bigint AS n FROM game.friendships WHERE owner_a = $1 OR owner_b = $1', [id]))?.n);

async function makeFriends(c: Db, a: string, b: string, now: number) {
  const [x, y] = pair(a, b);
  await rows(c, 'DELETE FROM game.friend_requests WHERE (from_owner = $1 AND to_owner = $2) OR (from_owner = $2 AND to_owner = $1)', [a, b]);
  await rows(c, 'INSERT INTO game.friendships (owner_a, owner_b, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [x, y, now]);
}

export async function handleFriends(repo: Database, ownerId: string, rawBody: unknown): Promise<unknown> {
  if (!isObject(rawBody)) return fail('INVALID_REQUEST', 'Dữ liệu không hợp lệ.');
  const action = String(rawBody.action || 'list');
  const allowed = new Set(['action', 'id', 'name']);
  if (Object.keys(rawBody).some(k => !allowed.has(k))) return fail('INVALID_REQUEST', 'Dữ liệu không hợp lệ.');
  const now = Date.now();
  return repo.transaction(async c => {
    const mine = await first(c, 'SELECT 1 AS ok FROM game.player_leaderboard WHERE owner_id = $1', [ownerId]);
    if (!mine) return fail('PLAYER_NOT_FOUND', 'Bạn cần có đạo thân trước khi kết bạn.');
    if (action === 'list') return listAll(c, ownerId, now);

    // Xác định đối phương: theo id (UUID) hoặc theo tên chính xác (không phân biệt hoa thường).
    let target: Row | null = null;
    if (action === 'request' && rawBody.name !== undefined) {
      const name = String(rawBody.name).trim().replace(/\s+/g, ' ');
      if (!name || name.length > 60) return fail('INVALID_REQUEST', 'Tên đạo hữu không hợp lệ.');
      target = await first(c, `${PEOPLE} WHERE lower(l.name) = lower($1)`, [name]);
    } else {
      const id = String(rawBody.id || '');
      if (!UUID.test(id)) return fail('INVALID_REQUEST', 'Dữ liệu không hợp lệ.');
      target = await first(c, `${PEOPLE} WHERE l.owner_id = $1`, [id.toLowerCase()]);
    }
    if (!target) return fail('FRIEND_NOT_FOUND', 'Không tìm thấy đạo hữu này.');
    const other = String(target.owner_id);
    if (other === ownerId) return fail('FRIEND_SELF', 'Không thể kết bạn với chính mình.');
    // Khóa theo cặp để hai bên bấm cùng lúc không tạo trạng thái lệch.
    await rows(c, 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['friend:' + pair(ownerId, other).join(':')]);

    if (action === 'request') {
      const blockedMe = await first(c, 'SELECT 1 AS ok FROM game.friend_blocks WHERE owner_id = $1 AND blocked_id = $2', [other, ownerId]);
      if (blockedMe) return fail('FRIEND_NOT_FOUND', 'Không thể gửi lời mời cho đạo hữu này.');
      if (await first(c, 'SELECT 1 AS ok FROM game.friend_blocks WHERE owner_id = $1 AND blocked_id = $2', [ownerId, other]))
        return fail('FRIEND_BLOCKED', 'Bạn đang chặn đạo hữu này. Hãy bỏ chặn trước.');
      if (await areFriends(c, ownerId, other)) return fail('FRIEND_EXISTS', 'Hai người đã là bạn.');
      if (await countFriends(c, ownerId) >= FRIEND_LIMITS.friends) return fail('FRIEND_LIMIT', 'Danh sách bạn của bạn đã đầy.');
      // Đối phương đã mời mình: coi như chấp nhận.
      const reverse = await first(c, 'SELECT 1 AS ok FROM game.friend_requests WHERE from_owner = $1 AND to_owner = $2', [other, ownerId]);
      if (reverse) {
        if (await countFriends(c, other) >= FRIEND_LIMITS.friends) return fail('FRIEND_LIMIT', 'Danh sách bạn của đối phương đã đầy.');
        await makeFriends(c, ownerId, other, now);
        return { ...(await listAll(c, ownerId, now)), result: 'accepted', person: asPerson(target, now) };
      }
      const out = num((await first(c, 'SELECT count(*)::bigint AS n FROM game.friend_requests WHERE from_owner = $1', [ownerId]))?.n);
      const inc = num((await first(c, 'SELECT count(*)::bigint AS n FROM game.friend_requests WHERE to_owner = $1', [other]))?.n);
      const exists = await first(c, 'SELECT 1 AS ok FROM game.friend_requests WHERE from_owner = $1 AND to_owner = $2', [ownerId, other]);
      if (exists) return { ...(await listAll(c, ownerId, now)), result: 'pending', person: asPerson(target, now) };
      if (out >= FRIEND_LIMITS.outgoing) return fail('FRIEND_LIMIT', 'Bạn đang chờ quá nhiều lời mời. Hãy đợi họ phản hồi.');
      if (inc >= FRIEND_LIMITS.incoming) return fail('FRIEND_LIMIT', 'Đạo hữu này đang nhận quá nhiều lời mời.');
      await rows(c, 'INSERT INTO game.friend_requests (from_owner, to_owner, created_at) VALUES ($1,$2,$3)', [ownerId, other, now]);
      return { ...(await listAll(c, ownerId, now)), result: 'sent', person: asPerson(target, now) };
    }
    if (action === 'accept' || action === 'decline') {
      const req = await first(c, 'SELECT 1 AS ok FROM game.friend_requests WHERE from_owner = $1 AND to_owner = $2', [other, ownerId]);
      if (!req) return fail('FRIEND_NO_REQUEST', 'Lời mời không còn tồn tại.');
      if (action === 'accept') {
        if (await countFriends(c, ownerId) >= FRIEND_LIMITS.friends) return fail('FRIEND_LIMIT', 'Danh sách bạn của bạn đã đầy.');
        if (await countFriends(c, other) >= FRIEND_LIMITS.friends) return fail('FRIEND_LIMIT', 'Danh sách bạn của đối phương đã đầy.');
        await makeFriends(c, ownerId, other, now);
      } else await rows(c, 'DELETE FROM game.friend_requests WHERE from_owner = $1 AND to_owner = $2', [other, ownerId]);
      return { ...(await listAll(c, ownerId, now)), result: action === 'accept' ? 'accepted' : 'declined', person: asPerson(target, now) };
    }
    if (action === 'cancel') {
      await rows(c, 'DELETE FROM game.friend_requests WHERE from_owner = $1 AND to_owner = $2', [ownerId, other]);
      return { ...(await listAll(c, ownerId, now)), result: 'cancelled', person: asPerson(target, now) };
    }
    if (action === 'remove') {
      const [x, y] = pair(ownerId, other);
      await rows(c, 'DELETE FROM game.friendships WHERE owner_a = $1 AND owner_b = $2', [x, y]);
      return { ...(await listAll(c, ownerId, now)), result: 'removed', person: asPerson(target, now) };
    }
    if (action === 'block') {
      const [x, y] = pair(ownerId, other);
      await rows(c, 'DELETE FROM game.friendships WHERE owner_a = $1 AND owner_b = $2', [x, y]);
      await rows(c, 'DELETE FROM game.friend_requests WHERE (from_owner = $1 AND to_owner = $2) OR (from_owner = $2 AND to_owner = $1)', [ownerId, other]);
      await rows(c, 'INSERT INTO game.friend_blocks (owner_id, blocked_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [ownerId, other, now]);
      return { ...(await listAll(c, ownerId, now)), result: 'blocked', person: asPerson(target, now) };
    }
    if (action === 'unblock') {
      await rows(c, 'DELETE FROM game.friend_blocks WHERE owner_id = $1 AND blocked_id = $2', [ownerId, other]);
      return { ...(await listAll(c, ownerId, now)), result: 'unblocked', person: asPerson(target, now) };
    }
    return fail('INVALID_REQUEST', 'Hành động không hợp lệ.');
  });
}
