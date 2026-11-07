import { adminOrderStatus } from "../utils/adminPresentation";
import { useState } from "react";
import { 
  Banknote, 
  Activity, 
  ArrowLeft, 
  Bike, 
  Building2, 
  CheckCheck, 
  Package, 
  Search, 
  Store as StoreIcon, 
  Users, 
  ChefHat, 
  ChevronLeft, 
  ChevronDown, 
  MapPin, 
  ClipboardList 
} from "lucide-react";
import type { Order, Store } from "../types";
import { cairoDay, dailyOperations } from "../utils/orderIntegration";
import { formatEGP } from "../utils/orderCalculations";
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
  const [areaFilter, setAreaFilter] = useState("");
  const [mapId, setMapId] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");

  // Extract unique areas / delivery addresses dynamically from active orders
  const areas = [...new Set<string>(
    orders.map(o => o.deliveryAddress || o.ministry || o.address || "").filter(Boolean)
  )].sort();

  const visibleOrders = areaFilter 
    ? orders.filter(order => (order.deliveryAddress || order.ministry || order.address || "").includes(areaFilter))
    : orders;

  const visible = dailyOperations(visibleOrders, day);

  const mapOrders = visible.active.filter(order => order.courierId && order.orderStatus === "with_courier");
  const mapOrder = mapOrders.find(order => order.id === mapId) || mapOrders[0];
  const term = search.trim().toLowerCase();

  const recent = (stage ? visible.active.filter(order => order.orderStatus === stage) : visible.created)
    .filter(order => [
      order.orderNumber, 
      order.profileName, 
      order.deliveryAddress, 
      order.ministry, 
      order.phone
    ].some(value => String(value || "").toLowerCase().includes(term)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const areaRows = areas
    .filter(name => !areaFilter || name === areaFilter)
    .map(name => ({
      name,
      ...dailyOperations(orders.filter(order => (order.deliveryAddress || order.ministry || order.address || "") === name), day)
    }));

  const activeAreas = areaRows.filter(row => row.created.length || row.delivered.length || row.active.length);
  const allStoresOpen = stores.filter(store => store.status === "open").length;

  return (
    <section dir="rtl" className="ops-dashboard" aria-label="مركز العمليات الحي">
      <header className="ops-heading">
        <div>
          <p className="admin-eyebrow">نظرة عامة على التشغيل</p>
          <h1>إدارة وعمليات منصة سنجوب</h1>
          <p>متابعة تشغيلية فورية للطلبات، المتاجر، وحركة التوصيل الميداني للعملاء.</p>
        </div>
        <button className="admin-primary btn btn-primary" onClick={() => onNavigate("orders")}>
          <ClipboardList size={17} />إدارة الطلبات<ArrowLeft size={16} />
        </button>
      </header>

      <div className="ops-toolbar">
        <div className="ops-period">
          <span className="ops-period-dot" />
          <span>ملخص العمليات والتشغيل</span>
          <small>منصة سنجوب</small>
        </div>
        <div className="ops-filters">
          <label>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span>التاريخ</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDay(cairoDay(new Date()))}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition ${day === cairoDay(new Date()) ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setDay("")}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition ${!day ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  كل الأيام ({orders.length})
                </button>
              </div>
            </div>
            <input aria-label="يوم التشغيل" type="date" value={day} onChange={event => setDay(event.target.value)} />
          </label>
          <label>
            <span>المنطقة أو عنوان التوصيل</span>
            <select aria-label="تصفية حسب المنطقة" value={areaFilter} onChange={event => setAreaFilter(event.target.value)}>
              <option value="">كل المناطق والعناوين ({areas.length})</option>
              {areas.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="ops-metrics">
        {[
          { label: "إجمالي الطلبات", value: day ? visible.created.length : orders.length, hint: day ? "أُنشئت في اليوم المحدد" : "إجمالي كل الطلبات المسجلة", icon: Package, tone: "orange" },
          { label: "تم التسليم", value: visible.delivered.length, hint: day ? "تسليمات اليوم المحدد" : "إجمالي التسليمات المكتملة", icon: CheckCheck, tone: "green" },
          { label: "نسبة الإنجاز", value: visible.created.length ? `${visible.deliveryRate}%` : visibleOrders.length ? `${Math.round(visibleOrders.filter(o => o.orderStatus === 'delivered').length / visibleOrders.length * 100)}%` : "—", hint: "معدل التسليم الناجح", icon: Activity, tone: "blue" },
          { label: "طلبات قيد التنفيذ", value: visible.active.length, hint: "الطلبات النشطة من كل الأيام", icon: Bike, tone: "purple" },
        ].map(({label,value,hint,icon:Icon,tone}) => (
          <article key={label} className="ops-metric">
            <div>
              <span>{label}</span>
              <i className={`ops-icon tone-${tone}`}><Icon size={19} /></i>
            </div>
            <strong>{value}</strong>
            <p>{hint}</p>
          </article>
        ))}
      </div>

      <div className="ops-summary">
        <span><StoreIcon size={16} />متاجر مفتوحة <strong>{allStoresOpen}<small> / {stores.length}</small></strong></span>
        <button className="btn btn-link p-0 text-decoration-none text-reset flex items-center gap-1.5" onClick={() => onNavigate("finance")} title="فتح التقارير المالية">
          <CheckCheck size={16} />قيمة التسليمات <strong className="text-emerald-700 underline">{formatEGP(visible.deliveredValue)}</strong>
        </button>
        <span><Users size={16} />مناديب مسجلون <strong>{couriers.length}</strong></span>
      </div>

      <nav className="ops-shortcuts" aria-label="اختصارات التشغيل">
        {[
          { id: "couriers-map", label: "خريطة المناديب الحية", hint: "تتبع الرحلات والـ GPS", icon: Bike },
          { id: "finance", label: "الحسابات والفواتير", hint: "تسوية المتاجر والأرباح", icon: Banknote },
          { id: "orders", label: "متابعة الطلبات", hint: "الحالات وتعيين المندوب", icon: ClipboardList },
          { id: "stores", label: "إدارة المتاجر", hint: "التوافر ورسوم التوصيل", icon: StoreIcon },
          { id: "offers", label: "عروض المنتجات", hint: "الخصومات الظاهرة للعملاء", icon: Package },
          { id: "users", label: "الحسابات والفريق", hint: "البيانات والصلاحيات", icon: Users },
        ].map(({id,label,hint,icon:Icon}) => (
          <button key={id} onClick={() => onNavigate(id)}>
            <Icon size={22} />
            <span><strong>{label}</strong><small>{hint}</small></span>
            <ArrowLeft size={17}/>
          </button>
        ))}
      </nav>

      {visible.missingDeliveryTime > 0 && (
        <p className="ops-warning alert alert-warning">
          {visible.missingDeliveryTime} طلب مسلّم دون وقت موثّق؛ لا يُحتسب ضمن تسليمات اليوم.
        </p>
      )}

      {!stores.length && (
        <section className="ops-setup">
          <div className="ops-setup-intro">
            <span className="admin-eyebrow">ابدأ التشغيل</span>
            <h2>كل شيء يبدأ بمتجرك الأول.</h2>
            <p>أضف البيانات الحقيقية، ثم جهّز فريقك لاستقبال الطلبات.</p>
          </div>
          <div className="ops-setup-steps">
            <button onClick={() => onNavigate("stores")}>
              <i><StoreIcon size={20} /></i>
              <span><strong>أضف متجرًا ومنتجاته</strong><small>الصور والأسعار والتوافر</small></span>
              <ChevronLeft size={17} />
            </button>
            <button onClick={() => onNavigate("users")}>
              <i><Users size={20} /></i>
              <span><strong>جهّز فريق التشغيل</strong><small>الشيف والمندوب وصلاحياتهما</small></span>
              <ChevronLeft size={17} />
            </button>
          </div>
        </section>
      )}

      <div className="ops-work-grid">
        <div className="ops-main-column">
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>مسار الطلبات الحية</h2>
                <p>كل الطلبات النشطة، عبر جميع الأيام</p>
              </div>
              <button className="admin-text-button btn btn-link" onClick={() => onNavigate("kitchen")}>
                <ChefHat size={16} />فتح المطبخ
              </button>
            </div>
            <div className="ops-pipeline">
              {stages.map(item => (
                <button 
                  key={item.id} 
                  className={`ops-stage ${stage === item.id ? "is-selected" : ""}`} 
                  aria-pressed={stage === item.id} 
                  onClick={() => setStage(stage === item.id ? "" : item.id)}
                >
                  <span className={`ops-stage-dot tone-${item.color}`} />
                  <strong>{visible.active.filter(order => order.orderStatus === item.id).length}</strong>
                  <small>{item.label}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>{stage ? stages.find(item => item.id === stage)?.label : "طلبات يوم التشغيل"}
                  <span className="badge admin-count">{recent.length}</span>
                </h2>
                <p>{stage ? "طلبات نشطة من كل الأيام" : "الطلبات المسجلة في اليوم المحدد"}</p>
              </div>
              {stage && (
                <button className="admin-text-button btn btn-link" onClick={() => setStage("")}>
                  مسح الحالة
                </button>
              )}
            </div>

            <label className="ops-search">
              <Search size={17} />
              <input 
                aria-label="بحث طلبات العمليات" 
                placeholder="ابحث برقم الطلب، العميل، أو عنوان التوصيل…" 
                value={search} 
                onChange={event => setSearch(event.target.value)} 
              />
            </label>

            {recent.length ? (
              <div className="admin-table-scroll">
                <table className="table table-hover align-middle admin-data-table">
                  <thead>
                    <tr>
                      <th>الطلب / العميل</th>
                      <th>عنوان التوصيل</th>
                      <th>القيمة</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.slice(0, 8).map(order => (
                      <tr key={order.id}>
                        <td>
                          <strong dir="ltr">#{order.orderNumber}</strong>
                          <small>{order.profileName || 'عميل'}</small>
                        </td>
                        <td>
                          <span className="block truncate max-w-xs">{order.deliveryAddress || order.ministry || order.address || 'العنوان المسجل بالطلب'}</span>
                          {(order.floorNumber || order.roomNumber) && (
                            <small className="text-slate-400 block font-normal">
                              {[order.floorNumber, order.roomNumber].filter(Boolean).join(' • ')}
                            </small>
                          )}
                        </td>
                        <td className="whitespace-nowrap font-bold text-slate-800">{formatEGP(order.total)}</td>
                        <td>
                          <span className={`badge admin-status status-${order.orderStatus}`}>
                            {adminOrderStatus[order.orderStatus] || order.orderStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty">
                <i><Package size={27} /></i>
                <h3>{term ? "لا توجد نتائج مطابقة" : "لا توجد طلبات في هذا العرض"}</h3>
                <p>{term ? "جرّب اسمًا آخر أو رقم الطلب." : "ستظهر الطلبات الحقيقية هنا فور وصولها."}</p>
                {(stage || areaFilter || term) && (
                  <button className="admin-text-button btn btn-link" onClick={() => {setStage("");setAreaFilter("");setSearch("");}}>
                    إزالة التصفية
                  </button>
                )}
              </div>
            )}

            {recent.length > 0 && (
              <button className="ops-panel-link" onClick={() => onNavigate("orders")}>
                عرض وإدارة كل الطلبات <ArrowLeft size={15} />
              </button>
            )}
          </section>
        </div>

        <aside className="ops-side-column">
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>فريق التوصيل</h2>
                <p>التكليفات الفعلية من الطلبات</p>
              </div>
              <span className="ops-icon tone-purple"><Bike size={19} /></span>
            </div>
            {couriers.length ? (
              <div className="ops-courier-list">
                {couriers.map(courier => {
                  const active = visible.active.filter(order => order.courierId === courier.id).length;
                  return (
                    <div className="ops-courier" key={courier.id}>
                      <span className="ops-avatar">{courier.name.slice(0,1)}</span>
                      <div>
                        <strong>{courier.name}</strong>
                        <small>{active ? `${active} تكليف نشط` : "لا توجد تكليفات نشطة"}</small>
                      </div>
                      <b>{visible.delivered.filter(order => order.courierId === courier.id).length}<small>تسليم</small></b>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="admin-empty compact">
                <Users size={25} />
                <h3>فريقك لم يُضف بعد</h3>
                <p>أضف المناديب من إدارة الفريق.</p>
                <button className="admin-text-button btn btn-link" onClick={() => onNavigate("users")}>
                  إدارة الفريق<ArrowLeft size={15} />
                </button>
              </div>
            )}
          </section>

          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>التتبع المباشر</h2>
                <p>مواقع حقيقية عند مشاركة المندوب</p>
              </div>
              <button className="admin-text-button btn btn-link" onClick={() => onNavigate("couriers-map")}>
                <Bike size={15} />الخريطة الكاملة
              </button>
            </div>
            {mapOrder ? (
              <div className="ops-map-content">
                <label>
                  الطلب
                  <select aria-label="طلب التتبع" value={mapOrder.id} onChange={event => setMapId(event.target.value)}>
                    {mapOrders.map(order => (
                      <option key={order.id} value={order.id}>
                        {order.orderNumber} · {order.courierName}
                      </option>
                    ))}
                  </select>
                </label>
                <OrderMap key={mapOrder.id} order={mapOrder} />
              </div>
            ) : (
              <div className="ops-map-empty">
                <MapPin size={28} />
                <strong>لا توجد رحلات نشطة</strong>
                <p>يظهر الموقع عند بدء التوصيل ومشاركة المندوب لموقعه.</p>
              </div>
            )}
          </section>
        </aside>
      </div>

      <details className="admin-panel ops-ministries">
        <summary>
          <Building2 size={19} />
          <strong>توزيع مناطق وعناوين التوصيل</strong>
          <span>{activeAreas.length} منطقة بها نشاط</span>
          <ChevronDown size={16} className="ops-details-arrow" />
        </summary>
        <div className="admin-table-scroll">
          <table className="table table-hover align-middle admin-data-table">
            <thead>
              <tr>
                <th>المنطقة / عنوان التوصيل</th>
                <th>طلبات اليوم</th>
                <th>تسليمات اليوم</th>
                <th>نشطة الآن</th>
              </tr>
            </thead>
            <tbody>
              {areaRows.map(row => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.created.length}</td>
                  <td>{row.delivered.length}</td>
                  <td>{row.active.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {!connected && (
        <p className="ops-warning alert alert-warning" role="status">
          لم يُؤكّد اتصال الطلبات بالخادم. قد تكون البيانات المعروضة من آخر مزامنة.
        </p>
      )}
    </section>
  );
}
