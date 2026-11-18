import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

const PageHeader = ({ eyebrow, title, description, actions }: PageHeaderProps) => (
  <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div className="min-w-0 flex-1">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-balance font-display text-xl font-semibold leading-tight text-foreground md:text-2xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export default PageHeader;
