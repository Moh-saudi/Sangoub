import { useState } from 'react';
import { TrackingMap } from './TrackingMap';
import { useOsmRoute } from '../services/useOsmRoute';
import { useCourierTracking } from '../services/useCourierTracking';
import type { Order } from '../types';
import { MapPin, Navigation, RotateCw, Map as MapIcon, ChevronDown, ChevronUp, AlertCircle, Signal } from 'lucide-react';

export type CourierTrackingOrder = Pick<Order,
  'id' | 'orderStatus' | 'courierId' | 'profileId' | 'coordinates'
>;

/** Single integration point: automatically active only for the assigned signed-in courier. */
export function CourierTracking({ order }: { order: CourierTrackingOrder }) {
  const { eligible, state, restart } = useCourierTracking(order);
  const [expanded, setExpanded] = useState(false);
  const { route, remaining } = useOsmRoute(
    eligible && state?.status === 'active' ? state.point : null,
    eligible ? order.coordinates : null,
    order.id
  );

  if (!eligible) return null;

  const isActive = state?.status === 'active';
  const isError = state?.status === 'stopped' || state?.status === 'gps-error';

  return (
    <section aria-label="حالة تتبع المندوب" className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 my-3 text-xs text-slate-700">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] ${
            isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
            isError ? 'bg-rose-100 text-rose-800 border border-rose-200' :
            'bg-amber-100 text-amber-800 border border-amber-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-600 courier-live-beacon' : isError ? 'bg-rose-600' : 'bg-amber-600'}`} />
            <span>{state?.message || 'جارٍ تهيئة GPS…'}</span>
          </span>
          {remaining && (
            <span className="font-medium text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
              {Math.max(1, Math.ceil(remaining.durationSeconds / 60))} دقيقة · {Math.round(remaining.distanceMeters)} م
            </span>
          )}
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 font-bold text-slate-700 transition-colors cursor-pointer"
        >
          <MapIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>{expanded ? 'إخفاء الخريطة' : 'عرض الخريطة'}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {isError && (
        <div className="flex items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl p-2.5 my-2">
          <div className="flex items-center gap-1.5 text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>تعذر إرسال إشارة الموقع. تحقق من إذن الموقع بالجهاز.</span>
          </div>
          <button
            type="button"
            onClick={restart}
            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 flex items-center gap-1 shrink-0"
          >
            <RotateCw className="w-3 h-3" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      )}

      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner">
            <TrackingMap
              mapKey={order.id}
              point={state?.point}
              destination={order.coordinates}
              route={state?.status === 'active' ? route : null}
              live={state?.status === 'active'}
            />
          </div>
          <p className="text-[11px] text-slate-500 text-center">
            يتم تحديث موقعك للعميل والإدارة مباشرة أثناء فتح هذه الصفحة.
          </p>
        </div>
      )}

      {order.coordinates && (
        <a
          className="mt-2.5 inline-flex items-center gap-1.5 font-bold text-orange-600 hover:text-orange-700 text-xs"
          href={`https://www.google.com/maps/dir/?api=1&destination=${order.coordinates.latitude},${order.coordinates.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>فتح الاتجاهات في Google Maps</span>
        </a>
      )}
    </section>
  );
}
