import { Card, GameState, Player, Suit, Trick, SUITS, RANKS, RANK_VALUES } from './gameTypes';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}-${suit}` });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(players: Player[]): Player[] {
  const deck = shuffleDeck(createDeck());
  const updatedPlayers = players.map((player, index) => ({
    ...player,
    hand: deck.slice(index * 13, (index + 1) * 13)
  }));
  return updatedPlayers;
}

export function canPlayCard(
  card: Card,
  hand: Card[],
  leadSuit: Suit | null,
  trumpSuit: Suit | null,
  trumpRevealed: boolean
): boolean {
  if (!leadSuit) return true;
  
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);
  if (hasLeadSuit) {
    return card.suit === leadSuit;
  }
  return true;
}

export function determineTrickWinner(
  trick: Trick,
  trumpSuit: Suit | null,
  trumpRevealed: boolean
): number {
  const { cards, leadSuit } = trick;
  if (cards.length === 0) return -1;
  
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

export function countTens(cards: Card[]): number {
  return cards.filter(card => card.rank === '10').length;
}

export function determineRoundWinner(
  teamATens: number,
  teamBTens: number,
  teamATricks: number,
  teamBTricks: number
): { winner: 'A' | 'B'; isMendikot: boolean; isWhitewash: boolean } {
  let winner: 'A' | 'B';
  let isMendikot = false;
  let isWhitewash = false;
  
  if (teamATens >= 3) {
    winner = 'A';
    isMendikot = teamATens === 4;
    isWhitewash = teamATricks === 13;
  } else if (teamBTens >= 3) {
    winner = 'B';
    isMendikot = teamBTens === 4;
    isWhitewash = teamBTricks === 13;
  } else {
    // Each team has 2 tens, winner by trick count
    winner = teamATricks >= 7 ? 'A' : 'B';
  }
  
  return { winner, isMendikot, isWhitewash };
}

export function getAICardToPlay(
  player: Player,
  leadSuit: Suit | null,
  trumpSuit: Suit | null,
  trumpRevealed: boolean,
  currentTrick: Trick
): Card {
  const playableCards = player.hand.filter(card => 
    canPlayCard(card, player.hand, leadSuit, trumpSuit, trumpRevealed)
  );
  
  if (playableCards.length === 0) return player.hand[0];
  
  // Simple AI: Play highest card if leading, lowest otherwise
  const sortedCards = [...playableCards].sort((a, b) => 
    RANK_VALUES[b.rank] - RANK_VALUES[a.rank]
  );
  
  if (!leadSuit || currentTrick.cards.length === 0) {
    // Leading - play a mid-range card
    return sortedCards[Math.floor(sortedCards.length / 2)];
  }
  
  // Following - try to win if possible, otherwise play lowest
  const followCards = sortedCards.filter(c => c.suit === leadSuit);
  if (followCards.length > 0) {
    return followCards[followCards.length - 1]; // Play lowest of suit
  }
  
  // Can't follow suit
  if (trumpRevealed && trumpSuit) {
    const trumpCards = sortedCards.filter(c => c.suit === trumpSuit);
    if (trumpCards.length > 0) {
      return trumpCards[trumpCards.length - 1]; // Play lowest trump
    }
  }
  
  return sortedCards[sortedCards.length - 1]; // Play lowest card
}

export function createInitialGameState(playerNames: string[]): GameState {
  const players: Player[] = playerNames.map((name, index) => ({
    id: index,
    name,
    hand: [],
    team: index % 2 === 0 ? 'A' : 'B',
    isHuman: index === 0
  }));
  
  return {
    players: dealCards(players),
    currentPlayerIndex: 1, // Player to dealer's right starts (dealer is 0)
    trumpSuit: null,
    trumpRevealed: false,
    trumpCard: null,
    trumpSetterIndex: null,
    currentTrick: { cards: [], leadSuit: null, winnerId: null },
    completedTricks: [],
    teamATricksWon: 0,
    teamBTricksWon: 0,
    teamATens: 0,
    teamBTens: 0,
    potTens: 0,
    potTensTeam: null,
    lastTrickWinner: null,
    dealerIndex: 0,
    gamePhase: 'playing',
    message: 'Game started! Play a card.',
    winner: null,
    isMendikot: false,
    isWhitewash: false
  };
}

export function sortHand(hand: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return RANK_VALUES[b.rank] - RANK_VALUES[a.rank];
  });
}
