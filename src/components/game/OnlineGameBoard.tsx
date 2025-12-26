import { useCallback } from 'react';
import { GameState, Card } from '@/lib/gameTypes';
import { canPlayCard } from '@/lib/gameLogic';
import { PlayerHand } from './PlayerHand';
import { TrickArea } from './TrickArea';
import { ScoreBoard } from './ScoreBoard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Trophy } from 'lucide-react';

interface OnlineGameBoardProps {
  gameState: GameState;
  playerIndex: number;
  onPlayCard: (card: Card) => Promise<boolean>;
  onLeave: () => void;
}

export function OnlineGameBoard({
  gameState,
  playerIndex,
  onPlayCard,
  onLeave,
}: OnlineGameBoardProps) {
  // Reorder players so current player is at bottom
  const reorderedPlayers = [
    gameState.players[playerIndex],
    gameState.players[(playerIndex + 1) % 4],
    gameState.players[(playerIndex + 2) % 4],
    gameState.players[(playerIndex + 3) % 4],
  ];

  const handleCardClick = useCallback(
    async (card: Card) => {
      const isMyTurn = gameState.currentPlayerIndex === playerIndex;
      const myHand = gameState.players[playerIndex].hand;

      if (
        isMyTurn &&
        gameState.gamePhase === 'playing' &&
        canPlayCard(
          card,
          myHand,
          gameState.currentTrick.leadSuit,
          gameState.trumpSuit,
          gameState.trumpRevealed
        )
      ) {
        await onPlayCard(card);
      }
    },
    [gameState, playerIndex, onPlayCard]
  );

  // Get player position based on their relative position to current player
  const getPosition = (relativeIndex: number): 'bottom' | 'right' | 'top' | 'left' => {
    const positions: ('bottom' | 'right' | 'top' | 'left')[] = ['bottom', 'right', 'top', 'left'];
    return positions[relativeIndex];
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
        <div className="px-4 py-2 bg-card/80 backdrop-blur-sm rounded-lg border border-border">
          <span className="text-sm text-foreground">{gameState.message}</span>
        </div>
      </div>

      {/* Center trick area */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <TrickArea
          currentTrick={gameState.currentTrick}
          trumpSuit={gameState.trumpSuit}
          trumpRevealed={gameState.trumpRevealed}
        />
      </div>

      {/* Player hands - show all cards face up */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <PlayerHand
          cards={reorderedPlayers[0].hand}
          onCardClick={handleCardClick}
          isActive={gameState.currentPlayerIndex === playerIndex && gameState.gamePhase === 'playing'}
          leadSuit={gameState.currentTrick.leadSuit}
          trumpSuit={gameState.trumpSuit}
          trumpRevealed={gameState.trumpRevealed}
          showCards={true}
          position="bottom"
          playerName={reorderedPlayers[0].name}
          team={reorderedPlayers[0].team}
        />
      </div>

      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <PlayerHand
          cards={reorderedPlayers[1].hand}
          onCardClick={() => {}}
          isActive={gameState.currentPlayerIndex === (playerIndex + 1) % 4 && gameState.gamePhase === 'playing'}
          leadSuit={gameState.currentTrick.leadSuit}
          trumpSuit={gameState.trumpSuit}
          trumpRevealed={gameState.trumpRevealed}
          showCards={true}
          position="right"
          playerName={reorderedPlayers[1].name}
          team={reorderedPlayers[1].team}
        />
      </div>

      <div className="absolute top-28 left-1/2 -translate-x-1/2">
        <PlayerHand
          cards={reorderedPlayers[2].hand}
          onCardClick={() => {}}
          isActive={gameState.currentPlayerIndex === (playerIndex + 2) % 4 && gameState.gamePhase === 'playing'}
          leadSuit={gameState.currentTrick.leadSuit}
          trumpSuit={gameState.trumpSuit}
          trumpRevealed={gameState.trumpRevealed}
          showCards={true}
          position="top"
          playerName={reorderedPlayers[2].name}
          team={reorderedPlayers[2].team}
        />
      </div>

      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <PlayerHand
          cards={reorderedPlayers[3].hand}
          onCardClick={() => {}}
          isActive={gameState.currentPlayerIndex === (playerIndex + 3) % 4 && gameState.gamePhase === 'playing'}
          leadSuit={gameState.currentTrick.leadSuit}
          trumpSuit={gameState.trumpSuit}
          trumpRevealed={gameState.trumpRevealed}
          showCards={true}
          position="left"
          playerName={reorderedPlayers[3].name}
          team={reorderedPlayers[3].team}
        />
      </div>

      {/* Leave button */}
      <Button variant="outline" size="sm" onClick={onLeave} className="absolute bottom-4 left-4">
        Leave Game
      </Button>

      {/* Round end overlay */}
      {gameState.gamePhase === 'roundEnd' && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div
            className={cn(
              'flex flex-col items-center gap-6 p-8 rounded-2xl',
              'bg-card border-2 border-primary gold-glow'
            )}
          >
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
            <Button variant="outline" onClick={onLeave} className="mt-4">
              Leave Game
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
