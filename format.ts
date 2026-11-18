import type { PackagingSize, PaymentStatus } from '@/types/types';

export const formatCurrency = (value: number | string | null | undefined): string => {
  const amount = Number(value ?? 0);
  return `M ${amount.toLocaleString('en-LS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatCompactCurrency = (value: number | string | null | undefined): string => {
  const amount = Number(value ?? 0);
  if (Math.abs(amount) >= 1_000_000) return `M ${(amount / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 10_000) return `M ${(amount / 1_000).toFixed(1)}k`;
  return formatCurrency(amount);
};

export const formatNumber = (value: number | string | null | undefined): string =>
  Number(value ?? 0).toLocaleString('en-LS');

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const packagingLabel = (size: PackagingSize | string): string => {
  switch (size) {
    case 'SMALL':
      return 'Small';
    case 'MEDIUM':
      return 'Medium';
    case 'LARGE':
      return 'Large';
    default:
      return String(size);
  }
};

export const paymentStatusLabel = (status: PaymentStatus | string): string => {
  switch (status) {
    case 'PAID':
      return 'Paid';
    case 'PARTIALLY_PAID':
      return 'Partially paid';
    case 'UNPAID':
      return 'Unpaid';
    default:
      return String(status);
  }
};

export const paymentMethodLabel = (method: string): string => {
  switch (method) {
    case 'CASH':
      return 'Cash';
    case 'MOBILE_MONEY':
      return 'Mobile money';
    case 'CREDIT':
      return 'Credit';
    default:
      return String(method);
  }
};

export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong. Please try again.';
};
