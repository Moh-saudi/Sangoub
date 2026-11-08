import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  ChefHat,
  PackageCheck,
  Clock,
  CheckCircle2,
  Bike,
  AlertCircle,
  Navigation,
  MapPin,
  FileText,
} from "lucide-react";
import type { Order, Store } from "../types";
import { kitchenStage } from "../utils/orderIntegration";

type Stage = "received" | "preparing" | "ready";

const stages: { id: Stage; title: string; color: string; badgeColor: string }[] = [
  {
    id: "received",
    title: "طلبات جديدة بانتظار القبول",
    color: "border-amber-200/90 bg-amber-50/20",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    id: "preparing",
    title: "مقبول وجارٍ التحضير والتجهيز",
    color: "border-blue-200/90 bg-blue-50/20",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    id: "ready",
    title: "تم التجهيز وجاهز بالمحل",
    color: "border-emerald-200/90 bg-emerald-50/20",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
];

export function KitchenDisplay({
  orders,
  stores,
  fixedStoreId,
  connected,
  onChange,
  onNavigateRadar,
  readOnly = false,
}: {
  readOnly?: boolean;
  orders: Order[];
  stores: Store[];
  fixedStoreId?: string;
  connected: boolean;
  onChange: (id: string, storeId: string, stage: "preparing" | "ready") => Promise<void>;
  onNavigateRadar?: () => void;
}) {
  const [selection, setSelection] = useState("");
  const [ministry, setMinistry] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [ticketNotes, setTicketNotes] = useState<Record<string, string>>({});
  const audio = useRef<AudioContext | null>(null);
  const previous = useRef<Set<string> | null>(null);

  const storeId = fixedStoreId || selection || stores[0]?.id || "";
  const tickets = orders.filter(
    (order) =>
      order.storeIds?.includes(storeId) &&
      ["received", "preparing", "ready"].includes(order.orderStatus)
  );

  const incomingIds = tickets
    .filter((order) => kitchenStage(order, storeId) === "received")
    .map((order) => order.id)
    .sort()
    .join("|");

  useEffect(() => {
    previous.current = null;
  }, [storeId]);

  useEffect(() => {
    if (!connected) return;
    const ids = new Set(incomingIds ? incomingIds.split("|") : []);
    if (previous.current && sound && [...ids].some((id) => !previous.current!.has(id))) {
      const context = audio.current;
      if (context?.state === "running") {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.frequency.setValueAtTime(659.25, context.currentTime);
        oscillator.frequency.setValueAtTime(880, context.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.55);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.6);
      }
    }
    previous.current = ids;
  }, [incomingIds, sound, connected, storeId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearInterval(timer);
      void audio.current?.close();
    };
  }, []);

  async function toggleSound() {
    try {
      if (!sound) {
        if (!audio.current || audio.current.state === "closed") audio.current = new AudioContext();
        await audio.current.resume();
        const ctx = audio.current;
        if (ctx && ctx.state === "running") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        }
      }
      setSound(!sound);
    } catch {
      setError("المتصفح لم يسمح بالصوت. حاول تفعيله مجددًا.");
    }
  }

  async function advance(order: Order, stage: "preparing" | "ready") {
    setError("");
    setPending((ids) => [...ids, order.id]);
    try {
      await onChange(order.id, storeId, stage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث الطلب.");
    } finally {
      setPending((ids) => ids.filter((id) => id !== order.id));
    }
  }

  return (
    <section dir="rtl" className="space-y-3.5" aria-label="محطة تحضير وتجهيز الطلبات">
      {/* ── 1. Compact & Clean Header Bar ── */}
      <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex flex-wrap justify-between gap-2.5 items-center">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck size={16} className="text-orange-600 shrink-0" />
            <h2 className="text-xs sm:text-sm font-black text-slate-900">
              تذاكر وتحضير الطلبات الفورية
            </h2>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                connected
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {connected ? "● متصل لحظياً" : "الاتصال غير مؤكد"}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            استقبل الطلب، أضف ملاحظات التجهيز، اضغط «قبول وبدء التجهيز»، ثم «جاهز للاستلام بالمحل».
          </p>
        </div>

        {/* Header Actions & Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Destination Filter */}
          <select
            aria-label="تصفية الطلبات حسب منطقة أو وجهة التوصيل"
            value={ministry}
            onChange={(e) => setMinistry(e.target.value)}
            className="h-8 px-2.5 text-[11px] font-bold border border-slate-200 rounded-lg bg-slate-50 text-slate-800 shadow-2xs focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="">كافة مناطق ووجهات التوصيل</option>
            {[...new Set(tickets.map((order) => order.deliveryAddress || order.ministry).filter(Boolean))].sort().map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>

          {/* Sound Alert Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={sound}
            className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${
              sound
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
          >
            {sound ? <Bell size={13} className="text-amber-400" /> : <BellOff size={13} />}
            <span>{sound ? "تنبيه مفعّل" : "تفعيل التنبيه الصوتي"}</span>
          </button>

          {/* Radar Shortcut */}
          {onNavigateRadar && (
            <button
              type="button"
              onClick={onNavigateRadar}
              className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer"
              title="الانتقال لشاشة تتبع المناديب ورادار التوصيل"
            >
              <Navigation size={13} className="text-orange-600" />
              <span>رادار التوصيل</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-[11px] font-bold flex items-center gap-2">
          <AlertCircle size={14} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 2. Kanban Stage Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-start">
        {stages.map((stage) => {
          const list = tickets
            .filter((order) => kitchenStage(order, storeId) === stage.id && (!ministry || order.ministry === ministry))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

          return (
            <div
              key={stage.id}
              className={`rounded-xl p-3 border shadow-2xs ${stage.color}`}
            >
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200/60 px-0.5">
                <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>{stage.title}</span>
                </h3>
                <span className={`px-2 py-0.2 rounded-full border text-[10px] font-black font-mono ${stage.badgeColor}`}>
                  {list.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {list.map((order) => {
                  const items = order.items.filter((item) => item.product.storeId === storeId);
                  const minutes = order.createdAt
                    ? Math.max(0, Math.floor((now - Date.parse(order.createdAt)) / 60000))
                    : null;
                  const hasCourier = Boolean(
                    order.courierId &&
                    order.courierId !== 'null' &&
                    order.courierId.trim() !== '' &&
                    order.courierName &&
                    order.courierName !== 'null' &&
                    order.courierName.trim() !== '' &&
                    !order.courierName.includes('غير محدد')
                  );

                  return (
                    <article
                      key={order.id}
                      className="bg-white rounded-lg p-3 shadow-2xs border border-slate-200 space-y-2 hover:border-slate-300 transition-all"
                    >
                      {/* Ticket Header */}
                      <div className="flex justify-between items-center gap-2">
                        <strong className="text-orange-600 font-mono text-xs font-black tracking-tight" dir="ltr">
                          {order.orderNumber}
                        </strong>
                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded font-mono">
                          <Clock size={11} className="text-slate-400" />
                          {minutes === null ? "الآن" : `${minutes} دقيقة`}
                        </span>
                      </div>

                      {/* Customer Destination / Address */}
                      <div className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-0.5">
                        <p className="font-bold text-slate-900 flex items-start gap-1">
                          <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                          <span>{order.deliveryAddress || order.ministry || "عنوان العميل المعتمد"}</span>
                        </p>
                        {(order.floorNumber || order.roomNumber || order.profileName) && (
                          <p className="text-[10px] text-slate-500 pr-4">
                            {order.floorNumber ? `الدور: ${order.floorNumber}` : ''}
                            {order.roomNumber ? ` • رقم: ${order.roomNumber}` : ''}
                            {order.profileName ? ` (العميل: ${order.profileName})` : ''}
                          </p>
                        )}
                      </div>

                      {/* Items List */}
                      <ul className="border-y border-slate-100 py-2 space-y-1">
                        {items.map((item, index) => (
                          <li key={item.id || index} className="text-[11px] flex flex-wrap items-baseline gap-1">
                            <strong className="text-orange-600 font-bold">{item.quantity} × </strong>
                            <span className="font-bold text-slate-800">{item.product.name}</span>
                            {Object.keys(item.selectedOptions || {}).length > 0 && (
                              <span className="text-[10px] text-slate-400">
                                ({Object.values(item.selectedOptions).join("، ")})
                              </span>
                            )}
                            {item.notes && (
                              <p className="w-full text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded mt-0.5 font-medium">
                                {item.notes}
                              </p>
                            )}
                          </li>
                        ))}
                        {!items.length && (
                          <li className="text-[10px] text-slate-400">
                            {order.itemsSummary || order.legacySummary || "تفاصيل الأصناف غير متاحة"}
                          </li>
                        )}
                      </ul>

                      {/* Customer Special Note */}
                      {order.notes && (
                        <div className="text-[10px] bg-amber-50/80 border border-amber-200/60 p-2 rounded-lg text-amber-900 font-medium">
                          <strong className="block text-[9px] text-amber-700 uppercase font-bold mb-0.5">
                            ملاحظة العميل الخاصة:
                          </strong>
                          {order.notes}
                        </div>
                      )}

                      {/* Kitchen Note Field */}
                      <div>
                        <input
                          type="text"
                          placeholder="ملاحظة المطبخ (اختياري)..."
                          value={ticketNotes[order.id] || ""}
                          onChange={(e) => setTicketNotes({ ...ticketNotes, [order.id]: e.target.value })}
                          className="w-full text-[10px] h-7 px-2 border border-slate-200 rounded-md bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      {/* Action Area Based on Stage & Real Courier State */}
                      {readOnly ? (
                        <p className="text-[10px] text-slate-400 text-center py-1">التحديث من حساب المتجر في التطبيق.</p>
                      ) : stage.id !== "ready" ? (
                        <button
                          type="button"
                          disabled={!connected || pending.includes(order.id)}
                          onClick={() => advance(order, stage.id === "received" ? "preparing" : "ready")}
                          className={`w-full h-8 rounded-lg text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer ${
                            stage.id === "received"
                              ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                              : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                          }`}
                        >
                          {pending.includes(order.id) ? (
                            "جارٍ الحفظ والمزامنة…"
                          ) : stage.id === "received" ? (
                            <>
                              <PackageCheck size={14} />
                              <span>قبول وبدء التجهيز</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} />
                              <span>تم التجهيز وجاهز للاستلام 📦</span>
                            </>
                          )}
                        </button>
                      ) : (
                        /* Stage: READY (تم التجهيز) -> Differentiate assigned courier vs waiting for courier */
                        <div className="space-y-1.5">
                          {hasCourier ? (
                            <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-center space-y-0.5">
                              <p className="text-emerald-900 text-[11px] font-bold flex items-center justify-center gap-1">
                                <Bike size={13} className="text-emerald-700" />
                                <span>الكابتن المكلف: {order.courierName || 'مندوب معتمد'}</span>
                              </p>
                              <p className="text-[9px] text-emerald-700">
                                الطلب جاهز ومغلف بالمحل — بانتظار استلام الكابتن للطلب
                              </p>
                            </div>
                          ) : (
                            <div className="bg-amber-50/80 border border-amber-200 p-2 rounded-lg text-center space-y-0.5">
                              <p className="text-amber-900 text-[11px] font-bold flex items-center justify-center gap-1">
                                <Clock size={13} className="text-amber-700" />
                                <span>جاهز ومغلف — بانتظار تكليف المندوب ⏳</span>
                              </p>
                              <p className="text-[9px] text-amber-700/90 leading-tight">
                                لم يتم تعيين مندوب حتى الآن؛ الطلب معروض في رادار المناديب للتكليف والاستلام.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}

                {!list.length && (
                  <div className="text-center py-8 text-slate-400 text-xs font-bold">
                    لا توجد تذاكر في هذه المرحلة
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
