import { createHash } from 'node:crypto';
import { AdminError, validId } from './adminRequest.ts';
import { supabaseAdminClient } from './supabaseAdmin.ts';

const definitionFields = ['name','description','category','imageType','imageUrl','optionGroups'] as const;
export const catalogOfferKey = (storeId: string, catalogId: string) => createHash('sha256').update(storeId+'\0'+catalogId).digest('hex');

export function catalogDefinition(data: any) {
  const definition: any = Object.fromEntries(definitionFields.filter(key => data[key] !== undefined).map(key => [key,data[key]]));
  if (data.optionGroups !== undefined) {
    if (!Array.isArray(data.optionGroups) || data.optionGroups.length > 10) throw new AdminError(400,'مجموعات خيارات المنتج غير صالحة.');
    definition.optionGroups = data.optionGroups.map((group: any,index: number) => {
      if (typeof group?.title !== 'string' || !group.title.trim() || group.title.length > 120 || !Array.isArray(group.options) || group.options.length < 1 || group.options.length > 30) throw new AdminError(400,'راجع خيارات المنتج العام.');
      return { id: typeof group.id === 'string' ? group.id.slice(0,128) : 'group-'+index, title: group.title, required: group.required === true,
        options: group.options.map((option: any) => {
          if (typeof option?.name !== 'string' || !option.name.trim() || option.name.length > 120 || typeof option.price !== 'number' || !Number.isFinite(option.price) || option.price < 0 || option.price > 100000) throw new AdminError(400,'اسم أو سعر إضافة غير صالح.');
          return { name: option.name, price: option.price };
        }) };
    });
  }
  return definition;
}

function publishedDefinition(product: any) {
  if (typeof product.name !== 'string' || !product.name.trim()) throw new AdminError(400,'اسم المنتج المنشور غير مكتمل.');
  return catalogDefinition({ ...product, name: product.name.trim().slice(0,120), description: typeof product.description === 'string' ? product.description.slice(0,1000) : '', category: typeof product.category === 'string' && product.category.trim() ? product.category.trim().slice(0,120) : 'غير مصنف' });
}

const catalogView = (row: any, legacy = false) => ({
  id: row.id, name: row.name, description: row.description || '', category: row.category || 'غير مصنف',
  imageType: row.image_type || '', imageUrl: row.image_url || '', optionGroups: row.option_groups || [], legacy,
});

export async function sharedCatalogPage(_context?: unknown, cursor?: string, search = '') {
  if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 180)) throw new AdminError(400,'مؤشر غير صالح.');
  if (typeof search !== 'string' || search.length > 120) throw new AdminError(400,'بحث غير صالح.');
  let source = 'catalog', after = '';
  if (cursor) { const split = cursor.indexOf(':'); source = cursor.slice(0,split); after = cursor.slice(split+1); if (!['catalog','legacy'].includes(source)) throw new AdminError(400,'مؤشر غير صالح.'); if (after) validId(after); }
  const client = supabaseAdminClient();
  const read = async (kind: string, position: string) => {
    let query: any;
    if (kind === 'catalog') {
      query = client.from('catalog_products').select('*').eq('active',true).order('id',{ascending:true}).limit(51);
      if (position) query = query.gt('id',position);
      if (search.trim()) query = query.or(`name.ilike.%${search.trim().replace(/[,%()]/g,' ')}%,description.ilike.%${search.trim().replace(/[,%()]/g,' ')}%`);
    } else {
      query = client.from('products').select('id,name,description,category,image_type,image_url,options,catalog_product_id').eq('is_available',true).eq('archived',false).is('catalog_product_id',null).order('id',{ascending:true}).limit(51);
      if (position) query = query.gt('id',position);
      if (search.trim()) query = query.or(`name.ilike.%${search.trim().replace(/[,%()]/g,' ')}%,description.ilike.%${search.trim().replace(/[,%()]/g,' ')}%`);
    }
    const {data,error} = await query;
    if (error) throw new AdminError(503,'تعذر تحميل الكتالوج العام من Supabase.');
    const rows = data || [], eligible = rows.slice(0,50);
    const items = eligible.flatMap((row: any) => {
      try { return [kind === 'legacy' ? { ...catalogView({ ...row, option_groups: row.options },true), ...publishedDefinition({ ...row, optionGroups: row.options }) } : catalogView(row)]; }
      catch { return []; }
    });
    return {items,nextCursor: rows.length > 50 ? kind+':'+eligible.at(-1)!.id : kind === 'catalog' ? 'legacy:' : null};
  };
  const result = await read(source,after);
  if (source === 'catalog' && result.nextCursor === 'legacy:') { const legacy = await read('legacy',''); return {items:[...result.items,...legacy.items],nextCursor:legacy.nextCursor}; }
  return result;
}

export async function publishCatalogProduct(id: string, context: any) {
  validId(id);
  const {data,error} = await supabaseAdminClient().rpc('publish_sangoub_catalog_product',{p_product_id:id,p_actor_id:context.actor.uid});
  if (error) {
    if (error.message?.includes('CATALOG_PRODUCT_NOT_FOUND')) throw new AdminError(404,'المنتج غير موجود أو مؤرشف.');
    if (error.code === '23505') throw new AdminError(409,'المنتج منشور بالفعل أو يوجد تعارض في الكتالوج.');
    throw new AdminError(503,'تعذر نشر المنتج في كتالوج Supabase.');
  }
  return data;
}

export async function linkCatalogProduct(input: any, context: any) {
  if (!context.verified || context.role !== 'restaurant' || !context.staff?.storeId || (context.staff.duty || 'manager') !== 'manager') throw new AdminError(403,'تعديل عروض المتجر متاح لمديره المعتمد فقط.');
  const storeId = context.staff.storeId;
  validId(storeId); validId(input.catalogProductId);
  if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price < 0 || input.price > 100000) throw new AdminError(400,'سعر العرض غير صالح.');
  if (input.existingProductId !== undefined) validId(input.existingProductId);
  const {data,error} = await supabaseAdminClient().rpc('link_sangoub_catalog_product',{
    p_store_id:storeId,p_catalog_product_id:input.catalogProductId,p_price:input.price,p_existing_product_id:input.existingProductId || null,p_actor_id:context.actor.uid,
  });
  if (error) {
    if (error.message?.includes('CATALOG_PRODUCT_NOT_FOUND')) throw new AdminError(404,'المنتج العام غير متاح.');
    if (error.message?.includes('PRODUCT_NOT_OWNED')) throw new AdminError(403,'اختر منتجًا قائمًا من متجرك فقط.');
    if (error.code === '23505') throw new AdminError(409,'المنتج العام مرتبط بعرض آخر في متجرك.');
    throw new AdminError(503,'تعذر ربط المنتج بمتجر Supabase.');
  }
  return data;
}
