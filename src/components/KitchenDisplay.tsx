import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, ChefHat, Clock } from "lucide-react";
import type { Order, Store } from "../types";
import { kitchenStage } from "../utils/orderIntegration";

type Stage = "received" | "preparing" | "ready";
const stages: { id: Stage; title: string; color: string }[] = [
  { id: "received", title: "طلبات جديدة", color: "border-orange-300 bg-orange-50" },
  { id: "preparing", title: "قيد التحضير", color: "border-blue-300 bg-blue-50" },
  { id: "ready", title: "جاهزة للاستلام", color: "border-emerald-300 bg-emerald-50" },
];
export function KitchenDisplay({ orders, stores, fixedStoreId, connected, onChange, readOnly = false }: {
  readOnly?: boolean; orders: Order[]; stores: Store[]; fixedStoreId?: string; connected: boolean;
  onChange: (id: string, storeId: string, stage: "preparing" | "ready") => Promise<void>;
}) {
  const [selection, setSelection] = useState("");
  const [ministry, setMinistry] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(Date.now());
  const audio = useRef<AudioContext | null>(null);
  const previous = useRef<Set<string> | null>(null);
  const storeId = fixedStoreId || selection || stores[0]?.id || "";
  const tickets = orders.filter((order) => order.storeIds?.includes(storeId) &&
    ["received", "preparing", "ready"].includes(order.orderStatus));
  const incomingIds = tickets.filter((order) => kitchenStage(order, storeId) === "received").map((order) => order.id).sort().join("|");
  useEffect(() => { previous.current = null; }, [storeId]);
  useEffect(() => {
    if (!connected) return;
    const ids = new Set(incomingIds ? incomingIds.split("|") : []);
    if (previous.current && sound && [...ids].some((id) => !previous.current!.has(id))) {
      const context = audio.current;
      if (context?.state === "running") {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.frequency.value = 740;
        gain.gain.setValueAtTime(0.15, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.55);
        oscillator.start(); oscillator.stop(context.currentTime + 0.6);
      }
    }
    previous.current = ids;
  }, [incomingIds, sound, connected, storeId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(timer); void audio.current?.close(); };
  }, []);
  async function toggleSound() {
    try {
      if (!sound) { if (!audio.current || audio.current.state === "closed") audio.current = new AudioContext(); await audio.current.resume(); }
      setSound(!sound);
    } catch { setError("المتصفح لم يسمح بالصوت. حاول تفعيله مجددًا."); }
  }
  async function advance(order: Order, stage: "preparing" | "ready") {
    setError(""); setPending((ids) => [...ids, order.id]);
    try { await onChange(order.id, storeId, stage); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحديث الطلب."); }
    finally { setPending((ids) => ids.filter((id) => id !== order.id)); }
  }
  return <section dir="rtl" className="space-y-5" aria-label="شاشة المطبخ الحية">
    <div className="admin-module-header bg-slate-900 rounded-3xl p-5 text-white flex flex-wrap justify-between gap-4 items-center">
      <div><p className="text-orange-300 text-xs mb-2">CAPITAL TALABAT · KITCHEN</p><h2 className="text-2xl font-black flex items-center gap-2"><ChefHat /> شاشة المطبخ</h2>
        <p className="text-sm mt-2 text-slate-300">استلام، تحضير، ثم تجهيز للمندوب.</p></div>
      <div className="flex items-center gap-3"><span className={`text-xs ${connected ? "text-emerald-300" : "text-amber-300"}`}>{connected ? "متصل بالطلبات الحية" : "الاتصال غير مؤكد — تحقق من الشبكة"}</span>
        <button onClick={toggleSound} aria-pressed={sound} className="flex gap-2 items-center border border-slate-600 rounded-xl px-3 py-2 text-sm">{sound ? <Bell size={16} /> : <BellOff size={16} />}{sound ? "إيقاف الصوت" : "تفعيل صوت الطلبات"}</button></div>
    </div>
    <div className="flex flex-wrap gap-3">
      {!fixedStoreId && <select aria-label="مطبخ المتجر" value={storeId} onChange={(e) => { setSelection(e.target.value); setMinistry(""); }} className="p-3 border rounded-xl bg-white max-w-full">
        {!stores.length && <option value="">لا توجد متاجر مسجلة</option>}{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
      </select>}
      <select aria-label="تصفية المطبخ بالوزارة" value={ministry} onChange={(e) => setMinistry(e.target.value)} className="p-3 border rounded-xl bg-white max-w-full"><option value="">كل الوزارات</option>
        {[...new Set(tickets.map((order) => order.ministry))].sort().map((name) => <option key={name}>{name}</option>)}
      </select>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-3">{error}</p>}
    {!storeId && <p className="p-6 border rounded-xl bg-white">أضف متجرًا حقيقيًا من إدارة الكتالوج لبدء التشغيل.</p>}
    <div className="grid lg:grid-cols-3 gap-4 items-start">
      {stages.map((stage) => {
        const list = tickets.filter((order) => kitchenStage(order, storeId) === stage.id && (!ministry || order.ministry === ministry)).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
        return <div key={stage.id} className={`border rounded-2xl p-3 ${stage.color}`}><h3 className="font-bold flex justify-between p-2 mb-3">{stage.title}<span>{list.length}</span></h3>
          <div className="space-y-3">{list.map((order) => {
            const items = order.items.filter((item) => item.product.storeId === storeId);
            const minutes = order.createdAt ? Math.max(0, Math.floor((now - Date.parse(order.createdAt)) / 60000)) : null;
            return <article key={order.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-3 border border-white">
              <div className="flex justify-between gap-2"><strong dir="ltr">{order.orderNumber}</strong><span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={13} />{minutes === null ? "وقت غير مسجل" : `${minutes} دقيقة`}</span></div>
              <p className="text-sm font-bold">{order.ministry}</p><p className="text-xs text-slate-500">{order.floorNumber} · {order.roomNumber}</p>
              <ul className="border-y py-3 space-y-2">{items.map((item, index) => <li key={item.id || index} className="text-sm"><strong className="text-orange-700">{item.quantity} × </strong>{item.product.name}
                {Object.keys(item.selectedOptions || {}).length > 0 && <p className="text-xs text-slate-500">{Object.values(item.selectedOptions).join("، ")}</p>}
                {item.notes && <p className="text-xs text-amber-700">{item.notes}</p>}</li>)}
                {!items.length && <li className="text-sm">{order.itemsSummary || order.legacySummary || "تفاصيل الأصناف غير متاحة"}</li>}</ul>
              {order.notes && <p className="text-xs bg-amber-50 p-2 rounded-lg">{order.notes}</p>}
              {readOnly ? <p className="text-xs text-slate-500">التحديث من حساب المتجر في التطبيق.</p> : stage.id !== "ready" ? <button disabled={!connected || pending.includes(order.id)} onClick={() => advance(order, stage.id === "received" ? "preparing" : "ready")} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm disabled:opacity-40">
                {pending.includes(order.id) ? "جارٍ الحفظ…" : stage.id === "received" ? "بدء التحضير" : "جاهز للاستلام"}</button> : <p className="text-emerald-700 text-xs font-bold">{order.orderStatus === "ready" ? "بانتظار استلام المندوب" : "هذا المطبخ جاهز — ننتظر باقي المطابخ"}</p>}
            </article>;
          })}{!list.length && <p className="text-center text-sm text-slate-500 py-8">لا توجد طلبات في هذه المرحلة</p>}</div>
        </div>;
      })}
    </div>
  </section>;
}
