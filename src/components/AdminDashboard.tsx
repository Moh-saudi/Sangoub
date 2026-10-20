import { OrderMap } from "./OrderMap.tsx";
import React, { useState, useEffect } from "react";
import {
  Bike,
  Package,
  CheckCircle,
  Clock,
  TrendingUp,
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
  Product,
  Store,
} from "../types/index.ts";

import { formatEGP, getOrderStatusLabel } from "../utils/orderCalculations.ts";

export type AdminTabType = "orders" | "partners" | "jobs" | "catalog" | "stats";

interface AdminDashboardProps {
  couriers: Array<{ id: string; name: string; phone: string }>;
  orders: Order[];
  stores: Store[];
  products: Product[];
  partnerApplications: PartnerApplication[];
  jobApplications: JobApplication[];
  initialAdminTab?: AdminTabType;
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onAssignCourier: (
    orderId: string,
    courierId: string,
    courierPhone: string,
  ) => void;
  onToggleProductStock: (productId: string) => void;
  onUpdateProductPrice: (productId: string, newPrice: number) => void;
  onToggleStoreStatus: (storeId: string) => void;
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
  stores,
  products,
  partnerApplications,
  jobApplications,
  initialAdminTab = "orders",
  onUpdateOrderStatus,
  onAssignCourier,
  onToggleProductStock,
  onUpdateProductPrice,
  onToggleStoreStatus,
  onUpdatePartnerStatus,
  onApprovePartnerAsStore,
  onUpdateJobStatus,
  onOpenWebsitePage,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTabType>(initialAdminTab);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCourierForOrder, setSelectedCourierForOrder] = useState<
    Record<string, string>
  >({});
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>("");

  useEffect(() => {
    setActiveTab(initialAdminTab);
  }, [initialAdminTab]);

  // Filtering orders
  const filteredOrders = orders.filter((o) => {
    if (statusFilter === "all") return true;
    return o.orderStatus === statusFilter;
  });

  // Calculate statistics
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const activeOrdersCount = orders.filter(
    (o) =>
      o.orderStatus === "received" ||
      o.orderStatus === "preparing" ||
      o.orderStatus === "with_courier",
  ).length;

  const pendingPartnersCount = partnerApplications.filter(
    (p) => p.status === "pending",
  ).length;
  const pendingJobsCount = jobApplications.filter(
    (j) => j.status === "pending",
  ).length;

  // Ministry breakdown count
  const ministryOrdersCount: Record<string, number> = {};
  orders.forEach((o) => {
    ministryOrdersCount[o.ministry] =
      (ministryOrdersCount[o.ministry] || 0) + 1;
  });

  const topMinistry = Object.entries(ministryOrdersCount).sort(
    (a, b) => b[1] - a[1],
  )[0] || ["لا توجد بيانات", 0];

  const handleCourierSelect = (orderId: string, courierId: string) => {
    const courier = couriers.find((c) => c.id === courierId);
    if (courier) {
      setSelectedCourierForOrder((prev) => ({ ...prev, [orderId]: courierId }));
      onAssignCourier(orderId, courier.id, courier.phone);
    }
  };

  const handleSavePrice = (productId: string) => {
    const num = parseFloat(tempPrice);
    if (!isNaN(num) && num > 0) {
      onUpdateProductPrice(productId, num);
    }
    setEditingPriceId(null);
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
    <div className="max-w-6xl mx-auto px-4 py-5 space-y-5" dir="rtl">
      {/* Top Admin Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-xl font-bold shadow-inner shrink-0">
              🏛️
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold">
                  لوحة تحكم إدارة الحي الحكومي
                </h2>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                  شركة ميسك للتكنولوجيا
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                إدارة الطلبات المباشرة، طلبات انضمام الشركاء، طلبات التوظيف،
                ومتاجر الفود كورت
              </p>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center bg-slate-800 p-1 rounded-2xl border border-slate-700 text-xs overflow-x-auto no-scrollbar gap-1">
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-3 py-1.5 font-bold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === "orders"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              الطلبات المباشرة ({orders.length})
            </button>

            <button
              onClick={() => setActiveTab("partners")}
              className={`px-3 py-1.5 font-bold rounded-xl transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === "partners"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Handshake className="w-3.5 h-3.5" />
              <span>طلبات الشركاء ({partnerApplications.length})</span>
              {pendingPartnersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-white text-orange-700 text-[10px] font-extrabold tabular-nums">
                  {pendingPartnersCount} جديد
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("jobs")}
              className={`px-3 py-1.5 font-bold rounded-xl transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === "jobs"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>طلبات التوظيف ({jobApplications.length})</span>
              {pendingJobsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-950 text-[10px] font-extrabold tabular-nums">
                  {pendingJobsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("catalog")}
              className={`px-3 py-1.5 font-bold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === "catalog"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              المتاجر والمنتجات ({stores.length})
            </button>

            <button
              onClick={() => setActiveTab("stats")}
              className={`px-3 py-1.5 font-bold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === "stats"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              إحصائيات الوزارات
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800 text-right">
          <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/60">
            <span className="text-[11px] text-slate-400 block mb-1">
              الطلبات النشطة الآن
            </span>
            <span className="text-xl font-bold text-amber-400 tabular-nums">
              {activeOrdersCount}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              قيد التجهيز والتوصيل
            </span>
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/60">
            <span className="text-[11px] text-slate-400 block mb-1">
              إجمالي المبيعات
            </span>
            <span className="text-xl font-bold text-emerald-400 tabular-nums">
              {formatEGP(totalRevenue)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              عبر إنستا باي وجيديا وكاش
            </span>
          </div>

          <div
            onClick={() => setActiveTab("partners")}
            className="bg-slate-800/80 hover:bg-slate-800 rounded-2xl p-3 border border-slate-700/60 cursor-pointer transition-colors"
          >
            <span className="text-[11px] text-slate-400 block mb-1">
              طلبات انضمام الشركاء
            </span>
            <span className="text-xl font-bold text-orange-400 tabular-nums">
              {partnerApplications.length} طلبات
            </span>
            <span className="text-[10px] text-slate-300 block mt-0.5">
              {pendingPartnersCount} بانتظار المراجعة والتعاقد
            </span>
          </div>

          <div
            onClick={() => setActiveTab("jobs")}
            className="bg-slate-800/80 hover:bg-slate-800 rounded-2xl p-3 border border-slate-700/60 cursor-pointer transition-colors"
          >
            <span className="text-[11px] text-slate-400 block mb-1">
              طلبات التوظيف بالموقع
            </span>
            <span className="text-xl font-bold text-blue-400 tabular-nums">
              {jobApplications.length} متقدمين
            </span>
            <span className="text-[10px] text-slate-300 block mt-0.5">
              مرسلة من صفحة الوظائف بالموقع
            </span>
          </div>
        </div>
      </div>

      {/* Tab 1: Orders Queue & Courier Assignment */}
      {activeTab === "orders" && (
        <div className="space-y-4">
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
                { id: "with_courier", label: "مع المندوب" },
                { id: "delivered", label: "تم التسليم" },
              ].map((filter) => (
                <button
                  key={filter.id}
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

          {/* Orders List */}
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-slate-200 text-slate-500">
                لا توجد طلبات مطابقة لهذا الفلتر
              </div>
            ) : (
              filteredOrders.map((order) => {
                const statusInfo = getOrderStatusLabel(order.orderStatus);

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 transition-all space-y-3"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
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
                      <div className="flex items-center gap-2 flex-1 max-w-md">
                        <Bike className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 shrink-0">
                          تعيين المندوب:
                        </span>
                        <select
                          value={
                            order.courierId ||
                            selectedCourierForOrder[order.id] ||
                            ""
                          }
                          onChange={(e) =>
                            handleCourierSelect(order.id, e.target.value)
                          }
                          className="flex-1 p-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 text-slate-800 truncate"
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
                        {order.orderStatus === "received" && (
                          <button
                            onClick={() =>
                              onUpdateOrderStatus(order.id, "preparing")
                            }
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            بدء التحضير بالمطعم
                          </button>
                        )}

                        {order.orderStatus === "preparing" && (
                          <button
                            onClick={() =>
                              onUpdateOrderStatus(order.id, "with_courier")
                            }
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            تسليم للمندوب وصعود الأدوار
                          </button>
                        )}

                        {order.orderStatus === "with_courier" && (
                          <button
                            onClick={() =>
                              onUpdateOrderStatus(order.id, "delivered")
                            }
                            className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            تأكيد التسليم واستلام النقد
                          </button>
                        )}

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
              })
            )}
          </div>
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

      {/* Tab 4: Catalog & Stores Management */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <StoreIcon className="w-4 h-4 text-emerald-700" />
              <span>
                متاجر الفود كورت والسوبر ماركت المسجلة ({stores.length})
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl">
                      {store.logo}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {store.name}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {store.locationInDistrict}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleStoreStatus(store.id)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      store.status === "open"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {store.status === "open" ? "مفتوح" : "مغلق مؤقتاً"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Product Prices & Stocks Editor */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-700" />
              <span>قائمة المنتجات وتعديل الأسعار وتوافر المخزون</span>
            </h3>

            <div className="space-y-2">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors gap-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-900">
                      {product.name}
                    </span>
                    <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      {product.storeName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Price editor */}
                    {editingPriceId === product.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={tempPrice}
                          onChange={(e) => setTempPrice(e.target.value)}
                          className="w-16 p-1 text-xs border border-emerald-300 rounded font-mono font-bold"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSavePrice(product.id)}
                          className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold cursor-pointer"
                        >
                          حفظ
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPriceId(product.id);
                          setTempPrice(product.price.toString());
                        }}
                        className="flex items-center gap-1 text-xs font-bold text-slate-800 hover:text-emerald-700 cursor-pointer"
                        title="تعديل السعر"
                      >
                        <span className="tabular-nums">
                          {formatEGP(product.price)}
                        </span>
                        <Edit3 className="w-3 h-3 text-slate-400" />
                      </button>
                    )}

                    {/* Stock toggle */}
                    <button
                      onClick={() => onToggleProductStock(product.id)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        product.inStock
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {product.inStock ? "متوفر بالمطبخ" : "نفد المخزون"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Ministry Statistics */}
      {activeTab === "stats" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <span>
                أكثر الوزارات طلباً في الحي الحكومي ({topMinistry[0]})
              </span>
            </h3>

            <div className="space-y-3">
              {Object.entries(ministryOrdersCount).map(
                ([ministryName, count]) => {
                  const percent = Math.round((count / orders.length) * 100);
                  return (
                    <div key={ministryName} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-800">
                        <span>{ministryName}</span>
                        <span className="tabular-nums">
                          {count} طلب ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Bike className="w-4 h-4 text-emerald-700" />
              <span>فريق المناديب المعتمد للحي الحكومي بالعاصمة</span>
            </h3>

            <div className="space-y-2.5">
              {couriers.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      🛵
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {c.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {c.phone}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    نشط بالخدمة
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
