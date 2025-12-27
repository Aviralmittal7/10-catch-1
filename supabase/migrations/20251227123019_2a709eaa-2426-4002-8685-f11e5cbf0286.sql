-- Create private hands table (hands are visible only to owning player)
CREATE TABLE IF NOT EXISTS public.game_player_hands (
  player_id UUID PRIMARY KEY REFERENCES public.game_players(id) ON DELETE CASCADE,
  hand JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_player_hands ENABLE ROW LEVEL SECURITY;

-- RLS: only authenticated owner can read/write their own hand
DROP POLICY IF EXISTS "Players can view their own hand" ON public.game_player_hands;
CREATE POLICY "Players can view their own hand"
ON public.game_player_hands
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.game_players gp
    WHERE gp.id = game_player_hands.player_id
      AND gp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Players can upsert their own hand" ON public.game_player_hands;
CREATE POLICY "Players can upsert their own hand"
ON public.game_player_hands
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.game_players gp
    WHERE gp.id = game_player_hands.player_id
      AND gp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Players can update their own hand" ON public.game_player_hands;
CREATE POLICY "Players can update their own hand"
ON public.game_player_hands
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.game_players gp
    WHERE gp.id = game_player_hands.player_id
      AND gp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.game_players gp
    WHERE gp.id = game_player_hands.player_id
      AND gp.user_id = auth.uid()
  )
);

-- Keep timestamps updated
DROP TRIGGER IF EXISTS update_game_player_hands_updated_at ON public.game_player_hands;
CREATE TRIGGER update_game_player_hands_updated_at
BEFORE UPDATE ON public.game_player_hands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tighten RLS on games & game_players (require authentication and participation)
DROP POLICY IF EXISTS "Anyone can view games" ON public.games;
DROP POLICY IF EXISTS "Anyone can create games" ON public.games;

CREATE POLICY "Authenticated users can create games"
ON public.games
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Players can view their games"
ON public.games
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.game_players gp
    WHERE gp.game_id = games.id
      AND gp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anyone can view game players" ON public.game_players;
DROP POLICY IF EXISTS "Anyone can join games" ON public.game_players;

CREATE POLICY "Authenticated users can join games"
ON public.game_players
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Players can view players in their games"
ON public.game_players
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.game_players me
    WHERE me.game_id = game_players.game_id
      AND me.user_id = auth.uid()
  )
);

CREATE POLICY "Players can update themselves while waiting"
ON public.game_players
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_players.game_id AND g.status = 'waiting')
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_players.game_id AND g.status = 'waiting')
);

CREATE POLICY "Players can delete themselves while waiting"
ON public.game_players
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_players.game_id AND g.status = 'waiting')
);

-- Update secure functions to use game_player_hands instead of game_players.hand

CREATE OR REPLACE FUNCTION public.start_game_secure(p_game_id uuid, p_host_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_game RECORD;
  v_host RECORD;
  v_deck JSONB;
  v_shuffled_deck JSONB;
  v_i INT;
  v_j INT;
  v_temp JSONB;
  v_rand INT;
  v_suits TEXT[] := ARRAY['hearts', 'diamonds', 'clubs', 'spades'];
  v_ranks TEXT[] := ARRAY['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  v_player_count INT;
  v_player RECORD;
  v_hand JSONB;
BEGIN
  -- Lock and get game
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- Verify host
  SELECT * INTO v_host FROM game_players WHERE id = p_host_player_id AND game_id = p_game_id;
  IF NOT FOUND OR v_host.player_index != 0 THEN
    RAISE EXCEPTION 'Only host can start the game';
  END IF;

  -- Verify game status
  IF v_game.status != 'waiting' THEN
    RAISE EXCEPTION 'Game already started';
  END IF;

  -- Count players
  SELECT COUNT(*) INTO v_player_count FROM game_players WHERE game_id = p_game_id;
  IF v_player_count != 4 THEN
    RAISE EXCEPTION 'Need 4 players to start';
  END IF;

  -- Create deck
  v_deck := '[]'::JSONB;
  FOR v_i IN 1..4 LOOP
    FOR v_j IN 1..13 LOOP
      v_deck := v_deck || jsonb_build_array(jsonb_build_object(
        'id', v_suits[v_i] || '-' || v_ranks[v_j],
        'suit', v_suits[v_i],
        'rank', v_ranks[v_j]
      ));
    END LOOP;
  END LOOP;

  -- Shuffle deck (Fisher-Yates)
  v_shuffled_deck := v_deck;
  FOR v_i IN REVERSE 51..1 LOOP
    v_rand := floor(random() * (v_i + 1))::INT;
    v_temp := v_shuffled_deck->v_i;
    v_shuffled_deck := jsonb_set(v_shuffled_deck, ARRAY[v_i::TEXT], v_shuffled_deck->v_rand);
    v_shuffled_deck := jsonb_set(v_shuffled_deck, ARRAY[v_rand::TEXT], v_temp);
  END LOOP;

  -- Deal cards to each player into the private hands table
  FOR v_player IN SELECT * FROM game_players WHERE game_id = p_game_id ORDER BY player_index LOOP
    v_hand := '[]'::JSONB;
    FOR v_i IN 0..12 LOOP
      v_hand := v_hand || jsonb_build_array(v_shuffled_deck->(v_player.player_index * 13 + v_i));
    END LOOP;

    INSERT INTO public.game_player_hands (player_id, hand)
    VALUES (v_player.id, v_hand)
    ON CONFLICT (player_id) DO UPDATE SET hand = EXCLUDED.hand, updated_at = now();

    -- Ensure legacy column never contains sensitive data
    UPDATE public.game_players SET hand = '[]'::jsonb WHERE id = v_player.id;
  END LOOP;

  -- Update game state
  UPDATE games SET
    status = 'playing',
    game_phase = 'playing',
    current_player_index = 1,
    message = (SELECT name FROM game_players WHERE game_id = p_game_id AND player_index = 1) || '''s turn'
  WHERE id = p_game_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.play_card_secure(p_game_id uuid, p_player_id uuid, p_card jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_game RECORD;
  v_player RECORD;
  v_current_hand JSONB;
  v_new_hand JSONB;
  v_current_trick JSONB;
  v_lead_suit TEXT;
  v_trump_suit TEXT;
  v_trump_revealed BOOLEAN;
  v_new_trick_cards JSONB;
  v_winner_id INT;
  v_winner_team TEXT;
  v_tens_in_trick INT;
  v_new_completed_tricks JSONB;
  v_new_team_a_tricks INT;
  v_new_team_b_tricks INT;
  v_new_team_a_tens INT;
  v_new_team_b_tens INT;
  v_new_pot_tens INT;
  v_new_pot_tens_team TEXT;
  v_next_player_index INT;
  v_has_lead_suit BOOLEAN;
  v_card_in_hand BOOLEAN;
  v_i INT;
  v_highest_value INT;
  v_current_value INT;
  v_rank_values JSONB;
BEGIN
  -- Validate card structure
  IF NOT validate_card(p_card) THEN
    RAISE EXCEPTION 'Invalid card structure';
  END IF;

  -- Lock and get game
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- Lock and get player
  SELECT * INTO v_player FROM game_players WHERE id = p_player_id AND game_id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found in game';
  END IF;

  -- Validate it's player's turn
  IF v_game.current_player_index != v_player.player_index THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  -- Validate game is in playing phase
  IF v_game.game_phase != 'playing' THEN
    RAISE EXCEPTION 'Game is not in playing phase';
  END IF;

  -- Lock and load player's private hand
  SELECT hand INTO v_current_hand
  FROM public.game_player_hands
  WHERE player_id = p_player_id
  FOR UPDATE;

  IF v_current_hand IS NULL THEN
    v_current_hand := '[]'::jsonb;
  END IF;

  -- Validate card is in hand
  v_card_in_hand := FALSE;
  FOR v_i IN 0..jsonb_array_length(v_current_hand) - 1 LOOP
    IF v_current_hand->v_i->>'id' = p_card->>'id' THEN
      v_card_in_hand := TRUE;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_card_in_hand THEN
    RAISE EXCEPTION 'Card not in hand';
  END IF;

  v_current_trick := v_game.current_trick;
  v_lead_suit := COALESCE(v_current_trick->>'leadSuit', p_card->>'suit');
  v_trump_suit := v_game.trump_suit;
  v_trump_revealed := v_game.trump_revealed;

  -- Check if trump should be revealed
  IF NOT v_trump_revealed AND v_current_trick->>'leadSuit' IS NOT NULL THEN
    v_has_lead_suit := FALSE;
    FOR v_i IN 0..jsonb_array_length(v_current_hand) - 1 LOOP
      IF v_current_hand->v_i->>'suit' = v_current_trick->>'leadSuit' THEN
        v_has_lead_suit := TRUE;
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_has_lead_suit THEN
      v_trump_suit := p_card->>'suit';
      v_trump_revealed := TRUE;
    END IF;
  END IF;

  -- Remove card from hand
  v_new_hand := '[]'::JSONB;
  FOR v_i IN 0..jsonb_array_length(v_current_hand) - 1 LOOP
    IF v_current_hand->v_i->>'id' != p_card->>'id' THEN
      v_new_hand := v_new_hand || jsonb_build_array(v_current_hand->v_i);
    END IF;
  END LOOP;

  -- Update player's private hand
  INSERT INTO public.game_player_hands (player_id, hand)
  VALUES (p_player_id, v_new_hand)
  ON CONFLICT (player_id) DO UPDATE SET hand = EXCLUDED.hand, updated_at = now();

  -- Trick update
  v_new_trick_cards := COALESCE(v_current_trick->'cards', '[]'::JSONB) || 
    jsonb_build_array(jsonb_build_object('playerId', v_player.player_index, 'card', p_card));

  -- Check if trick is complete (4 cards)
  IF jsonb_array_length(v_new_trick_cards) = 4 THEN
    v_rank_values := '{"A": 14, "K": 13, "Q": 12, "J": 11, "10": 10, "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2}'::JSONB;
    v_winner_id := (v_new_trick_cards->0->>'playerId')::INT;
    v_highest_value := (v_rank_values->>((v_new_trick_cards->0->'card'->>'rank')))::INT;

    FOR v_i IN 0..3 LOOP
      v_current_value := (v_rank_values->>((v_new_trick_cards->v_i->'card'->>'rank')))::INT;

      IF v_trump_revealed AND v_new_trick_cards->v_i->'card'->>'suit' = v_trump_suit THEN
        IF v_new_trick_cards->v_winner_id->'card'->>'suit' != v_trump_suit OR v_current_value > v_highest_value THEN
          v_winner_id := (v_new_trick_cards->v_i->>'playerId')::INT;
          v_highest_value := v_current_value;
        END IF;
      ELSIF v_new_trick_cards->v_i->'card'->>'suit' = v_lead_suit THEN
        IF v_new_trick_cards->v_winner_id->'card'->>'suit' != v_trump_suit AND v_current_value > v_highest_value THEN
          v_winner_id := (v_new_trick_cards->v_i->>'playerId')::INT;
          v_highest_value := v_current_value;
        END IF;
      END IF;
    END LOOP;

    v_tens_in_trick := 0;
    FOR v_i IN 0..3 LOOP
      IF v_new_trick_cards->v_i->'card'->>'rank' = '10' THEN
        v_tens_in_trick := v_tens_in_trick + 1;
      END IF;
    END LOOP;

    SELECT team INTO v_winner_team FROM game_players 
    WHERE game_id = p_game_id AND player_index = v_winner_id;

    v_new_completed_tricks := COALESCE(v_game.completed_tricks, '[]'::JSONB) || 
      jsonb_build_array(jsonb_build_object('winnerId', v_winner_id, 'cards', v_new_trick_cards));

    v_new_team_a_tricks := v_game.team_a_tricks_won + CASE WHEN v_winner_team = 'A' THEN 1 ELSE 0 END;
    v_new_team_b_tricks := v_game.team_b_tricks_won + CASE WHEN v_winner_team = 'B' THEN 1 ELSE 0 END;

    v_new_team_a_tens := v_game.team_a_tens;
    v_new_team_b_tens := v_game.team_b_tens;
    v_new_pot_tens := v_game.pot_tens;
    v_new_pot_tens_team := v_game.pot_tens_team;

    IF v_game.pot_tens > 0 AND v_game.pot_tens_team IS NOT NULL THEN
      IF v_winner_team = v_game.pot_tens_team THEN
        IF v_winner_team = 'A' THEN
          v_new_team_a_tens := v_new_team_a_tens + v_game.pot_tens;
        ELSE
          v_new_team_b_tens := v_new_team_b_tens + v_game.pot_tens;
        END IF;
        v_new_pot_tens := 0;
        v_new_pot_tens_team := NULL;
      END IF;
    END IF;

    IF v_tens_in_trick > 0 THEN
      v_new_pot_tens := v_new_pot_tens + v_tens_in_trick;
      v_new_pot_tens_team := v_winner_team;
    END IF;

    IF jsonb_array_length(v_new_completed_tricks) = 13 THEN
      IF v_new_pot_tens > 0 THEN
        IF v_winner_team = 'A' THEN
          v_new_team_a_tens := v_new_team_a_tens + v_new_pot_tens;
        ELSE
          v_new_team_b_tens := v_new_team_b_tens + v_new_pot_tens;
        END IF;
      END IF;

      UPDATE games SET
        current_trick = jsonb_build_object('cards', '[]'::JSONB, 'leadSuit', NULL, 'winnerId', NULL),
        completed_tricks = v_new_completed_tricks,
        team_a_tricks_won = v_new_team_a_tricks,
        team_b_tricks_won = v_new_team_b_tricks,
        team_a_tens = v_new_team_a_tens,
        team_b_tens = v_new_team_b_tens,
        pot_tens = 0,
        pot_tens_team = NULL,
        last_trick_winner = v_winner_team,
        trump_suit = v_trump_suit,
        trump_revealed = v_trump_revealed,
        game_phase = 'roundEnd',
        status = 'finished',
        winner = CASE 
          WHEN v_new_team_a_tens >= 3 THEN 'A'
          WHEN v_new_team_b_tens >= 3 THEN 'B'
          WHEN v_new_team_a_tricks >= 7 THEN 'A'
          ELSE 'B'
        END,
        is_mendikot = (v_new_team_a_tens = 4 OR v_new_team_b_tens = 4),
        is_whitewash = (v_new_team_a_tricks = 13 OR v_new_team_b_tricks = 13),
        message = 'Round complete!'
      WHERE id = p_game_id;
    ELSE
      UPDATE games SET
        current_player_index = v_winner_id,
        current_trick = jsonb_build_object('cards', '[]'::JSONB, 'leadSuit', NULL, 'winnerId', NULL),
        completed_tricks = v_new_completed_tricks,
        team_a_tricks_won = v_new_team_a_tricks,
        team_b_tricks_won = v_new_team_b_tricks,
        team_a_tens = v_new_team_a_tens,
        team_b_tens = v_new_team_b_tens,
        pot_tens = v_new_pot_tens,
        pot_tens_team = v_new_pot_tens_team,
        last_trick_winner = v_winner_team,
        trump_suit = v_trump_suit,
        trump_revealed = v_trump_revealed,
        game_phase = 'playing',
        message = (SELECT name FROM game_players WHERE game_id = p_game_id AND player_index = v_winner_id) || ' wins the trick!'
      WHERE id = p_game_id;
    END IF;
  ELSE
    v_next_player_index := (v_player.player_index + 1) % 4;

    UPDATE games SET
      current_player_index = v_next_player_index,
      current_trick = jsonb_build_object('cards', v_new_trick_cards, 'leadSuit', v_lead_suit, 'winnerId', NULL),
      trump_suit = v_trump_suit,
      trump_revealed = v_trump_revealed,
      game_phase = 'playing',
      message = (SELECT name FROM game_players WHERE game_id = p_game_id AND player_index = v_next_player_index) || '''s turn'
    WHERE id = p_game_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_game_secure(p_game_id uuid, p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_game RECORD;
  v_player RECORD;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  SELECT * INTO v_player FROM game_players WHERE id = p_player_id AND game_id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found in game';
  END IF;

  IF v_game.status = 'waiting' THEN
    DELETE FROM game_players WHERE id = p_player_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$function$;
