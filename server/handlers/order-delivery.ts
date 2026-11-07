import { createClient } from '@supabase/supabase-js';
import { supabaseIdentity } from '../supabaseIdentity.ts';
import { supabaseAdminClient } from '../supabaseAdmin.ts';
import { courierApprovalError } from '../../src/validation/accounts.ts';
import { mobileCors } from '../mobileCors.ts';
import { sendPushToUsers } from './notifications.ts';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tvnsqatkaqyubeznhnmu.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9ORqYV9HK0AbacKtYSRZiA_K7hcJ4yI';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const deliveryErrors: Record<string, string> = {
  ORDER_NOT_FOUND: 'الطلب غير موجود.',
  NOT_ASSIGNED: 'التسليم للمندوب المكلّف فقط.',
  ORDER_NOT_READY_FOR_DELIVERY: 'الطلب غير متاح للتسليم في حالته الحالية.',
  PICKUP_INCOMPLETE: 'لم يكتمل تأكيد استلام الطلب من جميع المتاجر.',
  OTP_UNAVAILABLE: 'رمز الاستلام غير متاح لهذا الطلب.',
  OTP_LOCKED: 'محاولات كثيرة. انتظر 15 دقيقة ثم تحقق مع العميل.',
  OTP_INVALID: 'رمز الاستلام غير صحيح.',
  CASH_AMOUNT_MISMATCH: 'أكّد تحصيل قيمة الطلب النقدية كاملة.',
  PAYMENT_NOT_CONFIRMED: 'يلزم تأكيد الدفع الإلكتروني دون تحصيل نقدي إضافي.',
};

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (mobileCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return res.status(401).json({ error: 'يرجى تسجيل الدخول.' });
  const { orderId, action, otpCode, collectedAmount } = req.body || {};
  if (typeof orderId !== 'string' || !UUID.test(orderId) || !['code', 'deliver'].includes(action))
    return res.status(400).json({ error: 'بيانات التسليم غير صالحة.' });

  try {
    const identity = await supabaseIdentity(bearer);
    if (!identity) return res.status(401).json({ error: 'جلسة الدخول غير صالحة.' });
    const user = identity.actor;
    if (action === 'deliver' && !user.email_verified && !user.phone_number) return res.status(403).json({ error: 'أكد حسابك أولًا.' });
    const userClient = createClient(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
    const admin = supabaseAdminClient();

    if (action === 'code') {
      const { data: order, error } = await userClient.from('orders').select('id,customer_id,status').eq('id', orderId).maybeSingle();
      if (error) return res.status(503).json({ error: 'تعذر التحقق من الطلب في Supabase.' });
      if (!order || order.customer_id !== user.uid) return res.status(403).json({ error: 'رمز الاستلام لصاحب الطلب فقط.' });
      if (['cancelled', 'delivered'].includes(order.status)) return res.status(409).json({ error: 'رمز الاستلام غير متاح لهذا الطلب.' });
      const { data: otp, error: otpError } = await admin.rpc('get_sangoub_order_otp', { p_order_id: orderId, p_customer_id: user.uid });
      if (otpError || typeof otp !== 'string') return res.status(409).json({ error: 'رمز الاستلام غير متاح لهذا الطلب.' });
      return res.status(200).json({ otpCode: otp });
    }

    if (user.role !== 'courier') return res.status(403).json({ error: 'التسليم متاح لحساب المندوب المعتمد فقط.' });
    const approvalError = courierApprovalError({ courierStatus: identity.profile?.courier_status }, identity.profile);
    if (approvalError) return res.status(403).json({ error: approvalError });
    if (typeof otpCode !== 'string' || !/^[0-9]{4}$/.test(otpCode) || typeof collectedAmount !== 'number' || !Number.isFinite(collectedAmount) || collectedAmount < 0)
      return res.status(400).json({ error: 'رمز أو قيمة تحصيل غير صالحة.' });
    const { data, error } = await admin.rpc('complete_sangoub_delivery', {
      p_order_id: orderId, p_courier_id: user.uid, p_otp: otpCode, p_collected_amount: collectedAmount,
    });
    if (error) return res.status(503).json({ error: 'تعذر تأكيد التسليم من Supabase.' });
    const status = Number(data?.status) || 503;
    if (status !== 200) return res.status(status).json({ error: deliveryErrors[data?.error] || 'تعذر تأكيد تسليم الطلب.' });

    void (async () => {
      try {
        const { data: ord } = await admin.from('orders').select('customer_id, order_number').eq('id', orderId).maybeSingle();
        if (ord?.customer_id) {
          await sendPushToUsers([ord.customer_id], {
            title: `تم توصيل طلبك بنجاح 🎉`,
            body: `شكراً لطلبك من سنجوب (طلب #${ord.order_number || ''})! نتمنى لك تجربة ممتعة، شاركنا تقييمك للطلب.`,
            type: 'operational',
            targetScreen: 'track',
            targetId: orderId,
            data: { orderId },
          });
        }
      } catch (e) {
        console.warn('Delivery completion notification failed:', e);
      }
    })();

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('Order delivery API failed:', error?.code || 'request-error');
    return res.status(503).json({ error: 'خدمة تأكيد التسليم غير متاحة حاليًا.' });
  }
}
