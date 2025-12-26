import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Copy, Play, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface OnlineLobbyProps {
  onCreateGame: (playerName: string) => Promise<string | null>;
  onJoinGame: (gameCode: string, playerName: string) => Promise<boolean>;
  onStartGame: () => Promise<boolean>;
  onBack: () => void;
  gameCode: string | null;
  players: { name: string; team: 'A' | 'B'; isReady: boolean }[];
  isHost: boolean;
  isLoading: boolean;
  error: string | null;
}

export function OnlineLobby({
  onCreateGame,
  onJoinGame,
  onStartGame,
  onBack,
  gameCode,
  players,
  isHost,
  isLoading,
  error,
}: OnlineLobbyProps) {
  const [playerName, setPlayerName] = useState('Player');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    const code = await onCreateGame(playerName);
    if (code) {
      toast({
        title: 'Game Created!',
        description: `Share code ${code} with friends`,
      });
    }
  };

  const handleJoin = async () => {
    const success = await onJoinGame(joinCode, playerName);
    if (success) {
      toast({
        title: 'Joined Game!',
        description: 'Waiting for host to start...',
      });
    }
  };

  const handleCopyCode = () => {
    if (gameCode) {
      navigator.clipboard.writeText(gameCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStart = async () => {
    const success = await onStartGame();
    if (!success) {
      toast({
        title: 'Cannot Start',
        description: 'Need 4 players to start the game',
        variant: 'destructive',
      });
    }
  };

  if (gameCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-serif">Game Lobby</CardTitle>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="px-4 py-2 bg-secondary rounded-lg font-mono text-xl tracking-widest">
                {gameCode}
              </div>
              <Button variant="outline" size="icon" onClick={handleCopyCode}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Share this code with friends to join
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-muted-foreground">Players ({players.length}/4)</Label>
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((index) => {
                  const player = players[index];
                  const team = index % 2 === 0 ? 'A' : 'B';
                  return (
                    <div
                      key={index}
                      className={cn(
                        'p-3 rounded-lg text-center border',
                        player
                          ? team === 'A'
                            ? 'bg-accent/10 border-accent/30'
                            : 'bg-chart-5/10 border-chart-5/30'
                          : 'bg-secondary/30 border-dashed border-muted'
                      )}
                    >
                      <div className="text-xs text-muted-foreground uppercase mb-1">
                        Team {team}
                      </div>
                      <div className="font-medium truncate">
                        {player?.name || 'Waiting...'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={onBack} className="flex-1">
                Leave
              </Button>
              {isHost && (
                <Button
                  onClick={handleStart}
                  disabled={players.length !== 4 || isLoading}
                  className="flex-1 gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Start Game
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif">Play Online</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Create a game or join with a code
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

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create Game</TabsTrigger>
              <TabsTrigger value="join">Join Game</TabsTrigger>
            </TabsList>
            <TabsContent value="create" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Create a new game and invite friends with a code
              </p>
              <Button
                onClick={handleCreate}
                disabled={!playerName.trim() || isLoading}
                className="w-full gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Create Game
              </Button>
            </TabsContent>
            <TabsContent value="join" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="gameCode">Game Code</Label>
                <Input
                  id="gameCode"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-letter code"
                  className="bg-secondary/50 font-mono tracking-widest"
                  maxLength={6}
                />
              </div>
              <Button
                onClick={handleJoin}
                disabled={!playerName.trim() || joinCode.length !== 6 || isLoading}
                className="w-full gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                Join Game
              </Button>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          <Button variant="outline" onClick={onBack} className="w-full">
            Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
