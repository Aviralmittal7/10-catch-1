import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameSetupProps {
  onStartGame: (playerNames: string[]) => void;
  onBack: () => void;
}

export function GameSetup({ onStartGame, onBack }: GameSetupProps) {
  const [playerName, setPlayerName] = useState('You');
  
  const handleStart = () => {
    onStartGame([playerName, 'Bot 1', 'Partner', 'Bot 2']);
  };
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif">Game Setup</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            You'll play with your AI partner against two AI opponents
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="playerName">Your Name</Label>
            <Input
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="bg-secondary/50"
            />
          </div>
          
          <div className="space-y-3">
            <Label className="text-muted-foreground">Teams</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className={cn(
                'p-4 rounded-lg text-center',
                'bg-accent/10 border border-accent/30'
              )}>
                <div className="text-xs text-muted-foreground uppercase mb-2">Team A</div>
                <div className="font-medium">{playerName || 'You'}</div>
                <div className="text-sm text-muted-foreground">Partner (AI)</div>
              </div>
              <div className={cn(
                'p-4 rounded-lg text-center',
                'bg-chart-5/10 border border-chart-5/30'
              )}>
                <div className="text-xs text-muted-foreground uppercase mb-2">Team B</div>
                <div className="text-sm text-muted-foreground">Bot 1 (AI)</div>
                <div className="text-sm text-muted-foreground">Bot 2 (AI)</div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onBack} className="flex-1">
              Back
            </Button>
            <Button onClick={handleStart} className="flex-1 gap-2">
              <Play className="w-4 h-4" />
              Start Game
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
