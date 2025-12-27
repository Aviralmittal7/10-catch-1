import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, GameState } from '@/lib/gameTypes';

interface UseAICardSelectResult {
  getAICard: (gameState: GameState, playerId: number) => Promise<Card>;
  isThinking: boolean;
}

export function useAICardSelect(): UseAICardSelectResult {
  const [isThinking, setIsThinking] = useState(false);

  const getAICard = useCallback(async (gameState: GameState, playerId: number): Promise<Card> => {
    const player = gameState.players[playerId];
    
    // Don't use AI for human players
    if (player.isHuman) {
      throw new Error('AI card select is not for human players');
    }

    setIsThinking(true);
    
    try {
      const gameContext = {
        hand: player.hand,
        leadSuit: gameState.currentTrick.leadSuit,
        trumpSuit: gameState.trumpSuit,
        trumpRevealed: gameState.trumpRevealed,
        currentTrickCards: gameState.currentTrick.cards,
        playerTeam: player.team,
        teamATricks: gameState.teamATricksWon,
        teamBTricks: gameState.teamBTricksWon,
        teamATens: gameState.teamATens,
        teamBTens: gameState.teamBTens,
        completedTricksCount: gameState.completedTricks.length,
      };

      const { data, error } = await supabase.functions.invoke('ai-card-select', {
        body: gameContext,
      });

      if (error) {
        console.error('AI card select error:', error);
        throw error;
      }

      if (data?.card) {
        return data.card as Card;
      }

      throw new Error('No card returned from AI');
    } catch (error) {
      console.error('Failed to get AI card, using fallback:', error);
      // Fallback: return first playable card
      return player.hand[0];
    } finally {
      setIsThinking(false);
    }
  }, []);

  return { getAICard, isThinking };
}
