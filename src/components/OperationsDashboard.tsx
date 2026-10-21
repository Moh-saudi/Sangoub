import { useState } from "react";
import { Activity, Bike, Building2, CheckCheck, Package } from "lucide-react";
import type { Order, Store } from "../types";
import { MINISTRIES_LIST } from "../data/seedData";
import { cairoDay, dailyOperations } from "../utils/orderIntegration";
import { formatEGP } from "../utils/orderCalculations";
import { OrderMap } from "./OrderMap";

export type OperationsCourier = { id: string; name: string; phone: string };
export function OperationsDashboard({ orders, stores, couriers, connected }: {
  orders: Order[]; stores: Store[]; couriers: OperationsCourier[]; connected: boolean;
}) {
  const [day, setDay] = useState(cairoDay(new Date()));
  const [ministry, setMinistry] = useState("");
  const [mapId, setMapId] = useState("");
  const metrics = dailyOperations(orders, day);
  const visibleOrders = ministry ? orders.filter((order) => order.ministry === ministry) : orders;
  const visible = dailyOperations(visibleOrders, day);
  const mapOrders = visibleOrders.filter((order) => order.courierId && order.orderStatus === "with_courier");
  const mapOrder = mapOrders.find((order) => order.id === mapId) || mapOrders[0];
  const ministries = [...new Set<string>([...MINISTRIES_LIST, ...orders.map((order) => order.ministry).filter(Boolean)])];
  return <section dir="rtl" className="space-y-5" aria-label="مركز العمليات الحي">
    <header className="rounded-3xl bg-gradient-to-l from-slate-900 to-slate-800 text-white p-6 flex flex-wrap justify-between items-center gap-4">
      <div><p className="text-orange-300 text-xs mb-2">CAPITAL TALABAT · OPERATIONS</p><h1 className="text-2xl sm:text-3xl font-black">الحي الحكومي، في شاشة واحدة.</h1><p className="text-slate-300 text-sm mt-3">الطلبات والمطابخ والتوصيل — من قاعدة التشغيل المشتركة.</p></div>
      <span role="status" className={`text-xs px-3 py-2 rounded-full ${connected ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"}`}>{connected ? "● اتصال حي بالطلبات" : "● لا يوجد تأكيد اتصال بالخادم"}</span>
    </header>
    <div className="flex flex-wrap gap-3 items-end">
      <label className="text-xs space-y-1"><span className="block">يوم التشغيل · توقيت القاهرة</span><input aria-label="يوم التشغيل" type="date" value={day} onChange={(event) => setDay(event.target.value)} className="p-3 bg-white border rounded-xl" /></label>
      <label className="text-xs space-y-1 min-w-0"><span className="block">الوزارة أو الجهة</span><select aria-label="الوزارة في العمليات" value={ministry} onChange={(event) => setMinistry(event.target.value)} className="p-3 bg-white border rounded-xl max-w-full"><option value="">كل الجهات ({ministries.length})</option>{ministries.map((name) => <option key={name}>{name}</option>)}</select></label>
    </div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {[
        { label: "طلبات اليوم المحدد", value: visible.created.length, icon: Package },
        { label: "تسليمات اليوم المحدد", value: visible.delivered.length, icon: CheckCheck },
        { label: "نسبة إنجاز طلبات ذلك اليوم", value: `${visible.deliveryRate}%`, icon: Activity },
        { label: "طلبات نشطة الآن · كل الأيام", value: visible.active.length, icon: Bike },
      ].map(({ label, value, icon: Icon }) => <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200"><Icon className="text-orange-600 mb-4" size={22} /><strong className="text-3xl font-black text-slate-900 block">{value}</strong><p className="text-xs text-slate-500 mt-2">{label}</p></div>)}
    </div>
    <div className="flex flex-wrap gap-3 text-xs text-slate-600"><span className="rounded-xl p-3 border bg-white">قيمة الطلبات المسلّمة في اليوم: <strong>{formatEGP(visible.deliveredValue)}</strong></span><span className="rounded-xl p-3 border bg-white">المتاجر المفتوحة: {stores.filter((store) => store.status === "open").length} / {stores.length}</span><span className="rounded-xl p-3 border bg-white">جاهزة للاستلام الآن: {visible.active.filter((order) => order.orderStatus === "ready").length}</span></div>
    {metrics.missingDeliveryTime > 0 && <p className="text-xs p-3 bg-amber-50 rounded-xl text-amber-800">يوجد {metrics.missingDeliveryTime} طلب مسلّم دون وقت تسليم موثّق؛ لا تدخل هذه السجلات في عدد تسليمات اليوم أو قيمتها.</p>}
    <div className="grid xl:grid-cols-[1.2fr_1fr] gap-5">
      <section className="border rounded-2xl bg-white overflow-hidden"><h2 className="font-bold p-5 flex items-center gap-2"><Building2 size={18} /> توزيع الوزارات والجهات</h2>
        <div className="overflow-x-auto max-h-[490px]"><table className="w-full text-right text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{["الوزارة / الجهة", "طلبات اليوم", "تسليمات اليوم", "نشطة الآن"].map((title) => <th key={title} className="p-3 whitespace-nowrap">{title}</th>)}</tr></thead><tbody>{ministries.filter((name) => !ministry || name === ministry).map((name) => {
          const row = dailyOperations(orders.filter((order) => order.ministry === name), day);
          return <tr key={name} className="border-t"><td className="p-3 font-medium">{name}</td><td className="p-3">{row.created.length}</td><td className="p-3">{row.delivered.length}</td><td className="p-3">{row.active.length}</td></tr>;
        })}</tbody></table></div>
      </section>
      <section className="border rounded-2xl bg-white p-5 space-y-4"><h2 className="font-bold flex gap-2"><Bike size={18} /> حركة المناديب</h2><p className="text-xs text-slate-500">التكليفات من الطلبات الحية. حالة الاتصال لا تُستنتج من وجود حساب المندوب.</p>
        <div className="max-h-48 overflow-y-auto space-y-2">{couriers.map((courier) => {
          const active = metrics.active.filter((order) => order.courierId === courier.id);
          const delivered = metrics.delivered.filter((order) => order.courierId === courier.id);
          return <div key={courier.id} className="bg-slate-50 rounded-xl p-3 flex justify-between gap-2 text-xs"><span className="font-bold">{courier.name}</span><span>{active.length} تكليف نشط · {delivered.length} تسليم اليوم</span></div>;
        })}{!couriers.length && <p className="text-sm text-slate-500">لم يُسجّل مناديب تشغيل بعد.</p>}</div>
        <label className="block text-xs">تتبع طلب في الطريق<select aria-label="طلب التتبع" value={mapOrder?.id || ""} onChange={(event) => setMapId(event.target.value)} className="block w-full p-3 mt-2 border rounded-xl bg-white"><option value="" disabled>لا توجد طلبات في الطريق</option>{mapOrders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.courierName} · {order.ministry}</option>)}</select></label>
        {mapOrder ? <OrderMap key={mapOrder.id} order={mapOrder} /> : <p className="text-xs text-slate-500 p-4 bg-slate-50 rounded-xl">عند بدء التوصيل يظهر الموقع الفعلي إذا شاركه المندوب، مع وقت آخر تحديث.</p>}
      </section>
    </div>
  </section>;
}
