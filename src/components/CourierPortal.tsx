import { OrderMap } from "./OrderMap.tsx";
import React, { useState } from "react";
import {
  Bike,
  CheckCircle2,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Store as StoreIcon,
  PackageCheck,
  Receipt,
  Banknote,
  Navigation,
  Check,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Order, Profile } from "../types/index.ts";
import { formatEGP } from "../utils/orderCalculations.ts";

interface CourierPortalProps {
  onCompleteDelivery: (orderId: string, otpCode: string, collectedAmount: number) => Promise<void>;
  courier: Profile;
  orders: Order[];
  onUpdateOrderChecklist: (
    orderId: string,
    checklistUpdates: {
      receivedAndCheckedAtRestaurant?: boolean;
      paidRestaurant?: boolean;
      settledRestaurantAmount?: number;
      onTheWayToMinistry?: boolean;
      arrivedAtCustomerOffice?: boolean;
      collectedPayment?: boolean;
      collectedAmount?: number;
      notes?: string;
    },
    updatedStatus?: Order["orderStatus"],
  ) => void;
  onAdvanceOrderStatus: (
    orderId: string,
    newStatus: Order["orderStatus"],
  ) => void;
}

export const CourierPortal: React.FC<CourierPortalProps> = ({
  courier,
  orders,
  onUpdateOrderChecklist,
  onAdvanceOrderStatus,
  onCompleteDelivery,
}) => {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [deliveryPending, setDeliveryPending] = useState<string[]>([]);
  const [deliveryError, setDeliveryError] = useState("");
  async function confirmDelivery(order: Order) {
    setDeliveryError("");
    if (!/^\d{4}$/.test(codes[order.id] || "")) { setDeliveryError("أدخل رمز الاستلام المكون من 4 أرقام من العميل."); return; }
    setDeliveryPending((ids) => [...ids, order.id]);
    try { await onCompleteDelivery(order.id, codes[order.id], inputCollectedAmounts[order.id] ?? order.total); }
    catch (error) { setDeliveryError((error as Error).message); }
    finally { setDeliveryPending((ids) => ids.filter((id) => id !== order.id)); }
  }
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeNotes, setActiveNotes] = useState<Record<string, string>>({});
  const [inputPaidAmounts, setInputPaidAmounts] = useState<
    Record<string, number>
  >({});
  const [inputCollectedAmounts, setInputCollectedAmounts] = useState<
    Record<string, number>
  >({});

  const assignedOrders = orders.filter(
    (order) => order.courierId === courier.id,
  );

  const activeDeliveries = assignedOrders.filter(
    (o) => o.orderStatus !== "delivered" && o.orderStatus !== "cancelled",
  );

  const completedDeliveries = assignedOrders.filter(
    (o) => o.orderStatus === "delivered",
  );

  // Calculate financial balances
  const totalCashInHand = completedDeliveries
    .filter((o) => o.paymentMethod === "cash")
    .reduce(
      (sum, o) => sum + (o.courierChecklist?.collectedAmount ?? o.total),
      0,
    );

  const totalTipsAndFeesEarned = completedDeliveries.reduce(
    (sum, o) => sum + o.deliveryFee + o.tip,
    0,
  );

  const handleToggleStep = (
    order: Order,
    step: "received" | "paid" | "travel" | "arrive" | "collect",
  ) => {
    const current = order.courierChecklist || {
      receivedAndCheckedAtRestaurant: false,
      paidRestaurant: false,
      onTheWayToMinistry: false,
      arrivedAtCustomerOffice: false,
      collectedPayment: false,
    };

    const restaurantCost = Math.max(0, order.subtotal - order.discount);
    const orderTotal = order.total;

    if (step === "received") {
      const nextVal = !current.receivedAndCheckedAtRestaurant;
      onUpdateOrderChecklist(order.id, {
        receivedAndCheckedAtRestaurant: nextVal,
      });
    } else if (step === "paid") {
      const nextVal = !current.paidRestaurant;
      const settledAmount = inputPaidAmounts[order.id] ?? restaurantCost;
      onUpdateOrderChecklist(order.id, {
        paidRestaurant: nextVal,
        settledRestaurantAmount: nextVal ? settledAmount : 0,
      });
    } else if (step === "travel") {
      const nextVal = !current.onTheWayToMinistry;
      onUpdateOrderChecklist(order.id, {
        onTheWayToMinistry: nextVal,
      });
    } else if (step === "arrive") {
      const nextVal = !current.arrivedAtCustomerOffice;
      onUpdateOrderChecklist(order.id, {
        arrivedAtCustomerOffice: nextVal,
      });
    } else if (step === "collect") {
      void confirmDelivery(order);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-5" dir="rtl">
      {deliveryError && <p role="alert" className="bg-red-50 text-red-700 rounded-xl p-3">{deliveryError}</p>}
      {/* Courier Identity Card */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950 text-white rounded-3xl p-5 shadow-lg border border-emerald-700/50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl shadow-inner shrink-0">
              🛵
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[11px] font-bold border border-emerald-400/30">
                  كابتن دليفري معتمد
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  متاح للتوصيل
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-0.5">
                {courier.fullName}
              </h2>
              <p className="text-xs text-emerald-100/90 flex items-center gap-2 mt-0.5">
                <span>{courier.vehicleType || "دراجة كهربائية سريعة"}</span>
                <span>•</span>
                <span>{courier.phone}</span>
                <span>•</span>
                <span>لوحة: {courier.vehiclePlate || "س ق و 442"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto bg-black/20 p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "active"
                  ? "bg-emerald-500 text-white shadow-md"
                  : "text-white/80 hover:text-white"
              }`}
            >
              الطلبات الجارية ({activeDeliveries.length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "completed"
                  ? "bg-emerald-500 text-white shadow-md"
                  : "text-white/80 hover:text-white"
              }`}
            >
              الطلبات المسلمة ({completedDeliveries.length})
            </button>
          </div>
        </div>

        {/* Courier Financial Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-emerald-200 block">
              مهام نشطة الآن
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-white">
                {activeDeliveries.length}
              </span>
              <span className="text-[11px] text-emerald-200">طلب ميداني</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-emerald-200 block">
              كاش في العهدة اليوم
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-300">
                {formatEGP(totalCashInHand)}
              </span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-emerald-200 block">
              أرباحك وبقشيشك
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-emerald-300">
                {formatEGP(totalTipsAndFeesEarned)}
              </span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-emerald-200 block">
              معدل التوصيل
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-white">14</span>
              <span className="text-[11px] text-emerald-200">دقيقة / دور</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Delivery Task List */}
      {activeTab === "active" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-black text-slate-900">
                قائمة مهام التوصيل الميدانية للحي الحكومي
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-full">
              {activeDeliveries.length} طلب بحاجة للتنفيذ
            </span>
          </div>

          {activeDeliveries.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center text-3xl">
                ☕
              </div>
              <h4 className="text-base font-bold text-slate-800">
                لا توجد طلبات معلقة لك حالياً
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                رائع! تم تسليم جميع الطلبات بنجاح. بمجرد أن يطلب أي موظف من الـ
                34 وزارة، ستظهر هنا مهمة التوصيل مباشرة.
              </p>
            </div>
          ) : (
            activeDeliveries.map((order) => {
              const checklist = order.courierChecklist || {
                receivedAndCheckedAtRestaurant: false,
                paidRestaurant: false,
                onTheWayToMinistry: false,
                arrivedAtCustomerOffice: false,
                collectedPayment: false,
              };

              const restaurantCost = Math.max(
                0,
                order.subtotal - order.discount,
              );
              const isExpanded = expandedOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl border-2 border-emerald-500/20 shadow-md overflow-hidden transition-all hover:border-emerald-500/40"
                >
                  {/* Order Header */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-emerald-50/30 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
                        #{order.orderNumber.replace("CAP-", "")}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900">
                            {order.orderNumber}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                            {order.orderStatus === "preparing"
                              ? "جاهز للاستلام بالفود كورت"
                              : "مع المندوب في الطريق"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>الطلب: {order.createdAt}</span>
                          <span>•</span>
                          <span className="font-bold text-emerald-700">
                            {order.estimatedDelivery}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-left bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 block font-bold">
                          المطلوب تحصيله
                        </span>
                        <span className="text-base font-black text-emerald-700">
                          {formatEGP(order.total)}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setExpandedOrderId(isExpanded ? null : order.id)
                        }
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
                        title="تفاصيل إضافية"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 space-y-4">
                    {order.scheduledDeliveryTime && (
                      <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 flex items-center gap-2 text-xs font-bold text-orange-950">
                        <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                        <span>
                          طلب مجدول مسبقاً — موعد التسليم المطلوب لمكتب الموظف:{" "}
                          <span className="underline">
                            {order.scheduledDeliveryTime}
                          </span>
                        </span>
                      </div>
                    )}
                    {/* Destination & Contact info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Dropoff Destination (Ministry + Floor + Room) */}
                      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-emerald-900 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            عنوان التسليم بالحي الحكومي:
                          </span>
                          <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md">
                            وجهة التوصيل
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-black text-slate-900">
                            {order.ministry}
                          </p>
                          <p className="text-xs text-emerald-950 font-bold">
                            {order.floorNumber} — {order.roomNumber}
                          </p>
                          <div className="flex items-center justify-between pt-1 text-xs text-slate-700">
                            <span className="font-medium">
                              الموظف: <strong>{order.profileName}</strong>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${order.phone}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors"
                              >
                                <Phone className="w-3 h-3" />
                                <span>اتصال</span>
                              </a>
                              <a
                                href={`https://wa.me/2${order.phone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>واتساب</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pickup Restaurant Info */}
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                            <StoreIcon className="w-3.5 h-3.5 text-amber-700" />
                            نقطة استلام الطلب بالفود كورت:
                          </span>
                          <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                            المطعم
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">
                            {order.items[0]?.product.storeName ||
                              "فود كورت الحي الحكومي"}
                          </p>
                          <p className="text-xs text-amber-900 mt-0.5">
                            مبنى الخدمات المركزية C2 — فود كورت الموظفين
                          </p>
                          <div className="flex items-center justify-between pt-2 text-xs">
                            <span className="text-slate-600">
                              مطلوب دفعه للمطعم:{" "}
                              <strong className="text-slate-900 font-bold">
                                {formatEGP(restaurantCost)}
                              </strong>
                            </span>
                            <span className="text-[11px] text-amber-800 font-bold">
                              طريقة الدفع:{" "}
                              {order.paymentMethod === "cash"
                                ? "نقدي عند التسليم"
                                : "إلكتروني مسبق"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Order Items Summary (Collapsed or expanded) */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                        <span>
                          أصناف الأوردر لمراجعتها (
                          {order.items.reduce((s, i) => s + i.quantity, 0)}{" "}
                          قطعة):
                        </span>
                        <span className="text-slate-400">
                          تأكد من سخونة ومطابقة الطلب
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-800">
                        <OrderMap order={order} canShare />
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1 border-b border-slate-200/60 last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black flex items-center justify-center">
                                {item.quantity}×
                              </span>
                              <span className="font-medium text-slate-900">
                                {item.product.name}
                              </span>
                              {Object.entries(item.selectedOptions).length >
                                0 && (
                                <span className="text-[10px] text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                                  {Object.values(item.selectedOptions).join(
                                    " - ",
                                  )}
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-slate-900">
                              {formatEGP(item.product.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* THE 5 CORE COURIER EXECUTION STEPS REQUIRED BY USER */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>إجراءات ومحطات مندوب التوصيل الميداني:</span>
                        </h5>
                        <span className="text-[11px] font-bold text-emerald-700">
                          {Object.values(checklist).filter(Boolean).length} من 5
                          مكتملة
                        </span>
                      </div>

                      {/* Step 1: استلام الأوردر من المطعم */}
                      <div
                        onClick={() => handleToggleStep(order, "received")}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                          checklist.receivedAndCheckedAtRestaurant
                            ? "bg-emerald-50 border-emerald-300"
                            : "bg-white border-slate-200 hover:border-emerald-300"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            checklist.receivedAndCheckedAtRestaurant
                              ? "bg-emerald-600 text-white"
                              : "border-2 border-slate-300"
                          }`}
                        >
                          {checklist.receivedAndCheckedAtRestaurant && (
                            <Check className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">
                              1. استلام الأوردر ومراجعته من شيف المطعم بالفود
                              كورت
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {checklist.receivedAndCheckedAtRestaurant
                                ? "تم الاستلام"
                                : "اضغط للتأكيد"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            التأكد من اكتمال عدد السندوتشات والمشروبات ومطابقتها
                            للشيك المسلم من المطعم.
                          </p>
                        </div>
                      </div>

                      {/* Step 2: دفع المبالغ للمطعم وتأكيد التسوية */}
                      <div
                        className={`p-3.5 rounded-2xl border transition-all ${
                          checklist.paidRestaurant
                            ? "bg-emerald-50 border-emerald-300"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            onClick={() => handleToggleStep(order, "paid")}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors ${
                              checklist.paidRestaurant
                                ? "bg-emerald-600 text-white"
                                : "border-2 border-slate-300"
                            }`}
                          >
                            {checklist.paidRestaurant && (
                              <Check className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div
                              className="flex items-center justify-between"
                              onClick={() => handleToggleStep(order, "paid")}
                            >
                              <span className="text-xs font-black text-slate-900">
                                2. دفع / تسوية المبالغ مع كاشير المطعم
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">
                                {checklist.paidRestaurant
                                  ? "تم الدفع للمطعم"
                                  : "مطلوب السداد"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-slate-600">
                                المبلغ المسدد للمطعم:
                              </span>
                              <input
                                type="number"
                                value={
                                  inputPaidAmounts[order.id] ?? restaurantCost
                                }
                                onChange={(e) =>
                                  setInputPaidAmounts({
                                    ...inputPaidAmounts,
                                    [order.id]: Number(e.target.value),
                                  })
                                }
                                className="w-24 px-2 py-1 text-xs font-bold border border-slate-300 rounded-lg text-slate-900 bg-white"
                              />
                              <span className="text-xs font-bold text-slate-700">
                                ج.م
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleStep(order, "paid")}
                                className="px-3 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-lg shadow-xs hover:bg-emerald-700"
                              >
                                {checklist.paidRestaurant
                                  ? "تعديل السداد"
                                  : "تأكيد السداد"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 3: التحرك لمبنى الوزارة والدور المطلوب */}
                      <div
                        onClick={() => handleToggleStep(order, "travel")}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                          checklist.onTheWayToMinistry
                            ? "bg-emerald-50 border-emerald-300"
                            : "bg-white border-slate-200 hover:border-emerald-300"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            checklist.onTheWayToMinistry
                              ? "bg-emerald-600 text-white"
                              : "border-2 border-slate-300"
                          }`}
                        >
                          {checklist.onTheWayToMinistry && (
                            <Check className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">
                              3. التحرك لمبنى {order.ministry} (
                              {order.floorNumber})
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {checklist.onTheWayToMinistry
                                ? "في الطريق للمصعد"
                                : "اضغط عند الانطلاق"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            الانطلاق بالدراجة السريعة ودخول بوابة مبنى الوزارة
                            والمصعد متجهاً للمكتب.
                          </p>
                        </div>
                      </div>

                      {/* Step 4: الوصول لمكتب الموظف بالدور المعني */}
                      <div
                        onClick={() => handleToggleStep(order, "arrive")}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                          checklist.arrivedAtCustomerOffice
                            ? "bg-emerald-50 border-emerald-300"
                            : "bg-white border-slate-200 hover:border-emerald-300"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            checklist.arrivedAtCustomerOffice
                              ? "bg-emerald-600 text-white"
                              : "border-2 border-slate-300"
                          }`}
                        >
                          {checklist.arrivedAtCustomerOffice && (
                            <Check className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">
                              4. الوصول لمكتب الموظف وتسليم الوجبات (
                              {order.roomNumber})
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {checklist.arrivedAtCustomerOffice
                                ? "تم الوصول للمكتب"
                                : "اضغط عند الوصول"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <label className="block text-xs font-bold">رمز الاستلام من العميل
                        <input aria-label={`رمز استلام ${order.orderNumber}`} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" value={codes[order.id] || ""} onChange={(e) => setCodes({ ...codes, [order.id]: e.target.value.replace(/[^0-9]/g, "") })} className="block w-full p-3 mt-2 border rounded-xl text-xl tracking-widest" />
                      </label>
                      {/* Step 5: استلام الأموال من الموظف وإغلاق الأوردر */}
                      <div className="p-4 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                            <Banknote className="w-4 h-4 text-emerald-700" />
                            5. استلام الأموال من الموظف وإغلاق الطلب نهائياً
                          </span>
                          <span className="text-xs font-black text-emerald-800">
                            المطلوب: {formatEGP(order.total)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                              المبلغ الفعلي المستلم (ج.م):
                            </label>
                            <input
                              type="number"
                              value={
                                inputCollectedAmounts[order.id] ?? order.total
                              }
                              onChange={(e) =>
                                setInputCollectedAmounts({
                                  ...inputCollectedAmounts,
                                  [order.id]: Number(e.target.value),
                                })
                              }
                              className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                              ملاحظات كابتن التوصيل:
                            </label>
                            <input
                              type="text"
                              value={
                                activeNotes[order.id] ??
                                (order.courierChecklist?.notes ||
                                  "تم التسليم باليد والأوردر كامل وساخن.")
                              }
                              onChange={(e) =>
                                setActiveNotes({
                                  ...activeNotes,
                                  [order.id]: e.target.value,
                                })
                              }
                              placeholder="اكتب ملاحظة الاستلام والتسليم..."
                              className="w-full px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-xl bg-white text-slate-900"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={deliveryPending.includes(order.id)}
                          onClick={() => handleToggleStep(order, "collect")}
                          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2 transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {checklist.collectedPayment
                              ? "تأكيد تحديث إغلاق الطلب وتوريد العهدة"
                              : deliveryPending.includes(order.id) ? "جارٍ التحقق…" : "تأكيد الاستلام بالرمز وتحصيل المبلغ"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Completed Deliveries History */}
      {activeTab === "completed" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">
              سجل الطلبات المسلمة والعهد المالية
            </h3>
            <span className="text-xs font-bold text-slate-500">
              {completedDeliveries.length} طلب مكتمل
            </span>
          </div>

          {completedDeliveries.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
              <p className="text-xs text-slate-500">
                لا توجد طلبات مسلمة حتى الآن.
              </p>
            </div>
          ) : (
            completedDeliveries.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900">
                      {order.orderNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      تم التسليم بنجاح
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {order.ministry} • {order.floorNumber} • {order.profileName}
                  </p>
                  {order.courierChecklist?.notes && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded-lg mt-1.5 border border-slate-100">
                      ملاحظة الكابتن: {order.courierChecklist.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto text-left">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      المحصل في العهدة
                    </span>
                    <span className="text-sm font-black text-emerald-700">
                      {formatEGP(
                        order.courierChecklist?.collectedAmount ?? order.total,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
