import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-muted">
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
    <p className="font-display text-base font-semibold text-foreground">{title}</p>
    <p className="mt-1.5 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
      {description}
    </p>
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

export default EmptyState;
