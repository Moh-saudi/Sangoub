import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, ChefHat, Clock, CheckCircle2, Bike, Send, AlertCircle, Sparkles, Filter } from "lucide-react";
import type { Order, Store } from "../types";
import { kitchenStage } from "../utils/orderIntegration";

type Stage = "received" | "preparing" | "ready";
const stages: { id: Stage; title: string; color: string; badgeColor: string }[] = [
  {
    id: "received",
    title: "طلبات جديدة بانتظار القبول",
    color: "bg-white/80 border-amber-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)]",
    badgeColor: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  },
  {
    id: "preparing",
    title: "مقبول وجاري التحضير بالمطبخ",
    color: "bg-white/80 border-blue-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)]",
    badgeColor: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  },
  {
    id: "ready",
    title: "تم التجهيز والتسليم للمندوب",
    color: "bg-white/80 border-emerald-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)]",
    badgeColor: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
];

export function KitchenDisplay({
  orders,
  stores,
  fixedStoreId,
  connected,
  onChange,
  readOnly = false,
}: {
  readOnly?: boolean;
  orders: Order[];
  stores: Store[];
  fixedStoreId?: string;
  connected: boolean;
  onChange: (id: string, storeId: string, stage: "preparing" | "ready") => Promise<void>;
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
        oscillator.frequency.value = 740;
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
    <section dir="rtl" className="space-y-5" aria-label="شاشة المطبخ وتذاكر الطلبات">
      {/* Apple / Google Minimalist Top Bar */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-[28px] p-5 shadow-xs flex flex-wrap justify-between gap-4 items-center">
        <div>
          <span className="text-orange-600 font-mono text-[10px] font-bold uppercase tracking-widest bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">
            KITCHEN DISPATCH · محطة التجهيز
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 mt-1.5 tracking-tight">
            <ChefHat className="text-orange-600" /> تذاكر طلبات العملاء الفورية
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            استقبل التذكرة، اكتب ملاحظات الشيف، اضغط «مقبول وجاري التحضير»، ثم «تم التسليم للمندوب».
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${
              connected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {connected ? "● متصل بالبث الحي" : "الاتصال غير مؤكد"}
          </span>

          <button
            onClick={toggleSound}
            aria-pressed={sound}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
              sound
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {sound ? <Bell size={14} className="text-amber-400" /> : <BellOff size={14} />}
            <span>{sound ? "جرس الطلبات مفعّل" : "تفعيل التنبيه الصوتي"}</span>
          </button>
        </div>
      </div>

      {/* Filter Selectors (Apple Clean Inset Pill Selects) */}
      <div className="flex flex-wrap gap-2.5">
        {!fixedStoreId && (
          <select
            aria-label="مطبخ المتجر"
            value={storeId}
            onChange={(e) => {
              setSelection(e.target.value);
              setMinistry("");
            }}
            className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-2xl bg-white text-slate-800 shadow-xs focus:ring-2 focus:ring-orange-500/20"
          >
            {!stores.length && <option value="">لا توجد متاجر مسجلة</option>}
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label="تصفية المطبخ بالوزارة"
          value={ministry}
          onChange={(e) => setMinistry(e.target.value)}
          className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-2xl bg-white text-slate-800 shadow-xs focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="">جميع الوزارات والجهات الحكومية</option>
          {[...new Set(tickets.map((order) => order.ministry))].sort().map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertCircle size={15} className="text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Kanban / Stage Columns (Apple Clean Card Containers) */}
      <div className="grid lg:grid-cols-3 gap-5 items-start">
        {stages.map((stage) => {
          const list = tickets
            .filter((order) => kitchenStage(order, storeId) === stage.id && (!ministry || order.ministry === ministry))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

          return (
            <div
              key={stage.id}
              className={`rounded-[28px] p-4 border backdrop-blur-md ${stage.color}`}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 px-1">
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <span>{stage.title}</span>
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full border text-xs font-black ${stage.badgeColor}`}>
                  {list.length}
                </span>
              </div>

              <div className="space-y-3.5">
                {list.map((order) => {
                  const items = order.items.filter((item) => item.product.storeId === storeId);
                  const minutes = order.createdAt
                    ? Math.max(0, Math.floor((now - Date.parse(order.createdAt)) / 60000))
                    : null;

                  return (
                    <article
                      key={order.id}
                      className="bg-white rounded-[24px] p-4.5 shadow-[0_2px_12px_rgb(0,0,0,0.04)] border border-slate-200/90 space-y-3 hover:border-slate-300 transition-all"
                    >
                      {/* Ticket Header */}
                      <div className="flex justify-between items-center gap-2">
                        <strong className="text-orange-600 font-mono text-base font-black tracking-tight" dir="ltr">
                          {order.orderNumber}
                        </strong>
                        <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full">
                          <Clock size={12} className="text-slate-400" />
                          {minutes === null ? "الآن" : `${minutes} دقيقة`}
                        </span>
                      </div>

                      {/* Customer Office Destination */}
                      <div className="text-xs bg-slate-50/90 p-3 rounded-2xl border border-slate-100">
                        <p className="font-black text-slate-900">{order.ministry}</p>
                        <p className="text-slate-500 mt-0.5">
                          {order.floorNumber} • {order.roomNumber}{" "}
                          {order.profileName ? `(العميل: ${order.profileName})` : ""}
                        </p>
                      </div>

                      {/* Items List */}
                      <ul className="border-y border-slate-100 py-3 space-y-2">
                        {items.map((item, index) => (
                          <li key={item.id || index} className="text-xs">
                            <strong className="text-orange-600 font-bold">{item.quantity} × </strong>
                            <span className="font-bold text-slate-800">{item.product.name}</span>
                            {Object.keys(item.selectedOptions || {}).length > 0 && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {Object.values(item.selectedOptions).join("، ")}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md mt-1 font-medium">
                                {item.notes}
                              </p>
                            )}
                          </li>
                        ))}
                        {!items.length && (
                          <li className="text-xs text-slate-500">
                            {order.itemsSummary || order.legacySummary || "تفاصيل الأصناف غير متاحة"}
                          </li>
                        )}
                      </ul>

                      {/* Customer Note */}
                      {order.notes && (
                        <div className="text-xs bg-amber-50/80 border border-amber-200/50 p-2.5 rounded-xl text-amber-900 font-medium">
                          <strong className="block text-[10px] text-amber-700 uppercase font-bold mb-0.5">
                            ملاحظة العميل الخاصة:
                          </strong>
                          {order.notes}
                        </div>
                      )}

                      {/* Kitchen Note Field */}
                      <div>
                        <input
                          type="text"
                          placeholder="اكتب ملاحظة على التذكرة (اختياري)..."
                          value={ticketNotes[order.id] || ""}
                          onChange={(e) => setTicketNotes({ ...ticketNotes, [order.id]: e.target.value })}
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        />
                      </div>

                      {/* Action Buttons (Apple Tactile Pill Buttons) */}
                      {readOnly ? (
                        <p className="text-xs text-slate-400 text-center py-1">التحديث من حساب المتجر في التطبيق.</p>
                      ) : stage.id !== "ready" ? (
                        <button
                          disabled={!connected || pending.includes(order.id)}
                          onClick={() => advance(order, stage.id === "received" ? "preparing" : "ready")}
                          className={`w-full py-3 rounded-2xl text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-40 ${
                            stage.id === "received"
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20"
                              : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20"
                          }`}
                        >
                          {pending.includes(order.id) ? (
                            "جارٍ الحفظ والمزامنة…"
                          ) : stage.id === "received" ? (
                            <>
                              <ChefHat size={16} /> مقبول وجاري التحضير
                            </>
                          ) : (
                            <>
                              <Bike size={16} /> تم التسليم للمندوب
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200/80 p-2.5 rounded-2xl text-center">
                          <p className="text-emerald-800 text-xs font-black flex items-center justify-center gap-1.5">
                            <CheckCircle2 size={15} /> تم تسليم الطلب للمندوب بنجاح
                          </p>
                          <p className="text-[10px] text-emerald-600 mt-0.5">
                            الطلب في عهدة المندوب ويظهر للعميل في شاشة التتبع
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}

                {!list.length && (
                  <div className="text-center py-12 text-slate-400 text-xs font-bold">
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
