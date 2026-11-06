import { supabaseAdminClient } from '../../server/supabaseAdmin.ts';
import { GeideaGateway, ChatAmanGateway } from '../../server/integrations.ts';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const payload = req.body || {};
    const providerId = payload.orderId || payload.order?.orderId;
    if (typeof providerId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(providerId)) return res.status(400).json({ error: 'بيانات الدفع غير صالحة.' });
    const admin = supabaseAdminClient();
    const referenceId = payload.merchantReferenceId || payload.order?.merchantReferenceId;
    let payment: any = null;
    const metadataId = payload.metadata?.orderId || payload.order?.metadata?.orderId;
    if (typeof metadataId === 'string' && /^[0-9a-f-]{36}$/i.test(metadataId)) {
      const { data } = await admin.from('order_payments').select('*').eq('order_id', metadataId).maybeSingle();
      payment = data;
    }
    if (!payment && typeof referenceId === 'string') {
      const { data } = await admin.from('order_payments').select('*').eq('reference_id', referenceId).maybeSingle();
      payment = data;
    }
    if (!payment) {
      const { data } = await admin.from('order_payments').select('*').eq('provider_id', providerId).maybeSingle();
      payment = data;
    }
    if (!payment?.order_id || !payment.reference_id) return res.status(409).json({ error: 'الدفع يحتاج مراجعة مرجعه على الخادم.' });
    const { data: order, error: orderError } = await admin.from('orders').select('id,total_amount,payment_method,payment_status,customer_name,customer_phone,order_number').eq('id', payment.order_id).maybeSingle();
    if (orderError || !order || order.payment_method !== 'geidea') return res.status(409).json({ error: 'الدفع يحتاج مراجعة مرجعه على الخادم.' });

    const verified = await GeideaGateway.verifyOrderPayment(providerId, {
      referenceId: payment.reference_id,
      amount: Number(order.total_amount),
      currency: 'EGP',
    });
    const wasPaid = order.payment_status === 'paid';
    const { data: confirmed, error: confirmError } = await admin.rpc('confirm_sangoub_payment', {
      p_order_id: order.id, p_provider_id: providerId, p_reference_id: verified.referenceId, p_amount: verified.amount,
    });
    if (confirmError || confirmed !== true) return res.status(409).json({ error: 'لم يؤكد الخادم سداد هذا الطلب بعد.' });
    if (!wasPaid && order.customer_phone) {
      void ChatAmanGateway.sendDirectMessage(order.customer_phone,
        `تم تأكيد سداد طلب سنجوب ${order.order_number || order.id} بقيمة ${verified.amount} ج.م عبر جيديا.`).catch(() => {});
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(409).json({ error: 'لم يؤكد الخادم سداد هذا الطلب بعد.' });
  }
}
