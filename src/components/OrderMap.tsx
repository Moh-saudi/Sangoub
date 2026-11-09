import type {Order, Coordinates} from '../types';
import {TrackingMap} from './TrackingMap';
import {useOrderTracking} from '../services/useOrderTracking';
import {useOsmRoute} from '../services/useOsmRoute';

export const trackingStatusText: Record<string, string> = {
  waiting: 'لم يبدأ المندوب مشاركة موقعه بعد.',
  tracking: 'جارٍ تتبع آخر موقع أرسله المندوب لحظياً.',
  disconnected: 'ننتظر تحديثًا جديدًا من المندوب؛ آخر نقطة غير مؤكدة البث.',
  inactive: 'مشاركة الموقع متوقفة.',
  delivered: 'تم تسليم الطلب بنجاح ✓',
  cancelled: 'أُلغي الطلب؛ انتهى التتبع.',
  unavailable: 'تعذر قراءة التتبع.'
};

export function resolveDistrictCoordinates(address?: string): Coordinates {
  const text = (address || '').toLowerCase();
  if (text.includes('زهرة العاصمة') || text.includes('بدر') || text.includes('المرحلة')) return { latitude: 30.1345, longitude: 31.7456 };
  if (text.includes('حكومي') || text.includes('وزار') || text.includes('برلمان')) return { latitude: 30.0131, longitude: 31.7381 };
  if (text.includes('r3') || text.includes('كابيتال ريزيدنس') || text.includes('المقصد')) return { latitude: 30.0320, longitude: 31.7210 };
  if (text.includes('r2')) return { latitude: 30.0400, longitude: 31.7150 };
  if (text.includes('r7') || text.includes('الجامعة البريطانية') || text.includes('سيليا')) return { latitude: 29.9880, longitude: 31.7050 };
  if (text.includes('r8')) return { latitude: 29.9750, longitude: 31.6920 };
  if (text.includes('شروق')) return { latitude: 30.1450, longitude: 31.6250 };
  if (text.includes('مدينتي')) return { latitude: 30.0980, longitude: 31.6230 };
  return { latitude: 30.0131, longitude: 31.7381 };
}

/** Read-only adapter. Publishing lives exclusively in CourierTracking inside CourierApp. */
export function OrderMap({order,canShare=false,merchant=false}:{order:Pick<Order,'id'|'orderStatus'|'coordinates'|'courierId'> & { deliveryAddress?: string; ministry?: string };canShare?:boolean;merchant?:boolean}){
  const destCoords: Coordinates = (order.coordinates && Number.isFinite(order.coordinates.latitude) && Number.isFinite(order.coordinates.longitude))
    ? order.coordinates
    : resolveDistrictCoordinates(order.deliveryAddress || order.ministry);

  const state = useOrderTracking(order.id, order.orderStatus, true, merchant, order.courierId),
        {route, remaining} = useOsmRoute(state.status === 'tracking' ? state.point : null, destCoords, order.id);

  return (
    <section aria-label="تتبع الطلب" className="rounded-2xl border border-slate-200/90 bg-white p-3 space-y-2 text-sm shadow-2xs" dir="rtl">
      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
        <span role="status">{trackingStatusText[state.status] || state.status}</span>
        <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
          📍 موقع العميل محدد على الخريطة
        </span>
      </div>

      <TrackingMap mapKey={order.id} point={state.point} destination={destCoords} route={state.status === 'tracking' ? route : null} live={state.status === 'tracking'} />

      {remaining && state.status === 'tracking' && (
        <p className="text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center justify-between">
          <span>{route?.isFallback ? 'المسافة التقديرية' : 'المتبقي عبر مسار الطريق'}: {Math.max(1, Math.ceil(remaining.durationSeconds / 60))} دقيقة</span>
          <span className="font-mono text-orange-600 font-black">{Math.round(remaining.distanceMeters)} متر</span>
        </p>
      )}
      {state.lastArrivalAt !== null && (
        <small className="text-[10px] text-slate-400 block text-left">آخر تحديث للموقع: {new Date(state.lastArrivalAt).toLocaleTimeString('ar-EG')}</small>
      )}
      {canShare && <a href="/courier" className="text-xs text-orange-600 font-bold block">مشاركة GPS متاحة من بوابة المندوب فقط.</a>}
    </section>
  );
}
