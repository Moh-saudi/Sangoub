import { createClient } from '@supabase/supabase-js';
import { writeOrderSignals } from '../orderSignals.ts';
import {customerOrderHistory} from '../customerOrders.ts';
import {checkoutQuoteHash} from '../checkoutQuote.ts';
import {ensureOrderPayment} from '../orderPayments.ts';
import { productCandidateIds } from '../productIdentity.ts';
import { auditInTransaction, attachAuditContext } from "../audit.ts";
import { FieldValue } from "firebase-admin/firestore";
import { randomInt } from "node:crypto";
import { adminServices } from "../firebaseAdmin.ts";
import { buildOrder } from "../orderBuilder.ts";
import { rolloutReady, writeTickets } from "../operations.ts";
import { mobileCors } from "../mobileCors.ts";
import { GeideaGateway, ChatAmanGateway } from "../integrations.ts";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tvnsqatkaqyubeznhnmu.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9ORqYV9HK0AbacKtYSRZiA_K7hcJ4yI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (mobileCors(req, res)) return;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return res.status(401).json({ error: "يرجى تسجيل الدخول." });
  try {
    const { auth, db } = adminServices();
    let identity: any = null;
    let isSupabase = false;
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${bearer}`,
        },
      });
      if (userRes.ok) {
        const u = await userRes.json();
        if (u?.id) {
          identity = {
            uid: u.id,
            email: u.email || '',
            email_verified: Boolean(u.email_confirmed_at || u.confirmed_at || true),
            phone_number: u.phone || '',
            auth_time: Math.floor(Date.now() / 1000),
          };
          isSupabase = true;
        }
      }
    } catch {}
    if (!identity) {
      try {
        identity = await auth.verifyIdToken(bearer, true);
      } catch {
        return res
          .status(401)
          .json({ error: "جلسة الدخول غير صالحة. سجّل الدخول مجددًا." });
      }
    }
    const access=(await db.doc('accountAccess/'+identity.uid).get()).data();
    if(access?.disabled||access?.operationLocked||identity.auth_time<=(access?.revokedBefore||0))return res.status(401).json({error:'أُلغيت هذه الجلسة أو عُلّق الحساب. سجل الدخول من جديد.'});
    attachAuditContext(req,identity);
    if (!identity.email_verified && !identity.phone_number) return res.status(403).json({error:'أكد بريدك الإلكتروني أو هاتفك أولًا.'});
    const input = req.body;
    if(input?.action==='profile-update'){
      const source=input.data,limits:Record<string,number>={fullName:120,phone:30,ministry:120,floorNumber:60,roomNumber:80,avatarUrl:100000};
      if(!source||typeof source!=='object'||Array.isArray(source)||Object.keys(source).some(key=>!Object.hasOwn(limits,key)&&key!=='coordinates'))return res.status(400).json({error:'حقول ملف غير مسموحة.'});
      const patch:any={};for(const [key,value]of Object.entries(source)){if(key==='coordinates'){const point=value as any;if(!point||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)return res.status(400).json({error:'إحداثيات غير صالحة.'});patch.coordinates={latitude:point.latitude,longitude:point.longitude};continue;}if(typeof value!=='string'||value.length>limits[key])return res.status(400).json({error:'بيانات ملف غير صالحة.'});patch[key]=value.trim();}
      if(patch.avatarUrl && !patch.avatarUrl.startsWith('data:image/')){try{const url=new URL(patch.avatarUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{return res.status(400).json({error:'رابط صورة غير صالح.'});}}
      const ref=db.doc('users/'+identity.uid);const profile=await ref.get();if(!profile.exists)return res.status(409).json({error:'أكمل ملف الحساب أولًا.'});
      if(profile.data()?.defaultAddress){
        if(patch.ministry!==undefined&&patch.ministry!==profile.data()?.ministry){patch['defaultAddress.fullAddress']=patch.ministry;patch['defaultAddress.details']='';}
        if(patch.coordinates)patch['defaultAddress.coordinates']=patch.coordinates;
      }
      await ref.update({...patch,updatedAt:FieldValue.serverTimestamp()});return res.status(200).json({ok:true});
    }
    if(input?.action==='profile-address'){
      const address=input.address;if(!address||typeof address!=='object'||Array.isArray(address))return res.status(400).json({error:'عنوان غير صالح.'});
      const clean:any={};for(const key of ['title','city','district','street','fullAddress','details','notes']){const value=address[key]??'';if(typeof value!=='string'||value.length>500)return res.status(400).json({error:'بيانات عنوان غير صالحة.'});clean[key]=value.trim();}
      if(!clean.fullAddress)return res.status(400).json({error:'اكتب العنوان الكامل.'});
      if(address.coordinates){const latitude=address.coordinates.latitude??address.coordinates.lat,longitude=address.coordinates.longitude??address.coordinates.lng;if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return res.status(400).json({error:'إحداثيات عنوان غير صالحة.'});clean.coordinates={latitude,longitude};}
      const ref=db.doc('users/'+identity.uid);if(!(await ref.get()).exists)return res.status(409).json({error:'أكمل ملف الحساب أولًا.'});
      if(input.makeDefault===true)await ref.update({defaultAddress:clean,ministry:clean.fullAddress.slice(0,120),coordinates:clean.coordinates||FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()});
      return res.status(200).json({ok:true,address:clean});
    }

    if(input?.action==='payment-session'){
      if(process.env.FIRESTORE_EMULATOR_HOST)return res.status(200).json({paymentError:'جلسة الدفع غير متاحة في المحاكي.'});
      if(typeof input.orderId!=='string'||!/^[\w-]{1,200}$/.test(input.orderId))return res.status(400).json({error:'مرجع الطلب غير صالح.'});
      try{const payment=await ensureOrderPayment(db,input.orderId,identity.email||'',identity.uid);return res.status(200).json({...payment,paymentError:(payment as any).error||null});}catch{return res.status(409).json({error:'تعذر متابعة الدفع لهذا الطلب. راجع حالته أو تواصل مع الدعم.'});}
    }
    if(input?.action==='order-status'){
      if(typeof input.orderId!=='string'||!/^[\w-]{1,200}$/.test(input.orderId))return res.status(400).json({error:'مرجع الطلب غير صالح.'});
      if (isSupabase) {
        const { data: supaOrder } = await supabase
          .from('orders')
          .select('*, order_items(*), stores(name, logo)')
          .eq('id', input.orderId)
          .maybeSingle();
        if (supaOrder && supaOrder.customer_id === identity.uid) {
          const mapped = {
            id: supaOrder.id,
            profileId: supaOrder.customer_id,
            storeId: supaOrder.store_id,
            storeName: supaOrder.stores?.name || 'متجر سنجوب',
            storeIds: [supaOrder.store_id],
            orderStatus: supaOrder.status,
            status: supaOrder.status,
            subtotal: Number(supaOrder.subtotal) || 0,
            deliveryFee: Number(supaOrder.delivery_fee) || 0,
            total: Number(supaOrder.total_amount) || 0,
            deliveryAddress: supaOrder.delivery_address || supaOrder.delivery_ministry || '',
            ministry: supaOrder.delivery_ministry || '',
            floorNumber: supaOrder.delivery_floor || '',
            roomNumber: supaOrder.delivery_room || '',
            paymentMethod: supaOrder.payment_method || 'cash',
            paymentStatus: supaOrder.payment_status || 'pending',
            notes: supaOrder.notes || '',
            createdAt: supaOrder.created_at,
            items: (supaOrder.order_items || []).map((it: any) => ({
              product: { id: it.product_id, name: it.product_name, price: Number(it.price) },
              quantity: it.quantity,
              selectedOptions: it.selected_options || {},
            })),
          };
          return res.status(200).json({ order: mapped, tracking: null });
        }
      }
      const snapshot=await db.doc('orders/'+input.orderId).get();
      if(!snapshot.exists||snapshot.data()?.profileId!==identity.uid)return res.status(404).json({error:'الطلب غير موجود.'});
      const value=snapshot.data()!;let tracking:any=null;
      if(value.orderStatus==='with_courier'){const location=(await db.doc('tracking/'+snapshot.id).get()).data();const point=location?.coordinates;if(point&&Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)&&Math.abs(point.latitude)<=90&&Math.abs(point.longitude)<=180)tracking={coordinates:point,active:location!.active!==false,updatedAt:location!.updatedAt?.toDate?.().toISOString()||null};}
      return res.status(200).json({order:{...value,id:snapshot.id,createdAt:value.createdAt?.toDate?.().toISOString()||value.createdAt},tracking});
    }
    if(input?.action==='customer-orders'){
      if (isSupabase) {
        const { data: supaOrders } = await supabase
          .from('orders')
          .select('*, order_items(*), stores(name, logo)')
          .eq('customer_id', identity.uid)
          .order('created_at', { ascending: false });
        if (supaOrders && supaOrders.length > 0) {
          const mapped = supaOrders.map((o: any) => ({
            id: o.id,
            profileId: o.customer_id,
            storeId: o.store_id,
            storeName: o.stores?.name || 'متجر سنجوب',
            storeIds: [o.store_id],
            orderStatus: o.status,
            status: o.status,
            subtotal: Number(o.subtotal) || 0,
            deliveryFee: Number(o.delivery_fee) || 0,
            total: Number(o.total_amount) || 0,
            deliveryAddress: o.delivery_address || o.delivery_ministry || '',
            ministry: o.delivery_ministry || '',
            floorNumber: o.delivery_floor || '',
            roomNumber: o.delivery_room || '',
            paymentMethod: o.payment_method || 'cash',
            paymentStatus: o.payment_status || 'pending',
            notes: o.notes || '',
            createdAt: o.created_at,
            items: (o.order_items || []).map((it: any) => ({
              product: { id: it.product_id, name: it.product_name, price: Number(it.price) },
              quantity: it.quantity,
              selectedOptions: it.selected_options || {},
            })),
          }));
          return res.status(200).json({ orders: mapped });
        }
      }
      return res.status(200).json({orders:await customerOrderHistory(db,identity.uid)});
    }
    if(input?.paymentMethod==='geidea'&&!process.env.FIRESTORE_EMULATOR_HOST&&!GeideaGateway.isConfigured())return res.status(503).json({error:'الدفع الإلكتروني غير متاح حاليًا. لم يتم إنشاء طلب جديد.'});
    if (
      !input ||
      typeof input.id !== "string" ||
      !/^ord-[a-f0-9-]{36}$/.test(input.id) ||
      !Array.isArray(input.items) ||
      input.items.length > 50 ||
      !input.items.length
    )
      return res.status(400).json({ error: "بيانات الطلب غير صالحة." });
    if (
      input.items.some(
        (i: any) =>
          typeof i?.product?.id !== "string" ||
          !/^[\w-]{1,128}$/.test(i.product.id),
      ) ||
      (input.couponCode && !/^[\w-]{1,40}$/.test(input.couponCode))
    )
      return res.status(400).json({ error: "معرّف صنف أو خصم غير صالح." });
    const ref = db.collection("orders").doc(`${identity.uid}_${input.id}`);
    const {order:result,created} = await db.runTransaction<Record<string, any>>(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) return {order:existing.data()!,created:false};
      const operationsConfig = await tx.get(db.doc("appConfig/operations"));
      const useFulfillments = rolloutReady() && operationsConfig.data()?.enabled === true;
      const quotaRef = db.collection("orderLimits").doc(identity.uid);
      const quota = await tx.get(quotaRef);
      const windowStart = Date.now() - 24 * 60 * 60 * 1000;
      const recent = quota.data()?.startedAt > windowStart;
      if (recent && quota.data()!.count >= 30)
        throw new Error("ORDER_RATE_LIMIT");
      const profile = await tx.get(db.collection("users").doc(identity.uid));
      if (!profile.exists && !isSupabase) throw new Error("أكمل بيانات الحساب أولًا.");
      const productIds = [
        ...new Set<string>(
          input.items.map((i: any) => i.product.id),
        ),
      ];
      const productDocs = await tx.getAll(...productIds.map(id => db.collection("products").doc(id)));
      // Read exact IDs once; legacy suffix lookups are only needed for missing products.
      const fallbackIds=[...new Set(productDocs.filter(doc=>!doc.exists).flatMap(doc=>productCandidateIds(doc.id).slice(1)))].filter(id=>!productIds.includes(id));
      if(fallbackIds.length) productDocs.push(...await tx.getAll(...fallbackIds.map(id=>db.collection('products').doc(id))));
      const products = new Map(
        productDocs
          .filter((d) => d.exists)
          .map((d) => [d.id, { ...d.data(), id: d.id } as any]),
      );
      const missingProductIds = productIds.filter(id => !products.has(id));
      if (missingProductIds.length > 0) {
        try {
          const { data: sbProds } = await supabase.from('products').select('*').in('id', missingProductIds);
          if (sbProds && sbProds.length) {
            for (const sp of sbProds) {
              products.set(sp.id, {
                id: sp.id,
                storeId: sp.store_id,
                name: sp.name,
                nameEn: sp.name_en || '',
                description: sp.description || '',
                price: Number(sp.price) || 0,
                originalPrice: sp.original_price ? Number(sp.original_price) : undefined,
                category: sp.category || 'عام',
                inStock: Boolean(sp.is_available),
                archived: Boolean(sp.archived),
                imageUrl: sp.image_url || '',
                optionGroups: sp.options || [],
              } as any);
            }
          }
        } catch (err) {
          console.warn('[orders handler] Supabase product fallback notice:', err);
        }
      }
      const storeIds = [
        ...new Set<string>(Array.from(products.values()).map((p) => p.storeId)),
      ];
      const storeDocs = storeIds.length ? await tx.getAll(...storeIds.map(id => db.collection("stores").doc(id))) : [];
      const stores = new Map(
        storeDocs
          .filter((d) => d.exists)
          .map((d) => [d.id, { ...d.data(), id: d.id } as any]),
      );
      const missingStoreIds = storeIds.filter(id => !stores.has(id));
      if (missingStoreIds.length > 0) {
        try {
          const { data: sbStores } = await supabase.from('stores').select('*').in('id', missingStoreIds);
          if (sbStores && sbStores.length) {
            for (const st of sbStores) {
              stores.set(st.id, {
                id: st.id,
                name: st.name,
                nameEn: st.name_en || '',
                type: st.type || '',
                category: st.category,
                status: st.status || 'open',
                minOrder: Number(st.min_order) || 0,
                deliveryFee: Number(st.delivery_fee) || 10,
                locationInDistrict: st.location_in_district || '',
                commissionRate: Number(st.commission_rate) || 10,
                taxRate: Number(st.tax_rate) || 14,
              } as any);
            }
          }
        } catch (err) {
          console.warn('[orders handler] Supabase store fallback notice:', err);
        }
      }
      const coupon = input.couponCode
        ? (await tx.get(db.collection("coupons").doc(input.couponCode))).data()
        : undefined;
      const order = buildOrder(
        input,
        identity.uid,
        products,
        stores,
        coupon as any,
      );
      order.id = ref.id;
      if(input.action==='quote'&&order.storeIds.length>1&&!useFulfillments)throw new Error('اختر متجرًا واحدًا لكل طلب حتى تفعيل دورة استلام المتاجر المتعددة.');
      if(input.action==='quote')return {order,created:false};
      if(input.quoteHash&&input.quoteHash!==checkoutQuoteHash(order))throw new Error('QUOTE_CHANGED');
      if(order.paymentMethod==='geidea'&&!useFulfillments)Object.assign(order,{pendingStoreIds:order.storeIds,storeIds:[]});
      if (useFulfillments) {
        Object.assign(order, { fulfillmentVersion: 2, paymentStatus: order.paymentMethod === "cash" ? "cash_on_delivery" : "pending" });
        writeTickets(db, tx, order, stores);
      }
      tx.set(quotaRef, {
        startedAt: recent ? quota.data()!.startedAt : Date.now(),
        count: recent ? quota.data()!.count + 1 : 1,
      });
      tx.create(ref, {
        ...order,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeOrderSignals(db, tx, order);
      tx.create(db.doc('customerOrderHistory/'+identity.uid+'/orders/'+ref.id),{createdAt:FieldValue.serverTimestamp()});
      tx.create(db.collection("orderSecrets").doc(ref.id), {
        otpCode: randomInt(1000, 10000).toString(), attempts: 0,
      });
      auditInTransaction(db, tx, identity, "orders.create", "orders", ref.id, null, order, "", "orders-api");
      return {order,created:true};
    });
    const publicOrder={...result,id:ref.id,createdAt:result?.createdAt?.toDate?result.createdAt.toDate().toISOString():result?.createdAt};
    if(input.action==='quote')return res.status(200).json({quote:publicOrder,quoteHash:checkoutQuoteHash(result as any)});
    const paymentResult:any=result.paymentMethod==='geidea'&&!process.env.FIRESTORE_EMULATOR_HOST?await ensureOrderPayment(db,ref.id,identity.email||'',identity.uid):null;
    if (created && isSupabase) {
      try {
        const STORE_SLUG_MAP: Record<string, string> = {
          'store-foul-hind': '27d12743-8106-4ef0-ba3c-84abefdb75d6',
          'store-supermarket-capital': '54a6c2f6-6c29-4177-ac65-32fadddea83d',
          'store-ministry-coffee': '55508f0e-f818-452e-b946-ab803fe9d637',
          'store-karam-elsham': '27d12743-8106-4ef0-ba3c-84abefdb75d6',
          'store-taza-bakery': '55508f0e-f818-452e-b946-ab803fe9d637',
        };
        const rawStoreId = result.storeIds?.[0];
        const storeId = (rawStoreId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawStoreId))
          ? rawStoreId
          : (STORE_SLUG_MAP[rawStoreId] || '27d12743-8106-4ef0-ba3c-84abefdb75d6');

        const userSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
          global: {
            headers: {
              Authorization: `Bearer ${bearer}`,
              apikey: SUPABASE_KEY,
            }
          }
        });

        const supaOrderId = (ref.id.includes('-') && ref.id.length === 36) ? ref.id : undefined;
        const { data: insertedOrder, error: insErr } = await userSupabase.from('orders').insert({
          ...(supaOrderId ? { id: supaOrderId } : {}),
          customer_id: identity.uid,
          store_id: storeId,
          status: 'pending',
          subtotal: result.subtotal || 0,
          delivery_fee: result.deliveryFee || 0,
          total_amount: result.total || 0,
          delivery_address: input.fullAddress || input.ministry || 'عنوان التوصيل',
          delivery_ministry: input.ministry || '',
          delivery_floor: input.floorNumber || '',
          delivery_room: input.roomNumber || '',
          payment_method: result.paymentMethod || 'cash',
          payment_status: result.paymentMethod === 'cash' ? 'pending' : 'paid',
          notes: input.notes || '',
        }).select().maybeSingle();

        if (insErr) {
          console.warn('[Supabase Order Mirror Error]:', insErr);
        } else if (insertedOrder?.id) {
          const items = (result.items || input.items || []).map((i: any) => ({
            order_id: insertedOrder.id,
            product_id: (i.product?.id && i.product.id.length === 36) ? i.product.id : null,
            product_name: i.product?.name || 'صنف',
            price: i.product?.price || 0,
            quantity: i.quantity || 1,
            selected_options: i.selectedOptions || {},
          }));
          if (items.length) {
            const { error: itemsErr } = await userSupabase.from('order_items').insert(items);
            if (itemsErr) console.warn('[Supabase Order Items Error]:', itemsErr);
          }
        }
      } catch (sbErr) {
        console.warn('Supabase order mirror exception:', sbErr);
      }
    }

    // إرسال رسالة تأكيد الطلب الفورية عبر واتساب شات أمان
    if (created && result.paymentMethod!=="geidea" && input.phone && !process.env.FIRESTORE_EMULATOR_HOST) {
      ChatAmanGateway.sendOrderConfirmation({
        phone: input.phone,
        customerName: input.profileName || "عميل سنجوب",
        orderNumber: ref.id.slice(0, 10),
        totalAmount: result.total,
        currency: "ج.م",
        deliveryAddress: `${input.ministry || input.fullAddress || "عنوان التوصيل"} ${input.floorNumber ? `- دور ${input.floorNumber}` : ""} ${input.roomNumber ? `- شقة/مكتب ${input.roomNumber}` : ""}`.trim(),
      }).catch((waErr) => console.warn("ChatAman confirmation warning:", waErr));
    }

    return res.status(200).json({
      order: publicOrder,
      requiresPaymentRedirect: !!paymentResult?.redirectUrl,
      redirectUrl: paymentResult?.redirectUrl || null,
      sessionId: paymentResult?.sessionId || null,
      paymentError: paymentResult?.error || (result.paymentMethod==='geidea'&&process.env.FIRESTORE_EMULATOR_HOST?'جلسة الدفع غير متاحة في المحاكي.':null),
    });
  } catch (error: any) {
    if(error.message==='QUOTE_CHANGED')return res.status(409).json({error:'تغير السعر أو رسوم التوصيل. راجع الإجمالي مرة أخرى قبل التأكيد.'});
    if (error.message === "ORDER_RATE_LIMIT")
      return res
        .status(429)
        .json({ error: "تجاوزت عدد الطلبات اليومي. تواصل مع الدعم." });
    const infrastructure =
      /credential|permission|PERMISSION_DENIED|UNAUTHENTICATED|default credentials|ENOTFOUND|project.*not found|NOT_FOUND|network/i.test(
        error.message || "",
      );
    if (infrastructure) {
      console.error(
        "Order infrastructure failure:",
        error.code || "unavailable",
      );
      return res
        .status(503)
        .json({
          error: "خدمة الطلبات غير متاحة حاليًا. يرجى المحاولة لاحقًا.",
        });
    }
    return res.status(400).json({ error: error.message || "تعذر حفظ الطلب." });
  }
}
