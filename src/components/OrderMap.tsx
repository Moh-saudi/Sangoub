import type {Order} from '../types';import {TrackingMap} from './TrackingMap';import {useOrderTracking} from '../services/useOrderTracking';import {useOsmRoute} from '../services/useOsmRoute';
export const trackingStatusText={waiting:'لم يبدأ المندوب مشاركة موقعه بعد.',tracking:'جارٍ تتبع آخر موقع أرسله المندوب.',disconnected:'انقطاع التتبع: لم يصل تحديث موثوق خلال أكثر من دقيقتين أو البيانات مخزنة محليًا.',inactive:'مشاركة الموقع متوقفة.',delivered:'تم تسليم الطلب؛ انتهى التتبع.',cancelled:'أُلغي الطلب؛ انتهى التتبع.',unavailable:'تعذر قراءة التتبع. راجع اتصالك وصلاحية حسابك.'};
/** Read-only adapter. Publishing lives exclusively in CourierTracking inside CourierApp. */
export function OrderMap({order,canShare=false}:{order:Pick<Order,'id'|'orderStatus'|'coordinates'>;canShare?:boolean}){
 const state=useOrderTracking(order.id,order.orderStatus),{route,remaining}=useOsmRoute(state.status==='tracking'?state.point:null,order.coordinates);
 return <section aria-label="تتبع الطلب" className="rounded-xl border p-3 space-y-2 text-sm" dir="rtl"><p role="status">{trackingStatusText[state.status]}</p>
 {order.orderStatus==='with_courier'&&<TrackingMap mapKey={order.id} point={state.point} destination={order.coordinates} route={route}/>}
 {remaining&&state.status==='tracking'&&<p>{route?.isFallback?'تقدير تقريبي بخط مستقيم':'المتبقي تقديريًا عبر الطرق'}: {Math.max(1,Math.ceil(remaining.durationSeconds/60))} دقيقة · {Math.round(remaining.distanceMeters)} متر</p>}
 {state.lastArrivalAt!==null&&<small>وصل آخر تحديث إلى جهازك: {new Date(state.lastArrivalAt).toLocaleTimeString('ar-EG')}</small>}
 {canShare&&<a href="/courier">مشاركة GPS متاحة من بوابة المندوب فقط.</a>}
 </section>;
}
