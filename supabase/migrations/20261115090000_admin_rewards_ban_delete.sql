-- Hư Giới internal admin console v2: thư thưởng, khóa người chơi, xóa tài khoản.
-- Additive migration; dữ liệu private trong schema game, không cấp quyền PostgREST trực tiếp.
-- PRIVACY: RPC không trả email, state, seed RNG, token hay chat tông môn.
-- AUTHORIZATION: chỉ game.admin_users đang bật; mọi hành động ghi admin_audit_log.
-- DELETE ACCOUNT: chỉ owner, cần xác nhận đúng UUID, và không xóa tài khoản admin.

begin;

-- Danh mục vật phẩm tối thiểu để máy chủ từ chối mã vật phẩm không tồn tại.
-- Bảng này được seed bởi migration 20261115090100_admin_item_catalog.sql.
create table if not exists game.item_catalog (
  code text primary key check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  name text not null check (length(name) between 1 and 120),
  category text not null default 'Khác' check (length(category) between 1 and 80)
);
alter table game.item_catalog enable row level security;
revoke all on game.item_catalog from public, anon, authenticated;

-- Idempotency cho hành động phát thưởng: retry không tạo hai thư.
create table if not exists game.admin_action_receipts (
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  action text not null check (length(action) between 1 and 64),
  target_id text,
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  primary key (admin_user_id, request_id)
);
alter table game.admin_action_receipts enable row level security;
revoke all on game.admin_action_receipts from public, anon, authenticated;

-- Khóa tài khoản ở cấp tài khoản (không phụ thuộc nhân vật còn sống hay không).
create table if not exists game.account_bans (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null check (length(reason) between 8 and 256),
  banned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists game_account_bans_expires_at
  on game.account_bans(expires_at) where expires_at is not null;
alter table game.account_bans enable row level security;
revoke all on game.account_bans from public, anon, authenticated;

comment on table game.item_catalog is
  'Mã/tên vật phẩm tối thiểu để admin RPC xác thực quà đính kèm; không chứa dữ liệu người chơi.';
comment on table game.admin_action_receipts is
  'Receipt idempotent cho hành động admin (ví dụ phát thư); retry không nhân đôi phần thưởng.';
comment on table game.account_bans is
  'Khóa tài khoản do admin đặt; Edge API từ chối mọi route gameplay khi còn hiệu lực.';

-- Trả thêm trạng thái khóa trong danh sách người chơi và cho phép lọc "banned".
CREATE OR REPLACE FUNCTION public.hu_admin_players(
  p_query text DEFAULT '', p_status text DEFAULT 'all', p_limit integer DEFAULT 50
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE q text; now_ms bigint; now_ts timestamptz;
BEGIN
  PERFORM public.hu_admin_role();
  IF p_status NOT IN ('all','online','offline','dead','banned') OR p_status IS NULL THEN
    RAISE EXCEPTION 'Invalid player status' USING ERRCODE='22023';
  END IF;
  q := left(trim(coalesce(p_query, '')), 100);
  now_ts := clock_timestamp();
  now_ms := (extract(epoch FROM now_ts) * 1000)::bigint;
  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.last_seen_at DESC), '[]'::jsonb)
    FROM (
      SELECT p.id::text AS id, p.owner_id::text AS user_id, p.name,
        coalesce((p.state->>'realm')::integer,0) AS realm,
        coalesce((p.state->>'stage')::integer,1) AS stage,
        p.combat_power, p.last_seen_at, p.revision,
        (p.state->'death' IS NOT NULL AND p.state->'death' <> 'null'::jsonb) AS dead,
        (p.last_seen_at >= now_ms - 90000
          AND (p.state->'death' IS NULL OR p.state->'death' = 'null'::jsonb)) AS online,
        (b.owner_id IS NOT NULL) AS banned,
        b.reason AS ban_reason,
        b.expires_at AS banned_until
      FROM game.players AS p
      LEFT JOIN game.account_bans AS b
        ON b.owner_id = p.owner_id
        AND (b.expires_at IS NULL OR b.expires_at > now_ts)
      WHERE (q = '' OR p.name ILIKE '%' || q || '%' OR p.owner_id::text ILIKE '%' || q || '%')
        AND (
          p_status='all'
          OR (p_status='dead' AND p.state->'death' IS NOT NULL AND p.state->'death' <> 'null'::jsonb)
          OR (p_status='online' AND p.last_seen_at >= now_ms - 90000
                AND (p.state->'death' IS NULL OR p.state->'death' = 'null'::jsonb))
          OR (p_status='offline' AND p.last_seen_at < now_ms - 90000
                AND (p.state->'death' IS NULL OR p.state->'death' = 'null'::jsonb))
          OR (p_status='banned' AND b.owner_id IS NOT NULL)
        )
      ORDER BY p.last_seen_at DESC, p.id
      LIMIT least(greatest(coalesce(p_limit,50),1),100)
    ) AS x
  );
END;
$$;

-- Tổng quan có thêm số tài khoản đang bị khóa.
CREATE OR REPLACE FUNCTION public.hu_admin_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE now_ms bigint; now_ts timestamptz;
BEGIN
  PERFORM public.hu_admin_role();
  now_ts := clock_timestamp();
  now_ms := (extract(epoch FROM now_ts) * 1000)::bigint;
  RETURN jsonb_build_object(
    'registered', (SELECT count(*) FROM auth.users),
    'players', (SELECT count(*) FROM game.players),
    'online_now', (SELECT count(*) FROM game.players p
      WHERE p.last_seen_at >= now_ms - 90000
        AND (p.state->'death' IS NULL OR p.state->'death' = 'null'::jsonb)),
    'active_24h', (SELECT count(*) FROM game.players p WHERE p.last_seen_at >= now_ms - 86400000),
    'chat_1h', (SELECT count(*) FROM game.world_chat_messages m
      WHERE m.channel_key IN ('world','dao_huu','dao_lu')
        AND m.created_at >= now_ms - 3600000),
    'ranked', (SELECT count(*) FROM game.player_leaderboard),
    'banned', (SELECT count(*) FROM game.account_bans b
      WHERE b.expires_at IS NULL OR b.expires_at > now_ts),
    'server_time', now_ms
  );
END;
$$;

-- Danh mục vật phẩm cho ô chọn quà. Chỉ đọc mã/tên/loại, không có dữ liệu người chơi.
CREATE OR REPLACE FUNCTION public.hu_admin_item_catalog()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM public.hu_admin_role();
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'code', c.code, 'name', c.name, 'category', c.category
    ) ORDER BY c.category, c.name, c.code), '[]'::jsonb)
    FROM game.item_catalog AS c
  );
END;
$$;

-- Phát thưởng qua hộp thư ở cấp tài khoản. Chỉ stone + vật phẩm có trong catalog.
-- request_id bảo đảm retry mạng không tạo thư thứ hai.
CREATE OR REPLACE FUNCTION public.hu_admin_send_mail(
  p_user_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_attachments jsonb DEFAULT '{}'::jsonb,
  p_expires_days integer DEFAULT 0,
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_role text;
  v_kind text;
  v_title text;
  v_body text;
  v_att jsonb := '{}'::jsonb;
  v_stone bigint := 0;
  v_items jsonb := '{}'::jsonb;
  v_key text;
  v_qty_text text;
  v_expires_days integer;
  v_now_ts timestamptz;
  v_now_ms bigint;
  v_expires_ms bigint;
  v_mail_id uuid;
  v_response jsonb;
  v_prior jsonb;
  v_prior_action text;
  v_prior_target text;
BEGIN
  v_role := public.hu_admin_role();
  IF v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing target account' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Target account not found' USING ERRCODE='22023';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Missing request id' USING ERRCODE='22023';
  END IF;

  v_kind := lower(trim(coalesce(p_kind, '')));
  IF v_kind NOT IN ('system','event','support','compensation') THEN
    RAISE EXCEPTION 'Invalid mail kind' USING ERRCODE='22023';
  END IF;
  v_title := trim(coalesce(p_title, ''));
  IF length(v_title) NOT BETWEEN 1 AND 120 OR v_title ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Mail title must contain 1–120 characters' USING ERRCODE='22023';
  END IF;
  v_body := trim(coalesce(p_body, ''));
  IF length(v_body) NOT BETWEEN 1 AND 2000 OR octet_length(v_body) > 8000
     OR translate(v_body, chr(9) || chr(10) || chr(13), '') ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Mail body must contain 1–2000 characters' USING ERRCODE='22023';
  END IF;

  IF p_attachments IS NULL THEN p_attachments := '{}'::jsonb; END IF;
  IF jsonb_typeof(p_attachments) <> 'object' OR octet_length(p_attachments::text) > 4096 THEN
    RAISE EXCEPTION 'Invalid attachments' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_attachments) AS k(key)
    WHERE k.key NOT IN ('stone','items')
  ) THEN
    RAISE EXCEPTION 'Invalid attachment fields' USING ERRCODE='22023';
  END IF;

  IF p_attachments ? 'stone' THEN
    IF jsonb_typeof(p_attachments->'stone') <> 'number'
       OR (p_attachments->>'stone') !~ '^[0-9]{1,7}$' THEN
      RAISE EXCEPTION 'Invalid stone amount' USING ERRCODE='22023';
    END IF;
    v_stone := (p_attachments->>'stone')::bigint;
    IF v_stone < 0 OR v_stone > 1000000 THEN
      RAISE EXCEPTION 'Stone amount out of range' USING ERRCODE='22023';
    END IF;
  END IF;

  IF p_attachments ? 'items' THEN
    IF jsonb_typeof(p_attachments->'items') <> 'object' THEN
      RAISE EXCEPTION 'Invalid item list' USING ERRCODE='22023';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_attachments->'items')) > 50 THEN
      RAISE EXCEPTION 'Too many reward items' USING ERRCODE='22023';
    END IF;
    FOR v_key, v_qty_text IN
      SELECT key, value FROM jsonb_each_text(p_attachments->'items')
    LOOP
      IF v_qty_text !~ '^[1-9][0-9]{0,3}$' THEN
        RAISE EXCEPTION 'Invalid item quantity' USING ERRCODE='22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM game.item_catalog AS c WHERE c.code = v_key) THEN
        RAISE EXCEPTION 'Unknown reward item: %', left(v_key, 40) USING ERRCODE='22023';
      END IF;
      v_items := v_items || jsonb_build_object(v_key, v_qty_text::integer);
    END LOOP;
  END IF;

  IF v_stone > 0 THEN v_att := v_att || jsonb_build_object('stone', v_stone); END IF;
  IF v_items <> '{}'::jsonb THEN v_att := v_att || jsonb_build_object('items', v_items); END IF;
  IF octet_length(v_att::text) > 4096 THEN
    RAISE EXCEPTION 'Attachments too large' USING ERRCODE='22023';
  END IF;

  v_expires_days := coalesce(p_expires_days, 0);
  IF v_expires_days < 0 OR v_expires_days > 365 THEN
    RAISE EXCEPTION 'Expiry must be 0–365 days' USING ERRCODE='22023';
  END IF;

  -- Một khóa theo (admin, request) để hai request song song không cùng tạo thư.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text || ':' || p_request_id::text, 0)
  );
  SELECT r.response, r.action, r.target_id
    INTO v_prior, v_prior_action, v_prior_target
  FROM game.admin_action_receipts AS r
  WHERE r.admin_user_id = auth.uid() AND r.request_id = p_request_id;
  IF FOUND THEN
    IF v_prior_action <> 'send_mail' OR v_prior_target IS DISTINCT FROM p_user_id::text THEN
      RAISE EXCEPTION 'Request id was reused' USING ERRCODE='22023';
    END IF;
    RETURN v_prior || jsonb_build_object('replayed', true);
  END IF;

  v_now_ts := clock_timestamp();
  v_now_ms := (extract(epoch FROM v_now_ts) * 1000)::bigint;
  v_expires_ms := CASE WHEN v_expires_days = 0 THEN NULL
    ELSE v_now_ms + (v_expires_days::bigint * 86400000) END;
  v_mail_id := gen_random_uuid();

  INSERT INTO game.account_mail
    (id, owner_id, seed_key, kind, title, body, attachments, created_at, expires_at)
  VALUES
    (v_mail_id, p_user_id, NULL, v_kind, v_title, v_body, v_att, v_now_ms, v_expires_ms);

  INSERT INTO game.admin_audit_log(admin_user_id, action, target_id, reason)
  VALUES (auth.uid(), 'send_mail', p_user_id::text, left(v_title, 120));

  v_response := jsonb_build_object(
    'sent', true,
    'mail_id', v_mail_id::text,
    'user_id', p_user_id::text,
    'kind', v_kind,
    'created_at', v_now_ms,
    'expires_at', v_expires_ms,
    'attachments', v_att
  );
  INSERT INTO game.admin_action_receipts
    (admin_user_id, request_id, action, target_id, response)
  VALUES (auth.uid(), p_request_id, 'send_mail', p_user_id::text, v_response);

  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.hu_admin_ban_player(
  p_user_id uuid,
  p_reason text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_role text;
  v_reason text;
  v_now timestamptz := clock_timestamp();
BEGIN
  v_role := public.hu_admin_role();
  IF v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Invalid ban target' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Target account not found' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM game.admin_users AS a WHERE a.user_id = p_user_id AND a.enabled) THEN
    RAISE EXCEPTION 'Cannot ban an admin account' USING ERRCODE='42501';
  END IF;
  v_reason := trim(coalesce(p_reason, ''));
  IF length(v_reason) NOT BETWEEN 8 AND 256 OR v_reason ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Ban reason must contain 8–256 characters' USING ERRCODE='22023';
  END IF;
  IF p_expires_at IS NOT NULL AND (p_expires_at <= v_now OR p_expires_at > v_now + interval '10 years') THEN
    RAISE EXCEPTION 'Invalid ban expiry' USING ERRCODE='22023';
  END IF;

  INSERT INTO game.account_bans(owner_id, reason, banned_by, created_at, expires_at)
  VALUES (p_user_id, v_reason, auth.uid(), v_now, p_expires_at)
  ON CONFLICT (owner_id) DO UPDATE
  SET reason = excluded.reason, banned_by = excluded.banned_by,
      created_at = excluded.created_at, expires_at = excluded.expires_at;

  INSERT INTO game.admin_audit_log(admin_user_id, action, target_id, reason)
  VALUES (auth.uid(), 'ban_player', p_user_id::text, v_reason);

  RETURN jsonb_build_object(
    'banned', true,
    'user_id', p_user_id::text,
    'expires_at', p_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.hu_admin_unban_player(
  p_user_id uuid,
  p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_role text;
  v_reason text;
BEGIN
  v_role := public.hu_admin_role();
  IF v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing target account' USING ERRCODE='22023';
  END IF;
  v_reason := trim(coalesce(p_reason, ''));
  IF length(v_reason) NOT BETWEEN 8 AND 256 OR v_reason ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Unban reason must contain 8–256 characters' USING ERRCODE='22023';
  END IF;

  DELETE FROM game.account_bans AS b WHERE b.owner_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('unbanned', false, 'reason', 'not_found');
  END IF;

  INSERT INTO game.admin_audit_log(admin_user_id, action, target_id, reason)
  VALUES (auth.uid(), 'unban_player', p_user_id::text, v_reason);

  RETURN jsonb_build_object('unbanned', true, 'user_id', p_user_id::text);
END;
$$;

-- Xóa vĩnh viễn tài khoản Auth (dữ liệu game xóa theo ON DELETE CASCADE).
-- Chỉ owner; phải nhập đúng UUID; không áp dụng cho tài khoản đang là admin.
CREATE OR REPLACE FUNCTION public.hu_admin_delete_account(
  p_user_id uuid,
  p_reason text,
  p_confirm text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_role text;
  v_reason text;
  v_players bigint;
BEGIN
  v_role := public.hu_admin_role();
  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'Owner role required' USING ERRCODE='42501';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Invalid delete target' USING ERRCODE='22023';
  END IF;
  v_reason := trim(coalesce(p_reason, ''));
  IF length(v_reason) NOT BETWEEN 8 AND 256 OR v_reason ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Delete reason must contain 8–256 characters' USING ERRCODE='22023';
  END IF;
  IF lower(trim(coalesce(p_confirm, ''))) <> p_user_id::text THEN
    RAISE EXCEPTION 'Type the exact account id to confirm deletion' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p_user_id) THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'not_found');
  END IF;
  IF EXISTS (SELECT 1 FROM game.admin_users AS a WHERE a.user_id = p_user_id) THEN
    RAISE EXCEPTION 'Cannot delete an admin account; remove it from game.admin_users first' USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_players FROM game.players AS p WHERE p.owner_id = p_user_id;

  -- Audit được giữ lại (target_id là text, không FK) để còn dấu vết sau khi xóa.
  INSERT INTO game.admin_audit_log(admin_user_id, action, target_id, reason)
  VALUES (auth.uid(), 'delete_account', p_user_id::text, v_reason);

  DELETE FROM auth.users AS u WHERE u.id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'deleted', true,
    'user_id', p_user_id::text,
    'players_removed', v_players
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hu_admin_players(text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hu_admin_overview() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hu_admin_item_catalog() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hu_admin_send_mail(uuid,text,text,text,jsonb,integer,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hu_admin_ban_player(uuid,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hu_admin_unban_player(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hu_admin_delete_account(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hu_admin_players(text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hu_admin_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hu_admin_item_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hu_admin_send_mail(uuid,text,text,text,jsonb,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hu_admin_ban_player(uuid,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hu_admin_unban_player(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hu_admin_delete_account(uuid,text,text) TO authenticated;

commit;
