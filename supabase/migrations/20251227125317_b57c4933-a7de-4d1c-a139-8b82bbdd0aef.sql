-- Remove the security definer view - it's a security risk
DROP VIEW IF EXISTS public.game_players_safe;

-- The hand column in game_players is now deprecated since we use game_player_hands table
-- But to prevent data leakage, we'll add a trigger that always clears the hand column
-- when it's read by non-owners. However, a simpler solution is to ensure 
-- the application code never reads from game_players.hand and only uses game_player_hands.

-- For defense in depth, let's add a column-level security approach:
-- We'll create a function that clears hand for non-owners and use it in a computed column context

-- Actually, the safest approach: since we now use game_player_hands for secure hand storage,
-- we should ensure the game_players.hand column is never populated with real data anymore.
-- Let's add a trigger to clear it on any update

CREATE OR REPLACE FUNCTION public.clear_hand_on_game_players()
RETURNS TRIGGER AS $$
BEGIN
  -- Always set hand to empty array to prevent data leakage
  -- Real hands are stored in game_player_hands table
  NEW.hand = '[]'::jsonb;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Apply trigger to INSERT and UPDATE
DROP TRIGGER IF EXISTS clear_hand_trigger ON public.game_players;
CREATE TRIGGER clear_hand_trigger
BEFORE INSERT OR UPDATE ON public.game_players
FOR EACH ROW
EXECUTE FUNCTION public.clear_hand_on_game_players();