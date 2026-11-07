import { supabaseAdminClient } from '../supabaseAdmin.ts';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdminClient()
        .from('coupons')
        .select('code, discount_type, value, min_order, title, description, starts_at, expires_at, max_uses, used_count')
        .eq('active', true);

      if (error) {
        console.warn('Error reading active coupons:', error);
        return res.status(200).json({ coupons: [] });
      }

      const now = Date.now();
      const activeCoupons = (data || []).filter((c: any) => {
        if (c.starts_at && new Date(c.starts_at).getTime() > now) return false;
        if (c.expires_at && new Date(c.expires_at).getTime() <= now) return false;
        if (c.max_uses != null && Number(c.used_count) >= Number(c.max_uses)) return false;
        return true;
      }).map((c: any) => ({
        code: String(c.code).toUpperCase(),
        discountType: c.discount_type,
        value: Number(c.value),
        minOrder: Number(c.min_order) || 0,
        title: c.title || c.code,
        description: c.description || '',
      }));

      return res.status(200).json({ coupons: activeCoupons });
    } catch (err: any) {
      return res.status(500).json({ error: 'تعذر جلب الكوبونات المتاحة' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { code, subtotal } = req.body || {};
      const cleanCode = String(code || '').trim().toUpperCase();
      if (!cleanCode) return res.status(400).json({ valid: false, message: 'يرجى إدخال كود الخصم.' });

      const { data, error } = await supabaseAdminClient()
        .from('coupons')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (error || !data) {
        return res.status(404).json({ valid: false, message: 'كود الخصم غير موجود أو غير صالح.' });
      }

      if (!data.active) {
        return res.status(400).json({ valid: false, message: 'كود الخصم غير متاح حالياً.' });
      }

      const now = Date.now();
      if (data.starts_at && new Date(data.starts_at).getTime() > now) {
        return res.status(400).json({ valid: false, message: 'كود الخصم لم يبدأ تفعيله بعد.' });
      }

      if (data.expires_at && new Date(data.expires_at).getTime() <= now) {
        return res.status(400).json({ valid: false, message: 'انتهت صلاحية كود الخصم.' });
      }

      if (data.max_uses != null && Number(data.used_count) >= Number(data.max_uses)) {
        return res.status(400).json({ valid: false, message: 'وصل كود الخصم للحد الأقصى من مرات الاستخدام.' });
      }

      const orderSubtotal = Number(subtotal) || 0;
      const minOrder = Number(data.min_order) || 0;
      if (orderSubtotal < minOrder) {
        return res.status(400).json({
          valid: false,
          message: `الحد الأدنى لتطبيق كود الخصم هو ${minOrder} ج.م (قيمة سلتك الحالية ${orderSubtotal} ج.م).`,
        });
      }

      const val = Number(data.value) || 0;
      const discount = data.discount_type === 'percent'
        ? Math.round((orderSubtotal * val) / 100)
        : Math.min(orderSubtotal, val);

      return res.status(200).json({
        valid: true,
        coupon: {
          code: data.code,
          discountType: data.discount_type,
          value: val,
          minOrder,
          title: data.title || data.code,
          description: data.description || '',
          discountAmount: discount,
        },
        message: `تم تطبيق كود الخصم (${data.code}) بنجاح ✓ وفرت ${discount} ج.م`,
      });
    } catch (err: any) {
      return res.status(500).json({ valid: false, message: 'حدث خطأ أثناء فحص كود الخصم.' });
    }
  }

  return res.status(405).json({ error: 'طريقة الطلب غير مدعومة.' });
}
