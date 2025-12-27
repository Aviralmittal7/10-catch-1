import { Card, SUIT_SYMBOLS } from '@/lib/gameTypes';
import { cn } from '@/lib/utils';

interface PlayingCardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animationDelay?: number;
}

export function PlayingCard({
  card,
  onClick,
  disabled = false,
  selected = false,
  faceDown = false,
  size = 'md',
  animationDelay = 0
}: PlayingCardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  
  const sizeClasses = {
    sm: 'w-12 h-16 text-sm',
    md: 'w-16 h-24 text-lg',
    lg: 'w-20 h-28 text-xl'
  };
  
  if (faceDown) {
    return (
      <div
        className={cn(
          sizeClasses[size],
          'rounded-lg bg-card-back card-shadow',
          'border-2 border-foreground/20',
          'flex items-center justify-center',
          'bg-gradient-to-br from-card-back to-secondary'
        )}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        <div className="w-3/4 h-3/4 rounded border border-foreground/30 bg-gradient-to-br from-primary/20 to-accent/20" />
      </div>
    );
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        sizeClasses[size],
        'rounded-lg bg-white card-shadow',
        'border-2 border-gray-300 transition-all duration-200',
        'flex flex-col items-center justify-between p-1.5',
        'font-serif font-bold',
        isRed ? 'text-red-600' : 'text-gray-900',
        selected && 'ring-2 ring-primary -translate-y-2 border-primary',
        !disabled && 'hover:-translate-y-1 hover:shadow-xl hover:border-primary/50 cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        'animate-card-deal shadow-lg'
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="self-start text-sm leading-none font-bold">
        <div className="drop-shadow-sm">{card.rank}</div>
        <div className="drop-shadow-sm">{SUIT_SYMBOLS[card.suit]}</div>
      </div>
      <div className={cn(
        'text-3xl drop-shadow-md', 
        size === 'sm' && 'text-xl', 
        size === 'lg' && 'text-4xl'
      )}>
        {SUIT_SYMBOLS[card.suit]}
      </div>
      <div className="self-end text-sm leading-none rotate-180 font-bold">
        <div className="drop-shadow-sm">{card.rank}</div>
        <div className="drop-shadow-sm">{SUIT_SYMBOLS[card.suit]}</div>
      </div>
    </button>
  );
}
