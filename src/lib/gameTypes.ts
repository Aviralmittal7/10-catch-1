export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | 'K' | 'Q' | 'J' | '10' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  team: 'A' | 'B';
  isHuman: boolean;
}

export interface Trick {
  cards: { playerId: number; card: Card }[];
  leadSuit: Suit | null;
  winnerId: number | null;
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  trumpSuit: Suit | null;
  trumpRevealed: boolean;
  trumpCard: Card | null;
  trumpSetterIndex: number | null;
  currentTrick: Trick;
  completedTricks: { winnerId: number; cards: { playerId: number; card: Card }[] }[];
  teamATricksWon: number;
  teamBTricksWon: number;
  teamATens: number;
  teamBTens: number;
  // Unconfirmed tens tracking
  potTens: number; // Tens waiting to be confirmed
  potTensTeam: 'A' | 'B' | null; // Team that needs to confirm
  lastTrickWinner: 'A' | 'B' | null; // Track last winner for confirmation
  dealerIndex: number;
  gamePhase: 'waiting' | 'setup' | 'dealing' | 'playing' | 'trickEnd' | 'roundEnd' | 'gameEnd';
  message: string;
  winner: 'A' | 'B' | null;
  isMendikot: boolean;
  isWhitewash: boolean;
}

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

export const RANK_VALUES: Record<Rank, number> = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};
