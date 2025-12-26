-- Create games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  dealer_index INTEGER NOT NULL DEFAULT 0,
  current_player_index INTEGER NOT NULL DEFAULT 0,
  trump_suit VARCHAR(10),
  trump_revealed BOOLEAN NOT NULL DEFAULT false,
  trump_card JSONB,
  trump_setter_index INTEGER,
  current_trick JSONB NOT NULL DEFAULT '{"cards": [], "leadSuit": null, "winnerId": null}',
  completed_tricks JSONB NOT NULL DEFAULT '[]',
  team_a_tricks_won INTEGER NOT NULL DEFAULT 0,
  team_b_tricks_won INTEGER NOT NULL DEFAULT 0,
  team_a_tens INTEGER NOT NULL DEFAULT 0,
  team_b_tens INTEGER NOT NULL DEFAULT 0,
  pot_tens INTEGER NOT NULL DEFAULT 0,
  pot_tens_team VARCHAR(1),
  last_trick_winner VARCHAR(1),
  game_phase VARCHAR(20) NOT NULL DEFAULT 'waiting',
  message TEXT NOT NULL DEFAULT 'Waiting for players...',
  winner VARCHAR(1),
  is_mendikot BOOLEAN NOT NULL DEFAULT false,
  is_whitewash BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create game_players table
CREATE TABLE public.game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player_index INTEGER NOT NULL,
  name VARCHAR(50) NOT NULL,
  team VARCHAR(1) NOT NULL CHECK (team IN ('A', 'B')),
  hand JSONB NOT NULL DEFAULT '[]',
  is_human BOOLEAN NOT NULL DEFAULT true,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_index)
);

-- Enable RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Games policies (public access for now since we want anyone to join)
CREATE POLICY "Anyone can view games" ON public.games FOR SELECT USING (true);
CREATE POLICY "Anyone can create games" ON public.games FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update games" ON public.games FOR UPDATE USING (true);

-- Game players policies
CREATE POLICY "Anyone can view game players" ON public.game_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join games" ON public.game_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game players" ON public.game_players FOR UPDATE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();