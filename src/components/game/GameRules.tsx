import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Trophy, Users, Spade, Heart } from 'lucide-react';

interface GameRulesProps {
  onBack: () => void;
}

export function GameRules({ onBack }: GameRulesProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-border bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center border-b border-border">
          <CardTitle className="text-3xl font-serif">How to Play Mendikot</CardTitle>
          <p className="text-muted-foreground mt-2">
            A classic Indian four-player partnership trick-taking game
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh] p-6">
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Teams & Setup</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Four players in two teams. Partners sit opposite each other. Each player receives 13 cards.
                  You (bottom) partner with the player across from you.
                </p>
              </section>
              
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Spade className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Playing Tricks</h3>
                </div>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• The player to dealer's right leads the first trick</li>
                  <li>• You must follow suit if possible</li>
                  <li>• If you can't follow suit, you may play any card</li>
                  <li>• Highest card of the led suit wins (unless trumped)</li>
                  <li>• Winner of each trick leads the next</li>
                </ul>
              </section>
              
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-5 h-5 text-card-red" />
                  <h3 className="text-lg font-semibold">Cut Hukum (Trump)</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  This game uses "Cut Hukum" - there's no trump at the start. The first time a player 
                  can't follow suit, the card they play becomes the trump suit for the rest of the round.
                  Trump cards beat any non-trump card.
                </p>
              </section>
              
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-gold" />
                  <h3 className="text-lg font-semibold">Winning</h3>
                </div>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    <strong className="text-foreground">The goal is to capture Tens.</strong> The team 
                    that captures 3 or 4 tens wins the round.
                  </p>
                  <p>
                    If each team has 2 tens, the team with 7 or more tricks wins.
                  </p>
                  <div className="bg-gold/10 border border-gold/30 rounded-lg p-4 mt-4">
                    <p className="font-medium text-gold">Special Victories:</p>
                    <ul className="mt-2 space-y-1">
                      <li>• <strong>Mendikot:</strong> Capture all four 10s</li>
                      <li>• <strong>Whitewash:</strong> Win all 13 tricks</li>
                    </ul>
                  </div>
                </div>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold mb-3">Card Rankings</h3>
                <p className="text-muted-foreground">
                  High to low: A → K → Q → J → 10 → 9 → 8 → 7 → 6 → 5 → 4 → 3 → 2
                </p>
              </section>
            </div>
          </ScrollArea>
          
          <div className="p-6 border-t border-border">
            <Button onClick={onBack} variant="outline" className="w-full gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Menu
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
