import { supabaseAdminClient } from './supabaseAdmin.ts';
import { GeideaGateway } from './integrations.ts';

function trustedRedirect(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'merchant.geidea.net' || url.hostname.endsWith('.merchant.geidea.net')) ? url.href : null;
  } catch { return null; }
}

export async function ensureOrderPayment(orderId: string, email: string, uid: string) {
  const client = supabaseAdminClient();
  const { data: claim, error: claimError } = await client.rpc('claim_sangoub_payment', { p_order_id: orderId, p_customer_id: uid });
  if (claimError) throw new Error('PAYMENT_CLAIM_FAILED');
  if (claim?.state === 'paid') return { alreadyPaid: true };
  if (claim?.state === 'ready') return { sessionId: claim.sessionId || null, redirectUrl: claim.redirectUrl || null };
  if (claim?.state !== 'new') return { error: 'تعذر تهيئة جلسة الدفع. احتفظ برقم الطلب وتواصل مع الدعم قبل إنشاء طلب جديد.' };

  const result = await GeideaGateway.createOrderPayment({
    orderId,
    amount: Number(claim.amount),
    currency: 'EGP',
    customerEmail: email,
    customerName: String(claim.customerName || 'عميل سنجوب'),
    returnUrl: `${(process.env.APP_URL || 'https://capital-talabat.vercel.app').replace(/\/$/, '')}/checkout/success?orderId=${encodeURIComponent(orderId)}`,
  });
  const providerId = typeof result.orderId === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(result.orderId) ? result.orderId : null;
  const redirectUrl = trustedRedirect(result.redirectUrl);
  if (!result.success || (!result.sessionId && !redirectUrl) || !result.referenceId) {
    await client.rpc('finish_sangoub_payment_session', { p_order_id: orderId, p_state: 'uncertain' });
    return { error: 'لم تكتمل تهيئة الدفع. طلبك محفوظ وغير مدفوع؛ تواصل مع الدعم برقم الطلب.' };
  }
  const { data: saved, error: saveError } = await client.rpc('finish_sangoub_payment_session', {
    p_order_id: orderId, p_state: 'ready', p_reference_id: result.referenceId,
    p_provider_id: providerId, p_session_id: result.sessionId || null, p_redirect_url: redirectUrl,
  });
  if (saveError || saved !== true) return { error: 'أنشأ مزود الدفع الجلسة لكن تعذر تسجيلها؛ لا تنشئ طلبًا آخر، تواصل مع الدعم.' };
  return { sessionId: result.sessionId || null, redirectUrl };
}
