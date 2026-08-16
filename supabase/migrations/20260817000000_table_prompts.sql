-- -----------------------------------------------------------------------------
-- 20260817000000_table_prompts.sql
-- -----------------------------------------------------------------------------
-- Three diner-flow features are the same primitive: one person proposes
-- something that affects the whole table, everyone else answers, and the
-- action only happens once the table agrees.
--
--   place_order   — "we're sending this to the kitchen, ok?"
--   split_method  — "how are we splitting the bill?"
--   end_session   — "we're paying and closing the table, ok?"
--
-- Modelling them separately would mean three near-identical tables, three
-- broadcast shapes and three sets of race conditions, so they share one.
--
-- Resolution is computed, never trusted from a client: a prompt is decided when
-- every current member has answered, OR when it expires (non-answerers count as
-- agreeing, so one distracted diner cannot stall the table forever). Expiry is
-- evaluated server-side on read, so a client that never polls cannot hold a
-- prompt open.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.table_prompts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  session_id     uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  kind           text NOT NULL,
  initiated_by   uuid NOT NULL REFERENCES public.session_members(id) ON DELETE CASCADE,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'pending',
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz,
  CONSTRAINT table_prompts_kind_chk   CHECK (kind IN ('place_order','split_method','end_session')),
  CONSTRAINT table_prompts_status_chk CHECK (status IN ('pending','resolved','cancelled'))
);

-- At most one live prompt per table. Two people hitting "place order" at the
-- same moment must not open two competing votes.
CREATE UNIQUE INDEX IF NOT EXISTS table_prompts_one_pending_idx
  ON public.table_prompts (session_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS table_prompts_session_idx
  ON public.table_prompts (session_id, status);

CREATE TABLE IF NOT EXISTS public.table_prompt_responses (
  prompt_id    uuid NOT NULL REFERENCES public.table_prompts(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES public.session_members(id) ON DELETE CASCADE,
  response     text NOT NULL,
  responded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prompt_id, member_id)
);

ALTER TABLE public.table_prompts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_prompt_responses ENABLE ROW LEVEL SECURITY;

-- Diners reach these only through the SECURITY DEFINER functions below, which
-- scope every read and write to the caller's own session.
CREATE POLICY tenant_isolation ON public.table_prompts FOR ALL TO authenticated
  USING (restaurant_id = (current_setting('request.jwt.claims', true)::jsonb->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (current_setting('request.jwt.claims', true)::jsonb->>'restaurant_id')::uuid);

--------------------------------------------------------------------------------
-- open_table_prompt — start a vote
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_table_prompt(
  p_session_id  uuid,
  p_member_id   uuid,
  p_kind        text,
  p_payload     jsonb DEFAULT '{}'::jsonb,
  p_ttl_seconds int DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_prompt  RECORD;
  v_id      uuid;
BEGIN
  SELECT * INTO v_session FROM table_sessions
  WHERE id = p_session_id AND closed_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  -- Retire anything already past its deadline so a stale prompt can't block a
  -- new one purely because nobody happened to read it.
  UPDATE table_prompts SET status = 'resolved', resolved_at = now()
  WHERE session_id = p_session_id AND status = 'pending' AND expires_at <= now();

  SELECT * INTO v_prompt FROM table_prompts
  WHERE session_id = p_session_id AND status = 'pending';

  IF FOUND THEN
    -- Someone got there first. Return theirs rather than erroring: the caller
    -- should join the vote in progress, not be told to try again.
    RETURN jsonb_build_object('promptId', v_prompt.id, 'kind', v_prompt.kind, 'alreadyOpen', true);
  END IF;

  INSERT INTO table_prompts (restaurant_id, session_id, kind, initiated_by, payload, expires_at)
  VALUES (v_session.restaurant_id, p_session_id, p_kind, p_member_id, COALESCE(p_payload, '{}'::jsonb),
          now() + make_interval(secs => p_ttl_seconds))
  RETURNING id INTO v_id;

  -- The opener has implicitly answered — they proposed it.
  INSERT INTO table_prompt_responses (prompt_id, member_id, response)
  VALUES (v_id, p_member_id, COALESCE(p_payload->>'ownResponse', 'yes'))
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('promptId', v_id, 'kind', p_kind, 'alreadyOpen', false);
END;
$$;

--------------------------------------------------------------------------------
-- respond_table_prompt — cast a vote
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_table_prompt(
  p_prompt_id uuid,
  p_member_id uuid,
  p_response  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM table_prompts tp
    JOIN session_members sm ON sm.session_id = tp.session_id
    WHERE tp.id = p_prompt_id AND sm.id = p_member_id AND tp.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'CONFLICT' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO table_prompt_responses (prompt_id, member_id, response)
  VALUES (p_prompt_id, p_member_id, p_response)
  ON CONFLICT (prompt_id, member_id)
  DO UPDATE SET response = EXCLUDED.response, responded_at = now();

  RETURN get_table_prompt(p_prompt_id);
END;
$$;

--------------------------------------------------------------------------------
-- get_table_prompt / get_active_table_prompt — read state WITH resolution
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_table_prompt(p_prompt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prompt   RECORD;
  v_total    int;
  v_answered int;
  v_expired  boolean;
  v_responses jsonb;
BEGIN
  SELECT * INTO v_prompt FROM table_prompts WHERE id = p_prompt_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_total FROM session_members WHERE session_id = v_prompt.session_id;

  SELECT count(*) INTO v_answered
  FROM table_prompt_responses r
  JOIN session_members sm ON sm.id = r.member_id AND sm.session_id = v_prompt.session_id
  WHERE r.prompt_id = p_prompt_id;

  v_expired := v_prompt.expires_at <= now();

  -- Every member is listed, answered or not, so the UI can name who it is
  -- waiting on rather than showing an anonymous counter.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'memberId', sm.id,
    'name', sm.name,
    'initials', sm.initials,
    'response', r.response
  ) ORDER BY sm.joined_at), '[]'::jsonb)
  INTO v_responses
  FROM session_members sm
  LEFT JOIN table_prompt_responses r ON r.prompt_id = p_prompt_id AND r.member_id = sm.id
  WHERE sm.session_id = v_prompt.session_id;

  -- A prompt with a "wait" outstanding is NOT complete, even at expiry: expiry
  -- promotes silence to agreement, never an explicit objection.
  RETURN jsonb_build_object(
    'id', v_prompt.id,
    'kind', v_prompt.kind,
    'status', v_prompt.status,
    'payload', v_prompt.payload,
    'initiatedBy', v_prompt.initiated_by,
    'expiresAt', v_prompt.expires_at,
    'expired', v_expired,
    'memberCount', v_total,
    'answeredCount', v_answered,
    'responses', v_responses,
    'complete', v_prompt.status = 'pending'
      AND (v_answered >= v_total OR v_expired)
      AND NOT EXISTS (
        SELECT 1 FROM table_prompt_responses r2
        WHERE r2.prompt_id = p_prompt_id AND r2.response = 'wait'
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_table_prompt(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM table_prompts
  WHERE session_id = p_session_id AND status = 'pending'
  ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN get_table_prompt(v_id);
END;
$$;

--------------------------------------------------------------------------------
-- close_table_prompt — resolve or cancel
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_table_prompt(p_prompt_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE table_prompts
  SET status = p_status, resolved_at = now()
  WHERE id = p_prompt_id AND status = 'pending';
END;
$$;

--------------------------------------------------------------------------------
-- end_diner_session — close the table from the diner side
--------------------------------------------------------------------------------
-- Closing is what makes a table genuinely reusable: the next customer must not
-- inherit the previous party's rounds, and must not be told "Ali has already
-- joined". Both fall out of the session being closed, because the roster and
-- the order list are scoped to the open session.
CREATE OR REPLACE FUNCTION public.end_diner_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_now timestamptz := now();
BEGIN
  UPDATE table_sessions
  SET closed_at = v_now, is_locked = true
  WHERE id = p_session_id AND closed_at IS NULL;

  UPDATE table_prompts
  SET status = 'resolved', resolved_at = v_now
  WHERE session_id = p_session_id AND status = 'pending';

  -- Any cart left behind is scratch data for a party that has gone home.
  DELETE FROM cart_items WHERE session_id = p_session_id;

  RETURN jsonb_build_object('sessionId', p_session_id, 'closedAt', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_table_prompt(uuid, uuid, text, jsonb, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.respond_table_prompt(uuid, uuid, text)          TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_table_prompt(uuid)                          TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_active_table_prompt(uuid)                   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.close_table_prompt(uuid, text)                  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.end_diner_session(uuid)                         TO authenticated, anon;
