import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, GameState, Player, Suit, Trick } from '@/lib/gameTypes';

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

  // Create a new game
  const createGame = useCallback(async (playerName: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const code = generateGameCode();
      
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          code,
          status: 'waiting',
          game_phase: 'waiting',
          message: 'Waiting for players...',
        })
        .select()
        .single();
      
      if (gameError) throw gameError;
      
      const { data: player, error: playerError } = await supabase
        .from('game_players')
        .insert({
          game_id: game.id,
          player_index: 0,
          name: playerName,
          team: 'A',
          is_human: true,
          is_ready: true,
        })
        .select()
        .single();
      
      if (playerError) throw playerError;
      
      setState(prev => ({
        ...prev,
        gameId: game.id,
        gameCode: code,
        playerId: player.id,
        playerIndex: 0,
        isHost: true,
        players: [{ name: playerName, team: 'A', isReady: true }],
        isLoading: false,
      }));
      
      return code;
    } catch (error: any) {
      setState(prev => ({ ...prev, isLoading: false, error: error.message }));
      return null;
    }
  }, []);

  // Join an existing game
  const joinGame = useCallback(async (gameCode: string, playerName: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('code', gameCode.toUpperCase())
        .maybeSingle();
      
      if (gameError) throw gameError;
      if (!game) throw new Error('Game not found');
      if (game.status !== 'waiting') throw new Error('Game already started');
      
      const { data: existingPlayers, error: playersError } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', game.id)
        .order('player_index');
      
      if (playersError) throw playersError;
      if (existingPlayers.length >= 4) throw new Error('Game is full');
      
      const playerIndex = existingPlayers.length;
      const team = playerIndex % 2 === 0 ? 'A' : 'B';
      
      const { data: player, error: playerError } = await supabase
        .from('game_players')
        .insert({
          game_id: game.id,
          player_index: playerIndex,
          name: playerName,
          team,
          is_human: true,
          is_ready: true,
        })
        .select()
        .single();
      
      if (playerError) throw playerError;
      
      const allPlayers = [...existingPlayers, player].map(p => ({
        name: p.name,
        team: p.team as 'A' | 'B',
        isReady: p.is_ready,
      }));
      
      setState(prev => ({
        ...prev,
        gameId: game.id,
        gameCode: game.code,
        playerId: player.id,
        playerIndex,
        isHost: false,
        players: allPlayers,
        isLoading: false,
      }));
      
      return true;
    } catch (error: any) {
      setState(prev => ({ ...prev, isLoading: false, error: error.message }));
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
      setState(prev => ({ ...prev, error: error.message }));
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
    if (!state.gameId) return;
    
    const gameChannel = supabase
      .channel(`game-${state.gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${state.gameId}` },
        async (payload) => {
          const game = payload.new as any;
          
          // Fetch players
          const { data: players } = await supabase
            .from('game_players')
            .select('*')
            .eq('game_id', state.gameId)
            .order('player_index');
          
          if (players) {
            const gameState = convertToGameState(game, players);
            setState(prev => ({
              ...prev,
              gameState,
              players: players.map(p => ({
                name: p.name,
                team: p.team as 'A' | 'B',
                isReady: p.is_ready,
              })),
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${state.gameId}` },
        async () => {
          const { data: players } = await supabase
            .from('game_players')
            .select('*')
            .eq('game_id', state.gameId)
            .order('player_index');
          
          if (players) {
            setState(prev => ({
              ...prev,
              players: players.map(p => ({
                name: p.name,
                team: p.team as 'A' | 'B',
                isReady: p.is_ready,
              })),
            }));
          }
        }
      )
      .subscribe();
    
    // Initial fetch
    (async () => {
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('id', state.gameId)
        .single();
      
      const { data: players } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', state.gameId)
        .order('player_index');
      
        if (game && players) {
        const gameState = convertToGameState(game, players);
        setState(prev => ({
          ...prev,
          gameState,
          players: players.map(p => ({
            name: p.name,
            team: p.team as 'A' | 'B',
            isReady: p.is_ready,
          })),
        }));
      }
    })();
    
    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [state.gameId]);

  return {
    ...state,
    createGame,
    joinGame,
    startGame,
    playCard,
    leaveGame,
  };
}

function convertToGameState(game: any, players: any[]): GameState {
  const currentTrick = game.current_trick as any;
  
  return {
    players: players.map((p, index) => ({
      id: index,
      name: p.name,
      team: p.team as 'A' | 'B',
      hand: (p.hand as unknown as Card[]) || [],
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
