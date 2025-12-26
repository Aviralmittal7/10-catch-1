import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, GameState, Player, Suit, Trick } from '@/lib/gameTypes';
import { createDeck, shuffleDeck, dealCards } from '@/lib/gameLogic';

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

  // Start the game (host only)
  const startGame = useCallback(async () => {
    if (!state.gameId || !state.isHost) return false;
    
    try {
      // Get all players
      const { data: players, error: playersError } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', state.gameId)
        .order('player_index');
      
      if (playersError) throw playersError;
      if (players.length !== 4) throw new Error('Need 4 players to start');
      
      // Deal cards
      const deck = shuffleDeck(createDeck());
      
      for (let i = 0; i < 4; i++) {
        const hand = deck.slice(i * 13, (i + 1) * 13);
        await supabase
          .from('game_players')
          .update({ hand: hand as any })
          .eq('id', players[i].id);
      }
      
      // Update game state
      await supabase
        .from('games')
        .update({
          status: 'playing',
          game_phase: 'playing',
          current_player_index: 1,
          message: `${players[1].name}'s turn`,
        })
        .eq('id', state.gameId);
      
      return true;
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
      return false;
    }
  }, [state.gameId, state.isHost]);

  // Play a card
  const playCard = useCallback(async (card: Card) => {
    if (!state.gameId || state.playerIndex === null) return false;
    
    try {
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', state.gameId)
        .single();
      
      if (gameError) throw gameError;
      if (game.current_player_index !== state.playerIndex) return false;
      
      const { data: players, error: playersError } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', state.gameId)
        .order('player_index');
      
      if (playersError) throw playersError;
      
      const currentPlayer = players[state.playerIndex];
      const currentHand = (currentPlayer.hand as unknown as Card[]) || [];
      const newHand = currentHand.filter(c => c.id !== card.id);
      
      // Update player's hand
      await supabase
        .from('game_players')
        .update({ hand: newHand as any })
        .eq('id', currentPlayer.id);
      
      // Update current trick
      const currentTrick = game.current_trick as any;
      const leadSuit = currentTrick.leadSuit || card.suit;
      
      // Check if trump is revealed
      let trumpSuit = game.trump_suit;
      let trumpRevealed = game.trump_revealed;
      
      if (!trumpRevealed && currentTrick.leadSuit) {
        const hasLeadSuit = currentHand.some((c: Card) => c.suit === currentTrick.leadSuit);
        if (!hasLeadSuit) {
          trumpSuit = card.suit;
          trumpRevealed = true;
        }
      }
      
      const newTrickCards = [...currentTrick.cards, { playerId: state.playerIndex, card }];
      
      // Check if trick is complete
      if (newTrickCards.length === 4) {
        // Determine winner and update state
        const winnerId = determineTrickWinnerOnline(
          { cards: newTrickCards, leadSuit, winnerId: null },
          trumpSuit,
          trumpRevealed
        );
        
        const trickCards = newTrickCards.map((c: any) => c.card);
        const tensInTrick = trickCards.filter((c: Card) => c.rank === '10').length;
        const winnerTeam = players[winnerId].team;
        
        const newCompletedTricks = [...(game.completed_tricks as any[]), { winnerId, cards: trickCards }];
        const newTeamATricks = game.team_a_tricks_won + (winnerTeam === 'A' ? 1 : 0);
        const newTeamBTricks = game.team_b_tricks_won + (winnerTeam === 'B' ? 1 : 0);
        
        // Handle pot tens
        let newTeamATens = game.team_a_tens;
        let newTeamBTens = game.team_b_tens;
        let newPotTens = game.pot_tens;
        let newPotTensTeam = game.pot_tens_team;
        
        if (game.pot_tens > 0 && game.pot_tens_team) {
          if (winnerTeam === game.pot_tens_team) {
            if (winnerTeam === 'A') newTeamATens += game.pot_tens;
            else newTeamBTens += game.pot_tens;
            newPotTens = 0;
            newPotTensTeam = null;
          }
        }
        
        if (tensInTrick > 0) {
          newPotTens += tensInTrick;
          newPotTensTeam = winnerTeam;
        }
        
        // Check if round is over
        if (newCompletedTricks.length === 13) {
          if (newPotTens > 0) {
            if (winnerTeam === 'A') newTeamATens += newPotTens;
            else newTeamBTens += newPotTens;
          }
          
          const winner = newTeamATens >= 3 ? 'A' : newTeamBTens >= 3 ? 'B' : (newTeamATricks >= 7 ? 'A' : 'B');
          const isMendikot = newTeamATens === 4 || newTeamBTens === 4;
          const isWhitewash = newTeamATricks === 13 || newTeamBTricks === 13;
          
          await supabase
            .from('games')
            .update({
              current_trick: { cards: [], leadSuit: null, winnerId: null } as any,
              completed_tricks: newCompletedTricks as any,
              team_a_tricks_won: newTeamATricks,
              team_b_tricks_won: newTeamBTricks,
              team_a_tens: newTeamATens,
              team_b_tens: newTeamBTens,
              pot_tens: 0,
              pot_tens_team: null,
              last_trick_winner: winnerTeam,
              trump_suit: trumpSuit,
              trump_revealed: trumpRevealed,
              game_phase: 'roundEnd',
              status: 'finished',
              winner,
              is_mendikot: isMendikot,
              is_whitewash: isWhitewash,
              message: `Team ${winner} wins${isMendikot ? ' with Mendikot!' : ''}${isWhitewash ? ' Whitewash!' : '!'}`,
            })
            .eq('id', state.gameId);
        } else {
          await supabase
            .from('games')
            .update({
              current_player_index: winnerId,
              current_trick: { cards: [], leadSuit: null, winnerId: null } as any,
              completed_tricks: newCompletedTricks as any,
              team_a_tricks_won: newTeamATricks,
              team_b_tricks_won: newTeamBTricks,
              team_a_tens: newTeamATens,
              team_b_tens: newTeamBTens,
              pot_tens: newPotTens,
              pot_tens_team: newPotTensTeam,
              last_trick_winner: winnerTeam,
              trump_suit: trumpSuit,
              trump_revealed: trumpRevealed,
              game_phase: 'playing',
              message: `${players[winnerId].name} wins the trick!`,
            })
            .eq('id', state.gameId);
        }
      } else {
        const nextPlayerIndex = (state.playerIndex + 1) % 4;
        await supabase
          .from('games')
          .update({
            current_player_index: nextPlayerIndex,
            current_trick: { cards: newTrickCards, leadSuit, winnerId: null } as any,
            trump_suit: trumpSuit,
            trump_revealed: trumpRevealed,
            game_phase: 'playing',
            message: `${players[nextPlayerIndex].name}'s turn`,
          })
          .eq('id', state.gameId);
      }
      
      return true;
    } catch (error: any) {
      console.error('Error playing card:', error);
      return false;
    }
  }, [state.gameId, state.playerIndex]);

  // Leave game
  const leaveGame = useCallback(async () => {
    if (!state.gameId || !state.playerId) return;
    
    await supabase
      .from('game_players')
      .delete()
      .eq('id', state.playerId);
    
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

function determineTrickWinnerOnline(
  trick: { cards: { playerId: number; card: Card }[]; leadSuit: Suit | null; winnerId: number | null },
  trumpSuit: string | null,
  trumpRevealed: boolean
): number {
  const RANK_VALUES: Record<string, number> = {
    'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
    '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
  };
  
  const { cards, leadSuit } = trick;
  if (cards.length === 0) return 0;
  
  let winningPlay = cards[0];
  
  for (let i = 1; i < cards.length; i++) {
    const currentPlay = cards[i];
    const currentCard = currentPlay.card;
    const winningCard = winningPlay.card;
    
    const currentIsTrump = trumpRevealed && trumpSuit && currentCard.suit === trumpSuit;
    const winningIsTrump = trumpRevealed && trumpSuit && winningCard.suit === trumpSuit;
    
    if (currentIsTrump && !winningIsTrump) {
      winningPlay = currentPlay;
    } else if (currentIsTrump && winningIsTrump) {
      if (RANK_VALUES[currentCard.rank] > RANK_VALUES[winningCard.rank]) {
        winningPlay = currentPlay;
      }
    } else if (!currentIsTrump && !winningIsTrump) {
      if (currentCard.suit === leadSuit && winningCard.suit === leadSuit) {
        if (RANK_VALUES[currentCard.rank] > RANK_VALUES[winningCard.rank]) {
          winningPlay = currentPlay;
        }
      } else if (currentCard.suit === leadSuit) {
        winningPlay = currentPlay;
      }
    }
  }
  
  return winningPlay.playerId;
}

function convertToGameState(game: any, players: any[]): GameState {
  return {
    players: players.map((p, i) => ({
      id: i,
      name: p.name,
      hand: (p.hand as unknown as Card[]) || [],
      team: p.team as 'A' | 'B',
      isHuman: p.is_human,
    })),
    currentPlayerIndex: game.current_player_index,
    trumpSuit: game.trump_suit as Suit | null,
    trumpRevealed: game.trump_revealed,
    trumpCard: game.trump_card as Card | null,
    trumpSetterIndex: game.trump_setter_index,
    currentTrick: game.current_trick as Trick,
    completedTricks: game.completed_tricks as { winnerId: number; cards: Card[] }[],
    teamATricksWon: game.team_a_tricks_won,
    teamBTricksWon: game.team_b_tricks_won,
    teamATens: game.team_a_tens,
    teamBTens: game.team_b_tens,
    potTens: game.pot_tens,
    potTensTeam: game.pot_tens_team as 'A' | 'B' | null,
    lastTrickWinner: game.last_trick_winner as 'A' | 'B' | null,
    dealerIndex: game.dealer_index,
    gamePhase: game.game_phase as GameState['gamePhase'],
    message: game.message,
    winner: game.winner as 'A' | 'B' | null,
    isMendikot: game.is_mendikot,
    isWhitewash: game.is_whitewash,
  };
}
