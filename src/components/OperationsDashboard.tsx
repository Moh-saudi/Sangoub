import { useState } from "react";
import { Activity, ArrowLeft, Bike, Building2, CheckCheck, Package, Search, Store as StoreIcon, Users, ChefHat, ChevronLeft, ChevronDown, MapPin, ClipboardList } from "lucide-react";
import type { Order, Store } from "../types";
import { MINISTRIES_LIST } from "../data/seedData";
import { cairoDay, dailyOperations } from "../utils/orderIntegration";
import { formatEGP, getOrderStatusLabel } from "../utils/orderCalculations";
import { OrderMap } from "./OrderMap";

export type OperationsCourier = { id: string; name: string; phone: string };
const stages = [
  { id: "received", label: "طلبات جديدة", color: "orange" },
  { id: "preparing", label: "قيد التحضير", color: "blue" },
  { id: "ready", label: "جاهزة للاستلام", color: "purple" },
  { id: "with_courier", label: "في الطريق", color: "green" },
];
export function OperationsDashboard({ orders, stores, couriers, connected, onNavigate }: {
  orders: Order[]; stores: Store[]; couriers: OperationsCourier[]; connected: boolean; onNavigate: (tab: string) => void;
}) {
  const [day, setDay] = useState(cairoDay(new Date()));
  const [ministry, setMinistry] = useState("");
  const [mapId, setMapId] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const visibleOrders = ministry ? orders.filter(order => order.ministry === ministry) : orders;
  const visible = dailyOperations(visibleOrders, day);
  const ministries = [...new Set<string>([...MINISTRIES_LIST, ...orders.map(order => order.ministry).filter(Boolean)])];
  const mapOrders = visible.active.filter(order => order.courierId && order.orderStatus === "with_courier");
  const mapOrder = mapOrders.find(order => order.id === mapId) || mapOrders[0];
  const term = search.trim().toLowerCase();
  const recent = (stage ? visible.active.filter(order => order.orderStatus === stage) : visible.created)
    .filter(order => [order.orderNumber, order.profileName, order.ministry, order.phone].some(value => String(value || "").toLowerCase().includes(term)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = ministries.filter(name => !ministry || name === ministry).map(name => ({ name, ...dailyOperations(orders.filter(order => order.ministry === name), day) }));
  const activeMinistries = rows.filter(row => row.created.length || row.delivered.length || row.active.length);
  const allStoresOpen = stores.filter(store => store.status === "open").length;
  return <section dir="rtl" className="ops-dashboard" aria-label="مركز العمليات الحي">
    <header className="ops-heading"><div><p className="admin-eyebrow">نظرة عامة على التشغيل</p><h1>الحي الحكومي، في شاشة واحدة.</h1><p>تابع اليوم، وحدّد الخطوة التالية لفريقك.</p></div><button className="admin-primary" onClick={() => onNavigate("management")}><ClipboardList size={17} />إدارة الطلبات<ArrowLeft size={16} /></button></header>
    <div className="ops-toolbar"><div className="ops-period"><span className="ops-period-dot" /><span>ملخص يوم التشغيل</span><small>بتوقيت القاهرة</small></div><div className="ops-filters"><label><span>التاريخ</span><input aria-label="يوم التشغيل" type="date" value={day} onChange={event => setDay(event.target.value)} /></label><label><span>الوزارة أو الجهة</span><select aria-label="الوزارة في العمليات" value={ministry} onChange={event => setMinistry(event.target.value)}><option value="">كل الجهات ({ministries.length})</option>{ministries.map(name => <option key={name}>{name}</option>)}</select></label></div></div>
    <div className="ops-metrics">{[
      { label: "إجمالي الطلبات", value: visible.created.length, hint: "أُنشئت في اليوم المحدد", icon: Package, tone: "orange" },
      { label: "تم التسليم", value: visible.delivered.length, hint: "تسليمات اليوم المحدد", icon: CheckCheck, tone: "green" },
      { label: "نسبة الإنجاز", value: visible.created.length ? `${visible.deliveryRate}%` : "—", hint: visible.created.length ? "من طلبات اليوم المحدد" : "تظهر عند وجود طلبات", icon: Activity, tone: "blue" },
      { label: "طلبات قيد التنفيذ", value: visible.active.length, hint: "الطلبات النشطة من كل الأيام", icon: Bike, tone: "purple" },
    ].map(({label,value,hint,icon:Icon,tone}) => <article key={label} className="ops-metric"><div><span>{label}</span><i className={`ops-icon tone-${tone}`}><Icon size={19} /></i></div><strong>{value}</strong><p>{hint}</p></article>)}</div>
    <div className="ops-summary"><span><StoreIcon size={16} />متاجر مفتوحة <strong>{allStoresOpen}<small> / {stores.length}</small></strong></span><span><CheckCheck size={16} />قيمة التسليمات <strong>{formatEGP(visible.deliveredValue)}</strong></span><span><Users size={16} />مناديب مسجلون <strong>{couriers.length}</strong></span></div>
    {visible.missingDeliveryTime > 0 && <p className="ops-warning">{visible.missingDeliveryTime} طلب مسلّم دون وقت موثّق؛ لا يُحتسب ضمن تسليمات اليوم.</p>}
    {!stores.length && <section className="ops-setup"><div className="ops-setup-intro"><span className="admin-eyebrow">ابدأ التشغيل</span><h2>كل شيء يبدأ بمتجرك الأول.</h2><p>أضف البيانات الحقيقية، ثم جهّز فريقك لاستقبال الطلبات.</p></div><div className="ops-setup-steps"><button onClick={() => onNavigate("catalog")}><i><StoreIcon size={20} /></i><span><strong>أضف متجرًا ومنتجاته</strong><small>الصور والأسعار والتوافر</small></span><ChevronLeft size={17} /></button><button onClick={() => onNavigate("settings")}><i><Users size={20} /></i><span><strong>جهّز فريق التشغيل</strong><small>الشيف والمندوب وصلاحياتهما</small></span><ChevronLeft size={17} /></button></div></section>}
    <div className="ops-work-grid"><div className="ops-main-column">
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>مسار الطلبات الحية</h2><p>كل الطلبات النشطة، عبر جميع الأيام</p></div><button className="admin-text-button" onClick={() => onNavigate("kitchen")}><ChefHat size={16} />فتح المطبخ</button></div><div className="ops-pipeline">{stages.map(item => <button key={item.id} className={`ops-stage ${stage === item.id ? "is-selected" : ""}`} aria-pressed={stage === item.id} onClick={() => setStage(stage === item.id ? "" : item.id)}><span className={`ops-stage-dot tone-${item.color}`} /><strong>{visible.active.filter(order => order.orderStatus === item.id).length}</strong><small>{item.label}</small></button>)}</div></section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>{stage ? stages.find(item => item.id === stage)?.label : "طلبات يوم التشغيل"}<span className="admin-count">{recent.length}</span></h2><p>{stage ? "طلبات نشطة من كل الأيام" : "الطلبات المسجلة في اليوم المحدد"}</p></div>{stage && <button className="admin-text-button" onClick={() => setStage("")}>مسح الحالة</button>}</div><label className="ops-search"><Search size={17} /><input aria-label="بحث طلبات العمليات" placeholder="ابحث برقم الطلب أو الاسم أو الجهة…" value={search} onChange={event => setSearch(event.target.value)} /></label>
      {recent.length ? <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>الطلب / العميل</th><th>الجهة</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>{recent.slice(0, 8).map(order => <tr key={order.id}><td><strong dir="ltr">#{order.orderNumber}</strong><small>{order.profileName}</small></td><td>{order.ministry}</td><td className="whitespace-nowrap">{formatEGP(order.total)}</td><td><span className={`admin-status status-${order.orderStatus}`}>{getOrderStatusLabel(order.orderStatus).text}</span></td></tr>)}</tbody></table></div> : <div className="admin-empty"><i><Package size={27} /></i><h3>{term ? "لا توجد نتائج مطابقة" : "لا توجد طلبات في هذا العرض"}</h3><p>{term ? "جرّب اسمًا آخر أو رقم الطلب." : "ستظهر الطلبات الحقيقية هنا فور وصولها. يمكنك تغيير التاريخ أو الجهة."}</p>{(stage || ministry || term) && <button className="admin-text-button" onClick={() => {setStage("");setMinistry("");setSearch("");}}>إزالة التصفية</button>}</div>}
      {recent.length > 0 && <button className="ops-panel-link" onClick={() => onNavigate("management")}>عرض وإدارة كل الطلبات <ArrowLeft size={15} /></button>}</section>
    </div><aside className="ops-side-column">
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>فريق التوصيل</h2><p>التكليفات الفعلية من الطلبات</p></div><span className="ops-icon tone-purple"><Bike size={19} /></span></div>{couriers.length ? <div className="ops-courier-list">{couriers.map(courier => {const active = visible.active.filter(order => order.courierId === courier.id).length;return <div className="ops-courier" key={courier.id}><span className="ops-avatar">{courier.name.slice(0,1)}</span><div><strong>{courier.name}</strong><small>{active ? `${active} تكليف نشط` : "لا توجد تكليفات نشطة"}</small></div><b>{visible.delivered.filter(order => order.courierId === courier.id).length}<small>تسليم</small></b></div>;})}</div> : <div className="admin-empty compact"><Users size={25} /><h3>فريقك لم يُضف بعد</h3><p>أضف المناديب من إدارة الفريق.</p><button className="admin-text-button" onClick={() => onNavigate("settings")}>إدارة الفريق<ArrowLeft size={15} /></button></div>}</section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>التتبع المباشر</h2><p>مواقع حقيقية عند مشاركة المندوب</p></div><span className="ops-icon tone-green"><MapPin size={19} /></span></div>{mapOrder ? <div className="ops-map-content"><label>الطلب<select aria-label="طلب التتبع" value={mapOrder.id} onChange={event => setMapId(event.target.value)}>{mapOrders.map(order => <option key={order.id} value={order.id}>{order.orderNumber} · {order.courierName}</option>)}</select></label><OrderMap key={mapOrder.id} order={mapOrder} /></div> : <div className="ops-map-empty"><MapPin size={28} /><strong>لا توجد رحلات نشطة</strong><p>يظهر الموقع عند بدء التوصيل ومشاركة المندوب لموقعه.</p></div>}</section>
    </aside></div>
    <details className="admin-panel ops-ministries"><summary><Building2 size={19} /><strong>توزيع الوزارات والجهات</strong><span>{activeMinistries.length} جهة بها نشاط</span><ChevronDown size={16} className="ops-details-arrow" /></summary><div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>الوزارة / الجهة</th><th>طلبات اليوم</th><th>تسليمات اليوم</th><th>نشطة الآن</th></tr></thead><tbody>{rows.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.created.length}</td><td>{row.delivered.length}</td><td>{row.active.length}</td></tr>)}</tbody></table></div></details>
    {!connected && <p className="ops-warning" role="status">لم يُؤكّد اتصال الطلبات بالخادم. قد تكون البيانات المعروضة من آخر مزامنة.</p>}
  </section>;
}
