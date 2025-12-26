import { cn } from '@/lib/utils';

interface ScoreBoardProps {
  teamATricks: number;
  teamBTricks: number;
  teamATens: number;
  teamBTens: number;
}

export function ScoreBoard({ teamATricks, teamBTricks, teamATens, teamBTens }: ScoreBoardProps) {
  return (
    <div className="flex gap-6">
      <div className={cn(
        'flex flex-col items-center px-4 py-3 rounded-lg',
        'bg-accent/20 border border-accent/50'
      )}>
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Team A</span>
        <div className="flex items-baseline gap-3 mt-1">
          <div className="text-center">
            <span className="text-2xl font-bold text-accent">{teamATricks}</span>
            <span className="text-xs text-muted-foreground block">tricks</span>
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-gold">{teamATens}</span>
            <span className="text-xs text-muted-foreground block">tens</span>
          </div>
        </div>
      </div>
      
      <div className={cn(
        'flex flex-col items-center px-4 py-3 rounded-lg',
        'bg-chart-5/20 border border-chart-5/50'
      )}>
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Team B</span>
        <div className="flex items-baseline gap-3 mt-1">
          <div className="text-center">
            <span className="text-2xl font-bold text-chart-5">{teamBTricks}</span>
            <span className="text-xs text-muted-foreground block">tricks</span>
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-gold">{teamBTens}</span>
            <span className="text-xs text-muted-foreground block">tens</span>
          </div>
        </div>
      </div>
    </div>
  );
}
