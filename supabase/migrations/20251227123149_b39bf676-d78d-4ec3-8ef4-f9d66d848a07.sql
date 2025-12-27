CREATE OR REPLACE FUNCTION public.join_game_secure(p_code text, p_player_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_game RECORD;
  v_player_count INT;
  v_player_index INT;
  v_team TEXT;
  v_player_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_game
  FROM public.games
  WHERE code = upper(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF v_game.status != 'waiting' THEN
    RAISE EXCEPTION 'Game already started';
  END IF;

  SELECT COUNT(*) INTO v_player_count
  FROM public.game_players
  WHERE game_id = v_game.id;

  IF v_player_count >= 4 THEN
    RAISE EXCEPTION 'Game is full';
  END IF;

  v_player_index := v_player_count;
  v_team := CASE WHEN (v_player_index % 2) = 0 THEN 'A' ELSE 'B' END;

  INSERT INTO public.game_players (
    game_id,
    user_id,
    player_index,
    name,
    team,
    is_human,
    is_ready
  ) VALUES (
    v_game.id,
    auth.uid(),
    v_player_index,
    p_player_name,
    v_team,
    true,
    true
  )
  RETURNING id INTO v_player_id;

  RETURN jsonb_build_object(
    'success', true,
    'game_id', v_game.id,
    'game_code', v_game.code,
    'player_id', v_player_id,
    'player_index', v_player_index,
    'team', v_team
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.join_game_secure(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_game_secure(text, text) TO authenticated;
