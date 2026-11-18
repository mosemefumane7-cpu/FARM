import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: 'default' | 'accent' | 'alert';
}

const StatCard = ({ label, value, hint, icon: Icon, tone = 'default' }: StatCardProps) => (
  <div className="paper-panel flex h-full flex-col p-4">
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          tone === 'accent' && 'text-accent',
          tone === 'alert' && 'text-destructive',
          tone === 'default' && 'text-primary/60',
        )}
      />
    </div>
    <p className="ledger-num mt-3 font-display text-xl font-semibold leading-none text-foreground md:text-2xl">
      {value}
    </p>
    {hint ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
  </div>
);

export default StatCard;
