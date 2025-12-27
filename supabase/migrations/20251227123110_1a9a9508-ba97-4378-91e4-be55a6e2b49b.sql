-- Allow authenticated users to resolve a waiting game by its join code without granting broad SELECT on games
CREATE OR REPLACE FUNCTION public.get_waiting_game_by_code(p_code text)
RETURNS TABLE(id uuid, code text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.code::text, g.status::text
  FROM public.games g
  WHERE g.code = upper(p_code)
    AND g.status = 'waiting'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_waiting_game_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_waiting_game_by_code(text) TO authenticated;
