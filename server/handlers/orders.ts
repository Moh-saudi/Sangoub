import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';
import { checkoutQuoteHash } from '../checkoutQuote.ts';
import { productCandidateIds } from '../productIdentity.ts';
import { supabaseIdentity } from '../supabaseIdentity.ts';
import { supabaseAdminClient } from '../supabaseAdmin.ts';
import { ensureOrderPayment } from '../orderPayments.ts';
import { buildOrder } from '../orderBuilder.ts';
import { mobileCors } from '../mobileCors.ts';
import { GeideaGateway, ChatAmanGateway } from '../integrations.ts';
import { CASH_PAYMENT_LIMIT_ERROR, CASH_PAYMENT_LIMIT_MESSAGE } from '../../src/utils/paymentPolicy.ts';
import { sendPushToUsers } from './notifications.ts';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tvnsqatkaqyubeznhnmu.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9ORqYV9HK0AbacKtYSRZiA_K7hcJ4yI';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const appOrderStatus = (status: string) => status === 'assigned' || status === 'picked_up' ? 'with_courier'
  : status === 'pending' || status === 'accepted' ? 'received' : status;

function mapSupabaseOrder(order: any) {
  return {
    id: order.id,
    profileId: order.customer_id,
    profileName: order.customer_name || '',
    phone: order.customer_phone || '',
    courierId: order.courier_id || '',
    courierName: order.courier_name || '',
    courierPhone: order.courier_phone || '',
    storeId: order.store_id,
    storeIds: order.store_ids || [order.store_id],
    storeName: order.stores?.name || order.restaurant_name || 'متجر سنجوب',
    orderNumber: order.order_number || order.id,
    orderStatus: appOrderStatus(order.status),
    status: appOrderStatus(order.status),
    subtotal: Number(order.subtotal) || 0,
    deliveryFee: Number(order.delivery_fee) || 0,
    discount: Number(order.discount) || 0,
    tip: Number(order.tip) || 0,
    taxTotal: Number(order.tax_total) || 0,
    total: Number(order.total_amount) || 0,
    deliveryAddress: order.delivery_address || order.delivery_ministry || '',
    ministry: order.delivery_ministry || '',
    floorNumber: order.delivery_floor || '',
    roomNumber: order.delivery_room || '',
    coordinates: order.coordinates || (Number.isFinite(order.delivery_lat) && Number.isFinite(order.delivery_lng)
      ? { latitude: order.delivery_lat, longitude: order.delivery_lng } : undefined),
    paymentMethod: order.payment_method || 'cash',
    paymentStatus: order.payment_status || 'pending',
    notes: order.notes || '',
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    deliveredAt: order.delivered_at,
    items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      product: { id: item.product_id, storeId: item.store_id || order.store_id, name: item.product_name, price: Number(item.price) || 0 },
      quantity: Number(item.quantity) || 1,
      selectedOptions: item.selected_options || {},
      extraPrice: Number(item.extra_price) || 0,
      notes: item.notes || '',
    })),
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (mobileCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return res.status(401).json({ error: 'يرجى تسجيل الدخول.' });

  try {
    const identity = await supabaseIdentity(bearer);
    if (!identity) return res.status(401).json({ error: 'جلسة الدخول غير صالحة. سجّل الدخول مجددًا.' });
    const actor = identity.actor;
    if (!actor.email_verified && !actor.phone_number) return res.status(403).json({ error: 'أكد بريدك الإلكتروني أو هاتفك أولًا.' });
    const input = req.body || {};
    const userSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { Authorization: `Bearer ${bearer}` } } });

    if (input.action === 'profile-update') {
      const source = input.data;
      const limits: Record<string, number> = { fullName: 120, phone: 30, ministry: 120, floorNumber: 60, roomNumber: 80, avatarUrl: 2000 };
      if (!source || typeof source !== 'object' || Array.isArray(source) || Object.keys(source).some(key => !Object.hasOwn(limits, key) && key !== 'coordinates'))
        return res.status(400).json({ error: 'حقول ملف غير مسموحة.' });
      const profilePatch: Record<string, unknown> = {};
      const columns: Record<string, string> = { fullName: 'full_name', phone: 'phone', ministry: 'ministry', floorNumber: 'floor_number', roomNumber: 'room_number', avatarUrl: 'avatar_url' };
      for (const [key, column] of Object.entries(columns)) {
        const value = source[key];
        if (value === undefined) continue;
        if (typeof value !== 'string' || value.length > limits[key]) return res.status(400).json({ error: 'بيانات ملف غير صالحة.' });
        if (key === 'avatarUrl' && value && (!value.startsWith('https://') || value.startsWith('data:'))) return res.status(400).json({ error: 'احفظ الصورة في Cloudflare أولًا.' });
        profilePatch[column] = value.trim();
      }
      if (source.coordinates !== undefined) {
        const point = source.coordinates;
        if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180)
          return res.status(400).json({ error: 'إحداثيات غير صالحة.' });
      }
      const { data, error } = await userSupabase.from('profiles').update(profilePatch).eq('id', actor.uid).select('id').maybeSingle();
      if (error) return res.status(503).json({ error: 'تعذر تحديث الملف الشخصي في Supabase.' });
      if (!data) return res.status(409).json({ error: 'ملف الحساب غير موجود في Supabase.' });
      if (source.coordinates) {
        const { data: profile } = await userSupabase.from('profiles').select('ministry,floor_number,room_number').eq('id', actor.uid).maybeSingle();
        const { error: addressError } = await userSupabase.rpc('save_customer_address', {
          p_make_default: true,
          p_address: { title: 'عنواني', fullAddress: profilePatch.ministry || profile?.ministry || 'عنوان التوصيل', details: [profilePatch.floor_number || profile?.floor_number, profilePatch.room_number || profile?.room_number].filter(Boolean).join(' - '), coordinates: source.coordinates },
        });
        if (addressError) return res.status(503).json({ error: 'تم تحديث الملف، لكن تعذر حفظ الإحداثيات في دفتر العناوين.' });
      }
      return res.status(200).json({ ok: true });
    }

    if (input.action === 'profile-address') {
      const source = input.address;
      if (!source || typeof source !== 'object' || Array.isArray(source)) return res.status(400).json({ error: 'عنوان غير صالح.' });
      const address: Record<string, any> = {};
      for (const field of ['title','city','district','street','fullAddress','details','notes']) {
        const value = source[field] ?? '';
        if (typeof value !== 'string' || value.length > 500) return res.status(400).json({ error: 'بيانات عنوان غير صالحة.' });
        address[field] = value.trim();
      }
      if (!address.fullAddress) return res.status(400).json({ error: 'اكتب العنوان الكامل.' });
      if (source.coordinates) {
        const latitude = source.coordinates.latitude ?? source.coordinates.lat;
        const longitude = source.coordinates.longitude ?? source.coordinates.lng;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return res.status(400).json({ error: 'إحداثيات عنوان غير صالحة.' });
        address.coordinates = { latitude, longitude };
      }
      const { data, error } = await userSupabase.rpc('save_customer_address', { p_address: address, p_make_default: input.makeDefault === true });
      if (error) return res.status(503).json({ error: 'تعذر حفظ العنوان في Supabase.' });
      if (input.makeDefault === true) {
        const { error: profileError } = await userSupabase.from('profiles').update({ ministry: address.fullAddress.slice(0, 120), floor_number: address.details.slice(0, 60), room_number: address.notes.slice(0, 80) }).eq('id', actor.uid);
        if (profileError) return res.status(503).json({ error: 'حُفظ العنوان، لكن تعذر تحديث العنوان الافتراضي في الملف.' });
      }
      return res.status(200).json({ ok: true, address: data });
    }
    if (input.action === 'payment-session') {
      if (typeof input.orderId !== 'string' || !UUID.test(input.orderId)) return res.status(400).json({ error: 'مرجع الطلب غير صالح.' });
      try {
        const payment = await ensureOrderPayment(input.orderId, actor.email || '', actor.uid);
        if (payment.error) return res.status(409).json({ error: payment.error });
        return res.status(200).json(payment);
      } catch { return res.status(503).json({ error: 'تعذر متابعة جلسة الدفع من Supabase.' }); }
    }

    if (input.action === 'order-status') {
      if (typeof input.orderId !== 'string' || !UUID.test(input.orderId)) return res.status(400).json({ error: 'مرجع الطلب غير صالح.' });
      const { data: order, error } = await userSupabase.from('orders').select('*,order_items(*),stores(name,logo)').eq('id', input.orderId).maybeSingle();
      if (error) return res.status(503).json({ error: 'تعذر تحميل الطلب من Supabase.' });
      if (!order || order.customer_id !== actor.uid) return res.status(404).json({ error: 'الطلب غير موجود.' });
      const mapped = mapSupabaseOrder(order);
      let tracking = null;
      if (mapped.orderStatus === 'with_courier' && mapped.courierId) {
        const { data: location, error: locationError } = await userSupabase.from('courier_locations').select('latitude,longitude,is_online,updated_at').eq('courier_id', mapped.courierId).maybeSingle();
        if (locationError) return res.status(503).json({ error: 'تعذر تحميل موقع المندوب من Supabase.' });
        if (location) tracking = { coordinates: { latitude: location.latitude, longitude: location.longitude }, active: location.is_online, updatedAt: location.updated_at };
      }
      return res.status(200).json({ order: mapped, tracking });
    }

    if (input.action === 'customer-orders') {
      const { data, error } = await userSupabase.from('orders').select('*,order_items(*),stores(name,logo)').eq('customer_id', actor.uid).order('created_at', { ascending: false }).limit(100);
      if (error) return res.status(503).json({ error: 'تعذر تحميل سجل الطلبات من Supabase.' });
      return res.status(200).json({ orders: (data || []).map(mapSupabaseOrder) });
    }

    if (input.action !== undefined && input.action !== 'quote') return res.status(400).json({ error: 'عملية الطلب غير معروفة.' });
    if (typeof input.id !== 'string' || !/^ord-[a-f0-9-]{36}$/.test(input.id) || !Array.isArray(input.items) || !input.items.length || input.items.length > 50)
      return res.status(400).json({ error: 'بيانات الطلب غير صالحة.' });
    if (input.items.some((item: any) => typeof item?.product?.id !== 'string' || !/^[\w-]{1,128}$/.test(item.product.id)) || (input.couponCode && !/^[\w-]{1,40}$/.test(input.couponCode)))
      return res.status(400).json({ error: 'معرّف صنف أو خصم غير صالح.' });

    const candidateIds = [...new Set<string>(input.items.flatMap((item: any) => productCandidateIds(item.product.id)))].filter(id => UUID.test(id));
    if (!candidateIds.length) return res.status(400).json({ error: 'لا توجد أصناف صالحة في الطلب.' });
    const { data: productRows, error: productsError } = await userSupabase.from('products').select('*').in('id', candidateIds);
    if (productsError) return res.status(503).json({ error: 'تعذر قراءة كتالوج Supabase.' });
    const products = new Map<string, any>((productRows || []).map((row: any) => [row.id, {
      id: row.id, storeId: row.store_id, name: row.name, nameEn: row.name_en || '', description: row.description || '',
      price: Number(row.price), originalPrice: row.original_price == null ? undefined : Number(row.original_price),
      category: row.category || 'عام', inStock: row.is_available !== false, archived: Boolean(row.archived),
      imageUrl: row.image_url || '', optionGroups: row.options || [],
    }]));

    const storeIds = [...new Set<string>((productRows || []).map((row: any) => row.store_id).filter((id: unknown): id is string => typeof id === 'string' && UUID.test(id)))];
    const { data: storeRows, error: storesError } = await userSupabase.from('stores').select('*').in('id', storeIds);
    if (storesError) return res.status(503).json({ error: 'تعذر قراءة المتاجر من Supabase.' });
    const stores = new Map<string, any>((storeRows || []).map((row: any) => [row.id, {
      id: row.id, name: row.name, nameEn: row.name_en || '', type: row.type || '', category: row.category,
      status: row.status || 'closed', minOrder: Number(row.min_order) || 0, deliveryFee: Number(row.delivery_fee) || 0,
      locationInDistrict: row.location_in_district || '', commissionRate: Number(row.commission_rate) || 0, taxRate: Number(row.tax_rate) || 0,
    }]));

    let coupon: any;
    if (input.couponCode) {
      const { data, error } = await supabaseAdminClient().from('coupons').select('*').eq('code', input.couponCode).maybeSingle();
      if (error) return res.status(503).json({ error: 'تعذر التحقق من كود الخصم في Supabase.' });
      if (data && (!data.active || (data.starts_at && new Date(data.starts_at).getTime() > Date.now()) || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) || (data.max_uses != null && Number(data.used_count) >= Number(data.max_uses))))
        return res.status(409).json({ error: 'كود الخصم غير نشط أو انتهت صلاحيته.' });
      coupon = data ? { code: data.code, discountType: data.discount_type, value: Number(data.value), minOrder: Number(data.min_order), active: data.active } : undefined;
    }

    const order = buildOrder(input, actor.uid, products, stores, coupon);
    if (input.action === 'quote') return res.status(200).json({ quote: order, quoteHash: checkoutQuoteHash(order) });
    if (input.quoteHash && input.quoteHash !== checkoutQuoteHash(order)) return res.status(409).json({ error: 'تغير السعر أو رسوم التوصيل. راجع الإجمالي مرة أخرى قبل التأكيد.' });
    if (order.paymentMethod === 'geidea' && !GeideaGateway.isConfigured()) return res.status(503).json({ error: 'الدفع الإلكتروني غير متاح حاليًا؛ لم يتم إنشاء الطلب.' });

    const admin = supabaseAdminClient();
    const otp = randomInt(1000, 10000).toString();
    const { data: saved, error: saveError } = await admin.rpc('create_sangoub_order', {
      p_customer_id: actor.uid, p_request_id: input.id, p_order: order, p_items: order.items, p_otp: otp,
    });
    if (saveError) {
      if (saveError.message?.includes('ORDER_RATE_LIMIT')) return res.status(429).json({ error: 'تجاوزت عدد الطلبات اليومي. تواصل مع الدعم.' });
      if (saveError.message?.includes('COUPON_UNAVAILABLE')) return res.status(409).json({ error: 'كود الخصم لم يعد متاحًا. أعد مراجعة السلة.' });
      console.error('Supabase order create failed:', saveError.code || 'database-error');
      return res.status(503).json({ error: 'تعذر حفظ الطلب في Supabase.' });
    }
    const row = saved?.order;
    if (!row?.id) return res.status(503).json({ error: 'لم يؤكد Supabase حفظ الطلب.' });
    const publicOrder = { ...order, id: row.id, orderNumber: row.order_number || order.orderNumber, orderStatus: appOrderStatus(row.status), paymentStatus: row.payment_status, createdAt: row.created_at };
    const payment = order.paymentMethod === 'geidea' ? await ensureOrderPayment(row.id, actor.email || '', actor.uid) : null;

    if (saved.created) {
      // 1. Send push notification to the customer
      void sendPushToUsers([actor.uid], {
        title: `تم تأكيد طلبك بنجاح #${publicOrder.orderNumber} 🎉`,
        body: `طلبك قيد المراجعة لدى المتجر بقيمة ${order.total} ج.م. يمكنك متابعته لحظة بلحظة.`,
        type: 'operational',
        targetScreen: 'track',
        targetId: row.id,
        data: { orderId: row.id },
      }).catch(err => console.warn('Customer order notification failed:', err));

      // 2. Send push notification to store staff / kitchen
      void (async () => {
        try {
          const sIds = Array.isArray(order.storeIds) && order.storeIds.length ? order.storeIds : storeIds;
          if (sIds.length) {
            const { data: staff } = await admin.from('store_staff').select('user_id').in('store_id', sIds);
            const staffUids = (staff || []).map((s: any) => s.user_id).filter(Boolean);
            if (staffUids.length) {
              await sendPushToUsers(staffUids, {
                title: `طلب جديد #${publicOrder.orderNumber} 🛎️`,
                body: `وصلك طلب جديد بقيمة ${order.total} ج.م. افتح شاشة المطبخ للمراجعة.`,
                type: 'operational',
                targetScreen: 'orders',
                targetId: row.id,
                data: { orderId: row.id },
              });
            }
          }
        } catch (e) {
          console.warn('Store staff notification failed:', e);
        }
      })();

      if (order.phone) {
        void ChatAmanGateway.sendOrderConfirmation({
          phone: order.phone, customerName: order.profileName, orderNumber: publicOrder.orderNumber,
          totalAmount: order.total, currency: 'ج.م',
          deliveryAddress: `${order.ministry}${order.floorNumber ? ` - دور ${order.floorNumber}` : ''}${order.roomNumber ? ` - شقة/مكتب ${order.roomNumber}` : ''}`.trim(),
        }).catch(error => console.warn('Order confirmation delivery failed:', error?.message || 'provider-error'));
      }
    }
    return res.status(200).json({ order: publicOrder, requiresPaymentRedirect: Boolean(payment?.redirectUrl), redirectUrl: payment?.redirectUrl || null, sessionId: payment?.sessionId || null, paymentError: payment?.error || null });
  } catch (error: any) {
    if (error?.message === CASH_PAYMENT_LIMIT_ERROR) return res.status(409).json({ error: CASH_PAYMENT_LIMIT_MESSAGE });
    if (error?.message === 'QUOTE_CHANGED') return res.status(409).json({ error: 'تغير السعر أو رسوم التوصيل. راجع الإجمالي مرة أخرى قبل التأكيد.' });
    if (error?.message === 'ORDER_RATE_LIMIT') return res.status(429).json({ error: 'تجاوزت عدد الطلبات اليومي. تواصل مع الدعم.' });
    if (error?.message === 'COUPON_UNAVAILABLE') return res.status(409).json({ error: 'كود الخصم لم يعد متاحًا. أعد مراجعة السلة.' });
    console.error('Orders API failed:', error?.code || 'request-error');
    return res.status(503).json({ error: 'تعذر تنفيذ طلب Supabase حاليًا.' });
  }
}
