export const CASH_PAYMENT_LIMIT_EGP = 300;
export const CASH_PAYMENT_LIMIT_ERROR = 'CASH_LIMIT_EXCEEDED';
export const CASH_PAYMENT_LIMIT_MESSAGE = 'الدفع نقدًا متاح عندما يكون إجمالي الفاتورة أقل من 300 جنيه. خفّض السلة، أو أكمل الطلب بعد تفعيل الدفع الإلكتروني.';

export function isCashPaymentAllowed(total: number): boolean {
  return Number.isFinite(total) && total < CASH_PAYMENT_LIMIT_EGP;
}
