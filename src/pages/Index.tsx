import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GameBoard } from '@/components/game/GameBoard';
import { GameSetup } from '@/components/game/GameSetup';
import { GameRules } from '@/components/game/GameRules';
import { OnlineLobby } from '@/components/game/OnlineLobby';
import { OnlineGameBoard } from '@/components/game/OnlineGameBoard';
import { useOnlineGame } from '@/hooks/useOnlineGame';
import { Spade, Heart, Diamond, Club, Play, BookOpen, Trophy, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import heroImage from '@/assets/hero-cards.jpg';

type View = 'menu' | 'setup' | 'rules' | 'game' | 'online';

const Index = () => {
  const [view, setView] = useState<View>('menu');
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  
  const onlineGame = useOnlineGame();
  
  const handleStartGame = (names: string[]) => {
    setPlayerNames(names);
    setView('game');
  };
  
  const handleLeaveOnline = async () => {
    await onlineGame.leaveGame();
    setView('menu');
  };
  
  if (view === 'setup') {
    return <GameSetup onStartGame={handleStartGame} onBack={() => setView('menu')} />;
  }
  
  if (view === 'rules') {
    return <GameRules onBack={() => setView('menu')} />;
  }
  
  if (view === 'game') {
    return <GameBoard playerNames={playerNames} onBackToMenu={() => setView('menu')} />;
  }
  
  if (view === 'online') {
    if (onlineGame.gameState && onlineGame.gameState.gamePhase !== 'waiting' && onlineGame.playerIndex !== null) {
      return (
        <OnlineGameBoard
          gameState={onlineGame.gameState}
          playerIndex={onlineGame.playerIndex}
          onPlayCard={onlineGame.playCard}
          onLeave={handleLeaveOnline}
        />
      );
    }
    
    return (
      <OnlineLobby
        onCreateGame={onlineGame.createGame}
        onJoinGame={onlineGame.joinGame}
        onStartGame={onlineGame.startGame}
        onBack={handleLeaveOnline}
        gameCode={onlineGame.gameCode}
        players={onlineGame.players}
        isHost={onlineGame.isHost}
        isLoading={onlineGame.isLoading}
        error={onlineGame.error}
      />
    );
  }
  
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Hero background */}
      <div className="absolute inset-0">
        <img 
          src={heroImage} 
          alt="Card table" 
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>
      
      {/* Floating suit decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Spade className="absolute top-20 left-[10%] w-16 h-16 text-muted/20 animate-float" style={{ animationDelay: '0s' }} />
        <Heart className="absolute top-40 right-[15%] w-12 h-12 text-card-red/20 animate-float" style={{ animationDelay: '0.5s' }} />
        <Diamond className="absolute bottom-32 left-[20%] w-14 h-14 text-card-red/20 animate-float" style={{ animationDelay: '1s' }} />
        <Club className="absolute bottom-48 right-[10%] w-10 h-10 text-muted/20 animate-float" style={{ animationDelay: '1.5s' }} />
      </div>
      
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-16">
        {/* Logo and title */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex -space-x-2">
              <div className="w-12 h-12 rounded-lg bg-foreground flex items-center justify-center card-shadow">
                <span className="text-card-red text-2xl font-bold">10</span>
              </div>
              <div className="w-12 h-12 rounded-lg bg-foreground flex items-center justify-center card-shadow rotate-6">
                <span className="text-card-black text-2xl font-bold">10</span>
              </div>
            </div>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-serif font-bold text-foreground mb-4 tracking-tight">
            Mendikot
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-md mx-auto leading-relaxed">
            The classic Indian trick-taking card game where capturing tens is everything
          </p>
        </div>
        
        {/* Game features */}
        <div className="grid grid-cols-3 gap-6 mb-12 max-w-lg w-full">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-2">
              <span className="text-primary font-bold">4</span>
            </div>
            <span className="text-sm text-muted-foreground">Players</span>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-accent/20 flex items-center justify-center mb-2">
              <span className="text-accent font-bold">2</span>
            </div>
            <span className="text-sm text-muted-foreground">Teams</span>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-gold/20 flex items-center justify-center mb-2">
              <Trophy className="w-5 h-5 text-gold" />
            </div>
            <span className="text-sm text-muted-foreground">Capture 10s</span>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              size="lg"
              onClick={() => setView('setup')}
              className={cn(
                'flex-1 h-14 text-lg gap-3',
                'bg-primary hover:bg-primary/90',
                'gold-glow'
              )}
            >
              <Play className="w-5 h-5" />
              Play vs AI
            </Button>
            
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setView('online')}
              className="flex-1 h-14 text-lg gap-3"
            >
              <Globe className="w-5 h-5" />
              Play Online
            </Button>
          </div>
          
          <Button
            size="lg"
            variant="outline"
            onClick={() => setView('rules')}
            className="h-14 text-lg gap-3"
          >
            <BookOpen className="w-5 h-5" />
            How to Play
          </Button>
        </div>
        
        {/* Footer info */}
        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>A partnership game from Maharashtra & Gujarat, India</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
