import { adminOrderStatus } from "../utils/adminPresentation";
import { OrderMap } from "./OrderMap.tsx";
import React, { useState, useEffect, useRef } from "react";
import {
  Bike,
  Package,
  CheckCircle,
  Clock,
  Store as StoreIcon,
  Filter,
  Building,
  Phone,
  Edit3,
  Handshake,
  Briefcase,
  Mail,
  MessageCircle,
  MapPin,
  PlusCircle,
  Globe,
} from "lucide-react";
import type {
  ApplicationStatus,
  JobApplication,
  Order,
  OrderStatus,
  PartnerApplication,
} from "../types/index.ts";

import { formatEGP, getOrderStatusLabel } from "../utils/orderCalculations.ts";

export type AdminTabType = "orders" | "partners" | "jobs";

interface AdminDashboardProps {
  couriers: Array<{ id: string; name: string; phone: string }>;
  orders: Order[];
  partnerApplications: PartnerApplication[];
  jobApplications: JobApplication[];
  initialAdminTab?: AdminTabType;
  orderSearchRequest?: {term:string;key:number};
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => Promise<void>;
  onAssignCourier: (
    orderId: string,
    courierId: string,
    courierPhone: string,
  ) => Promise<void>;
  onUpdatePartnerStatus: (partnerId: string, status: ApplicationStatus) => void;
  onApprovePartnerAsStore: (partner: PartnerApplication) => void;
  onUpdateJobStatus: (jobId: string, status: ApplicationStatus) => void;
  onOpenWebsitePage?: (
    page: "home" | "partners" | "careers" | "terms" | "privacy",
  ) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  couriers,
  partnerApplications,
  jobApplications,
  initialAdminTab = "orders",
  orderSearchRequest,
  onUpdateOrderStatus,
  onAssignCourier,
  onUpdatePartnerStatus,
  onApprovePartnerAsStore,
  onUpdateJobStatus,
  onOpenWebsitePage,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTabType>(initialAdminTab);
  const [selectedOrderId,setSelectedOrderId]=useState('');
  const orderDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(selectedOrderId)orderDialog.current?.showModal();else orderDialog.current?.close();},[selectedOrderId]);
  useEffect(()=>{if(orderSearchRequest){setOrderSearch(orderSearchRequest.term);setStatusFilter('all');setMinistryFilter('');setActiveTab('orders');}},[orderSearchRequest?.key]);
  const [orderSearch, setOrderSearch] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("");
  const [pendingOrders, setPendingOrders] = useState<string[]>([]);
  const [orderError, setOrderError] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCourierForOrder, setSelectedCourierForOrder] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setActiveTab(initialAdminTab);
  }, [initialAdminTab]);

  // Filtering orders
  const filteredOrders = orders.filter((order) => {
    const term = orderSearch.trim().toLowerCase();
    return (statusFilter === "all" || order.orderStatus === statusFilter) &&
      (!ministryFilter || order.ministry === ministryFilter) &&
      [order.orderNumber, order.profileName, order.phone, order.ministry].some((value) => String(value || "").toLowerCase().includes(term));
  });
  async function runOrderAction(id: string, action: () => Promise<void>) {
    setPendingOrders((ids) => [...ids, id]); setOrderError(""); setOrderMessage("");
    try { await action(); setOrderMessage("تم حفظ تحديث الطلب."); }
    catch (error) { setOrderError((error as Error).message); }
    finally { setPendingOrders((ids) => ids.filter((value) => value !== id)); }
  }


  // Calculate statistics
  const totalRevenue = orders.filter((order) => order.orderStatus === "delivered").reduce((sum, o) => sum + o.total, 0);
  const activeOrdersCount = orders.filter(
    (o) =>
      o.orderStatus === "received" ||
      o.orderStatus === "preparing" ||
      o.orderStatus === "ready" ||
      o.orderStatus === "with_courier",
  ).length;

  const pendingPartnersCount = partnerApplications.filter(
    (p) => p.status === "pending",
  ).length;
  const pendingJobsCount = jobApplications.filter(
    (j) => j.status === "pending",
  ).length;

  const handleCourierSelect = (orderId: string, courierId: string) => {
    const courier = couriers.find((c) => c.id === courierId);
    if (courier) {
      void runOrderAction(orderId, async () => {
        await onAssignCourier(orderId, courier.id, courier.phone);
        setSelectedCourierForOrder((prev) => ({ ...prev, [orderId]: courierId }));
      });
    }
  };

  const getApplicationStatusLabel = (status: ApplicationStatus) => {
    switch (status) {
      case "pending":
        return {
          label: "جديد · قيد المراجعة",
          className: "bg-amber-50 text-amber-800 border-amber-200",
        };
      case "contacted":
        return {
          label: "تم التواصل هاتفياً",
          className: "bg-blue-50 text-blue-800 border-blue-200",
        };
      case "approved":
        return {
          label: "معتمد وتم التعاقد",
          className: "bg-emerald-50 text-emerald-800 border-emerald-200",
        };
      case "rejected":
        return {
          label: "مرفوض / مؤجل",
          className: "bg-rose-50 text-rose-800 border-rose-200",
        };
    }
  };

  return (
    <div className="admin-management max-w-6xl mx-auto px-4 py-5 space-y-5" dir="rtl">
      <header className="ops-heading"><div><p className="admin-eyebrow">{activeTab === "orders" ? "التشغيل اليومي" : "نمو المنصة"}</p><h1 className="text-2xl font-black">{activeTab === "orders" ? "الطلبات" : activeTab === "partners" ? "طلبات الشراكة" : "طلبات التوظيف"}</h1><p>{activeTab === "orders" ? "كل الطلبات، تحديث الحالات وتعيين المندوب من مكان واحد." : activeTab === "partners" ? "راجع المتاجر المتقدمة وتابع التواصل والتعاقد." : "راجع المتقدمين وتابع المقابلات وقرارات التعيين."}</p></div></header>
      <div className="management-summary">{activeTab === "orders" ? <><span>طلبات نشطة <strong>{activeOrdersCount}</strong></span><span>قيمة الطلبات المسلّمة <strong>{formatEGP(totalRevenue)}</strong></span></> : <span>بانتظار المراجعة <strong>{activeTab === "partners" ? pendingPartnersCount : pendingJobsCount}</strong></span>}</div>

      {/* Tab 1: Orders Queue & Courier Assignment */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <input aria-label="بحث الطلبات" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="رقم الطلب أو اسم العميل أو الهاتف" className="p-3 border rounded-xl bg-white text-sm min-w-0" />
            <select aria-label="وزارة الطلبات" value={ministryFilter} onChange={(event) => setMinistryFilter(event.target.value)} className="p-3 border rounded-xl bg-white text-sm min-w-0"><option value="">كل الوزارات</option>{[...new Set(orders.map((order) => order.ministry))].sort().map((name) => <option key={name}>{name}</option>)}</select>
          </div>
          {orderError && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl">{orderError}</p>}
          {orderMessage && <p role="status" className="p-3 bg-emerald-50 text-emerald-800 rounded-xl">{orderMessage}</p>}
          {/* Status Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-slate-900">
                تصفية حسب الحالة:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: "الكل" },
                { id: "received", label: "جديد" },
                { id: "preparing", label: "قيد التجهيز" },
                { id: "ready", label: "جاهز للاستلام" },
                { id: "with_courier", label: "مع المندوب" },
                { id: "delivered", label: "تم التسليم" },
                { id: "cancelled", label: "ملغى" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  aria-pressed={statusFilter === filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                    statusFilter === filter.id
                      ? "bg-emerald-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <section className="admin-panel compact-orders"><div className="compact-table-caption"><strong>سجل الطلبات</strong><span>عرض {filteredOrders.length} طلب</span></div><div className="admin-table-scroll"><table className="table table-hover align-middle admin-data-table"><thead><tr><th>رقم الطلب / العميل</th><th>الجهة / المكتب</th><th>الأصناف</th><th>القيمة</th><th>الحالة</th><th>المندوب</th><th>التاريخ</th><th>الإجراءات</th></tr></thead><tbody>{filteredOrders.map(order=><tr key={order.id}><td><button className="admin-order-link" onClick={()=>setSelectedOrderId(order.id)}>{order.orderNumber}</button><small>{order.profileName}</small></td><td>{order.ministry}<small>{order.floorNumber} · {order.roomNumber}</small></td><td><span className="compact-item-summary">{order.itemsSummary||order.items.map(item=>`${item.quantity}× ${item.product.name}`).join('، ')||order.legacySummary||'—'}</span></td><td className="whitespace-nowrap">{formatEGP(order.total)}</td><td><span className={`badge admin-status status-${order.orderStatus}`}>{adminOrderStatus[order.orderStatus]}</span></td><td>{order.courierName||'لم يُعيّن'}</td><td className="whitespace-nowrap">{order.createdAt?new Date(order.createdAt).toLocaleDateString('ar-EG',{timeZone:'Africa/Cairo'}):'—'}<small>{order.createdAt?new Date(order.createdAt).toLocaleTimeString('ar-EG',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit'}):''}</small></td><td><button className="compact-row-action btn btn-outline-secondary" aria-label={`تفاصيل الطلب ${order.orderNumber}`} onClick={()=>setSelectedOrderId(order.id)}>تفاصيل وإدارة</button></td></tr>)}</tbody></table></div>{!filteredOrders.length&&<p className="admin-empty">لا توجد طلبات مطابقة لهذا الفلتر</p>}</section>
          <dialog ref={orderDialog} className="admin-detail-drawer" aria-label="تفاصيل وإدارة الطلب" onCancel={()=>setSelectedOrderId('')} onClose={()=>setSelectedOrderId('')} dir="rtl"><div className="admin-dialog-heading"><h2>تفاصيل وإدارة الطلب</h2><button aria-label="إغلاق تفاصيل الطلب" onClick={()=>setSelectedOrderId('')}>إغلاق ×</button></div><div className="compact-order-details">
              {orders.filter(order=>order.id===selectedOrderId).map((order) => {
                const statusInfo = getOrderStatusLabel(order.orderStatus);

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 transition-all space-y-3"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                        <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {order.orderNumber}
                        </span>
                        <div className="text-xs">
                          <span className="font-bold text-slate-900">
                            {order.profileName}
                          </span>
                          <span className="text-slate-400 mx-1">·</span>
                          <span className="text-slate-600 font-mono">
                            {order.phone}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${statusInfo.colorClass}`}
                        >
                          {statusInfo.text}
                        </span>
                        <span className="text-sm font-extrabold text-emerald-800 tabular-nums">
                          {formatEGP(order.total)}
                        </span>
                      </div>
                    </div>

                    {/* Middle Info: Ministry Location & Items summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 space-y-1">
                        <div className="font-bold text-emerald-950 flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{order.ministry}</span>
                        </div>
                        <div className="text-slate-600">
                          {order.floorNumber} · {order.roomNumber}
                        </div>
                        {order.scheduledDeliveryTime && (
                          <div className="text-[11px] font-bold text-orange-800 bg-orange-100/80 px-2 py-1 rounded-lg border border-orange-200 flex items-center gap-1 mt-1">
                            <Clock className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                            <span>
                              موعد التسليم المجدول:{" "}
                              {order.scheduledDeliveryTime}
                            </span>
                          </div>
                        )}
                        {order.notes && (
                          <div className="text-[11px] text-amber-800">
                            ملاحظة الموظف: {order.notes}
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                        <div className="font-bold text-slate-800">
                          الأصناف ({order.items.length}):
                          {order.legacyRecord && (
                            <p>
                              سجل قديم: {order.legacySummary}. تفاصيل الأسعار
                              الفرعية غير محفوظة.
                            </p>
                          )}
                        </div>
                        <div className="text-slate-600">
                          <details className="my-2">
                            <summary className="cursor-pointer text-xs text-blue-700">
                              خريطة الطلب
                            </summary>
                            <OrderMap order={order} />
                          </details>
                          {order.items
                            .map((i) => `${i.quantity}× ${i.product.name}`)
                            .join("، ")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          طريقة الدفع:{" "}
                          {order.paymentMethod === "instapay"
                            ? "إنستا باي"
                            : order.paymentMethod === "geidea"
                              ? "بطاقة جيديا"
                              : "نقداً بالدور"}
                        </div>
                      </div>
                    </div>

                    {/* Courier Assignment & Status Controls Bar */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Courier Selector */}
                      <div className="flex items-center gap-2 flex-1 max-w-md min-w-0">
                        <Bike className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 shrink-0">
                          تعيين المندوب:
                        </span>
                        <select
                          disabled={!["ready", "with_courier"].includes(order.orderStatus) || pendingOrders.includes(order.id)}
                          value={
                            order.courierId ||
                            selectedCourierForOrder[order.id] ||
                            ""
                          }
                          onChange={(e) =>
                            handleCourierSelect(order.id, e.target.value)
                          }
                          className="min-w-0 flex-1 p-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 text-slate-800 truncate"
                        >
                          <option value="">
                            -- اضغط لتعيين مندوب التوصيل --
                          </option>
                          {couriers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Advance Status Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {pendingOrders.includes(order.id) && <span role="status" className="text-xs">جارٍ الحفظ…</span>}
                        {!["delivered", "cancelled"].includes(order.orderStatus) && <button disabled={pendingOrders.includes(order.id)} className="text-xs border border-red-200 text-red-700 rounded-xl px-3 py-2" onClick={() => { if (window.confirm(`إلغاء الطلب ${order.orderNumber}؟`)) void runOrderAction(order.id, () => onUpdateOrderStatus(order.id, "cancelled")); }}>إلغاء الطلب</button>}
                        {order.orderStatus === "received" && (
                          <button
                            disabled={pendingOrders.includes(order.id)}
                            onClick={() =>
                              runOrderAction(order.id, () => onUpdateOrderStatus(order.id, "preparing"))
                            }
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            بدء التحضير بالمطعم
                          </button>
                        )}

                        {order.orderStatus === "preparing" && (
                          <button
                            disabled={pendingOrders.includes(order.id)}
                            onClick={() =>
                              runOrderAction(order.id, () => onUpdateOrderStatus(order.id, "ready"))
                            }
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            جاهز لاستلام المندوب
                          </button>
                        )}

                        {order.orderStatus === "with_courier" && <span className="text-xs text-slate-500">يؤكد المندوب التسليم برمز العميل</span>}

                        {order.orderStatus === "delivered" && (
                          <span className="text-xs text-teal-700 font-bold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            مكتمل بنجاح
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div></dialog>
        </div>
      )}

      {/* Tab 2: Partner Applications (طلبات الانضمام كشريك من الموقع الرسمي) */}
      {activeTab === "partners" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-orange-600">
                <Handshake className="w-4 h-4" />
                <span>
                  الطلبات المرسلة مباشرة من نموذج "انضم إلينا كشريك" في الموقع
                  الرسمي
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                سجل طلبات انضمام المطاعم والكافيهات والسوبر ماركت (
                {partnerApplications.length})
              </h3>
            </div>

            {onOpenWebsitePage && (
              <button
                type="button"
                onClick={() => onOpenWebsitePage("partners")}
                className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Globe className="w-4 h-4" />
                <span>فتح نموذج الشركاء في الموقع</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {partnerApplications.map((partner) => {
              const statusBadge = getApplicationStatusLabel(partner.status);
              const cleanWhatsappPhone = partner.phone.replace(/[^0-9]/g, "");
              const whatsappUrl = `https://wa.me/${
                cleanWhatsappPhone.startsWith("0")
                  ? "2" + cleanWhatsappPhone
                  : cleanWhatsappPhone
              }`;

              return (
                <div
                  key={partner.id}
                  className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-extrabold text-slate-900">
                          {partner.businessName}
                        </h4>
                        <span className="text-xs text-slate-500">·</span>
                        <span className="text-xs font-bold text-orange-700">
                          {partner.partnerType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span>المسؤول: {partner.contactName}</span>
                        <span>·</span>
                        <span className="font-mono">{partner.phone}</span>
                        <span>·</span>
                        <span className="font-mono">{partner.email}</span>
                        <span>·</span>
                        <span>{partner.createdAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-3 py-1 rounded-lg border text-xs font-bold ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                        <span>الموقع والفروع بالعاصمة الإدارية:</span>
                      </div>
                      <p className="text-slate-600">
                        {partner.locationInCapital}
                      </p>
                      <p className="text-slate-500">
                        عدد الفروع: {partner.branchesCount}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1">
                      <div className="font-bold text-slate-800">
                        ملاحظات الشريك الإضافية:
                      </div>
                      <p className="text-slate-600">
                        {partner.notes ||
                          "لا توجد ملاحظات إضافية — جاهز للتعاقد وتفعيل الحساب."}
                      </p>
                    </div>
                  </div>

                  {/* Admin Actions for Partner Application */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>مراسلة واتساب</span>
                      </a>
                      <a
                        href={`mailto:${partner.email}`}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5 text-slate-600" />
                        <span>إرسال بريد</span>
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {partner.status !== "contacted" && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdatePartnerStatus(partner.id, "contacted")
                          }
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                        >
                          تحديد: تم التواصل
                        </button>
                      )}

                      {partner.status !== "approved" && (
                        <button
                          type="button"
                          onClick={() => onApprovePartnerAsStore(partner)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>اعتماد الشريك وإضافته كمتجر في التطبيق</span>
                        </button>
                      )}

                      {partner.status !== "rejected" && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdatePartnerStatus(partner.id, "rejected")
                          }
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                        >
                          رفض
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Job Applications (طلبات التوظيف المرسلة من صفحة الوظائف بالموقع) */}
      {activeTab === "jobs" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <Briefcase className="w-4 h-4" />
                <span>
                  الطلبات المرسلة مباشرة من "صفحة الوظائف والتقديم عليها" في
                  الموقع الرسمي
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                سجل المتقدمين للوظائف والتشغيل الميداني (
                {jobApplications.length})
              </h3>
            </div>

            {onOpenWebsitePage && (
              <button
                type="button"
                onClick={() => onOpenWebsitePage("careers")}
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Globe className="w-4 h-4" />
                <span>فتح صفحة الوظائف في الموقع</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {jobApplications.map((job) => {
              const statusBadge = getApplicationStatusLabel(job.status);
              const cleanWhatsappPhone = job.phone.replace(/[^0-9]/g, "");
              const whatsappUrl = `https://wa.me/${
                cleanWhatsappPhone.startsWith("0")
                  ? "2" + cleanWhatsappPhone
                  : cleanWhatsappPhone
              }`;

              return (
                <div
                  key={job.id}
                  className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-extrabold text-slate-900">
                          {job.applicantName}
                        </h4>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-bold text-emerald-700">
                          {job.jobTitle}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span>{job.department}</span>
                        <span>·</span>
                        <span className="font-mono">{job.phone}</span>
                        <span>·</span>
                        <span className="font-mono">{job.email}</span>
                        <span>·</span>
                        <span>{job.createdAt}</span>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-lg border text-xs font-bold shrink-0 ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1">
                      <div className="font-bold text-slate-800">
                        الخبرة ومنطقة السكن:
                      </div>
                      <p className="text-slate-600">
                        سنوات الخبرة: {job.experienceYears}
                      </p>
                      <p className="text-slate-600">
                        منطقة السكن: {job.residenceArea}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1">
                      <div className="font-bold text-slate-800">
                        نبذة المتقدم والسيرة المختصرة:
                      </div>
                      <p className="text-slate-600">{job.summary}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تواصل واتساب للمقابلة</span>
                      </a>
                      <a
                        href={`tel:${job.phone}`}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-600" />
                        <span>اتصال هاتفي</span>
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateJobStatus(job.id, "contacted")}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                      >
                        تم تحديد مقابلة
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateJobStatus(job.id, "approved")}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                      >
                        قبول وتعيين
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateJobStatus(job.id, "rejected")}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                      >
                        اعتذار
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
