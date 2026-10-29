import { createHash } from 'node:crypto';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { AdminError, validId } from './adminRequest.ts';
import { auditInTransaction } from './audit.ts';

// Definitions are immutable once published. products remains the public offer projection
// read by existing web/mobile clients; merchant prices and availability belong to that offer.
const definitionFields = ['name','description','category','imageType','imageUrl','optionGroups'] as const;
export const catalogOfferKey = (storeId:string, catalogId:string) =>
  createHash('sha256').update(storeId+'\0'+catalogId).digest('hex');
export function catalogDefinition(data:any) {
  const definition=Object.fromEntries(definitionFields.filter(key=>data[key]!==undefined).map(key=>[key,data[key]]));
  if(data.optionGroups!==undefined){
    if(!Array.isArray(data.optionGroups)||data.optionGroups.length>10)throw new AdminError(400,'مجموعات خيارات المنتج غير صالحة.');
    definition.optionGroups=data.optionGroups.map((group:any,index:number)=>{
      if(typeof group?.title!=='string'||!group.title.trim()||group.title.length>120||!Array.isArray(group.options)||group.options.length<1||group.options.length>30)throw new AdminError(400,'راجع خيارات المنتج العام.');
      return {id:typeof group.id==='string'?group.id.slice(0,128):'group-'+index,title:group.title,required:group.required===true,
        options:group.options.map((option:any)=>{
          if(typeof option?.name!=='string'||!option.name.trim()||option.name.length>120||typeof option.price!=='number'||!Number.isFinite(option.price)||option.price<0||option.price>100000)throw new AdminError(400,'اسم أو سعر إضافة غير صالح.');
          return {name:option.name,price:option.price};
        })};
    });
  }
  return definition;
}
function publishedDefinition(product:any){
  if(typeof product.name!=='string'||!product.name.trim())throw new AdminError(400,'اسم المنتج المنشور غير مكتمل.');
  return catalogDefinition({...product,name:product.name.trim().slice(0,120),
    description:typeof product.description==='string'?product.description.slice(0,1000):'',
    category:typeof product.category==='string'&&product.category.trim()?product.category.trim().slice(0,120):'غير مصنف'});
}
export function catalogSearchQuery(db:any, collection:string, search:string) {
  const query=db.collection(collection);
  // Firestore requires every ordering constraint before any cursor bound.
  return search.trim()
    ? query.orderBy('name').orderBy(FieldPath.documentId()).startAt(search.trim()).endAt(search.trim()+'\uf8ff')
    : query.orderBy(FieldPath.documentId());
}
export async function sharedCatalogPage(db:any, cursor?:string, search='') {
  if(cursor!==undefined&&(typeof cursor!=='string'||cursor.length>160))throw new AdminError(400,'مؤشر غير صالح.');
  if(typeof search!=='string'||search.length>120)throw new AdminError(400,'بحث غير صالح.');
  let source='catalog',last='';
  if(cursor){const split=cursor.indexOf(':');source=cursor.slice(0,split);last=cursor.slice(split+1);if(!['catalog','legacy'].includes(source))throw new AdminError(400,'مؤشر غير صالح.');if(last)validId(last);}
  // Published products already exist in production. Read them as migration candidates,
  // without requiring an empty new collection to be populated manually first.
  const read=async(kind:string,after:string)=>{
    const collection=kind==='catalog'?'catalogProducts':'products';
    let query=catalogSearchQuery(db,collection,search);
    if(after){if(search.trim()){const previous=await db.doc(collection+'/'+after).get();if(!previous.exists)throw new AdminError(400,'أعد البحث لتحديث الصفحة.');query=query.startAfter(previous);}else query=query.startAfter(after);}
    const snapshot=await query.limit(51).get();const docs=snapshot.docs.slice(0,50);
    const eligible=docs.filter((d:any)=>kind==='catalog'?d.data().active===true:d.data().inStock===true&&!d.data().archived&&!d.data().catalogProductId);
    const items=eligible.flatMap((d:any)=>{try{const data=d.data();return [{id:d.id,...(kind==='legacy'?publishedDefinition(data):catalogDefinition(data)),legacy:kind==='legacy'}];}catch{return [];}});
    return {items,nextCursor:snapshot.docs.length>50?kind+':'+docs.at(-1)!.id:kind==='catalog'?'legacy:':null};
  };
  const result=await read(source,last);
  if(source==='catalog'&&result.nextCursor==='legacy:'){const legacy=await read('legacy','');return {items:[...result.items,...legacy.items],nextCursor:legacy.nextCursor};}
  return result;
}
export async function publishCatalogProduct(id:string, context:any) {
  validId(id);const {db,actor}=context;
  return db.runTransaction(async(tx:any)=>{
    const sourceRef=db.doc('products/'+id);
    const [admin,access,source]=await Promise.all([tx.get(db.doc('admins/'+actor.uid)),tx.get(db.doc('accountAccess/'+actor.uid)),tx.get(sourceRef)]);
    const a=access.data();if(!admin.exists||a?.disabled||a?.operationLocked||actor.auth_time<=(a?.revokedBefore||0))throw new AdminError(403,'انتهت صلاحية الإدارة.');
    if(!source.exists||source.data().archived)throw new AdminError(400,'اختر منتجًا قائمًا وغير مؤرشف.');
    const product=source.data();validId(product.storeId);
    if(product.catalogProductId)return {ok:true,catalogProductId:product.catalogProductId,alreadyPublished:true};
    if(typeof product.name!=='string'||!product.name.trim()||typeof product.description!=='string'||typeof product.category!=='string')throw new AdminError(400,'أكمل تعريف المنتج قبل نشره في الكتالوج العام.');
    const definitionRef=db.doc('catalogProducts/'+id);
    const offerRef=db.doc('catalogOffers/'+catalogOfferKey(product.storeId,id));
    const [definition,offer]=await Promise.all([tx.get(definitionRef),tx.get(offerRef)]);
    if(definition.exists||offer.exists)throw new AdminError(409,'تعارض في رابط الكتالوج؛ راجع الإدارة.');
    const data={...catalogDefinition(product),active:true,createdAt:FieldValue.serverTimestamp(),createdBy:actor.uid};
    tx.create(definitionRef,data);
    tx.create(offerRef,{storeId:product.storeId,catalogProductId:id,productId:id});
    tx.update(sourceRef,{catalogProductId:id,updatedAt:FieldValue.serverTimestamp()});
    auditInTransaction(db,tx,actor,'catalog.publish','catalogProducts',id,null,data);
    return {ok:true,catalogProductId:id};
  });
}
export async function linkCatalogProduct(input:any, context:any) {
  const {db,actor,staff}=context;
  if(!context.verified||context.role!=='restaurant'||!staff?.storeId)throw new AdminError(403,'الحساب غير مرتبط بمتجر معتمد.');
  const storeId=staff.storeId;validId(input.catalogProductId);validId(storeId);
  if(typeof input.price!=='number'||!Number.isFinite(input.price)||input.price<0||input.price>100000)throw new AdminError(400,'سعر العرض غير صالح.');
  if(input.existingProductId!==undefined)validId(input.existingProductId);
  const key=catalogOfferKey(storeId,input.catalogProductId);
  return db.runTransaction(async(tx:any)=>{
    const linkRef=db.doc('catalogOffers/'+key);
    const definitionRef=db.doc('catalogProducts/'+input.catalogProductId);
    const [membership,access,store,definition,link]=await Promise.all([
      tx.get(db.doc('staff/'+actor.uid)),tx.get(db.doc('accountAccess/'+actor.uid)),tx.get(db.doc('stores/'+storeId)),
      tx.get(definitionRef),tx.get(linkRef),
    ]);
    const m=membership.data(),a=access.data();
    if(m?.role!=='restaurant'||m?.storeId!==storeId||(m.duty||'manager')!=='manager'||a?.disabled||a?.operationLocked||actor.auth_time<=(a?.revokedBefore||0))throw new AdminError(403,'تعديل عروض المتجر متاح لمديره المعتمد فقط.');
    if(!store.exists)throw new AdminError(404,'المتجر غير متاح.');
    let legacy:any=null,sourceLink:any=null,sourceRef:any=null,sourceLinkRef:any=null;
    let data=definition.data();
    if(!definition.exists){
      sourceRef=db.doc('products/'+input.catalogProductId);legacy=await tx.get(sourceRef);
      const p=legacy.data();
      if(!legacy.exists||p.inStock!==true||p.archived||p.catalogProductId)throw new AdminError(404,'المنتج غير متاح في الكتالوج المنشور.');
      if(p.storeId){validId(p.storeId);sourceLinkRef=db.doc('catalogOffers/'+catalogOfferKey(p.storeId,input.catalogProductId));
        sourceLink=sourceLinkRef.path===linkRef.path?link:await tx.get(sourceLinkRef);
        if(sourceLink.exists)throw new AdminError(409,'تعارض في رابط المنتج الأصلي.');}
      data={...publishedDefinition(p),active:true,origin:'published-product',createdAt:FieldValue.serverTimestamp(),createdBy:actor.uid};
      if(p.storeId===storeId&&input.existingProductId&&input.existingProductId!==legacy.id)throw new AdminError(409,'هذا المنتج موجود في متجرك بالفعل؛ استخدم سجله الأصلي.');
    }
    if(data.active!==true)throw new AdminError(404,'المنتج العام غير متاح.');
    if(link.exists){
      if(input.existingProductId&&input.existingProductId!==link.data().productId)throw new AdminError(409,'المنتج العام مرتبط بعرض آخر في متجرك؛ لا ندمج السجلات تلقائيًا.');
      return {ok:true,id:link.data().productId,alreadyLinked:true};
    }
    const adoptId=input.existingProductId||(legacy?.data().storeId===storeId?legacy.id:undefined);
    const id=adoptId||'offer_'+key;const ref=db.doc('products/'+id);const existing=await tx.get(ref);
    if(adoptId){
      if(!existing.exists||existing.data().storeId!==storeId)throw new AdminError(403,'اختر منتجًا قائمًا من متجرك فقط.');
      if(existing.data().catalogProductId&&existing.data().catalogProductId!==input.catalogProductId)throw new AdminError(409,'المنتج القائم مرتبط بتعريف عام آخر.');
    }else if(existing.exists)throw new AdminError(409,'تعارض في معرف عرض المتجر؛ راجع الإدارة.');
    const metadata=catalogDefinition(data);
    const price=existing.exists?existing.data().price:input.price;
    if(typeof price!=='number'||!Number.isFinite(price)||price<0||price>100000)throw new AdminError(400,'صحح سعر المنتج القائم أولًا.');
    const offer={...metadata,optionGroups:metadata.optionGroups||[],imageUrl:metadata.imageUrl||'',
      id,storeId,storeName:store.data().name,catalogProductId:input.catalogProductId,
      price,inStock:existing.exists?Boolean(existing.data().inStock):false,
      archived:existing.exists?Boolean(existing.data().archived):false,updatedAt:FieldValue.serverTimestamp()};
    if(legacy){
      tx.create(definitionRef,data);
      if(sourceRef.path!==ref.path)tx.update(sourceRef,{catalogProductId:input.catalogProductId,updatedAt:FieldValue.serverTimestamp()});
      if(sourceLinkRef&&sourceLinkRef.path!==linkRef.path)tx.create(sourceLinkRef,{storeId:legacy.data().storeId,catalogProductId:input.catalogProductId,productId:legacy.id});
    }
    if(existing.exists)tx.set(ref,offer,{merge:true});else tx.create(ref,offer);tx.create(linkRef,{storeId,catalogProductId:input.catalogProductId,productId:id});
    auditInTransaction(db,tx,actor,'merchant.catalog-link','products',id,existing.exists?existing.data():null,offer);
    return {ok:true,id,alreadyLinked:false};
  });
}
