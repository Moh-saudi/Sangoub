export const CASH_PAYMENT_LIMIT_EGP = 100000;
export const CASH_PAYMENT_LIMIT_ERROR = 'CASH_LIMIT_EXCEEDED';
export const CASH_PAYMENT_LIMIT_MESSAGE = 'طريقة الدفع متاحة لهذا الطلب.';

export function isCashPaymentAllowed(total: number): boolean {
  return Number.isFinite(total) && total <= CASH_PAYMENT_LIMIT_EGP;
}
