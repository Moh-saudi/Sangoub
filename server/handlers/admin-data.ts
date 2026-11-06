import { publishCatalogProduct } from '../sharedCatalog.ts';
import { courierApprovalError } from '../../src/validation/accounts.ts';
import {settlementAction} from '../settlements.ts';
import { adminSangoubRequests } from '../sangoubRequests.ts';
import { requireAdmin, AdminError, adminError, validId } from '../adminRequest.ts';
import { mobileCors } from '../mobileCors.ts';
import { supabaseAdminClient } from '../supabaseAdmin.ts';

const fields:Record<string,string[]>={
  products:['id','storeId','storeName','name','nameEn','description','price','originalPrice','category','categoryId','barcode','merchantPosSku','verticalId','imageType','imageUrl','imageKey','inStock','archived','badge','isPopular','optionGroups','stockQuantity','minStockAlert','maxPerOrder','catalogProductId','offerTitle','isOccasion','occasionName','offerStartDate','offerEndDate'],
  stores:['commissionRate','taxRate','taxRegistrationNumber','pricesIncludeTax','id','name','nameEn','locationInDistrict','type','category','status','deliveryTime','minOrder','deliveryFee','imageUrl','bannerUrl','logoUrl','logoKey','bannerKey','imageKey','logo','banner','rating','ratingCount'],
  coupons:['code','discountType','value','minOrder','title','description'],staff:['role','name','phone','storeId'],partnerApplications:['status'],jobApplications:['status'],
  orders:['orderStatus','courierId','courierName','courierPhone'],
};
const dbFields:Record<string,Record<string,string>>={
  products:{storeId:'store_id',name:'name',nameEn:'name_en',description:'description',price:'price',originalPrice:'original_price',category:'category',categoryId:'category_id',barcode:'barcode',merchantPosSku:'merchant_pos_sku',verticalId:'vertical_id',imageType:'image_type',imageUrl:'image_url',imageKey:'image_key',inStock:'is_available',archived:'archived',badge:'badge',isPopular:'is_popular',optionGroups:'options',stockQuantity:'stock_quantity',minStockAlert:'min_stock_alert',maxPerOrder:'max_per_order',catalogProductId:'catalog_product_id',offerTitle:'offer_title',isOccasion:'is_occasion',occasionName:'occasion_name',offerStartDate:'offer_start_date',offerEndDate:'offer_end_date'},
  stores:{commissionRate:'commission_rate',taxRate:'tax_rate',taxRegistrationNumber:'tax_registration_number',pricesIncludeTax:'prices_include_tax',name:'name',nameEn:'name_en',locationInDistrict:'location_in_district',type:'type',category:'category',status:'status',deliveryTime:'delivery_time',minOrder:'min_order',deliveryFee:'delivery_fee',imageUrl:'logo_url',bannerUrl:'banner_url',logoUrl:'logo_url',logoKey:'logo_key',bannerKey:'banner_key',imageKey:'image_key',logo:'logo',banner:'banner',rating:'rating',ratingCount:'rating_count'},
  coupons:{code:'code',discountType:'discount_type',value:'value',minOrder:'min_order',title:'title',description:'description'},
};
const bad=(message='بيانات غير صالحة.')=>{throw new AdminError(400,message);};
const str=(v:any,max:number,required=false)=>(!required&&(v===undefined||v===null||v===''))||(typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0));
const num=(v:any,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
function validate(type:string,id:string,d:any){
  if(type==='products'&&(!str(d.name,120,true)||!str(d.description,1000)||!num(d.price,100000)||typeof d.inStock!=='boolean'||!str(d.storeId,128,true)||!str(d.category,120,true)))bad('راجع اسم الصنف وسعره ومتجره.');
  if(type==='products'&&d.originalPrice!==undefined&&d.originalPrice!==null&&(!num(d.originalPrice,100000)||d.originalPrice<d.price))bad('السعر قبل الخصم غير صالح.');
  if(type==='products'&&d.archived===true&&d.inStock!==false)bad('المنتج المؤرشف لا يمكن إتاحته.');
  if(type==='products'&&d.stockQuantity!==undefined&&!num(d.stockQuantity,1000000))bad('الكمية بالمخزن غير صالحة.');
  if(type==='products'&&d.minStockAlert!==undefined&&!num(d.minStockAlert,10000))bad('حد التنبيه غير صالح.');
  if(type==='products'&&d.maxPerOrder!==undefined&&!num(d.maxPerOrder,1000))bad('الحد الأقصى للطلب غير صالح.');
  if(type==='products'&&d.catalogProductId!==undefined&&d.catalogProductId!==null&&!str(d.catalogProductId,128))bad('معرف الكتالوج العام غير صالح.');
  if(type==='stores'&&d.commissionRate!==undefined&&!num(d.commissionRate,100))bad('نسبة التعاقد غير صالحة.');
  if(type==='stores'&&(!str(d.name,120,true)||!num(d.minOrder,100000)||!num(d.deliveryFee,1000)||!['open','closed','busy'].includes(d.status)))bad('راجع بيانات المتجر ورسومه.');
  if(type==='stores'&&((d.taxRate!==undefined&&!num(d.taxRate,100))||(d.pricesIncludeTax!==undefined&&typeof d.pricesIncludeTax!=='boolean')||(d.taxRegistrationNumber!==undefined&&!str(d.taxRegistrationNumber,60))||(d.taxRate>0&&!str(d.taxRegistrationNumber,60,true))))bad('راجع نسبة الضريبة ورقم تسجيل المتجر.');
  if(type==='staff'&&(!['restaurant','courier'].includes(d.role)||!str(d.name,120,true)||!str(d.phone,30)))bad('راجع دور الموظف وبياناته.');
  if(type==='coupons'&&(d.code!==id||!['fixed','percent'].includes(d.discountType)||!num(d.value,d.discountType==='percent'?100:10000)||!num(d.minOrder,100000)))bad('راجع قيمة الخصم والحد الأدنى.');
  if(['partnerApplications','jobApplications'].includes(type)&&!['pending','contacted','approved','rejected'].includes(d.status))bad();
  for(const key of ['imageUrl','bannerUrl','logoUrl']) {
    if(d[key] && typeof d[key] === 'string' && d[key].trim()) {
      let val = d[key].trim();
      if(val.startsWith('/') || val.startsWith('data:')) continue;
      if(val.startsWith('photo-')) { val = 'https://images.unsplash.com/' + val; d[key] = val; }
      else if(val.startsWith('//')) { val = 'https:' + val; d[key] = val; }
      try {
        const u = new URL(val);
        if(u.protocol !== 'https:' && u.protocol !== 'http:') bad('رابط الصورة يجب أن يستخدم HTTPS.');
      } catch {
        if(!val.includes(':')) continue;
        bad('رابط الصورة يجب أن يستخدم HTTPS.');
      }
    }
  }
}
const toApp=(type:string,row:any):any=>type==='products'?{
  ...row,id:row.id,storeId:row.store_id,storeName:row.store_name,nameEn:row.name_en,originalPrice:row.original_price,categoryId:row.category_id,
  merchantPosSku:row.merchant_pos_sku,verticalId:row.vertical_id,imageType:row.image_type,imageUrl:row.image_url,imageKey:row.image_key,
  inStock:row.is_available,isPopular:row.is_popular,optionGroups:row.options,stockQuantity:row.stock_quantity,minStockAlert:row.min_stock_alert,
  maxPerOrder:row.max_per_order,catalogProductId:row.catalog_product_id,offerTitle:row.offer_title,isOccasion:row.is_occasion,
  occasionName:row.occasion_name,offerStartDate:row.offer_start_date,offerEndDate:row.offer_end_date,
}:type==='stores'?{
  ...row,id:row.id,nameEn:row.name_en,locationInDistrict:row.location_in_district,deliveryTime:row.delivery_time,
  minOrder:row.min_order,deliveryFee:row.delivery_fee,imageUrl:row.logo_url||row.logo,bannerUrl:row.banner_url||row.banner,
  logoUrl:row.logo_url||row.logo,commissionRate:row.commission_rate,taxRate:row.tax_rate,
  taxRegistrationNumber:row.tax_registration_number||row.tax_number,pricesIncludeTax:row.prices_include_tax,ratingCount:row.rating_count,
}:type==='coupons'?{...row,discountType:row.discount_type,minOrder:row.min_order}:row;

async function supabaseCatalogMutation(input:any,actor:any){
  const type=input.collection,id=input.id,client=supabaseAdminClient();
  if(!['save','delete'].includes(input.action)||!['products','stores','coupons'].includes(type))bad('المجموعة غير متاحة من هذه الواجهة.');
  validId(id);
  if(input.action==='delete'){
    if(type!=='coupons')bad('هذه البيانات تُؤرشف ولا تُحذف.');
    const {error}=await client.from('coupons').delete().eq('code',id);
    if(error)throw new AdminError(503,'تعذر حذف القسيمة من Supabase.');
    return {ok:true};
  }
  const patch=input.data||{};
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(key=>!fields[type].includes(key)))bad('تتضمن العملية حقولًا غير مسموحة.');
  const idColumn=type==='coupons'?'code':'id';
  const {data:current,error:readError}=await client.from(type).select('*').eq(idColumn,id).maybeSingle();
  if(readError)throw new AdminError(503,'تعذر تحميل السجل من Supabase.');
  const merged={...(current?toApp(type,current):{}),...patch,id,...(type==='coupons'?{code:id}:{})};
  validate(type,id,merged);
  const columns=dbFields[type];
  const values:any={...(type==='coupons'?{code:id}:{id})};
  for(const [key,value] of Object.entries(patch))if(columns[key])values[columns[key]]=value;
  if(type==='products'&&patch.archived===true)values.is_available=false;
  if(type==='stores'&&patch.taxRegistrationNumber!==undefined)values.tax_number=patch.taxRegistrationNumber;
  if(current){
    const {error}=await client.from(type).update(values).eq(idColumn,id);
    if(error)throw new AdminError(503,'تعذر حفظ التعديل في Supabase.');
  }else{
    const {error}=await client.from(type).insert(values);
    if(error)throw new AdminError(503,'تعذر إنشاء السجل في Supabase.');
  }
  return {ok:true};
}
async function supabaseOrderMutation(input:any,actor:any){
  const client=supabaseAdminClient();
  if(input.action!=='save'||typeof input.id!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(input.id))bad('مرجع الطلب غير صالح.');
  const patch=input.data||{};
  const allowed=new Set(['orderStatus','courierId','courierName','courierPhone']);
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(key=>!allowed.has(key))||Object.keys(patch).length===0)bad('تتضمن العملية حقولًا غير مسموحة.');
  if(patch.orderStatus!==undefined&&patch.orderStatus!=='cancelled')throw new AdminError(409,'الحالة الإدارية المسموحة هي الإلغاء فقط؛ استخدم مسار التحضير أو التوصيل للمراحل الأخرى.');
  let courierId:string|null=null;
  if(patch.courierId!==undefined){
    if(typeof patch.courierId!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(patch.courierId))bad('معرّف المندوب غير صالح.');
    const [{data:{user},error:userError},{data:assignments,error:rolesError},{data:profile,error:profileError},{data:verification,error:verificationError}]=await Promise.all([
      client.auth.admin.getUserById(patch.courierId),
      client.from('user_roles').select('roles(name_en,name_ar)').eq('user_id',patch.courierId),
      client.from('profiles').select('courier_status,vehicle_type,vehicle_plate,has_thermal_box,has_thermal_backpack').eq('id',patch.courierId).maybeSingle(),
      client.from('courier_verification').select('*').eq('user_id',patch.courierId).maybeSingle(),
    ]);
    if(userError||!user)throw new AdminError(404,'حساب المندوب غير موجود في Supabase.');
    if(rolesError||profileError||verificationError)throw new AdminError(503,'تعذر التحقق من اعتماد المندوب.');
    if(!profile||!verification)throw new AdminError(409,'ملف اعتماد المندوب غير مكتمل في Supabase.');
    const hasCourierRole=(assignments||[]).some((row:any)=>{
      const relation=Array.isArray(row.roles)?row.roles[0]:row.roles;
      return ['fleet courier','store in-house courier'].includes(String(relation?.name_en||relation?.name_ar||'').trim().toLowerCase());
    });
    if(!hasCourierRole||(user.banned_until&&new Date(user.banned_until).getTime()>Date.now()))bad('المندوب غير متاح أو لا يملك دور التوصيل.');
    const approval=courierApprovalError({courierStatus:profile?.courier_status},profile?{
      courierStatus:profile.courier_status,vehicleType:profile.vehicle_type,vehiclePlate:profile.vehicle_plate,
      hasThermalBox:profile.has_thermal_box,hasThermalBackpack:profile.has_thermal_backpack,
      nationalId:verification?.national_id,emergencyPhone:verification?.emergency_phone,currentAddress:verification?.current_address,
      idCardAddress:verification?.id_card_address,drivingLicenseNumber:verification?.driving_license_number,
      licenseIssueDate:verification?.license_issue_date,licenseExpiryDate:verification?.license_expiry_date,
      vehicleYear:verification?.vehicle_year,drugTestStatus:verification?.drug_test_status,drugTestDate:verification?.drug_test_date,
      criminalRecordStatus:verification?.criminal_record_status,criminalRecordDate:verification?.criminal_record_date,
    }:null);
    if(approval)throw new AdminError(409,approval);
    courierId=patch.courierId;
  }
  const {data,error}=await client.rpc('admin_update_sangoub_order',{
    p_order_id:input.id,p_actor_id:actor.uid,p_order_status:patch.orderStatus||null,p_courier_id:courierId,
  });
  if(error){
    if(error.message?.includes('ORDER_NOT_FOUND'))throw new AdminError(404,'الطلب غير موجود.');
    if(error.code==='23514')throw new AdminError(409,'تغيرت حالة الطلب أو لا تسمح قواعد التشغيل بهذا التعديل.');
    throw new AdminError(503,'تعذر تحديث الطلب في Supabase.');
  }
  return {ok:true,order:data};
}
export default async function handler(req:any,res:any){
  res.setHeader('Cache-Control','no-store');if(mobileCors(req,res))return;
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const input=req.body||{};
    if(input.action==='application-list'){
      const {actor}=await requireAdmin(req);
      const tables:Record<string,string>={coupons:'coupons',partnerApplications:'partner_applications',jobApplications:'job_applications'};
      const table=tables[input.collection];if(!table)bad('نوع القائمة غير مدعوم.');
      const {data,error}=await supabaseAdminClient().from(table).select('*').order('created_at',{ascending:false}).limit(500);
      if(error)throw new AdminError(503,'تعذر تحميل القائمة من Supabase.');
      const rows=(data||[]).map((row:any)=>input.collection==='coupons'?{
        code:row.code,title:row.title||row.code,description:row.description||'',discountType:row.discount_type,value:Number(row.value),minOrder:Number(row.min_order),active:row.active,
      }:input.collection==='partnerApplications'?{
        id:row.id,businessName:row.business_name,partnerType:row.partner_type,contactName:row.contact_name,phone:row.phone,
        branchesCount:row.branches_count,locationInCapital:row.location_in_capital,notes:row.notes,status:row.status,storeId:row.store_id,createdAt:row.created_at,
      }:{...(row.payload||{}),id:row.id,status:row.status,createdAt:row.created_at});
      return res.status(200).json({items:rows,actor:actor.uid});
    }
    if(input.action==='application-status'&&['partnerApplications','jobApplications'].includes(input.collection)){
      const {actor}=await requireAdmin(req);validId(input.id);
      if(!['pending','contacted','approved','rejected'].includes(input.status))bad();
      const table=input.collection==='partnerApplications'?'partner_applications':'job_applications';
      const {data,error}=await supabaseAdminClient().from(table).update({status:input.status,updated_at:new Date().toISOString()}).eq('id',input.id).select('id').maybeSingle();
      if(error)throw new AdminError(503,'تعذر تحديث الطلب في Supabase.');if(!data)throw new AdminError(404,'الطلب غير موجود.');
      return res.status(200).json({ok:true,actor:actor.uid});
    }
    if(['sangoub-list','sangoub-update'].includes(input.action)){
      const context=await requireAdmin(req);
      return res.status(200).json(await adminSangoubRequests(input,context));
    }
    if(input.action==='approve'&&input.collection==='partnerApplications'){
      const {actor}=await requireAdmin(req);validId(input.id);validId(input.store?.id);
      const allowedStore=new Set(fields.stores);if(!input.store||Object.keys(input.store).some((key:string)=>!allowedStore.has(key)))bad();
      validate('stores',input.store.id,{...input.store,status:'closed'});
      const {data,error}=await supabaseAdminClient().rpc('approve_sangoub_partner',{p_partner_id:input.id,p_store:input.store});
      if(error){if(error.code==='23505')throw new AdminError(409,'معرّف المتجر مستخدم بالفعل.');throw new AdminError(503,'تعذر اعتماد الشريك في Supabase.');}
      return res.status(200).json({...(data||{ok:true}),actor:actor.uid});
    }
    if(input.action==='catalog-publish'){
      const {actor}=await requireAdmin(req);
      return res.status(200).json(await publishCatalogProduct(input.id,{actor}));
    }
    if(['save','delete'].includes(input.action)&&['products','stores','coupons'].includes(input.collection)){
      const {actor}=await requireAdmin(req);
      return res.status(200).json(await supabaseCatalogMutation(input,actor));
    }
    if(input.action==='save'&&input.collection==='orders'){
      const {actor}=await requireAdmin(req);
      return res.status(200).json(await supabaseOrderMutation(input,actor));
    }
    const {actor}=await requireAdmin(req);
    const client=supabaseAdminClient();
    if(input.action==='contract-list'){
      const {data,error}=await client.from('stores').select('id,name,commission_rate,updated_at').order('name').limit(500);
      if(error)throw new AdminError(503,'تعذر تحميل عقود المتاجر من Supabase.');
      return res.status(200).json({contracts:(data||[]).map((row:any)=>({id:row.id,storeId:row.id,storeName:row.name,commissionRate:Number(row.commission_rate)||0,updatedAt:row.updated_at}))});
    }
    if(['settlement-list','settlement-preview','settlement-save'].includes(input.action))return res.status(200).json(await settlementAction(input,{actor}));
    if(input.action==='session'){
      if(!['open','logout'].includes(input.event))bad();
      const {error}=await client.from('audit_logs').insert({actor_id:actor.uid,actor_email:actor.email||'',action:'admin.workspace.'+input.event,entity_type:'admins',entity_id:actor.uid,after_state:{event:input.event},source:'admin-data-api'});
      if(error)throw new AdminError(503,'تعذر تسجيل العملية في Supabase.');
      return res.status(200).json({ok:true});
    }
    if(input.action==='audit-export'){
      const {error}=await client.from('audit_logs').insert({actor_id:actor.uid,actor_email:actor.email||'',action:'audit.export',entity_type:'audit_logs',entity_id:'export',after_state:{clientReportedCount:Number(input.count)||0,filters:input.filters||{}},source:'admin-data-api'});
      if(error)throw new AdminError(503,'تعذر تسجيل التصدير في Supabase.');
      return res.status(200).json({ok:true});
    }
    if(input.action==='audit'){
      const columns:Record<string,string>={actorUid:'actor_id',actorEmail:'actor_email',action:'action',entityType:'entity_type',status:'status',entityId:'entity_id'};
      let query:any=client.from('audit_logs').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51);
      if(input.filterValue){if(!columns[input.filterBy]||!str(input.filterValue,256))bad();query=query.eq(columns[input.filterBy],input.filterValue);}
      if(input.from){const date=new Date(input.from);if(!Number.isFinite(date.getTime()))bad();query=query.gte('created_at',date.toISOString());}
      if(input.to){const date=new Date(input.to);if(!Number.isFinite(date.getTime()))bad();query=query.lte('created_at',date.toISOString());}
      if(input.cursor){
        validId(input.cursor);
        const {data:cursor,error:cursorError}=await client.from('audit_logs').select('id,created_at').eq('id',input.cursor).maybeSingle();
        if(cursorError)throw new AdminError(503,'تعذر قراءة مؤشر سجل التدقيق.');
        if(!cursor)throw new AdminError(400,'مؤشر الصفحة غير موجود.');
        const stamp=new Date(cursor.created_at).toISOString();query=query.or(`created_at.lt.${stamp},and(created_at.eq.${stamp},id.lt.${input.cursor})`);
      }
      const {data,error}=await query;
      if(error)throw new AdminError(503,'تعذر تحميل سجل التدقيق من Supabase.');
      const rows=data||[],events=rows.slice(0,50).map((row:any)=>({id:row.id,actorUid:row.actor_id||'',actorEmail:row.actor_email||'',action:row.action,entityType:row.entity_type,entityId:row.entity_id,before:row.before_state,after:row.after_state,reason:row.reason||'',source:row.source,status:row.status,createdAt:row.created_at,changedFields:[],request:{}}));
      return res.status(200).json({events,nextCursor:rows.length>50?events.at(-1)?.id||null:null});
    }
    throw new AdminError(400,'هذه العملية غير متاحة؛ استخدم واجهة Supabase المناسبة.');
  }catch(error){
    return adminError(res,error);
  }
}
