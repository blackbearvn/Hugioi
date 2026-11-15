-- Phát thưởng qua thư cho toàn bộ tài khoản đã đăng ký.
-- Tách RPC riêng để hành động diện rộng không thể vô tình chạy qua đường gửi một người.
-- Idempotent theo (admin, request_id); audit chỉ ghi tiêu đề + số người nhận.
CREATE OR REPLACE FUNCTION public.hu_admin_send_mail_all(
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
  v_count integer;
  v_response jsonb;
  v_prior jsonb;
  v_prior_action text;
BEGIN
  v_role := public.hu_admin_role();
  IF v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501';
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

  -- Cùng khóa idempotency với gửi một người để request id không bị dùng chéo.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text || ':' || p_request_id::text, 0)
  );
  SELECT r.response, r.action
    INTO v_prior, v_prior_action
  FROM game.admin_action_receipts AS r
  WHERE r.admin_user_id = auth.uid() AND r.request_id = p_request_id;
  IF FOUND THEN
    IF v_prior_action <> 'send_mail_all' THEN
      RAISE EXCEPTION 'Request id was reused' USING ERRCODE='22023';
    END IF;
    RETURN v_prior || jsonb_build_object('replayed', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users) THEN
    RAISE EXCEPTION 'No recipient accounts' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM auth.users) > 100000 THEN
    RAISE EXCEPTION 'Too many recipient accounts' USING ERRCODE='22023';
  END IF;

  v_now_ts := clock_timestamp();
  v_now_ms := (extract(epoch FROM v_now_ts) * 1000)::bigint;
  v_expires_ms := CASE WHEN v_expires_days = 0 THEN NULL
    ELSE v_now_ms + (v_expires_days::bigint * 86400000) END;

  INSERT INTO game.account_mail
    (id, owner_id, seed_key, kind, title, body, attachments, created_at, expires_at)
  SELECT gen_random_uuid(), u.id, NULL, v_kind, v_title, v_body, v_att, v_now_ms, v_expires_ms
  FROM auth.users AS u;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO game.admin_audit_log(admin_user_id, action, target_id, reason)
  VALUES (auth.uid(), 'send_mail_all', NULL, left(v_title, 120) || ' · ' || v_count || ' tài khoản');

  v_response := jsonb_build_object(
    'sent', true,
    'all', true,
    'sent_count', v_count,
    'kind', v_kind,
    'created_at', v_now_ms,
    'expires_at', v_expires_ms,
    'attachments', v_att
  );
  INSERT INTO game.admin_action_receipts
    (admin_user_id, request_id, action, target_id, response)
  VALUES (auth.uid(), p_request_id, 'send_mail_all', NULL, v_response);

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.hu_admin_send_mail_all(text,text,text,jsonb,integer,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hu_admin_send_mail_all(text,text,text,jsonb,integer,uuid)
  TO authenticated;

COMMENT ON FUNCTION public.hu_admin_send_mail_all(text,text,text,jsonb,integer,uuid) IS
  'Phát thưởng qua thư cho toàn bộ tài khoản; chỉ admin/owner, idempotent theo request_id.';
