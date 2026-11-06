import { merchantReadModel } from './merchantReadModels.ts';
import { sharedCatalogPage, linkCatalogProduct } from './sharedCatalog.ts';
import { merchantOrderView } from './portalOrders.ts';
import { AdminError, validId } from './adminRequest.ts';
import { paymentReady, type OperationIdentity } from './operations.ts';
import { supabaseAdminClient } from './supabaseAdmin.ts';

export const merchantActions = [
  'store-dashboard', 'store-products', 'shared-catalog', 'store-customers', 'store-payments',
  'link-catalog-product', 'set-product-archived', 'save-product', 'set-product-stock',
  'set-product-inventory', 'set-product-price', 'set-store-status', 'legacy-prepare',
];

const storeView = (row: any) => ({
  id: row.id, name: row.name, nameEn: row.name_en || '', type: row.type || '', category: row.category || '',
  status: row.status || 'closed', minOrder: Number(row.min_order) || 0, deliveryFee: Number(row.delivery_fee) || 0,
  deliveryTime: row.delivery_time || '', locationInDistrict: row.location_in_district || '', logo: row.logo || '',
  banner: row.banner || '', imageUrl: row.logo || '', commissionRate: Number(row.commission_rate) || 0,
  taxRate: Number(row.tax_rate) || 0, taxRegistrationNumber: row.tax_registration_number || row.tax_number || '',
  pricesIncludeTax: row.prices_include_tax === true,
});

const productView = (row: any) => ({
  id: row.id, storeId: row.store_id, storeName: row.store_name || '', name: row.name, nameEn: row.name_en || '',
  description: row.description || '', price: Number(row.price) || 0,
  originalPrice: row.original_price == null ? undefined : Number(row.original_price), category: row.category || 'عام',
  categoryId: row.category_id || undefined, barcode: row.barcode || '', merchantPosSku: row.merchant_pos_sku || '',
  verticalId: row.vertical_id || undefined, imageType: row.image_type || '', imageUrl: row.image_url || '',
  imageKey: row.image_key || undefined, inStock: row.is_available !== false, archived: row.archived === true,
  badge: row.badge || '', isPopular: row.is_popular === true, optionGroups: row.options || [],
  stockQuantity: Number(row.stock_quantity) || 0, minStockAlert: Number(row.min_stock_alert) || 0,
  maxPerOrder: Number(row.max_per_order) || 99, catalogProductId: row.catalog_product_id || undefined,
  offerTitle: row.offer_title || '', isOccasion: row.is_occasion === true, occasionName: row.occasion_name || '',
  offerStartDate: row.offer_start_date || '', offerEndDate: row.offer_end_date || '',
});

export async function merchantAction(input: any, context: OperationIdentity) {
  const { actor, staff, role } = context;
  if (!context.verified || !['restaurant', 'admin'].includes(role)) throw new AdminError(403, 'الحساب غير مرتبط بمتجر معتمد.');
  const storeId = input.storeId || staff?.storeId;
  if (!storeId || (role === 'restaurant' && storeId !== staff?.storeId)) throw new AdminError(403, 'المتجر غير مرتبط بحسابك.');
  validId(storeId);

  if (input.action === 'store-customers' || input.action === 'store-payments') return merchantReadModel(input, context);
  if (input.action === 'shared-catalog') return sharedCatalogPage(undefined, input.cursor, input.query || '');
  if (input.action === 'link-catalog-product') return linkCatalogProduct(input, context);

  const client = supabaseAdminClient();
  if (input.action === 'store-products' || input.action === 'store-dashboard') {
    const [{ data: store, error: storeError }, { data: rows, error: productsError }] = await Promise.all([
      client.from('stores').select('*').eq('id', storeId).maybeSingle(),
      (() => {
        let query = client.from('products').select('*,stores(name)').eq('store_id', storeId).order('id', { ascending: true }).limit(101);
        if (input.cursor !== undefined) {
          if (typeof input.cursor !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.cursor)) throw new AdminError(400, 'مؤشر الصفحة غير صالح.');
          query = query.gt('id', input.cursor);
        }
        return query;
      })(),
    ]);
    if (productsError) throw new AdminError(503, 'تعذر تحميل منتجات المتجر من Supabase.');
    if (input.action === 'store-products') {
      const products = rows || [];
      return { products: products.slice(0, 100).map((row: any) => productView({ ...row, store_name: row.stores?.name })), productsNextCursor: products.length > 100 ? products[99].id : null };
    }
    if (storeError) throw new AdminError(503, 'تعذر تحميل المتجر من Supabase.');
    if (!store) throw new AdminError(404, 'المتجر غير موجود في Supabase.');
    const products = rows || [];
    return {
      stores: [storeView(store)],
      products: products.slice(0, 100).map((row: any) => productView({ ...row, store_name: store.name })),
      productsNextCursor: products.length > 100 ? products[99].id : null,
      orders: [],
    };
  }

  if (input.action === 'legacy-prepare') {
    validId(input.id);
    if (!['preparing', 'ready'].includes(input.next)) throw new AdminError(400, 'مرحلة التحضير غير صالحة.');
    const { data: order, error } = await client.from('orders').select('id,status,store_id,store_ids,kitchen_status,payment_method,payment_status,payment_confirmed_at,fulfillment_version')
      .eq('id', input.id).maybeSingle();
    if (error) throw new AdminError(503, 'تعذر قراءة الطلب من Supabase.');
    if (!order || !(order.store_ids || [order.store_id]).includes(storeId) || order.fulfillment_version === 2) throw new AdminError(403, 'الطلب غير متاح لهذا المسار.');
    const mapped = { paymentMethod: order.payment_method, paymentStatus: order.payment_status, paymentConfirmedAt: order.payment_confirmed_at };
    if (!paymentReady(mapped) || !['received', 'preparing'].includes(order.status)) throw new AdminError(409, 'الطلب غير متاح للتحضير.');
    const current = order.kitchen_status || {};
    const old = current[storeId] || 'received';
    if (!((old === 'received' && input.next === 'preparing') || (old === 'preparing' && input.next === 'ready'))) throw new AdminError(409, 'راجع مرحلة التحضير الحالية.');
    const kitchenStatus = { ...current, [storeId]: input.next };
    const allReady = (order.store_ids || [storeId]).every((id: string) => kitchenStatus[id] === 'ready');
    const nextStatus = allReady ? 'ready' : 'preparing';
    const { error: updateError } = await client.from('orders').update({
      kitchen_status: kitchenStatus, status: nextStatus, updated_at: new Date().toISOString(),
      ...(allReady ? { ready_at: new Date().toISOString() } : {}),
    }).eq('id', input.id).eq('status', order.status);
    if (updateError) throw new AdminError(503, 'تعذر تحديث تحضير الطلب في Supabase.');
    return { ok: true };
  }

  if (role !== 'admin' && staff?.duty !== 'manager') throw new AdminError(403, 'تعديل المنيو والمتجر متاح لمدير المتجر فقط.');
  if (input.action === 'set-store-status') {
    if (!['open', 'closed', 'busy'].includes(input.status)) throw new AdminError(400, 'حالة متجر غير صالحة.');
    const { error } = await client.from('stores').update({
      status: input.status, updated_at: new Date().toISOString(), stopped_at: input.status === 'closed' ? new Date().toISOString() : null,
    }).eq('id', storeId);
    if (error) throw new AdminError(503, 'تعذر تحديث حالة المتجر في Supabase.');
    return { ok: true };
  }

  validId(input.id);
  const { data: product, error: productError } = await client.from('products').select('*').eq('id', input.id).eq('store_id', storeId).maybeSingle();
  if (productError) throw new AdminError(503, 'تعذر قراءة المنتج من Supabase.');
  if (!product) throw new AdminError(404, 'المنتج غير موجود في متجرك.');
  if (input.action === 'save-product') throw new AdminError(409, 'اختر المنتج من الكتالوج العام بدل إنشاء نسخة جديدة.');
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.action === 'set-product-archived') {
    if (typeof input.archived !== 'boolean') throw new AdminError(400, 'حالة الأرشفة غير صالحة.');
    patch.archived = input.archived;
    if (input.archived) patch.is_available = false;
  } else if (input.action === 'set-product-stock') {
    if (typeof input.inStock !== 'boolean' || product.archived) throw new AdminError(400, 'المنتج غير متاح للتعديل.');
    patch.is_available = input.inStock;
  } else if (input.action === 'set-product-inventory') {
    if (product.archived) throw new AdminError(400, 'المنتج غير متاح للتعديل.');
    for (const [source, target, max] of [['stockQuantity','stock_quantity',1000000],['minStockAlert','min_stock_alert',10000],['maxPerOrder','max_per_order',1000]] as const) {
      const value = input[source];
      if (value === undefined) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (source === 'maxPerOrder' && value < 1)) throw new AdminError(400, 'قيمة المخزون غير صالحة.');
      patch[target] = Math.floor(value);
    }
    if (typeof input.inStock === 'boolean') patch.is_available = input.inStock;
  } else if (input.action === 'set-product-price') {
    if (!Number.isFinite(input.price) || input.price < 0 || input.price > 100000) throw new AdminError(400, 'سعر غير صالح.');
    patch.price = input.price;
    if (Number(product.original_price) < input.price) patch.original_price = null;
  } else {
    throw new AdminError(400, 'عملية غير صالحة.');
  }
  const { error: updateError } = await client.from('products').update(patch).eq('id', input.id).eq('store_id', storeId);
  if (updateError) throw new AdminError(503, 'تعذر حفظ تعديل المنتج في Supabase.');
  return { ok: true };
}
