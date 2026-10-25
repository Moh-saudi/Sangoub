import { OrderReceiptCode } from "./OrderReceiptCode";
import { OrderMap } from "./OrderMap.tsx";
import React, { useState } from "react";
import {
  PackageCheck,
  Clock,
  Bike,
  CheckCircle,
  Phone,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  AlertCircle,
  Check,
  Receipt,
  MessageCircle,
} from "lucide-react";
import type { Order, OrderStatus } from "../types/index.ts";
import { formatEGP, getOrderStatusLabel } from "../utils/orderCalculations.ts";

interface OrdersViewProps {
  orders: Order[];
  onReorder: (order: Order) => void;
  onTrackOrder?: (orderId: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  onReorder,
}) => {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(
    orders.length > 0 ? orders[0].id : null,
  );

  const toggleExpand = (id: string) => {
    setExpandedOrderId((prev) => (prev === id ? null : id));
  };

  const getStepState = (currentStatus: OrderStatus, stepNumber: number) => {
    const statusMap: Record<OrderStatus, number> = {
      received: 1,
      preparing: 2,
      ready: 3,
      with_courier: 4,
      delivered: 5,
      cancelled: 0,
    };
    const currentStep = statusMap[currentStatus];

    if (currentStatus === "cancelled") return "cancelled";
    if (currentStep > stepNumber) return "completed";
    if (currentStep === stepNumber) return "current";
    return "upcoming";
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4" dir="rtl">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            طلباتي بالحي الحكومي
          </h2>
          <p className="text-xs text-slate-500">
            متابعة حالة الوجبات وتحديثات مندوب التوصيل الميداني لمكتبك في
            الوزارة
          </p>
        </div>
        <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
          {orders.length} طلبات
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mx-auto mb-3">
            📋
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            لا توجد طلبات حالية
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            قم بالطلب من الفود كورت أو السوبر ماركت لتتبع وصول مندوبك إلى مكتبك
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const statusInfo = getOrderStatusLabel(order.orderStatus);
            const checklist = order.courierChecklist;

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all overflow-hidden"
              >
                {isExpanded && <OrderMap order={order} />}
                {isExpanded && !["delivered", "cancelled"].includes(order.orderStatus) && <OrderReceiptCode orderId={order.id} />}
                {order.legacyRecord && (
                  <p className="text-xs text-amber-900 bg-amber-50 p-3">
                    سجل قديم: {order.legacySummary}. المتاح هو إجمالي الطلب فقط؛
                    تفاصيل الأسعار الفرعية غير محفوظة.
                  </p>
                )}
                {/* Order Summary Bar */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none bg-slate-50/40 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border ${statusInfo.colorClass}`}
                    >
                      {order.orderStatus === "delivered"
                        ? "✓"
                        : order.orderStatus === "with_courier"
                          ? "🛵"
                          : "🍳"}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-slate-900">
                          {order.orderNumber}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          · {order.createdAt}
                        </span>
                        {order.scheduledDeliveryTime && (
                          <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-md border border-orange-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-orange-600" />
                            <span>مجدول: {order.scheduledDeliveryTime}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-700 truncate mt-0.5">
                        {order.ministry} · {order.floorNumber}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <span className="text-xs sm:text-sm font-black text-emerald-800 tabular-nums block">
                        {formatEGP(order.total)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.colorClass}`}
                      >
                        {statusInfo.text}
                      </span>
                    </div>

                    <button
                      className="text-slate-400 hover:text-slate-600 p-1"
                      aria-label="تفاصيل الطلب"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-2 border-t border-slate-100 space-y-4">
                    {/* Scheduled Order Banner if scheduled */}
                    {order.scheduledDeliveryTime && (
                      <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between gap-2 text-xs text-orange-950">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-orange-600 shrink-0" />
                          <span>
                            <strong>طلب مجدول مسبقاً:</strong> موعد التسليم
                            المحدد هو{" "}
                            <strong className="underline">
                              {order.scheduledDeliveryTime}
                            </strong>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Visual Progress Steps Tracker */}
                    <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70">
                      <div className="text-xs font-bold text-slate-800 mb-3 flex items-center justify-between">
                        <span>خط سير توصيل الطلب للوزارة</span>
                        <span className="text-[11px] text-emerald-700 font-bold">
                          {order.estimatedDelivery}
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1 text-center">
                        {["استلام الطلب", "التحضير", "جاهز للاستلام", "مع المندوب", "تم التسليم"].map((label, index) => {
                          const state = getStepState(order.orderStatus, index + 1);
                          return <div key={label} className="flex flex-col items-center gap-2">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${["upcoming", "cancelled"].includes(state) ? "bg-white border text-slate-400" : "bg-emerald-600 text-white"}`}>{index + 1}</span>
                            <span className="text-[10px] text-slate-700">{label}</span>
                          </div>;
                        })}
                      </div>
                    </div>

                    {/* LIVE COURIER CHECKLIST STEPS (Detailed view for employee) */}
                    {checklist && (
                      <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                            <Bike className="w-4 h-4 text-emerald-700" />
                            تحديثات مندوب التوصيل اللحظية:
                          </span>
                          <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
                            متابعة دقيقة للطلب
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div
                            className={`flex items-center gap-2 p-2 rounded-xl border ${
                              checklist.receivedAndCheckedAtRestaurant
                                ? "bg-white text-slate-900 border-emerald-300"
                                : "bg-white/50 text-slate-400 border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                checklist.receivedAndCheckedAtRestaurant
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              {checklist.receivedAndCheckedAtRestaurant
                                ? "✓"
                                : "1"}
                            </span>
                            <span>استلام ومراجعة الطلب من المطعم</span>
                          </div>

                          <div
                            className={`flex items-center gap-2 p-2 rounded-xl border ${
                              checklist.paidRestaurant
                                ? "bg-white text-slate-900 border-emerald-300"
                                : "bg-white/50 text-slate-400 border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                checklist.paidRestaurant
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              {checklist.paidRestaurant ? "✓" : "2"}
                            </span>
                            <span>سداد حساب المطعم بالفود كورت</span>
                          </div>

                          <div
                            className={`flex items-center gap-2 p-2 rounded-xl border ${
                              checklist.onTheWayToMinistry
                                ? "bg-white text-slate-900 border-emerald-300"
                                : "bg-white/50 text-slate-400 border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                checklist.onTheWayToMinistry
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              {checklist.onTheWayToMinistry ? "✓" : "3"}
                            </span>
                            <span>
                              في الطريق لمبنى {order.ministry} (
                              {order.floorNumber})
                            </span>
                          </div>

                          <div
                            className={`flex items-center gap-2 p-2 rounded-xl border ${
                              checklist.collectedPayment
                                ? "bg-white text-slate-900 border-emerald-300"
                                : "bg-white/50 text-slate-400 border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                checklist.collectedPayment
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              {checklist.collectedPayment ? "✓" : "4"}
                            </span>
                            <span>تسليم المكتب واستلام الحساب</span>
                          </div>
                        </div>

                        {checklist.notes && (
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-xs text-slate-700">
                            <span className="font-bold text-emerald-900 ml-1">
                              ملاحظة الكابتن:
                            </span>
                            <span>{checklist.notes}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Assigned Courier Card */}
                    {order.courierName ? (
                      <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg">
                            🛵
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-800 font-bold block">
                              مندوب الحي الحكومي المعين لطلبك:
                            </span>
                            <span className="text-xs font-black text-slate-900">
                              {order.courierName}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {order.courierPhone && (
                            <>
                              <a
                                href={`tel:${order.courierPhone}`}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span>اتصال</span>
                              </a>
                              <a
                                href={`https://wa.me/2${order.courierPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>واتساب</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs text-amber-900">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          جاري تعيين مندوب التوصيل الميداني من لوحة تحكم إدارة
                          الفود كورت...
                        </span>
                      </div>
                    )}

                    {/* Items Breakdown */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-900 block">
                        تفاصيل الفاتورة والأصناف:
                      </span>
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">
                                {item.quantity}× {item.product.name}
                              </span>
                              {Object.values(item.selectedOptions).length >
                                0 && (
                                <span className="text-[10px] text-slate-500">
                                  (
                                  {Object.values(item.selectedOptions).join(
                                    ", ",
                                  )}
                                  )
                                </span>
                              )}
                            </div>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {formatEGP(
                                (item.product.price + (item.extraPrice || 0)) *
                                  item.quantity,
                              )}
                            </span>
                          </div>
                        ))}

                        <div className="pt-2 border-t border-slate-200 text-xs space-y-1 text-slate-600">
                          <div className="flex justify-between items-center">
                            <span>طريقة الدفع:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">
                                {order.paymentMethod === "instapay"
                                  ? "إنستا باي (InstaPay)"
                                  : order.paymentMethod === "geidea"
                                    ? "بطاقة بنكية (Geidea)"
                                    : "نقداً لمندوب الدور"}
                              </span>
                              {order.paymentStatus === "paid" && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                                  ✓ تم السداد
                                </span>
                              )}
                            </div>
                          </div>
                          {order.discount > 0 && (
                            <div className="flex justify-between text-emerald-700 font-semibold">
                              <span>قسيمة الخصم ({order.couponCode}):</span>
                              <span className="tabular-nums">
                                -{formatEGP(order.discount)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-slate-900 font-bold text-sm pt-1">
                            <span>الإجمالي:</span>
                            <span className="text-emerald-800 tabular-nums">
                              {formatEGP(order.total)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {order.roomNumber} ({order.floorNumber})
                        </span>
                      </div>

                      <button
                        onClick={() => onReorder(order)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة طلب الوجبات</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
