CREATE OR REPLACE FUNCTION public.create_game_secure(p_player_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_game_id uuid;
  v_player_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Generate a 6-char code similar to frontend (avoid ambiguous chars)
  v_code := '';
  WHILE length(v_code) < 6 LOOP
    v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random()*32)::int + 1, 1);
  END LOOP;

  INSERT INTO public.games (code, status, game_phase, message)
  VALUES (v_code, 'waiting', 'waiting', 'Waiting for players...')
  RETURNING id INTO v_game_id;

  INSERT INTO public.game_players (
    game_id,
    user_id,
    player_index,
    name,
    team,
    is_human,
    is_ready
  ) VALUES (
    v_game_id,
    auth.uid(),
    0,
    p_player_name,
    'A',
    true,
    true
  ) RETURNING id INTO v_player_id;

  RETURN jsonb_build_object(
    'success', true,
    'game_id', v_game_id,
    'game_code', v_code,
    'player_id', v_player_id,
    'player_index', 0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_game_secure(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_game_secure(text) TO authenticated;
