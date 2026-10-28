import {useCourierTracking} from '../services/useCourierTracking';
import type { Order } from '../types';

export type CourierTrackingOrder = Pick<Order,
  'id' | 'orderStatus' | 'courierId' | 'profileId' | 'coordinates'
>;

/** Integration seam owned by the GPS contributor. No location reads, writes, or UI until supplied. */
export function CourierTracking({order}: { order: CourierTrackingOrder }) {
  const {eligible,state}=useCourierTracking(order);
  if(!eligible)return null;
  return <section aria-label="حالة تتبع المندوب" className="rounded-xl border p-3 text-sm"><p role="status">{state?.message||'جارٍ بدء التتبع…'}</p><p>التتبع أثناء فتح الصفحة فقط. قفل الشاشة أو فتح تطبيق آخر يوقف الإرسال.</p>{state?.wake!=='held'&&<small>إبقاء الشاشة مضاءة غير مؤكد؛ قد لا يدعم المتصفح Wake Lock أو لم يسمح به.</small>}</section>;
}
