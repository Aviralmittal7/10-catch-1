import { Trick, Suit, SUIT_SYMBOLS } from '@/lib/gameTypes';
import { PlayingCard } from './PlayingCard';
import { cn } from '@/lib/utils';

interface TrickAreaProps {
  currentTrick: Trick;
  trumpSuit: Suit | null;
  trumpRevealed: boolean;
}

export function TrickArea({ currentTrick, trumpSuit, trumpRevealed }: TrickAreaProps) {
  const positions = [
    'bottom-4 left-1/2 -translate-x-1/2', // Player 0 (bottom)
    'right-4 top-1/2 -translate-y-1/2',   // Player 1 (right)
    'top-4 left-1/2 -translate-x-1/2',    // Player 2 (top)
    'left-4 top-1/2 -translate-y-1/2'     // Player 3 (left)
  ];
  
  return (
    <div className="relative w-64 h-48 rounded-xl bg-felt/50 felt-surface border border-border/50">
      {/* Trump indicator */}
      {trumpRevealed && trumpSuit && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 bg-primary/20 rounded-full border border-primary/50">
          <span className="text-sm text-muted-foreground">Trump:</span>
          <span className={cn(
            'text-xl font-bold',
            (trumpSuit === 'hearts' || trumpSuit === 'diamonds') ? 'text-card-red' : 'text-foreground'
          )}>
            {SUIT_SYMBOLS[trumpSuit]}
          </span>
        </div>
      )}
      
      {/* Played cards */}
      {currentTrick.cards.map(({ playerId, card }, index) => (
        <div
          key={card.id}
          className={cn('absolute animate-card-play', positions[playerId])}
        >
          <PlayingCard card={card} size="md" />
        </div>
      ))}
      
      {currentTrick.cards.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          Play a card to start
        </div>
      )}
    </div>
  );
}
