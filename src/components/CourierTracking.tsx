import {useState} from 'react';
import {TrackingMap} from './TrackingMap';
import {useOsmRoute} from '../services/useOsmRoute';
import {useCourierTracking} from '../services/useCourierTracking';
import type { Order } from '../types';

export type CourierTrackingOrder = Pick<Order,
  'id' | 'orderStatus' | 'courierId' | 'profileId' | 'coordinates'
>;

/** Single integration point: automatically active only for the assigned signed-in courier. */
export function CourierTracking({order}: { order: CourierTrackingOrder }) {
  const {eligible,state}=useCourierTracking(order);
  const [expanded,setExpanded]=useState(false);
  const {route,remaining}=useOsmRoute(eligible?state?.point:null,eligible?order.coordinates:null);
  if(!eligible)return null;
  return <section aria-label="حالة تتبع المندوب" className="rounded-xl border p-3 text-sm"><p role="status">{state?.message||'جارٍ بدء التتبع…'}</p>
    <p className="text-xs">التتبع أثناء فتح الصفحة فقط. قفل الشاشة أو فتح تطبيق آخر يوقف الإرسال.</p>
    {state?.wake!=='held'&&<small>إبقاء الشاشة مضاءة غير مؤكد؛ قد لا يدعم المتصفح Wake Lock أو لم يسمح به.</small>}
    {remaining&&<p>{route?.isFallback?'تقدير تقريبي بخط مستقيم، وليس مسار طرق':'المسافة والوقت تقديريان بحسب المسار'}: {Math.round(remaining.distanceMeters)} متر · {Math.max(1,Math.ceil(remaining.durationSeconds/60))} دقيقة</p>}
    <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'طي الخريطة':'عرض الخريطة'}</button>
    {expanded&&<><TrackingMap mapKey={order.id} point={state?.point} destination={order.coordinates} route={route}/><p className="text-xs">إحداثيات المتجر غير متاحة في استجابة هذا الطلب؛ لا يُعرض موقع افتراضي له.</p></>}
    {order.coordinates&&<a className="block mt-2" href={`https://www.google.com/maps/dir/?api=1&destination=${order.coordinates.latitude},${order.coordinates.longitude}`} target="_blank" rel="noopener noreferrer">فتح Google Maps — سيتوقف التتبع عند مغادرة الصفحة</a>}
  </section>;
}
