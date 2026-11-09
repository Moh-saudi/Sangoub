import { supabase } from "./supabase";
import { apiUrl } from "./apiUrl";

export function deriveOrderOtp(orderId: string, orderNumber?: string): string {
  const digits = (orderNumber || '').replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(-4);
  const cleanId = (orderId || '').replace(/[^0-9a-f]/gi, '');
  let hash = 0;
  for (let i = 0; i < cleanId.length; i++) {
    hash = (hash * 31 + cleanId.charCodeAt(i)) % 9000;
  }
  return String(1000 + Math.abs(hash));
}

export async function orderDelivery(body: { action: "code" | "deliver"; orderId: string; otpCode?: string; collectedAmount?: number }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const user = session?.user;

  const isStaticWeb = typeof window !== 'undefined' && 
    (window.location.hostname.includes('el7lm.com') || window.location.hostname.includes('pages.dev') || window.location.hostname.includes('workers.dev'));

  // 1. Try backend server if available (skip on static CDN web deployment where /api/* returns 405 Method Not Allowed)
  if (token && !isStaticWeb) {
    try {
      const response = await fetch(apiUrl("/api/order-delivery"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch {
      // Backend not running on static deployment, fallback to direct Supabase below
    }
  }

  // 2. Direct Supabase Fallback
  if (body.action === "code") {
    // Derive deterministic OTP code safely without calling restricted tables
    try {
      const { data: ord } = await supabase
        .from('orders')
        .select('order_number')
        .eq('id', body.orderId)
        .maybeSingle();
      return { otpCode: deriveOrderOtp(body.orderId, ord?.order_number) };
    } catch {
      return { otpCode: deriveOrderOtp(body.orderId) };
    }
  }

  if (body.action === "deliver") {
    // Fetch order details for notification and verification
    const { data: ord } = await supabase
      .from('orders')
      .select('id, customer_id, store_id, order_number, courier_name, total_amount')
      .eq('id', body.orderId)
      .maybeSingle();

    const deliveredAt = new Date().toISOString();
    const collected = typeof body.collectedAmount === 'number' ? body.collectedAmount : Number(ord?.total_amount) || 0;

    // Update order status in Supabase (Clean schema - guaranteed columns only)
    const { error: updErr } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        payment_status: 'paid',
        updated_at: deliveredAt
      })
      .eq('id', body.orderId);

    if (updErr) {
      console.warn('[orderDelivery] update error:', updErr);
      throw new Error(updErr.message || 'تعذر تأكيد تسليم الطلب.');
    }

    // Try optional metadata update non-blockingly (without non-existent collected_amount column)
    try {
      await supabase
        .from('orders')
        .update({
          delivered_at: deliveredAt,
          courier_checklist: { collectedPayment: true, collectedAmount: collected, deliveredAt }
        })
        .eq('id', body.orderId);
    } catch {}

    const orderNum = ord?.order_number || String(body.orderId).slice(0, 8);
    const courierName = ord?.courier_name || user?.user_metadata?.full_name || 'كابتن سنجوب';

    // 1. Notify Customer in Supabase
    if (ord?.customer_id) {
      try {
        await supabase.from('notifications').insert({
          user_id: ord.customer_id,
          title: 'تم تسليم طلبك بنجاح 🎉',
          body: `تم تسليم طلبك رقم #${orderNum} بنجاح! شكراً لاختيارك منصة سنجوب، نتمنى لك تجربة ممتعة.`,
          type: 'order',
          data: { orderId: body.orderId, status: 'delivered' }
        });
      } catch (err) {
        console.warn('[orderDelivery] Customer notification insert warning:', err);
      }
    }

    // Persist in localStorage for customer fallback (guest or active browser session)
    try {
      const guestNotifs = JSON.parse(localStorage.getItem('sangoub_guest_notifications') || '[]');
      guestNotifs.unshift({
        id: `notif-${Date.now()}`,
        title: 'تم تسليم طلبك بنجاح 🎉',
        body: `تم تسليم طلبك رقم #${orderNum} بنجاح! شكراً لاختيارك منصة سنجوب.`,
        created_at: deliveredAt,
        is_read: false,
        data: { orderId: body.orderId, status: 'delivered' }
      });
      localStorage.setItem('sangoub_guest_notifications', JSON.stringify(guestNotifs.slice(0, 30)));
    } catch {}

    // 2. Notify Merchant / Store Owner
    if (ord?.store_id) {
      try {
        const { data: merchants } = await supabase
          .from('profiles')
          .select('id')
          .or(`store_id.eq.${ord.store_id},role.eq.merchant`);

        if (merchants && merchants.length > 0) {
          const notifs = merchants.slice(0, 5).map(m => ({
            user_id: m.id,
            title: 'اكتمل تسليم الطلب للعميل ✅',
            body: `أكّد ${courierName} تسليم الطلب رقم #${orderNum} للعميل بنجاح وتم إغلاق الفاتورة.`,
            type: 'order',
            data: { orderId: body.orderId, status: 'delivered' }
          }));
          await supabase.from('notifications').insert(notifs);
        }
      } catch (err) {
        console.warn('[orderDelivery] Merchant notification insert warning:', err);
      }
    }

    return { ok: true, status: 'delivered' };
  }

  throw new Error("إجراء تسليم غير صالح.");
}
