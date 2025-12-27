import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, GameState, Player, Suit, Trick } from '@/lib/gameTypes';
import { toast } from 'sonner';
interface OnlineGameState {
  gameId: string | null;
  gameCode: string | null;
  playerId: string | null;
  playerIndex: number | null;
  isHost: boolean;
  players: { name: string; team: 'A' | 'B'; isReady: boolean }[];
  gameState: GameState | null;
  isLoading: boolean;
  error: string | null;
}

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function useOnlineGame() {
  const [state, setState] = useState<OnlineGameState>({
    gameId: null,
    gameCode: null,
    playerId: null,
    playerIndex: null,
    isHost: false,
    players: [],
    gameState: null,
    isLoading: false,
    error: null,
  });

  // Create a new game (authenticated)
  const createGame = useCallback(async (playerName: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.rpc('create_game_secure', {
        p_player_name: playerName,
      });

      if (error) throw error;
      if (!data?.success) throw new Error('Failed to create game');

      setState((prev) => ({
        ...prev,
        gameId: data.game_id,
        gameCode: data.game_code,
        playerId: data.player_id,
        playerIndex: data.player_index,
        isHost: true,
        players: [{ name: playerName, team: 'A', isReady: true }],
        isLoading: false,
      }));

      return data.game_code as string;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to create game';
      toast.error(errorMsg);
      setState((prev) => ({ ...prev, isLoading: false, error: errorMsg }));
      return null;
    }
  }, []);

  // Join an existing game (authenticated)
  const joinGame = useCallback(async (gameCode: string, playerName: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.rpc('join_game_secure', {
        p_code: gameCode.toUpperCase(),
        p_player_name: playerName,
      });

      if (error) throw error;
      if (!data?.success) throw new Error('Failed to join game');

      setState((prev) => ({
        ...prev,
        gameId: data.game_id,
        gameCode: data.game_code,
        playerId: data.player_id,
        playerIndex: data.player_index,
        isHost: data.player_index === 0,
        // players list will be populated by realtime fetch
        players: prev.players,
        isLoading: false,
      }));

      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to join game';
      toast.error(errorMsg);
      setState((prev) => ({ ...prev, isLoading: false, error: errorMsg }));
      return false;
    }
  }, []);

  // Start the game (host only) - uses secure server-side function
  const startGame = useCallback(async () => {
    if (!state.gameId || !state.isHost || !state.playerId) return false;
    
    try {
      const { data, error } = await supabase.rpc('start_game_secure', {
        p_game_id: state.gameId,
        p_host_player_id: state.playerId,
      });
      
      if (error) throw error;
      
      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to start game';
      toast.error(errorMsg);
      setState(prev => ({ ...prev, error: errorMsg }));
      return false;
    }
  }, [state.gameId, state.isHost, state.playerId]);

  // Play a card - uses secure server-side function
  const playCard = useCallback(async (card: Card) => {
    if (!state.gameId || state.playerIndex === null || !state.playerId) return false;
    
    try {
      const { data, error } = await supabase.rpc('play_card_secure', {
        p_game_id: state.gameId,
        p_player_id: state.playerId,
        p_card: {
          id: card.id,
          suit: card.suit,
          rank: card.rank,
        },
      });
      
      if (error) throw error;
      
      return true;
    } catch (error: any) {
      console.error('Error playing card:', error);
      toast.error('Failed to play card. Please try again.');
      return false;
    }
  }, [state.gameId, state.playerIndex, state.playerId]);

  // Leave game - uses secure server-side function
  const leaveGame = useCallback(async () => {
    if (!state.gameId || !state.playerId) return;
    
    try {
      await supabase.rpc('leave_game_secure', {
        p_game_id: state.gameId,
        p_player_id: state.playerId,
      });
    } catch (error) {
      console.error('Error leaving game:', error);
    }
    
    setState({
      gameId: null,
      gameCode: null,
      playerId: null,
      playerIndex: null,
      isHost: false,
      players: [],
      gameState: null,
      isLoading: false,
      error: null,
    });
  }, [state.gameId, state.playerId]);

  // Subscribe to game updates
  useEffect(() => {
    if (!state.gameId || !state.playerId || state.playerIndex === null) return;

    const fetchAndSet = async (gameRow?: any) => {
      const game = gameRow
        ? gameRow
        : (await supabase.from('games').select('*').eq('id', state.gameId).single()).data;

      const { data: players } = await supabase
        .from('game_players')
        .select('id, game_id, player_index, name, team, is_ready, is_human')
        .eq('game_id', state.gameId)
        .order('player_index');

      const { data: myHandRow } = await supabase
        .from('game_player_hands')
        .select('hand')
        .eq('player_id', state.playerId)
        .maybeSingle();

      if (game && players) {
        const myHand = (myHandRow?.hand as unknown as Card[]) || [];
        const gameState = convertToGameState(game, players, state.playerIndex, myHand);

        setState((prev) => ({
          ...prev,
          gameState,
          players: players.map((p) => ({
            name: p.name,
            team: p.team as 'A' | 'B',
            isReady: p.is_ready,
          })),
        }));
      }
    };

    const gameChannel = supabase
      .channel(`game-${state.gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${state.gameId}` },
        async (payload) => {
          await fetchAndSet(payload.new as any);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${state.gameId}` },
        async () => {
          await fetchAndSet();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_player_hands', filter: `player_id=eq.${state.playerId}` },
        async () => {
          await fetchAndSet();
        }
      )
      .subscribe();

    // Initial fetch
    fetchAndSet();

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [state.gameId, state.playerId, state.playerIndex]);

  return {
    ...state,
    createGame,
    joinGame,
    startGame,
    playCard,
    leaveGame,
  };
}

function convertToGameState(game: any, players: any[], myPlayerIndex: number, myHand: Card[]): GameState {
  const currentTrick = game.current_trick as any;

  return {
    players: players.map((p: any, index: number) => ({
      id: index,
      name: p.name,
      team: p.team as 'A' | 'B',
      // Never put opponents' hands into client state
      hand: index === myPlayerIndex ? myHand : [],
      isHuman: p.is_human,
    })),
    currentPlayerIndex: game.current_player_index,
    dealerIndex: game.dealer_index,
    trumpSuit: game.trump_suit as Suit | null,
    trumpRevealed: game.trump_revealed,
    trumpCard: game.trump_card as Card | null,
    trumpSetterIndex: game.trump_setter_index,
    currentTrick: {
      cards: currentTrick.cards || [],
      leadSuit: currentTrick.leadSuit as Suit | null,
      winnerId: currentTrick.winnerId,
    },
    completedTricks: (game.completed_tricks as any[]) || [],
    gamePhase: game.game_phase as any,
    teamATricksWon: game.team_a_tricks_won,
    teamBTricksWon: game.team_b_tricks_won,
    teamATens: game.team_a_tens,
    teamBTens: game.team_b_tens,
    potTens: game.pot_tens,
    potTensTeam: game.pot_tens_team as 'A' | 'B' | null,
    message: game.message,
    lastTrickWinner: game.last_trick_winner as 'A' | 'B' | null,
    isMendikot: game.is_mendikot,
    isWhitewash: game.is_whitewash,
    winner: game.winner as 'A' | 'B' | null,
  };
}
