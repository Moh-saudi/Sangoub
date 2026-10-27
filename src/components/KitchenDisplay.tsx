import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, ChefHat, Clock, CheckCircle2, Bike, FileText, Send } from "lucide-react";
import type { Order, Store } from "../types";
import { kitchenStage } from "../utils/orderIntegration";

type Stage = "received" | "preparing" | "ready";
const stages: { id: Stage; title: string; color: string }[] = [
  { id: "received", title: "طلبات جديدة بانتظار القبول", color: "border-orange-300 bg-orange-50" },
  { id: "preparing", title: "مقبول وجاري التحضير بالمطبخ", color: "border-blue-300 bg-blue-50" },
  { id: "ready", title: "تم التجهيز والتسليم للمندوب", color: "border-emerald-300 bg-emerald-50" },
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
      <div className="admin-module-header bg-slate-900 rounded-3xl p-5 text-white flex flex-wrap justify-between gap-4 items-center">
        <div>
          <p className="text-orange-300 text-xs mb-2">تذاكر المطبخ وإسناد المناديب · KITCHEN TICKETS</p>
          <h2 className="text-2xl font-black flex items-center gap-2">
            <ChefHat /> تذاكر طلبات العملاء الفورية
          </h2>
          <p className="text-sm mt-2 text-slate-300">
            استقبل التذكرة، اكتب ملاحظات التحضير، اختر «مقبول وجاري التحضير»، ثم «تم التسليم للمندوب».
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold ${connected ? "text-emerald-300" : "text-amber-300"}`}>
            {connected ? "● متصل باستقبال الطلبات الحية" : "الاتصال غير مؤكد — تحقق من الشبكة"}
          </span>
          <button
            onClick={toggleSound}
            aria-pressed={sound}
            className="flex gap-2 items-center border border-slate-600 rounded-xl px-3 py-2 text-sm hover:bg-slate-800 transition"
          >
            {sound ? <Bell size={16} /> : <BellOff size={16} />}
            {sound ? "إيقاف جرس الطلبات" : "تفعيل جرس الطلبات"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {!fixedStoreId && (
          <select
            aria-label="مطبخ المتجر"
            value={storeId}
            onChange={(e) => {
              setSelection(e.target.value);
              setMinistry("");
            }}
            className="p-3 border rounded-xl bg-white max-w-full text-xs font-bold"
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
          className="p-3 border rounded-xl bg-white max-w-full text-xs font-bold"
        >
          <option value="">كل الوزارات والجهات الحكومية</option>
          {[...new Set(tickets.map((order) => order.ministry))].sort().map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-3 text-xs">{error}</p>}
      {!storeId && <p className="p-6 border rounded-xl bg-white text-sm">أضف متجرًا حقيقيًا من إدارة الكتالوج لبدء التشغيل.</p>}

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {stages.map((stage) => {
          const list = tickets
            .filter((order) => kitchenStage(order, storeId) === stage.id && (!ministry || order.ministry === ministry))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

          return (
            <div key={stage.id} className={`border rounded-2xl p-3.5 ${stage.color}`}>
              <h3 className="font-black text-sm flex justify-between p-2 mb-3 text-slate-800">
                {stage.title}
                <span className="bg-white/80 px-2.5 py-0.5 rounded-full border text-xs">{list.length}</span>
              </h3>
              <div className="space-y-3.5">
                {list.map((order) => {
                  const items = order.items.filter((item) => item.product.storeId === storeId);
                  const minutes = order.createdAt ? Math.max(0, Math.floor((now - Date.parse(order.createdAt)) / 60000)) : null;

                  return (
                    <article key={order.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-3 border border-slate-200">
                      <div className="flex justify-between items-center gap-2">
                        <strong className="text-orange-700 font-mono text-base font-black" dir="ltr">
                          {order.orderNumber}
                        </strong>
                        <span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                          <Clock size={13} />
                          {minutes === null ? "الآن" : `${minutes} دقيقة`}
                        </span>
                      </div>

                      <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <p className="font-black text-slate-900">{order.ministry}</p>
                        <p className="text-slate-500 mt-0.5">
                          {order.floorNumber} · {order.roomNumber} {order.profileName ? `(العميل: ${order.profileName})` : ""}
                        </p>
                      </div>

                      <ul className="border-y py-2.5 space-y-2">
                        {items.map((item, index) => (
                          <li key={item.id || index} className="text-xs">
                            <strong className="text-orange-700">{item.quantity} × </strong>
                            <span className="font-bold text-slate-800">{item.product.name}</span>
                            {Object.keys(item.selectedOptions || {}).length > 0 && (
                              <p className="text-[11px] text-slate-500">{Object.values(item.selectedOptions).join("، ")}</p>
                            )}
                            {item.notes && <p className="text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5">{item.notes}</p>}
                          </li>
                        ))}
                        {!items.length && (
                          <li className="text-xs text-slate-600">{order.itemsSummary || order.legacySummary || "تفاصيل الأصناف غير متاحة"}</li>
                        )}
                      </ul>

                      {order.notes && (
                        <p className="text-xs bg-amber-50 p-2 rounded-lg text-amber-900 font-medium">
                          <strong>ملاحظة العميل:</strong> {order.notes}
                        </p>
                      )}

                      {/* كتابة ملاحظة من التاجر على التذكرة */}
                      <div className="pt-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="اكتب ملاحظة على التذكرة (اختياري)..."
                            value={ticketNotes[order.id] || ""}
                            onChange={(e) => setTicketNotes({ ...ticketNotes, [order.id]: e.target.value })}
                            className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800"
                          />
                        </div>
                      </div>

                      {readOnly ? (
                        <p className="text-xs text-slate-500">التحديث من حساب المتجر في التطبيق.</p>
                      ) : stage.id !== "ready" ? (
                        <button
                          disabled={!connected || pending.includes(order.id)}
                          onClick={() => advance(order, stage.id === "received" ? "preparing" : "ready")}
                          className={`w-full py-3 rounded-xl text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition disabled:opacity-40 ${
                            stage.id === "received"
                              ? "bg-blue-600 hover:bg-blue-700"
                              : "bg-emerald-600 hover:bg-emerald-700"
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
                        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-center">
                          <p className="text-emerald-800 text-xs font-black flex items-center justify-center gap-1">
                            <CheckCircle2 size={14} /> تم تسليم الطلب للمندوب بنجاح
                          </p>
                          <p className="text-[10px] text-emerald-600 mt-0.5">الطلب الآن في عهدة المندوب ويظهر للعميل في التتبع</p>
                        </div>
                      )}
                    </article>
                  );
                })}
                {!list.length && <p className="text-center text-xs text-slate-500 py-8">لا توجد تذاكر في هذه المرحلة</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
