import { Card, Suit } from '@/lib/gameTypes';
import { PlayingCard } from './PlayingCard';
import { sortHand, canPlayCard } from '@/lib/gameLogic';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  isActive: boolean;
  leadSuit: Suit | null;
  trumpSuit: Suit | null;
  trumpRevealed: boolean;
  showCards?: boolean;
  position: 'bottom' | 'top' | 'left' | 'right';
  playerName: string;
  team: 'A' | 'B';
}

export function PlayerHand({
  cards,
  onCardClick,
  isActive,
  leadSuit,
  trumpSuit,
  trumpRevealed,
  showCards = true,
  position,
  playerName,
  team
}: PlayerHandProps) {
  const sortedCards = sortHand(cards);
  
  const containerClasses = {
    bottom: 'flex-row justify-center items-end',
    top: 'flex-row justify-center items-start',
    left: 'flex-col justify-center items-start',
    right: 'flex-col justify-center items-end'
  };
  
  const cardOverlap = {
    bottom: '-ml-6 first:ml-0',
    top: '-ml-6 first:ml-0',
    left: '-mt-12 first:mt-0',
    right: '-mt-12 first:mt-0'
  };
  
  return (
    <div className={cn('relative', position === 'left' || position === 'right' ? 'h-full' : 'w-full')}>
      <div className={cn(
        'absolute text-sm font-medium px-3 py-1 rounded-full',
        'bg-secondary/80 backdrop-blur-sm',
        isActive && 'animate-pulse-glow bg-primary text-primary-foreground',
        position === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-8',
        position === 'top' && 'bottom-0 left-1/2 -translate-x-1/2 translate-y-8',
        position === 'left' && 'right-0 top-1/2 -translate-y-1/2 translate-x-8',
        position === 'right' && 'left-0 top-1/2 -translate-y-1/2 -translate-x-8'
      )}>
        <span>{playerName}</span>
        <span className={cn('ml-2 text-xs', team === 'A' ? 'text-accent' : 'text-chart-5')}>
          Team {team}
        </span>
      </div>
      
      <div className={cn('flex', containerClasses[position])}>
        {sortedCards.map((card, index) => (
          <div key={card.id} className={cardOverlap[position]}>
            <PlayingCard
              card={card}
              onClick={() => onCardClick(card)}
              disabled={!isActive || !canPlayCard(card, cards, leadSuit, trumpSuit, trumpRevealed)}
              faceDown={!showCards}
              size={position === 'bottom' ? 'lg' : 'sm'}
              animationDelay={index * 50}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
