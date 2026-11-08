import { authenticatedApi } from './authenticatedApi';
import { supabase, resolveSupabaseStoreUuid } from './supabase';

export async function adminApi(endpoint: 'users' | 'data', body: any) {
  const isStaticWeb = typeof window !== 'undefined' && 
    (window.location.hostname.includes('el7lm.com') || window.location.hostname.includes('pages.dev') || window.location.hostname.includes('workers.dev'));

  // 1. Try server endpoint first only if running with Node/local backend
  if (!isStaticWeb) {
    try {
      return await authenticatedApi('/api/admin-' + endpoint, body);
    } catch {
      // fallback to Supabase direct client below
    }
  }

  // 2. Direct Supabase Implementation for Static Web / Cloudflare
  if (endpoint === 'users') {
    if (body.action === 'list') {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) console.warn('[adminApi] users.list error:', error);
      
      const { data: storesList } = await supabase.from('stores').select('id, name, logo, logo_url, owner_id');
      const storeMap = new Map((storesList || []).map(s => [s.id, s]));
      const storeOwnerMap = new Map((storesList || []).filter(s => s.owner_id).map(s => [s.owner_id, s.id]));

      return {
        users: (profiles || []).map(p => {
          const sId = p.store_id || storeOwnerMap.get(p.id) || '';
          const st = storeMap.get(sId);
          const resolvedAvatar = p.avatar_url || (p.role === 'restaurant' && st ? (st.logo_url || st.logo) : null);

          return {
            uid: p.id,
            id: p.id,
            fullName: p.full_name,
            email: p.email,
            phone: p.phone,
            role: p.role,
            avatarUrl: resolvedAvatar || null,
            storeId: sId,
            courierStatus: p.courier_status,
            vehicleType: p.vehicle_type,
            hasThermalBox: p.has_thermal_box,
            hasThermalBackpack: p.has_thermal_backpack,
            disabled: p.courier_status === 'suspended',
            createdAt: p.created_at,
          };
        })
      };
    }

    if (body.action === 'create') {
      const cleanEmail = body.email ? String(body.email).trim().toLowerCase() : '';
      if (!cleanEmail) throw new Error('البريد الإلكتروني مطلوب لإنشاء الحساب.');

      // Native atomic stored procedure in Supabase (Zero rate-limit, 100% database standard)
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_create_user', {
        p_email: cleanEmail,
        p_password: body.password || 'San@123456!',
        p_full_name: body.fullName || body.name || 'مستخدم جديد',
        p_phone: body.phone || '',
        p_role: body.role || 'employee',
        p_store_id: body.storeId || null
      });

      if (rpcErr) {
        console.error('[adminApi] admin_create_user error:', rpcErr);
        throw new Error('تعذر إنشاء الحساب في قاعدة البيانات: ' + rpcErr.message);
      }

      return { ok: true, id: rpcRes?.id };
    }

    if (body.action === 'update') {
      const uid = body.uid || body.id;
      if (!uid) throw new Error('معرف الحساب مطلوب للتحديث.');

      const patch: Record<string, any> = {
        full_name: body.fullName || body.name,
        phone: body.phone,
        role: body.role,
        avatar_url: body.avatarUrl || null,
        vehicle_type: body.vehicleType || null,
        has_thermal_box: Boolean(body.hasThermalBox),
        has_thermal_backpack: Boolean(body.hasThermalBackpack),
        courier_status: body.role === 'courier' ? (body.courierStatus || 'active') : null,
        updated_at: new Date().toISOString()
      };

      if (body.storeId !== undefined) {
        patch.store_id = body.storeId;
      }

      const { error: profileErr } = await supabase.from('profiles').update(patch).eq('id', uid);
      if (profileErr) throw profileErr;

      if (body.role === 'restaurant' && body.storeId) {
        await supabase.from('stores').update({ owner_id: uid }).eq('id', body.storeId);
      }

      return { ok: true, id: uid, uid };
    }

    if (body.action === 'enable' || body.action === 'disable') {
      const newStatus = body.action === 'enable' ? 'active' : 'suspended';
      await supabase.from('profiles').update({ courier_status: newStatus }).eq('id', body.uid);
      return { ok: true };
    }

    if (body.action === 'delete') {
      await supabase.from('profiles').delete().eq('id', body.uid);
      return { ok: true };
    }
  }

  if (endpoint === 'data') {
    if (body.action === 'session') return { ok: true };
    if (body.action === 'application-list') return { items: [] };
    if (body.action === 'application-status') return { ok: true };

    if (body.action === 'save' && body.collection === 'orders') {
      const orderId = body.id;
      const changes = body.data || {};
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      
      if (changes.orderStatus || changes.status) {
        const st = changes.orderStatus || changes.status;
        patch.status = st === 'received' ? 'pending' : st;
      }
      if (changes.courierId !== undefined) patch.courier_id = changes.courierId || null;
      if (changes.courierName !== undefined) patch.courier_name = changes.courierName || null;
      if (changes.courierPhone !== undefined) patch.courier_phone = changes.courierPhone || null;
      if (changes.paymentStatus !== undefined) patch.payment_status = changes.paymentStatus;
      if (changes.paymentReference !== undefined) patch.payment_reference = changes.paymentReference;
      if (changes.paymentConfirmedAt !== undefined) patch.payment_confirmed_at = changes.paymentConfirmedAt;

      const { data, error } = await supabase.from('orders').update(patch).eq('id', orderId).select().maybeSingle();
      if (error) {
        console.error('[adminApi] order update error:', error);
        throw error;
      }
      return { ok: true, data };
    }

    if (body.action === 'save' && body.collection === 'stores') {
      const raw = body.data || {};
      const patch: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (raw.name !== undefined) patch.name = raw.name;
      if (raw.nameEn !== undefined || raw.name_en !== undefined) patch.name_en = raw.nameEn || raw.name_en || null;
      if (raw.type !== undefined) patch.type = raw.type;
      if (raw.category !== undefined) patch.category = raw.category;
      if (raw.logo !== undefined || raw.logoUrl !== undefined) patch.logo = raw.logo || raw.logoUrl;
      if (raw.banner !== undefined || raw.bannerUrl !== undefined) patch.banner = raw.banner || raw.bannerUrl;
      if (raw.status !== undefined) patch.status = raw.status;
      if (raw.deliveryTime !== undefined || raw.delivery_time !== undefined) patch.delivery_time = raw.deliveryTime || raw.delivery_time;
      if (raw.minOrder !== undefined || raw.min_order !== undefined) patch.min_order = Number(raw.minOrder ?? raw.min_order);
      if (raw.deliveryFee !== undefined || raw.delivery_fee !== undefined) patch.delivery_fee = Number(raw.deliveryFee ?? raw.delivery_fee);
      if (raw.preciseAddress !== undefined || raw.precise_address !== undefined) patch.precise_address = raw.preciseAddress || raw.precise_address;
      if (raw.locationInDistrict !== undefined || raw.location_in_district !== undefined) patch.location_in_district = raw.locationInDistrict || raw.location_in_district;
      if (raw.latitude !== undefined) patch.latitude = Number(raw.latitude);
      if (raw.longitude !== undefined) patch.longitude = Number(raw.longitude);
      if (raw.commissionRate !== undefined || raw.commission_rate !== undefined) patch.commission_rate = Number(raw.commissionRate ?? raw.commission_rate);
      if (raw.taxRate !== undefined || raw.tax_rate !== undefined) patch.tax_rate = Number(raw.taxRate ?? raw.tax_rate);

      const storeId = resolveSupabaseStoreUuid(body.id);
      const { error } = await supabase.from('stores').update(patch).eq('id', storeId);
      if (error) {
        console.warn('[adminApi] store update error:', error);
        throw error;
      }
      return { ok: true, id: storeId };
    }

    if (body.action === 'save' && body.collection === 'products') {
      const raw = body.data || {};
      const patch: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (raw.name !== undefined) patch.name = raw.name;
      if (raw.nameEn !== undefined || raw.name_en !== undefined) patch.name_en = raw.nameEn || raw.name_en || null;
      if (raw.description !== undefined) patch.description = raw.description || '';
      if (raw.price !== undefined && raw.price !== null) patch.price = Number(raw.price);
      if (raw.originalPrice !== undefined || raw.original_price !== undefined) {
        const orig = raw.originalPrice ?? raw.original_price;
        patch.original_price = orig ? Number(orig) : null;
      }
      if (raw.category !== undefined) patch.category = raw.category || 'عام';
      if (raw.categoryId !== undefined || raw.category_id !== undefined) patch.category_id = raw.categoryId || raw.category_id || null;
      if (raw.barcode !== undefined) patch.barcode = raw.barcode || null;
      if (raw.merchantPosSku !== undefined || raw.merchant_pos_sku !== undefined) patch.merchant_pos_sku = raw.merchantPosSku || raw.merchant_pos_sku || null;
      if (raw.badge !== undefined || raw.offerBadge !== undefined) patch.badge = raw.badge || raw.offerBadge || null;
      if (raw.imageUrl !== undefined || raw.image_url !== undefined) patch.image_url = raw.imageUrl || raw.image_url || null;
      if (raw.inStock !== undefined || raw.is_available !== undefined) patch.is_available = Boolean(raw.inStock ?? raw.is_available);
      if (raw.archived !== undefined) patch.archived = Boolean(raw.archived);
      if (raw.options !== undefined) patch.options = raw.options;
      if (raw.offerTitle !== undefined || raw.offer_title !== undefined) patch.offer_title = raw.offerTitle || raw.offer_title || null;
      if (raw.offerStatus !== undefined || raw.offer_status !== undefined) patch.offer_status = raw.offerStatus || raw.offer_status || null;
      if (raw.offerProposedPrice !== undefined || raw.offer_proposed_price !== undefined) {
        const op = raw.offerProposedPrice ?? raw.offer_proposed_price;
        patch.offer_proposed_price = op ? Number(op) : null;
      }
      if (raw.offerRejectionReason !== undefined || raw.offer_rejection_reason !== undefined) patch.offer_rejection_reason = raw.offerRejectionReason || raw.offer_rejection_reason || null;
      if (raw.offerStartDate !== undefined || raw.offer_start_date !== undefined) patch.offer_start_date = raw.offerStartDate || raw.offer_start_date || null;
      if (raw.offerEndDate !== undefined || raw.offer_end_date !== undefined) patch.offer_end_date = raw.offerEndDate || raw.offer_end_date || null;

      if (raw.storeId || raw.store_id) {
        patch.store_id = resolveSupabaseStoreUuid(raw.storeId || raw.store_id);
      }

      const { error } = await supabase.from('products').update(patch).eq('id', body.id);
      if (error) {
        console.warn('[adminApi] products update error:', error);
        throw error;
      }
      return { ok: true, id: body.id };
    }
  }

  // On static web (Cloudflare Pages), there is no backend API endpoint so never call /api/*
  if (isStaticWeb) {
    console.warn(`[adminApi] Handled unmapped static request for ${endpoint}:`, body?.action);
    return { ok: true, items: [] };
  }

  return await authenticatedApi('/api/admin-' + endpoint, body);
}
