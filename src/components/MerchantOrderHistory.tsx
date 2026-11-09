import React, { useState, useMemo } from 'react';
import {
  Archive,
  CheckCircle2,
  XCircle,
  Search,
  Calendar,
  Filter,
  Printer,
  Eye,
  Copy,
  DollarSign,
  Truck,
  User,
  Clock,
  RotateCw,
  ShoppingBag,
  CreditCard,
  Layers,
  ChevronDown,
  X
} from 'lucide-react';
import type { Order, Store, Product } from '../types';
import { formatEGP } from '../utils/orderCalculations';
import { CustomerPOSReceipt } from './CustomerPOSReceipt';

export interface MerchantOrderHistoryProps {
  orders: Order[];
  stores: Store[];
  fixedStoreId?: string;
  userStore: Store;
  products?: Product[];
  couriers?: any[];
  onLoadMoreHistory?: () => void;
  hasMoreHistory?: boolean;
  historyLoading?: boolean;
}

export function MerchantOrderHistory({
  orders,
  stores,
  fixedStoreId,
  userStore,
  products = [],
  couriers = [],
  onLoadMoreHistory,
  hasMoreHistory = false,
  historyLoading = false,
}: MerchantOrderHistoryProps) {
  const currentStoreId = fixedStoreId || userStore.id;

  // Tabs: 'completed' vs 'cancelled'
  const [activeTab, setActiveTab] = useState<'completed' | 'cancelled'>('completed');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedCourierId, setSelectedCourierId] = useState<string>('all');

  // Drawer / Print modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Products catalog map for images
  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      if (p.id) map.set(p.id, p);
    }
    return map;
  }, [products]);

  // Filter store orders
  const storeOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.storeIds && o.storeIds.length > 0) {
        return o.storeIds.includes(currentStoreId);
      }
      return o.storeId === currentStoreId;
    });
  }, [orders, currentStoreId]);

  // Split into completed and cancelled
  const completedOrders = useMemo(() => {
    return storeOrders.filter(o => o.orderStatus === 'delivered');
  }, [storeOrders]);

  const cancelledOrders = useMemo(() => {
    return storeOrders.filter(o => o.orderStatus === 'cancelled');
  }, [storeOrders]);

  // Statistics
  const stats = useMemo(() => {
    const completedTotal = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const avgOrderValue = completedOrders.length > 0 ? completedTotal / completedOrders.length : 0;
    return {
      completedCount: completedOrders.length,
      completedTotal,
      cancelledCount: cancelledOrders.length,
      avgOrderValue,
    };
  }, [completedOrders, cancelledOrders]);

  // Apply filters on the active tab list
  const filteredList = useMemo(() => {
    const baseList = activeTab === 'completed' ? completedOrders : cancelledOrders;

    return baseList.filter(order => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = (order.orderNumber || order.id).toLowerCase().includes(q);
        const nameMatch = (order.profileName || '').toLowerCase().includes(q);
        const phoneMatch = (order.phone || '').includes(q);
        if (!numMatch && !nameMatch && !phoneMatch) return false;
      }

      // Date Filter
      if (dateFilter !== 'all' && order.createdAt) {
        const orderTime = new Date(order.createdAt).getTime();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        if (dateFilter === 'today' && now - orderTime > dayMs) return false;
        if (dateFilter === 'week' && now - orderTime > 7 * dayMs) return false;
        if (dateFilter === 'month' && now - orderTime > 30 * dayMs) return false;
      }

      // Payment Filter
      if (paymentFilter !== 'all') {
        if (order.paymentMethod !== paymentFilter) return false;
      }

      // Courier Filter
      if (selectedCourierId !== 'all') {
        if (order.courierId !== selectedCourierId) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [activeTab, completedOrders, cancelledOrders, searchQuery, dateFilter, paymentFilter, selectedCourierId]);

  const handleCopy = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedOrderId(num);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  return (
    <div dir="rtl" className="space-y-4 font-['Tajawal'] text-slate-800 antialiased select-none">
      {/* ── 1. Header & Summary Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Main Title Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shrink-0">
            <Archive size={24} />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black text-slate-900 font-['Cairo']">
              سجل الطلبات والأرشيف
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              أرشيف الطلبات المكتملة والملغاة وتفاصيل فواتيرها
            </p>
          </div>
        </div>

        {/* Metric 1: إجمالي الطلبات المكتملة */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 font-['Cairo']">طلبات تم تسليمها بنجاح</span>
            <div className="text-2xl font-black text-emerald-600 font-['Cairo'] tabular-nums mt-0.5">
              {stats.completedCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Metric 2: إجمالي المبيعات المحققة */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 font-['Cairo']">إجمالي الإيرادات المحققة</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-['Tajawal'] tabular-nums mt-0.5">
              {formatEGP(stats.completedTotal)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Metric 3: الطلبات الملغاة */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 font-['Cairo']">طلبات ملغاة</span>
            <div className="text-2xl font-black text-rose-600 font-['Cairo'] tabular-nums mt-0.5">
              {stats.cancelledCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <XCircle size={20} />
          </div>
        </div>
      </div>

      {/* ── 2. Tabs & Filter Toolbar ── */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Tabs: Completed vs Cancelled */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black font-['Cairo'] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CheckCircle2 size={15} />
              <span>الطلبات المكتملة</span>
              <span className="text-[10px] opacity-80 tabular-nums">({stats.completedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cancelled')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black font-['Cairo'] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'cancelled'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <XCircle size={15} />
              <span>الطلبات الملغاة</span>
              <span className="text-[10px] opacity-80 tabular-nums">({stats.cancelledCount})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الطلب أو اسم العميل..."
              className="w-full h-9 pr-9 pl-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Date filter */}
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200 text-slate-600">
              <Calendar size={13} className="text-slate-400" />
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value as any)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">كافة الفترات</option>
                <option value="today">اليوم فقط</option>
                <option value="week">آخر 7 أيام</option>
                <option value="month">آخر 30 يوماً</option>
              </select>
            </div>

            {/* Payment method filter */}
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200 text-slate-600">
              <CreditCard size={13} className="text-slate-400" />
              <select
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">كافة طرق الدفع</option>
                <option value="cash">الدفع عند الاستلام (كاش)</option>
                <option value="instapay">إنستاباي (InstaPay)</option>
                <option value="card">بطاقة بنكية / فيزا</option>
                <option value="vodafone_cash">فودافون كاش</option>
              </select>
            </div>

            {/* Courier filter */}
            {couriers.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200 text-slate-600">
                <Truck size={13} className="text-slate-400" />
                <select
                  value={selectedCourierId}
                  onChange={e => setSelectedCourierId(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">كافة المناديب</option>
                  {couriers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.full_name || 'مندوب'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <span className="text-[11px] font-bold text-slate-400">
            تم العثور على {filteredList.length} طلب
          </span>
        </div>
      </div>

      {/* ── 3. Orders Table / List ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Archive size={32} className="mx-auto opacity-40 mb-2" />
            <p className="text-sm font-bold text-slate-600">لا توجد طلبات مطابقة في هذا السجل</p>
            <p className="text-xs text-slate-400">جرب تغيير معايير البحث أو الفلترة الزمنية.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 font-['Cairo'] border-b border-slate-200">
                  <th className="py-3 px-4">رقم الطلب والتوقيت</th>
                  <th className="py-3 px-4">بيانات العميل</th>
                  <th className="py-3 px-4">الأصناف والمنتجات</th>
                  <th className="py-3 px-4">المندوب</th>
                  <th className="py-3 px-4">طريقة الدفع</th>
                  <th className="py-3 px-4">الإجمالي النهائي</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredList.map(order => {
                  const distinctCount = order.items?.length || 0;
                  const totalPieces = (order.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
                  const isCopied = copiedOrderId === order.orderNumber;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Order Number & Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleCopy(order.orderNumber || order.id)}
                          className="font-bold text-slate-900 hover:text-orange-600 flex items-center gap-1 font-['Cairo'] tracking-tight cursor-pointer"
                          title="نسخ رقم الطلب"
                        >
                          <span>#{order.orderNumber || order.id.slice(0, 7)}</span>
                          <Copy size={11} className={isCopied ? 'text-emerald-500' : 'text-slate-400'} />
                        </button>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          <span>
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString('ar-EG', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'غير محدد'}
                          </span>
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <User size={12} className="text-slate-400" />
                          <span>{order.profileName || 'عميل سنجوب'}</span>
                        </div>
                        {order.phone && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">
                            {order.phone}
                          </div>
                        )}
                      </td>

                      {/* Products Summary with Thumbnails */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">
                          {distinctCount} منتج <span className="text-[10px] text-slate-400 font-normal">({totalPieces} قطعة)</span>
                        </div>
                        <div className="flex items-center -space-x-1.5 space-x-reverse mt-1">
                          {(order.items || []).slice(0, 3).map(it => {
                            const img = it.product?.imageUrl || productsMap.get(it.product?.id || '')?.imageUrl;
                            return (
                              <div
                                key={it.id}
                                className="w-6 h-6 rounded-md bg-slate-100 border border-white overflow-hidden shadow-2xs shrink-0"
                                title={it.product?.name}
                              >
                                {img ? (
                                  <img src={img} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400">
                                    {it.product?.name?.charAt(0) || 'ص'}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {distinctCount > 3 && (
                            <span className="text-[9px] font-bold text-slate-500 mr-1">
                              +{distinctCount - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Courier */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                        {order.courierName ? (
                          <div className="flex items-center gap-1">
                            <Truck size={12} className="text-indigo-600" />
                            <span>{order.courierName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Payment */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700">
                          {order.paymentMethod === 'cash'
                            ? 'كاش عند الاستلام'
                            : order.paymentMethod === 'instapay'
                            ? 'إنستاباي'
                            : order.paymentMethod === 'vodafone_cash'
                            ? 'فودافون كاش'
                            : 'دفع إلكتروني'}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-black text-slate-900 font-['Tajawal'] text-xs sm:text-sm tabular-nums">
                          {formatEGP(order.total)}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                            title="عرض تفاصيل الطلب"
                          >
                            <Eye size={12} className="text-slate-500" />
                            <span>تفاصيل</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPrintingOrder(order)}
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                            title="طباعة الفاتورة"
                          >
                            <Printer size={12} className="text-slate-500" />
                            <span>فاتورة</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More Pagination */}
        {hasMoreHistory && (
          <div className="p-4 border-t border-slate-100 flex justify-center">
            <button
              type="button"
              disabled={historyLoading}
              onClick={onLoadMoreHistory}
              className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {historyLoading ? <RotateCw size={13} className="animate-spin" /> : <ChevronDown size={14} />}
              <span>تحميل المزيد من الطلبات السابقة</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 4. Order Details Modal / Drawer ── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            onClick={() => setSelectedOrder(null)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
          />

          <aside className="relative w-full sm:w-[540px] bg-white h-full shadow-2xl flex flex-col z-10 border-r border-slate-200 animate-in slide-in-from-left">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
                <h2 className="text-sm font-black text-slate-900 font-['Cairo']">
                  تفاصيل الطلب المنتهي #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 7)}
                </h2>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-black font-['Cairo'] ${
                  selectedOrder.orderStatus === 'delivered'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {selectedOrder.orderStatus === 'delivered' ? 'مكتمل بنجاح ✓' : 'ملغي ✕'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Customer */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1">
                <div className="font-bold text-slate-900 text-xs">
                  العميل: {selectedOrder.profileName || 'عميل سنجوب'}
                </div>
                {selectedOrder.phone && (
                  <div className="text-xs text-slate-500 font-mono" dir="ltr">
                    {selectedOrder.phone}
                  </div>
                )}
                {(selectedOrder.deliveryAddress || selectedOrder.ministry) && (
                  <div className="text-xs text-slate-500">
                    العنوان: {selectedOrder.deliveryAddress || selectedOrder.ministry}
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-900 font-['Cairo']">
                  قائمة الأصناف ({selectedOrder.items?.length || 0})
                </h3>
                <div className="space-y-1.5">
                  {selectedOrder.items?.map(it => (
                    <div
                      key={it.id}
                      className="bg-white rounded-lg p-2 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{it.product?.name}</span>
                        <div className="text-[10px] text-slate-400">
                          الكمية: {it.quantity} × {formatEGP(it.product?.price || 0)}
                        </div>
                      </div>
                      <span className="font-black text-slate-900 tabular-nums">
                        {formatEGP((it.product?.price || 0) * (it.quantity || 1))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financials */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>إجمالي الأصناف:</span>
                  <span className="font-bold">{formatEGP(selectedOrder.subtotal || selectedOrder.total)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>رسوم التوصيل:</span>
                  <span className="font-bold">{formatEGP(selectedOrder.deliveryFee || 0)}</span>
                </div>
                {(selectedOrder.discount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>الخصم:</span>
                    <span className="font-bold">- {formatEGP(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-slate-900">
                  <span className="font-['Cairo']">الإجمالي النهائي:</span>
                  <span className="text-emerald-700 text-sm">{formatEGP(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-200 text-xs text-amber-900">
                  <span className="font-bold block mb-0.5">ملاحظات العميل:</span>
                  {selectedOrder.notes}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPrintingOrder(selectedOrder)}
                className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer size={15} />
                <span>طباعة الفاتورة</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── 5. POS Receipt Modal ── */}
      {printingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-4 sm:p-6 relative">
            <button
              type="button"
              onClick={() => setPrintingOrder(null)}
              className="absolute left-4 top-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
            >
              <X size={16} />
            </button>
            <CustomerPOSReceipt
              order={printingOrder}
              stores={stores}
              selectedStoreId={currentStoreId}
              onClose={() => setPrintingOrder(null)}
              showTabs={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
