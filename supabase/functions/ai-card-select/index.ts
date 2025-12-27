import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Card {
  suit: string;
  rank: string;
  id: string;
}

type AIDifficulty = 'easy' | 'medium' | 'hard';

interface GameContext {
  hand: Card[];
  leadSuit: string | null;
  trumpSuit: string | null;
  trumpRevealed: boolean;
  currentTrickCards: { playerId: number; card: Card }[];
  playerTeam: 'A' | 'B';
  teamATricks: number;
  teamBTricks: number;
  teamATens: number;
  teamBTens: number;
  completedTricksCount: number;
  difficulty: AIDifficulty;
}

const difficultySettings: Record<AIDifficulty, { temperature: number; useAI: boolean; systemPromptSuffix: string }> = {
  easy: {
    temperature: 1.0,
    useAI: false, // Use simple fallback logic
    systemPromptSuffix: '',
  },
  medium: {
    temperature: 0.5,
    useAI: true,
    systemPromptSuffix: 'Play reasonably but not perfectly. Sometimes make suboptimal moves.',
  },
  hard: {
    temperature: 0.2,
    useAI: true,
    systemPromptSuffix: 'Play optimally using advanced strategy. Analyze all possibilities.',
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const gameContext: GameContext = await req.json();
    const difficulty = gameContext.difficulty || 'medium';
    const settings = difficultySettings[difficulty];
    
    // Find playable cards
    const playableCards = getPlayableCards(gameContext);
    
    if (playableCards.length === 1) {
      // Only one option, no need to think
      return new Response(JSON.stringify({ card: playableCards[0] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Easy mode: use simple random/fallback logic
    if (!settings.useAI) {
      const easyCard = getEasyModeCard(gameContext, playableCards);
      return new Response(JSON.stringify({ card: easyCard, mode: 'easy' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured, using fallback');
      const fallbackCard = getSimpleAICard(gameContext, playableCards);
      return new Response(JSON.stringify({ card: fallbackCard, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an expert Mendikot card game AI. Mendikot is a 4-player trick-taking card game where:
- Players in teams of 2 (A vs B) sit across from each other
- Goal: Capture 3 or 4 tens to win. All 4 tens = Mendikot (bonus)
- If tens are split 2-2, team with 7+ tricks wins
- Trump suit is revealed when a player can't follow the lead suit
- Card rankings: A(high) > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2(low)
- Must follow lead suit if possible

Strategy principles:
1. Protect your tens - don't play them unless you can win or partner will
2. Try to capture opponent's tens when possible
3. If partner is winning the trick, play low cards
4. Lead with high cards to draw out opponent's trumps
5. Save trumps for capturing tens or critical tricks
6. In endgame, count remaining cards to optimize play

${settings.systemPromptSuffix}

Respond with ONLY a valid JSON object: {"cardId": "the exact card id to play", "reason": "brief explanation"}`;

    const userPrompt = `Game state:
- Your hand: ${JSON.stringify(playableCards.map(c => ({ id: c.id, display: `${c.rank} of ${c.suit}` })))}
- Lead suit: ${gameContext.leadSuit || 'None (you are leading)'}
- Trump suit: ${gameContext.trumpRevealed ? gameContext.trumpSuit : 'Not revealed yet'}
- Current trick cards: ${gameContext.currentTrickCards.length > 0 
    ? gameContext.currentTrickCards.map(c => `Player ${c.playerId}: ${c.card.rank} of ${c.card.suit}`).join(', ')
    : 'Empty (you lead)'}
- Your team: ${gameContext.playerTeam}
- Team A tricks: ${gameContext.teamATricks}, Team B tricks: ${gameContext.teamBTricks}
- Team A tens: ${gameContext.teamATens}, Team B tens: ${gameContext.teamBTens}
- Tricks played: ${gameContext.completedTricksCount}/13

Which card should you play? Consider strategy for Mendikot.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: settings.temperature,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      // Fallback to simple logic
      const fallbackCard = getSimpleAICard(gameContext, playableCards);
      return new Response(JSON.stringify({ card: fallbackCard, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', content);

    // Parse AI response
    let selectedCardId: string | null = null;
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        selectedCardId = parsed.cardId;
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
    }

    // Find the card by ID
    let selectedCard = playableCards.find(c => c.id === selectedCardId);
    
    // If AI selected invalid card, use fallback
    if (!selectedCard) {
      console.log('AI selected invalid card, using fallback');
      selectedCard = getSimpleAICard(gameContext, playableCards);
    }

    return new Response(JSON.stringify({ card: selectedCard, mode: difficulty }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in ai-card-select:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getPlayableCards(ctx: GameContext): Card[] {
  const { hand, leadSuit } = ctx;
  
  if (!leadSuit) return hand; // Leading, can play any
  
  const suitCards = hand.filter(c => c.suit === leadSuit);
  if (suitCards.length > 0) return suitCards; // Must follow suit
  
  return hand; // Can't follow, play any
}

function getEasyModeCard(ctx: GameContext, playableCards: Card[]): Card {
  // Easy mode: mostly random with slight preference for lower cards
  const shuffled = [...playableCards].sort(() => Math.random() - 0.5);
  
  // 70% chance to pick from bottom half (lower cards), 30% from top
  const rankValues: Record<string, number> = {
    'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
    '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
  };
  
  const sorted = [...playableCards].sort((a, b) => rankValues[a.rank] - rankValues[b.rank]);
  
  if (Math.random() < 0.7) {
    // Pick from lower half
    const lowerHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
    return lowerHalf[Math.floor(Math.random() * lowerHalf.length)];
  }
  
  return shuffled[0];
}

function getSimpleAICard(ctx: GameContext, playableCards: Card[]): Card {
  const rankValues: Record<string, number> = {
    'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
    '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
  };
  
  const sorted = [...playableCards].sort((a, b) => rankValues[b.rank] - rankValues[a.rank]);
  
  // Simple strategy: if leading, play mid-range; otherwise play lowest
  if (!ctx.leadSuit || ctx.currentTrickCards.length === 0) {
    return sorted[Math.floor(sorted.length / 2)];
  }
  
  return sorted[sorted.length - 1]; // Play lowest
}
