import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Card, Suit, AIDifficulty } from '@/lib/gameTypes';
import {
  createInitialGameState,
  canPlayCard,
  determineTrickWinner,
  countTens,
  determineRoundWinner,
  getAICardToPlay,
  dealCards
} from '@/lib/gameLogic';
import { PlayerHand } from './PlayerHand';
import { TrickArea } from './TrickArea';
import { ScoreBoard } from './ScoreBoard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RotateCcw, Trophy, Brain, Loader2 } from 'lucide-react';
import { useAICardSelect } from '@/hooks/useAICardSelect';
import { toast } from 'sonner';

interface GameBoardProps {
  playerNames: string[];
  difficulty: AIDifficulty;
  onBackToMenu: () => void;
}

export function GameBoard({ playerNames, difficulty, onBackToMenu }: GameBoardProps) {
  const [gameState, setGameState] = useState<GameState>(() => 
    createInitialGameState(playerNames)
  );
  const { getAICard, isThinking } = useAICardSelect();
  const aiThinkingRef = useRef(false);
  
  const playCard = useCallback((playerId: number, card: Card) => {
    setGameState(prev => {
      const player = prev.players[playerId];
      const newHand = player.hand.filter(c => c.id !== card.id);
      
      // Check if this reveals trump (cut hukum)
      let newTrumpSuit = prev.trumpSuit;
      let newTrumpRevealed = prev.trumpRevealed;
      let newTrumpSetterIndex = prev.trumpSetterIndex;
      
      const leadSuit = prev.currentTrick.leadSuit || card.suit;
      const hasLeadSuit = player.hand.some(c => c.suit === leadSuit);
      
      if (!prev.trumpRevealed && prev.currentTrick.leadSuit && !hasLeadSuit) {
        // Player can't follow suit - their card becomes trump
        newTrumpSuit = card.suit;
        newTrumpRevealed = true;
        newTrumpSetterIndex = playerId;
      }
      
      const newCurrentTrick = {
        cards: [...prev.currentTrick.cards, { playerId, card }],
        leadSuit: prev.currentTrick.leadSuit || card.suit,
        winnerId: null
      };
      
      const newPlayers = prev.players.map((p, i) => 
        i === playerId ? { ...p, hand: newHand } : p
      );
      
      // Check if trick is complete
      if (newCurrentTrick.cards.length === 4) {
        const winnerId = determineTrickWinner(newCurrentTrick, newTrumpSuit, newTrumpRevealed);
        const trickCards = newCurrentTrick.cards; // Keep full card info with playerIds
        const tensInTrick = countTens(trickCards.map(c => c.card));
        const winnerTeam = prev.players[winnerId].team;
        
        const newCompletedTricks = [...prev.completedTricks, { winnerId, cards: trickCards }];
        const newTeamATricks = prev.teamATricksWon + (winnerTeam === 'A' ? 1 : 0);
        const newTeamBTricks = prev.teamBTricksWon + (winnerTeam === 'B' ? 1 : 0);
        
        // Handle pot tens confirmation logic
        let newTeamATens = prev.teamATens;
        let newTeamBTens = prev.teamBTens;
        let newPotTens = prev.potTens;
        let newPotTensTeam = prev.potTensTeam;
        let confirmMessage = '';
        
        // First, check if previous pot tens get confirmed or stay in pot
        if (prev.potTens > 0 && prev.potTensTeam) {
          if (winnerTeam === prev.potTensTeam) {
            // Same team wins consecutive trick - tens confirmed!
            if (winnerTeam === 'A') {
              newTeamATens += prev.potTens;
            } else {
              newTeamBTens += prev.potTens;
            }
            confirmMessage = ` (${prev.potTens} ten${prev.potTens > 1 ? 's' : ''} confirmed!)`;
            newPotTens = 0;
            newPotTensTeam = null;
          } else {
            // Opponent wins - tens remain in pot, waiting for next confirmation
            // The pot stays with original team, they need to win next trick
          }
        }
        
        // Now handle tens from this trick
        if (tensInTrick > 0) {
          // Add new tens to pot, they need confirmation
          newPotTens += tensInTrick;
          newPotTensTeam = winnerTeam;
        }
        
        // Check if round is over
        if (newCompletedTricks.length === 13) {
          // On last trick, pot tens go to whoever won the last trick
          if (newPotTens > 0 && newPotTensTeam) {
            if (winnerTeam === newPotTensTeam) {
              // Winner of last trick confirms their pot tens
              if (winnerTeam === 'A') {
                newTeamATens += newPotTens;
              } else {
                newTeamBTens += newPotTens;
              }
            }
            // If opponent won last trick, pot tens are lost (go to winner of last trick)
            else {
              if (winnerTeam === 'A') {
                newTeamATens += newPotTens;
              } else {
                newTeamBTens += newPotTens;
              }
            }
          }
          
          const result = determineRoundWinner(newTeamATens, newTeamBTens, newTeamATricks, newTeamBTricks);
          return {
            ...prev,
            players: newPlayers,
            currentTrick: { cards: [], leadSuit: null, winnerId: null },
            completedTricks: newCompletedTricks,
            teamATricksWon: newTeamATricks,
            teamBTricksWon: newTeamBTricks,
            teamATens: newTeamATens,
            teamBTens: newTeamBTens,
            potTens: 0,
            potTensTeam: null,
            lastTrickWinner: winnerTeam,
            trumpSuit: newTrumpSuit,
            trumpRevealed: newTrumpRevealed,
            trumpSetterIndex: newTrumpSetterIndex,
            gamePhase: 'roundEnd',
            winner: result.winner,
            isMendikot: result.isMendikot,
            isWhitewash: result.isWhitewash,
            message: `Team ${result.winner} wins${result.isMendikot ? ' with Mendikot!' : ''}${result.isWhitewash ? ' Whitewash!' : '!'}`
          };
        }
        
        const potMessage = newPotTens > 0 ? ` (${newPotTens} ten${newPotTens > 1 ? 's' : ''} in pot)` : '';
        
        return {
          ...prev,
          players: newPlayers,
          currentPlayerIndex: winnerId,
          currentTrick: { cards: [], leadSuit: null, winnerId: null },
          completedTricks: newCompletedTricks,
          teamATricksWon: newTeamATricks,
          teamBTricksWon: newTeamBTricks,
          teamATens: newTeamATens,
          teamBTens: newTeamBTens,
          potTens: newPotTens,
          potTensTeam: newPotTensTeam,
          lastTrickWinner: winnerTeam,
          trumpSuit: newTrumpSuit,
          trumpRevealed: newTrumpRevealed,
          trumpSetterIndex: newTrumpSetterIndex,
          gamePhase: 'trickEnd',
          message: `${prev.players[winnerId].name} wins the trick!${confirmMessage}${potMessage}`
        };
      }
      
      return {
        ...prev,
        players: newPlayers,
        currentPlayerIndex: (playerId + 1) % 4,
        currentTrick: newCurrentTrick,
        trumpSuit: newTrumpSuit,
        trumpRevealed: newTrumpRevealed,
        trumpSetterIndex: newTrumpSetterIndex,
        gamePhase: 'playing',
        message: `${prev.players[(playerId + 1) % 4].name}'s turn`
      };
    });
  }, []);
  
  // AI plays with Lovable AI for smarter decisions
  useEffect(() => {
    if (gameState.gamePhase === 'roundEnd') return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer.isHuman && gameState.gamePhase === 'playing' && !aiThinkingRef.current) {
      aiThinkingRef.current = true;
      
      const playAICard = async () => {
        try {
          // Use AI-powered card selection
          const card = await getAICard(gameState, currentPlayer.id, difficulty);
          playCard(currentPlayer.id, card);
        } catch (error) {
          console.error('AI card selection failed:', error);
          // Fallback to simple AI
          const fallbackCard = getAICardToPlay(
            currentPlayer,
            gameState.currentTrick.leadSuit,
            gameState.trumpSuit,
            gameState.trumpRevealed,
            gameState.currentTrick
          );
          playCard(currentPlayer.id, fallbackCard);
        } finally {
          aiThinkingRef.current = false;
        }
      };

      const timer = setTimeout(playAICard, 600);
      return () => {
        clearTimeout(timer);
        aiThinkingRef.current = false;
      };
    }
    
    if (gameState.gamePhase === 'trickEnd') {
      const timer = setTimeout(() => {
        setGameState(prev => ({ ...prev, gamePhase: 'playing' }));
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayerIndex, gameState.gamePhase, gameState.players, gameState.currentTrick, gameState.trumpSuit, gameState.trumpRevealed, playCard, getAICard, gameState]);
  
  const handleCardClick = (card: Card) => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.isHuman && gameState.gamePhase === 'playing') {
      if (canPlayCard(card, currentPlayer.hand, gameState.currentTrick.leadSuit, gameState.trumpSuit, gameState.trumpRevealed)) {
        playCard(currentPlayer.id, card);
      }
    }
  };
  
  const handleNewGame = () => {
    setGameState(createInitialGameState(playerNames));
  };
  
  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      {/* Felt table background */}
      <div className="absolute inset-8 rounded-3xl bg-felt felt-surface" />
      
      {/* Header */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-10">
        <ScoreBoard
          teamATricks={gameState.teamATricksWon}
          teamBTricks={gameState.teamBTricksWon}
          teamATens={gameState.teamATens}
          teamBTens={gameState.teamBTens}
          potTens={gameState.potTens}
          potTensTeam={gameState.potTensTeam}
        />
        <div className="px-4 py-2 bg-card/80 backdrop-blur-sm rounded-lg border border-border flex items-center gap-2">
          {isThinking && <Brain className="w-4 h-4 text-primary animate-pulse" />}
          <span className="text-sm text-foreground">{gameState.message}</span>
        </div>
      </div>
      
      {/* Center trick area */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <TrickArea
          currentTrick={gameState.currentTrick}
          trumpSuit={gameState.trumpSuit}
          trumpRevealed={gameState.trumpRevealed}
          lastCompletedTrick={gameState.completedTricks.length > 0 
            ? gameState.completedTricks[gameState.completedTricks.length - 1] 
            : null}
          showLastTrick={gameState.gamePhase === 'trickEnd'}
        />
      </div>
      
      {/* Player hands */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <PlayerHand
          cards={gameState.players[0].hand}
          onCardClick={handleCardClick}
          isActive={gameState.currentPlayerIndex === 0 && gameState.gamePhase === 'playing'}
          leadSuit={gameState.currentTrick.leadSuit}
          trumpSuit={gameState.trumpSuit}
          trumpRevealed={gameState.trumpRevealed}
          showCards={true}
          position="bottom"
          playerName={gameState.players[0].name}
          team={gameState.players[0].team}
        />
      </div>
      
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <PlayerHand
          cards={gameState.players[1].hand}
          onCardClick={() => {}}
          isActive={gameState.currentPlayerIndex === 1 && gameState.gamePhase === 'playing'}
          leadSuit={gameState.currentTrick.leadSuit}
          trumpSuit={gameState.trumpSuit}
          trumpRevealed={gameState.trumpRevealed}
          showCards={false}
          position="right"
          playerName={gameState.players[1].name}
          team={gameState.players[1].team}
        />
      </div>
      
      <div className="absolute top-28 left-1/2 -translate-x-1/2">
        <PlayerHand
          cards={gameState.players[2].hand}
          onCardClick={() => {}}
          isActive={gameState.currentPlayerIndex === 2 && gameState.gamePhase === 'playing'}
          leadSuit={gameState.currentTrick.leadSuit}
          trumpSuit={gameState.trumpSuit}
          trumpRevealed={gameState.trumpRevealed}
          showCards={false}
          position="top"
          playerName={gameState.players[2].name}
          team={gameState.players[2].team}
        />
      </div>
      
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <PlayerHand
          cards={gameState.players[3].hand}
          onCardClick={() => {}}
          isActive={gameState.currentPlayerIndex === 3 && gameState.gamePhase === 'playing'}
          leadSuit={gameState.currentTrick.leadSuit}
          trumpSuit={gameState.trumpSuit}
          trumpRevealed={gameState.trumpRevealed}
          showCards={false}
          position="left"
          playerName={gameState.players[3].name}
          team={gameState.players[3].team}
        />
      </div>
      
      {/* Back button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onBackToMenu}
        className="absolute bottom-4 left-4"
      >
        Back to Menu
      </Button>
      
      {/* Round end overlay */}
      {gameState.gamePhase === 'roundEnd' && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div className={cn(
            'flex flex-col items-center gap-6 p-8 rounded-2xl',
            'bg-card border-2 border-primary gold-glow'
          )}>
            <Trophy className="w-16 h-16 text-gold animate-float" />
            <h2 className="text-3xl font-serif font-bold text-foreground">
              Team {gameState.winner} Wins!
            </h2>
            {gameState.isMendikot && (
              <div className="px-4 py-2 bg-gold/20 rounded-full border border-gold">
                <span className="text-gold font-bold">🎉 MENDIKOT!</span>
              </div>
            )}
            {gameState.isWhitewash && (
              <div className="px-4 py-2 bg-accent/20 rounded-full border border-accent">
                <span className="text-accent font-bold">💫 WHITEWASH!</span>
              </div>
            )}
            <div className="flex gap-4 mt-4">
              <Button onClick={handleNewGame} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Play Again
              </Button>
              <Button variant="outline" onClick={onBackToMenu}>
                Main Menu
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
