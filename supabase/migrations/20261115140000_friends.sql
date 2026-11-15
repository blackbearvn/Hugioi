-- Bạn bè giữa người chơi thật. Bảng private: chỉ Edge API (service role) truy cập sau JWT.
-- friendships lưu một hàng cho mỗi cặp (owner_a < owner_b) để không thể trùng lặp hai chiều.
CREATE TABLE IF NOT EXISTS game.friendships (
  owner_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  PRIMARY KEY (owner_a, owner_b),
  CHECK (owner_a < owner_b)
);
CREATE INDEX IF NOT EXISTS game_friendships_b ON game.friendships(owner_b);

CREATE TABLE IF NOT EXISTS game.friend_requests (
  from_owner uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_owner uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  PRIMARY KEY (from_owner, to_owner),
  CHECK (from_owner <> to_owner)
);
CREATE INDEX IF NOT EXISTS game_friend_requests_to ON game.friend_requests(to_owner, created_at DESC);

CREATE TABLE IF NOT EXISTS game.friend_blocks (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  PRIMARY KEY (owner_id, blocked_id),
  CHECK (owner_id <> blocked_id)
);

ALTER TABLE game.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.friend_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON game.friendships, game.friend_requests, game.friend_blocks FROM PUBLIC, anon, authenticated;
