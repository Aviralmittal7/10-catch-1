import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { GameBoard } from '@/components/game/GameBoard';
import { GameSetup } from '@/components/game/GameSetup';
import { GameRules } from '@/components/game/GameRules';
import { OnlineLobby } from '@/components/game/OnlineLobby';
import { OnlineGameBoard } from '@/components/game/OnlineGameBoard';
import { useOnlineGame } from '@/hooks/useOnlineGame';
import { Spade, Heart, Diamond, Club, Play, BookOpen, Trophy, Globe, LogOut, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import heroImage from '@/assets/hero-cards.jpg';
import type { User } from '@supabase/supabase-js';

type View = 'menu' | 'setup' | 'rules' | 'game' | 'online';

const Index = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('menu');
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const onlineGame = useOnlineGame();

  useEffect(() => {
    const guestMode = localStorage.getItem('guestMode');
    setIsGuest(guestMode === 'true');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          localStorage.removeItem('guestMode');
          setIsGuest(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleStartGame = (names: string[]) => {
    setPlayerNames(names);
    setView('game');
  };

  const handleLeaveOnline = async () => {
    await onlineGame.leaveGame();
    setView('menu');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('guestMode');
    setIsGuest(false);
    toast.success('Logged out successfully');
  };

  const handleLogin = () => {
    navigate('/auth');
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
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Auth button */}
      <nav className="absolute top-4 right-4 z-20" aria-label="User navigation">
        {user ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
            aria-label="Log out of your account"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Logout
          </Button>
        ) : isGuest ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogin}
            className="gap-2"
            aria-label="Sign in to your account"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            Sign In
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogin}
            className="gap-2"
            aria-label="Login to your account"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            Login
          </Button>
        )}
      </nav>

      {/* Hero background */}
      <div className="absolute inset-0" aria-hidden="true">
        <img src={heroImage} alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      {/* Floating suit decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <Spade className="absolute top-20 left-[10%] w-16 h-16 text-muted/20 animate-float" style={{ animationDelay: '0s' }} />
        <Heart className="absolute top-40 right-[15%] w-12 h-12 text-card-red/20 animate-float" style={{ animationDelay: '0.5s' }} />
        <Diamond className="absolute bottom-32 left-[20%] w-14 h-14 text-card-red/20 animate-float" style={{ animationDelay: '1s' }} />
        <Club className="absolute bottom-48 right-[10%] w-10 h-10 text-muted/20 animate-float" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Main content */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-16">
        {/* Logo and title */}
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6" aria-hidden="true">
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
            10 Catch
          </h1>

          <p className="text-xl text-muted-foreground max-w-md mx-auto leading-relaxed">
            The classic Indian trick-taking card game where capturing tens is everything
          </p>
        </header>

        {/* Game features */}
        <div className="grid grid-cols-3 gap-6 mb-12 max-w-lg w-full" role="list" aria-label="Game features">
          <div className="text-center" role="listitem">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-2">
              <span className="text-primary font-bold">4</span>
            </div>
            <span className="text-sm text-muted-foreground">Players</span>
          </div>
          <div className="text-center" role="listitem">
            <div className="w-12 h-12 mx-auto rounded-full bg-accent/20 flex items-center justify-center mb-2">
              <span className="text-accent font-bold">2</span>
            </div>
            <span className="text-sm text-muted-foreground">Teams</span>
          </div>
          <div className="text-center" role="listitem">
            <div className="w-12 h-12 mx-auto rounded-full bg-gold/20 flex items-center justify-center mb-2">
              <Trophy className="w-5 h-5 text-gold" aria-hidden="true" />
            </div>
            <span className="text-sm text-muted-foreground">Capture 10s</span>
          </div>
        </div>

        {/* Action buttons */}
        <nav className="flex flex-col gap-4 w-full max-w-sm" aria-label="Game options">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              size="lg"
              onClick={() => setView('setup')}
              className={cn('flex-1 h-14 text-lg gap-3', 'bg-primary hover:bg-primary/90', 'gold-glow')}
              aria-label="Play against computer opponents"
            >
              <Play className="w-5 h-5" aria-hidden="true" />
              Play vs AI
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={() => setView('online')}
              className="flex-1 h-14 text-lg gap-3"
              aria-label="Play online with friends"
            >
              <Globe className="w-5 h-5" aria-hidden="true" />
              Play Online
            </Button>
          </div>

          <Button
            size="lg"
            variant="outline"
            onClick={() => setView('rules')}
            className="h-14 text-lg gap-3"
            aria-label="Learn how to play the game"
          >
            <BookOpen className="w-5 h-5" aria-hidden="true" />
            How to Play
          </Button>
        </nav>

        {/* Footer info */}
        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>A partnership game from Maharashtra & Gujarat, India</p>
        </footer>
      </section>
    </main>
  );
};

export default Index;
