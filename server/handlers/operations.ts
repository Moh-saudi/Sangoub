import { courierApprovalError } from '../../src/validation/accounts.ts';
import { supabaseAdminClient } from '../supabaseAdmin.ts';
import { portalOrderActions, portalOrders } from '../portalOrders.ts';
import { merchantTracking } from '../merchantTracking.ts';
import { merchantActions, merchantAction } from '../merchantActions.ts';
import { AdminError, adminError, validId } from '../adminRequest.ts';
import { mobileCors } from '../mobileCors.ts';
import { operationIdentity, requireOperationalAccess, rolloutReady } from '../operations.ts';
import { sendPushToUsers } from './notifications.ts';

export default async function handler(req: any, res: any) {
 res.setHeader('Cache-Control','no-store');
 if (mobileCors(req,res)) return;
 if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
 try {
  const input = req.body || {};
  const context = await operationIdentity(req);
  const {actor,role,staff} = context;
  if (input.action === 'profile') {
   let store: any = null;
   if (role === 'restaurant' && staff?.storeId) {
    const {data,error} = await supabaseAdminClient().from('stores').select('id,name,category,status').eq('id',staff.storeId).maybeSingle();
    if (error) throw new AdminError(503,'تعذر قراءة المتجر من Supabase.');
    store = data;
   }
   return res.status(200).json({uid:actor.uid,role,duty:role==='restaurant'?staff?.duty||'manager':null,storeId:staff?.storeId||null,
    store:store?{id:staff!.storeId,name:store.name,category:store.category,status:store.status,preparationType:store.category==='supermarket'?'picking':'kitchen'}:null,
    courierStatus:role==='courier'?staff?.courierStatus||null:null,courierApprovalError:role==='courier'?courierApprovalError(staff,context.profile):null,
    displayName:context.profile?.full_name||actor.name||'',needsVerification:!context.verified,
    destination:role==='admin'?'admin_web':role==='restaurant'?'store_preparation':role==='courier'?'courier_tasks':'customer_home',
    capabilities:['operations_v2'],rolloutReady:rolloutReady(),requiresStoreAssignment:role==='restaurant'&&!store});
  }
  if (input.action === 'courier-location') {
   requireOperationalAccess(context);
   if (role !== 'courier') throw new AdminError(403,'تحديث الموقع متاح لحساب المندوب فقط.');
   validId(input.orderId);
   const point = input.coordinates;
   if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude)>90 || Math.abs(point.longitude)>180 || typeof input.active!=='boolean') throw new AdminError(400,'بيانات الموقع غير صالحة.');
   const client = supabaseAdminClient();
   const {data:order,error:orderError} = await client.from('orders').select('id,courier_id,status').eq('id',input.orderId).maybeSingle();
   if (orderError) throw new AdminError(503,'تعذر التحقق من إسناد الطلب.');
   if (!order) throw new AdminError(404,'الطلب غير موجود.');
   if (order.courier_id!==actor.uid) throw new AdminError(403,'هذا الطلب غير مسند إلى حسابك.');
   if (input.active && !['assigned','picked_up','with_courier'].includes(order.status)) throw new AdminError(409,'لا يمكن تتبع هذا الطلب في حالته الحالية.');
   const {error} = await client.from('courier_locations').upsert({courier_id:actor.uid,latitude:point.latitude,longitude:point.longitude,is_online:input.active,updated_at:new Date().toISOString()},{onConflict:'courier_id'});
   if (error) throw new AdminError(503,'تعذر حفظ موقع المندوب في Supabase.');
   return res.status(200).json({ok:true});
  }
  if (input.action==='merchant-tracking') return res.status(200).json(await merchantTracking(input,context));
  if (portalOrderActions.includes(input.action)) return res.status(200).json(await portalOrders(input,context));
  if (merchantActions.includes(input.action)) return res.status(200).json(await merchantAction(input,context));
  if (input.action==='cancel') {
   if (!context.verified) throw new AdminError(403,'أكد بريدك الإلكتروني أو هاتفك أولًا.');
   if (!/^[0-9a-f-]{36}$/i.test(input.orderId||'')) throw new AdminError(400,'معرّف الطلب غير صالح.');
   const {data,error} = await supabaseAdminClient().rpc('cancel_sangoub_order',{p_order_id:input.orderId,p_customer_id:actor.uid});
   if (error) {
    if (error.message?.includes('ORDER_NOT_FOUND')) throw new AdminError(404,'الطلب غير موجود.');
    if (error.code==='23514') throw new AdminError(409,'بدأ تحضير الطلب أو تم دفعه إلكترونيًا؛ تواصل مع الدعم لمراجعته.');
    throw new AdminError(503,'تعذر إلغاء الطلب في Supabase.');
   }

   void (async () => {
     try {
       const client = supabaseAdminClient();
       const { data: ord } = await client.from('orders').select('customer_id, order_number').eq('id', input.orderId).maybeSingle();
       if (ord?.customer_id) {
         await sendPushToUsers([ord.customer_id], {
           title: `تم إلغاء الطلب #${ord.order_number || ''}`,
           body: `تم إلغاء طلبك بنجاح. تواصل معنا إذا كنت بحاجة لأي استفسار.`,
           type: 'operational',
           targetScreen: 'orders',
           targetId: input.orderId,
           data: { orderId: input.orderId },
         });
       }
     } catch {}
   })();

   return res.status(200).json(data||{ok:true});
  }
  if (input.action==='list') return res.status(200).json(await portalOrders({...input,action:'portal-active'},context));
  if (input.action==='inspect') {
   requireOperationalAccess(context);
   if (role!=='admin') throw new AdminError(403,'المتابعة الشاملة للإدارة فقط.');
   if (!/^[0-9a-f-]{36}$/i.test(input.orderId||'')) throw new AdminError(400,'معرّف الطلب غير صالح.');
   const {data,error} = await supabaseAdminClient().from('order_fulfillments').select('*').eq('order_id',input.orderId);
   if (error) throw new AdminError(503,'تعذر تحميل تذاكر الطلب من Supabase.');
   return res.status(200).json({tickets:data||[]});
  }
  if (['prepare','report-issue','resolve-issue'].includes(input.action)) {
   requireOperationalAccess(context);
   if (!/^[0-9a-f-]{36}$/i.test(input.orderId||'') || !/^[0-9a-f-]{36}$/i.test(input.storeId||'')) throw new AdminError(400,'مرجع الطلب أو المتجر غير صالح.');
   if (input.action==='prepare' && !['preparing','ready'].includes(input.next)) throw new AdminError(400,'حالة التحضير غير صالحة.');
   if (input.action!=='prepare' && (typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>500)) throw new AdminError(400,'اكتب وصف المشكلة أو نتيجة المراجعة.');
   const {data,error} = await supabaseAdminClient().rpc('update_sangoub_fulfillment',{
    p_order_id:input.orderId,p_store_id:input.storeId,p_actor_id:actor.uid,p_action:input.action,p_next:input.next||null,
    p_checked_item_ids:Array.isArray(input.checkedItemIds)?input.checkedItemIds:[],p_reason:input.reason?.trim()||null,
   });
   if (error) {
    if (error.message?.includes('ORDER_NOT_FOUND')||error.message?.includes('FULFILLMENT_NOT_FOUND')) throw new AdminError(404,'الطلب أو تذكرة المتجر غير موجودة.');
    if (error.code==='42501') throw new AdminError(403,'حسابك غير مصرح له بإدارة تذكرة هذا المتجر.');
    if (error.code==='40001'||error.code==='23514') throw new AdminError(409,'تغيرت حالة الطلب أو لم يعد متاحًا لهذه العملية.');
    if (error.code==='22023') throw new AdminError(400,'راجع الأصناف المؤكدة أو بيانات الملاحظة.');
    throw new AdminError(503,'تعذر تحديث تذكرة الطلب في Supabase.');
   }

   if (input.action === 'prepare') {
    void (async () => {
      try {
        const client = supabaseAdminClient();
        const { data: ord } = await client.from('orders').select('customer_id, order_number, restaurant_name').eq('id', input.orderId).maybeSingle();
        if (ord?.customer_id) {
          if (input.next === 'preparing') {
            await sendPushToUsers([ord.customer_id], {
              title: `طلبك قيد التحضير الآن 👨‍🍳`,
              body: `بدأ ${ord.restaurant_name || 'المتجر'} بتجهيز أصناف طلبك رقم #${ord.order_number || ''}.`,
              type: 'operational',
              targetScreen: 'track',
              targetId: input.orderId,
              data: { orderId: input.orderId },
            });
          } else if (input.next === 'ready') {
            await sendPushToUsers([ord.customer_id], {
              title: `طلبك جاهز للاستلام 📦`,
              body: `تم تجهيز طلبك رقم #${ord.order_number || ''} وبانتظار استلام المندوب.`,
              type: 'operational',
              targetScreen: 'track',
              targetId: input.orderId,
              data: { orderId: input.orderId },
            });

            const { data: couriers } = await client.from('profiles').select('id').in('role', ['courier', 'store_courier']);
            const courierIds = (couriers || []).map((c: any) => c.id).filter(Boolean);
            if (courierIds.length) {
              await sendPushToUsers(courierIds, {
                title: `طلب جديد جاهز للتوصيل 🛵`,
                body: `طلب جاهز للاستلام من ${ord.restaurant_name || 'المتجر'}. اضغط لمراجعة المهمة.`,
                type: 'operational',
                targetScreen: 'orders',
                targetId: input.orderId,
                data: { orderId: input.orderId },
              });
            }
          }
        }
      } catch (e) {
        console.warn('Fulfillment transition push failed:', e);
      }
    })();
   }

   return res.status(200).json(data||{ok:true});
  }
  if (input.action==='pickup') return res.status(200).json(await portalOrders({...input,action:'courier-pickup'},context));
  if (input.action==='depart') return res.status(200).json(await portalOrders({...input,action:'courier-depart'},context));
  throw new AdminError(400,'عملية تشغيل غير معروفة.');
 } catch (error) { return adminError(res,error); }
}
