import { courierApprovalError } from '../../src/validation/accounts.ts';
import { writeOrderSignals } from '../orderSignals.ts';
import {settlementAction} from '../settlements.ts';
import { adminSangoubRequests } from '../sangoubRequests.ts';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireAdmin, AdminError, adminError, validId } from '../adminRequest.ts';
import { auditInTransaction, auditSafe, auditRecord } from '../audit.ts';
import { nextKitchenUpdate, normalizeOrder } from '../../src/utils/orderIntegration.ts';
import { assignmentRef, closeOperationalQueues, paymentReady, ticketRef } from '../operations.ts';
import { mobileCors } from '../mobileCors.ts';

const fields:Record<string,string[]>={
  products:['id','storeId','storeName','name','nameEn','description','price','originalPrice','category','categoryId','barcode','merchantPosSku','verticalId','imageType','imageUrl','imageKey','inStock','archived','badge','isPopular','optionGroups'],
  stores:['commissionRate','taxRate','taxRegistrationNumber','pricesIncludeTax','id','name','nameEn','locationInDistrict','type','category','status','deliveryTime','minOrder','deliveryFee','imageUrl','bannerUrl','logoUrl','logoKey','bannerKey','imageKey','logo','banner','rating','ratingCount'],
  coupons:['code','discountType','value','minOrder','title','description'],staff:['role','name','phone','storeId'],partnerApplications:['status'],jobApplications:['status'],
  orders:['orderStatus','courierId','courierName','courierPhone'],
};
const bad=(message='بيانات غير صالحة.')=>{throw new AdminError(400,message);};
const str=(v:any,max:number,required=false)=>(!required&&(v===undefined||v===null||v===''))||(typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0));
const num=(v:any,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
function validate(type:string,id:string,d:any){
  if(type==='products'&&(!str(d.name,120,true)||!str(d.description,1000)||!num(d.price,100000)||typeof d.inStock!=='boolean'||!str(d.storeId,128,true)||!str(d.category,120,true)))bad('راجع اسم الصنف وسعره ومتجره.');
  if(type==='products'&&d.originalPrice!==undefined&&(!num(d.originalPrice,100000)||d.originalPrice<d.price))bad('السعر قبل الخصم غير صالح.');
  if(type==='products'&&d.archived===true&&d.inStock!==false)bad('المنتج المؤرشف لا يمكن إتاحته.');
  if(type==='stores'&&d.commissionRate!==undefined&&!num(d.commissionRate,100))bad('نسبة التعاقد غير صالحة.');
  if(type==='stores'&&(!str(d.name,120,true)||!num(d.minOrder,100000)||!num(d.deliveryFee,1000)||!['open','closed','busy'].includes(d.status)))bad('راجع بيانات المتجر ورسومه.');
  if(type==='stores'&&((d.taxRate!==undefined&&!num(d.taxRate,100))||(d.pricesIncludeTax!==undefined&&typeof d.pricesIncludeTax!=='boolean')||(d.taxRegistrationNumber!==undefined&&!str(d.taxRegistrationNumber,60))||(d.taxRate>0&&!str(d.taxRegistrationNumber,60,true))))bad('راجع نسبة الضريبة ورقم تسجيل المتجر.');
  if(type==='staff'&&(!['restaurant','courier'].includes(d.role)||!str(d.name,120,true)||!str(d.phone,30)))bad('راجع دور الموظف وبياناته.');
  if(type==='coupons'&&(d.code!==id||!['fixed','percent'].includes(d.discountType)||!num(d.value,d.discountType==='percent'?100:10000)||!num(d.minOrder,100000)))bad('راجع قيمة الخصم والحد الأدنى.');
  if(['partnerApplications','jobApplications'].includes(type)&&!['pending','contacted','approved','rejected'].includes(d.status))bad();
  for(const key of ['imageUrl','bannerUrl','logoUrl'])if(d[key]){try{if(new URL(d[key]).protocol!=='https:')bad();}catch{bad('رابط الصورة يجب أن يستخدم HTTPS.');}}
}
export default async function handler(req:any,res:any){
  res.setHeader('Cache-Control','no-store');if(mobileCors(req,res))return;
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  let context: Awaited<ReturnType<typeof requireAdmin>>|undefined;
  try{
    const {db,auth,actor}=context=await requireAdmin(req);const input=req.body||{};
    if(input.action==='contract-list'){const records=await db.collection('merchantContracts').limit(500).get();return res.status(200).json({contracts:records.docs.map(d=>({...d.data(),id:d.id}))});}
    if(['settlement-list','settlement-preview','settlement-save'].includes(input.action))return res.status(200).json(await settlementAction(input,context));
    if(['sangoub-list','sangoub-update'].includes(input.action)) return res.status(200).json(await adminSangoubRequests(input,context));
    if(input.action==='session'){
      if(!['open','logout'].includes(input.event))bad();
      await db.collection('auditLogs').add(auditRecord(actor,'admin.workspace.'+input.event,'admins',actor.uid,null,{event:input.event}));
      return res.status(200).json({ok:true});
    }
    if(input.action==='audit-export'){
      await db.collection('auditLogs').add({...auditRecord(actor,'audit.export','auditLogs','export',null,{clientReportedCount:input.count,filters:auditSafe(input.filters)}),status:'success'});
      return res.status(200).json({ok:true});
    }
    if(input.action==='audit'){
      let q:any=db.collection('auditLogs');
      if(input.filterValue){if(!['actorUid','actorEmail','action','entityType','status','entityId'].includes(input.filterBy)||!str(input.filterValue,256))bad();q=q.where(input.filterBy,'==',input.filterValue);}
      if(input.from){const date=new Date(input.from);if(!Number.isFinite(date.getTime()))bad();q=q.where('createdAt','>=',Timestamp.fromDate(date));}
      if(input.to){const date=new Date(input.to);if(!Number.isFinite(date.getTime()))bad();q=q.where('createdAt','<=',Timestamp.fromDate(date));}
      q=q.orderBy('createdAt','desc');
      if(input.cursor){validId(input.cursor);const cursor=await db.doc('auditLogs/'+input.cursor).get();if(!cursor.exists)bad('مؤشر الصفحة غير موجود.');q=q.startAfter(cursor);}
      const snapshot=await q.limit(51).get();const docs=snapshot.docs.slice(0,50);
      return res.status(200).json({events:docs.map((doc:any)=>({id:doc.id,...auditSafe(doc.data())})),nextCursor:snapshot.size>50?docs.at(-1)?.id:null});
    }
    if(!['save','delete','kitchen','approve'].includes(input.action))bad();
    const type=input.action==='kitchen'?'orders':input.collection;const id=input.id;validId(id);
    if(typeof type!=='string'||!Object.hasOwn(fields,type))bad('المجموعة غير متاحة من هذه الواجهة.');
    if(input.action==='delete'&&!['coupons','staff'].includes(type))bad('هذه البيانات تُؤرشف ولا تُحذف.');
    const patch=input.data||{};
    if(type==='stores'&&patch.commissionRate!==undefined&&!num(patch.commissionRate,100))bad('راجع نسبة التعاقد.');
    if(typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(key=>!fields[type].includes(key)))bad('تتضمن العملية حقولًا غير مسموحة.');
    if(type==='staff'&&input.action!=='delete'&&(await auth.getUser(id)).disabled)bad('الحساب معطل.');
    await db.runTransaction(async tx=>{
      const ref=db.doc(type+'/'+id);const [own,target,actorAccess]=await Promise.all([tx.get(db.doc('admins/'+actor.uid)),tx.get(ref),tx.get(db.doc('accountAccess/'+actor.uid))]);
      const control=actorAccess.data();if(control?.disabled||control?.operationLocked||actor.auth_time<=(control?.revokedBefore||0))throw new AdminError(403,'انتهت صلاحية الجلسة.');
      if(!own.exists)throw new AdminError(403,'انتهت صلاحية الإدارة.');
      let before=target.data()||null;
      if(type==='products'&&(!before||!before.name)){
        try{
          const spRes=await fetch(`${process.env.VITE_SUPABASE_URL||'https://tvnsqatkaqyubeznhnmu.supabase.co'}/rest/v1/products?id=eq.${id}&select=*`,{
            headers:{'apikey':process.env.VITE_SUPABASE_ANON_KEY||''}
          });
          const spList=await spRes.json();
          if(Array.isArray(spList)&&spList.length>0){
            const sp=spList[0];
            before={
              id:sp.id,
              name:sp.name,
              nameEn:sp.name_en||'',
              description:sp.description||'',
              price:Number(sp.price)||0,
              originalPrice:sp.original_price?Number(sp.original_price):undefined,
              category:sp.category||'عام',
              storeId:sp.store_id||'',
              inStock:Boolean(sp.is_available),
              archived:Boolean(sp.archived),
              imageUrl:sp.image_url||'',
              imageType:sp.image_type||'croissant',
              ...(before||{}),
            };
          }
        }catch{}
      }
      let after:any={...(before||{}),...patch};
      const contractRef=type==='stores'?db.doc('merchantContracts/'+id):null;
      const contractBefore=contractRef?await tx.get(contractRef):null;
      if(type==='stores')delete after.commissionRate;
      if(input.action==='delete'&&!before)throw new AdminError(404,'السجل غير موجود.');
      if(input.action==='approve'){
        if(type!=='partnerApplications'||!before)bad();validId(input.store?.id);const store=input.store;
        if(Object.keys(store).some(key=>!fields.stores.includes(key)))bad();validate('stores',store.id,store);
        if((await tx.get(db.doc('stores/'+store.id))).exists)throw new AdminError(409,'المتجر موجود بالفعل.');
        tx.create(db.doc('stores/'+store.id),{...store,updatedAt:FieldValue.serverTimestamp()});after={...before,status:'approved'};
        auditInTransaction(db,tx,actor,'stores.create','stores',store.id,null,store);
      }else if(input.action==='kitchen'){
        if(!before)bad();if(!paymentReady(before))throw new AdminError(409,'يلزم تأكيد الدفع قبل التحضير.');if(before?.fulfillmentVersion===2)throw new AdminError(409,'التحضير من حساب المتجر في التطبيق.');validId(input.storeId);if(!['preparing','ready'].includes(input.next))bad();after={...before,...nextKitchenUpdate(normalizeOrder({...before,id}),input.storeId,input.next)};
      }else if(type==='orders'){
        if(before?.paymentMethod==='geidea'&&before.paymentStatus!=='paid'&&['preparing','ready','with_courier','delivered'].includes(patch.orderStatus))throw new AdminError(409,'يلزم تأكيد الدفع الإلكتروني قبل تجهيز الطلب أو تسليمه.');
        if(!before||['delivered','cancelled'].includes(before.orderStatus))throw new AdminError(409,'الطلب مغلق أو غير موجود.');
        let resolvedCourier:any;
        if(after.orderStatus==='with_courier'||'courierId'in patch){
          validId(after.courierId);const courier=await tx.get(db.doc('staff/'+after.courierId));let account;
          try{account=await auth.getUser(after.courierId);}catch{bad('حساب المندوب غير موجود.');}
          if(courier.data()?.role!=='courier'||(courier.data()?.courierStatus&&courier.data()?.courierStatus!=='active')||account!.disabled)bad('المندوب غير متاح.');
          const courierProfile=await tx.get(db.doc('users/'+after.courierId));const approvalError=courierApprovalError(courier.data(),courierProfile.data());if(approvalError)bad(approvalError);
          resolvedCourier=courier.data();
        }
        if(before.paymentMethod!=='cash'&&paymentReady(before)&&patch.orderStatus==='cancelled')throw new AdminError(409,'الطلب مدفوع؛ راجع إجراءات الاسترداد قبل الإلغاء.');
        if(before.fulfillmentVersion!==2){
          if('courierId'in patch){if(before.orderStatus!=='ready'||!paymentReady(before))throw new AdminError(409,'تعيين المندوب متاح بعد الجاهزية وتأكيد الدفع.');after.orderStatus='ready';}
          else if(before.orderStatus==='ready'&&patch.orderStatus==='with_courier')throw new AdminError(409,'يؤكد المندوب الاستلام من حسابه قبل الانتقال للتوصيل.');
        }
        if(before.fulfillmentVersion===2){
          const tickets=await Promise.all((before.storeIds||[]).map((storeId:string)=>tx.get(ticketRef(db,id,storeId))));
          if(patch.orderStatus==='cancelled'){
            if(before.paymentMethod!=='cash'&&paymentReady(before))throw new AdminError(409,'الطلب مدفوع إلكترونيًا؛ راجع إجراءات الاسترداد قبل الإلغاء.');
            if(tickets.some(ticket=>ticket.data()?.status==='picked_up'))throw new AdminError(409,'استُلمت أصناف من المتاجر؛ راجع التسوية قبل الإلغاء.');
            for(const ticket of tickets)if(ticket.exists)tx.update(ticket.ref,{status:'cancelled',updatedAt:FieldValue.serverTimestamp()});
            closeOperationalQueues(db,tx,{...before,id});
          }else{
            if('courierId'in patch){
              if(before.orderStatus!=='ready'||!paymentReady(before)||tickets.some(ticket=>ticket.data()?.status!=='ready'||ticket.data()?.issueOpen))throw new AdminError(409,'التكليف متاح بعد جاهزية جميع المتاجر وقبل استلام أي نقطة.');
              if(before.courierId&&before.courierId!==after.courierId)tx.set(assignmentRef(db,before.courierId,id),{active:false},{merge:true});
              // Assignment is not pickup. Preserve the ready state for old admin clients too.
              after.orderStatus='ready';
            }else if(after.orderStatus!==before.orderStatus)throw new AdminError(409,'تحديث التحضير والاستلام يتم من حسابات فريق التشغيل في التطبيق.');
          }
        }
        const allowed:Record<string,string[]>={received:['received','preparing','cancelled'],preparing:['preparing','ready','cancelled'],ready:['ready','with_courier','cancelled'],with_courier:['with_courier','cancelled']};
        if(!allowed[before.orderStatus]?.includes(after.orderStatus))bad('انتقال حالة الطلب غير مسموح.');
        if(after.orderStatus==='with_courier'||'courierId'in patch){
          after.courierName=resolvedCourier.name;after.courierPhone=resolvedCourier.phone;
          if('courierId'in patch&&before.courierId!==after.courierId)tx.delete(db.doc('tracking/'+id));
          if(before.fulfillmentVersion===2)tx.set(assignmentRef(db,after.courierId,id),{orderId:id,active:true,assignedAt:FieldValue.serverTimestamp()});
        }else if('courierId'in patch)bad('تعيين المندوب متاح للطلبات الجاهزة فقط.');
      }else if(type==='staff'){
        if(id===actor.uid||(await tx.get(db.doc('admins/'+id))).exists)bad('استخدم قسم المستخدمين لتعديل صلاحيات الإدارة.');
        if((await tx.get(db.doc('adminUserLocks/'+id))).exists)throw new AdminError(409,'عملية مستخدم أخرى قيد التنفيذ.');
        const user=await tx.get(db.doc('users/'+id));if(!user.exists)bad('يجب وجود ملف مستخدم أولًا.');
        const assigned=await tx.get(db.collection('orders').where('courierId','==',id));
        const kitchen=before?.role==='restaurant'?await tx.get(db.collection('orders').where('storeIds','array-contains',before.storeId)):null;
        if((input.action==='delete'||before?.role!==after.role||before?.storeId!==after.storeId)&&[...assigned.docs,...(kitchen?.docs||[])].some(d=>!['delivered','cancelled'].includes(d.data().orderStatus)))throw new AdminError(409,'أعد تعيين الطلبات النشطة أولًا.');
        if(after.role==='restaurant'&&input.action!=='delete')validId(after.storeId);
        if(after.role==='restaurant'&&input.action!=='delete'&&!(await tx.get(db.doc('stores/'+after.storeId))).exists)bad('المتجر غير موجود.');
        if(after.role==='courier')delete after.storeId;
        const profileChange={role:input.action==='delete'?'employee':after.role};
        tx.update(db.doc('users/'+id),{...profileChange,updatedAt:FieldValue.serverTimestamp()});
        auditInTransaction(db,tx,actor,'users.role.sync','users',id,user.data(),{...user.data(),...profileChange});
      }else if(type==='products'){
        // If the product is being restored or was archived, allow assigning or reassigning the store
        if(before?.storeId&&before.storeId!==after.storeId&&!before.archived){
          const oldStore=await tx.get(db.doc('stores/'+before.storeId));
          if(oldStore.exists)bad('لا يمكن نقل صنف نشط لمتجر آخر مباشرة؛ يرجى أرشفته أولاً.');
        }
        if(!after.storeId)bad('اختر المتجر المسؤول عن المنتج قبل إتاحته أو حفظه.');
        validId(after.storeId);
        const storeRef=db.doc('stores/'+after.storeId);
        const storeSnap=await tx.get(storeRef);
        if(!storeSnap.exists){
          if(after.storeId==='a0000000-0000-0000-0000-000000000001'){
            tx.set(storeRef,{
              id:'a0000000-0000-0000-0000-000000000001',
              name:'متجر سنجوب إكسبريس المركزي',
              nameEn:'Sangoub Express Mart',
              type:'مخزن وسوبرماركت مركزي - سنجوب',
              category:'supermarket',
              status:'open',
              rating:5,
              ratingCount:1,
              deliveryTime:'15-25 دقيقة',
              minOrder:0,
              deliveryFee:10,
              locationInDistrict:'الفرع المركزي - العاصمة الإدارية',
              updatedAt:FieldValue.serverTimestamp(),
            },{merge:true});
          }else{
            bad('المتجر غير موجود.');
          }
        }
      }
      if(input.action!=='delete'&&type!=='orders')validate(type,id,after);
      if(contractRef&&patch.commissionRate!==undefined){const contract={commissionRate:patch.commissionRate,updatedAt:FieldValue.serverTimestamp(),updatedBy:actor.uid};tx.set(contractRef,contract,{merge:true});auditInTransaction(db,tx,actor,'contract.updated','merchantContracts',id,contractBefore?.data()||null,contract);}

      if(input.action==='delete')tx.delete(ref);else tx.set(ref,{...after,updatedAt:FieldValue.serverTimestamp(),...(type==='orders'&&after.orderStatus==='ready'&&before?.orderStatus!=='ready'?{readyAt:FieldValue.serverTimestamp()}:{})});
      if(type==='orders')writeOrderSignals(db,tx,{...after,id},{...before,id});
      auditInTransaction(db,tx,actor,type+'.'+(input.action==='delete'?'delete':!before?'create':input.action==='kitchen'?'kitchen':'update'),type,id,before,input.action==='delete'?null:after);
    });
    return res.status(200).json({ok:true});
  }catch(error){
    if(context&&['save','delete','kitchen','approve'].includes(req.body?.action)){
      try{await context.db.collection('auditLogs').add({...auditRecord(context.actor,'admin.mutation.blocked',String(req.body?.collection||'orders').slice(0,100),String(req.body?.id||'invalid').slice(0,128),null,null),status:error instanceof AdminError?'blocked':'failed',requestedChange:auditSafe(req.body),errorCode:error instanceof AdminError?'http-'+error.status:'mutation-failed'});}catch{}
    }
    return adminError(res,error);
  }
}
