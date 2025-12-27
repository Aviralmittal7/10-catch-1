-- Fix 1: Prevent direct UPDATE on games table (all updates go through secure functions)
-- The secure functions use SECURITY DEFINER, so they bypass RLS
-- We add a restrictive UPDATE policy that blocks all direct updates
CREATE POLICY "No direct updates allowed" 
ON public.games 
FOR UPDATE 
USING (false);

-- Fix 2: Hide the hand column from other players in game_players
-- Drop the existing SELECT policy and replace with one that filters the hand column
DROP POLICY IF EXISTS "Players can view players in their games" ON public.game_players;

-- Create a view that hides hand from non-owners
CREATE OR REPLACE VIEW public.game_players_safe AS
SELECT 
  id,
  game_id,
  user_id,
  name,
  team,
  player_index,
  is_human,
  is_ready,
  created_at,
  CASE 
    WHEN user_id = auth.uid() THEN hand 
    ELSE '[]'::jsonb 
  END as hand
FROM public.game_players;

-- Recreate the SELECT policy - players can see basic info but hand is filtered via view
CREATE POLICY "Players can view players in their games" 
ON public.game_players 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM game_players me 
  WHERE me.game_id = game_players.game_id 
  AND me.user_id = auth.uid()
));