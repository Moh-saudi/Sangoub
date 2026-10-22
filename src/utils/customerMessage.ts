/** Keep infrastructure diagnostics out of customer-facing messages. */
export function customerMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (!/[\u0600-\u06ff]/.test(message) || /firebase|firestore|cloudflare|\bR2\b|\bCORS\b|authentication|permission-denied|https?:\/\/|FIREBASE_|ERR_/i.test(message)) return fallback;
  return message;
}
