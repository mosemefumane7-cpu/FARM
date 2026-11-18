/**
 * Receipt numbers are derived from the sale record so they stay stable across
 * reprints: RCP-YYYYMMDD-#### where #### is the zero-padded sale id.
 */
export const receiptNumber = (saleId: number, saleDate: string): string => {
  const compact = (saleDate || '').replace(/-/g, '').slice(0, 8);
  return `RCP-${compact || '00000000'}-${String(saleId).padStart(4, '0')}`;
};

export const paymentMethodLabel = (method: string): string => {
  if (method === 'MOBILE_MONEY') return 'Mobile Money';
  if (method === 'CASH') return 'Cash';
  return 'Credit';
};

export const paymentStatusLabel = (status: string): string => {
  if (status === 'PAID') return 'Paid in full';
  if (status === 'PARTIALLY_PAID') return 'Partially paid';
  return 'Unpaid';
};
