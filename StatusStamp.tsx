import { cn } from '@/lib/utils';

type StampTone = 'neutral' | 'primary' | 'accent' | 'destructive';

const TONE_CLASS: Record<StampTone, string> = {
  neutral: 'border-border text-muted-foreground',
  primary: 'border-primary/45 text-primary',
  accent: 'border-accent/60 text-accent',
  destructive: 'border-destructive/50 text-destructive',
};

interface StatusStampProps {
  label: string;
  tone?: StampTone;
  className?: string;
}

const StatusStamp = ({ label, tone = 'neutral', className }: StatusStampProps) => (
  <span className={cn('stamp whitespace-nowrap', TONE_CLASS[tone], className)}>{label}</span>
);

export const paymentStatusTone = (status: string): StampTone => {
  if (status === 'PAID') return 'primary';
  if (status === 'PARTIALLY_PAID') return 'accent';
  return 'destructive';
};

export default StatusStamp;
