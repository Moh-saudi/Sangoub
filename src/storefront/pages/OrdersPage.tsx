import React, { useState, useEffect } from 'react';
import { Package, Clock, MapPin, ChevronRight, ChevronLeft, Search, Phone, ExternalLink, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import { formatEGP } from '../../utils/orderCalculations';
import { supabase } from '../../lib/supabase';
import { authenticatedApi } from '../../lib/authenticatedApi';
import type { TrackableOrder } from '../components/OrderTrackingModal';

interface OrdersPageProps {
  onBackToHome: () => void;
  onTrackOrder: (order: TrackableOrder) => void;
  isMobile?: boolean;
}

interface OrderItemDisplay {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  statusText: string;
  statusColor: string;
  total: number;
  paymentMethod: string;
  destination: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  rawOrder: any;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'قيد المراجعة', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  confirmed: { label: 'تم التأكيد', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  preparing: { label: 'جاري التجهيز', color: 'bg-orange-50 text-orange-800 border-orange-200' },
  picked_up: { label: 'استلم المندوب الطلب', color: 'bg-purple-50 text-purple-800 border-purple-200' },
  delivering: { label: 'في الطريق للتسليم', color: 'bg-amber-50 text-amber-900 border-amber-300' },
  delivered: { label: 'تم التسليم بنجاح', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'ملغي', color: 'bg-red-50 text-red-800 border-red-200' },
};

function formatOrderNumber(raw: string | undefined): string {
  if (!raw) return 'SG-0000';
  if (raw.startsWith('SG-')) return raw;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(raw) || raw.length > 10) {
    return `SG-${raw.slice(0, 6).toUpperCase()}`;
  }
  return raw;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  onBackToHome,
  onTrackOrder,
  isMobile = false,
}) => {
  const [orders, setOrders] = useState<OrderItemDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searchError, setSearchError] = useState('');

  // 1. Load initial orders from localStorage and current session
  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    const loadedList: OrderItemDisplay[] = [];

    // Check localStorage for last placed order
    try {
      const lastOrderStr = localStorage.getItem('sangoub_last_order');
      if (lastOrderStr) {
        const lastOrder: TrackableOrder = JSON.parse(lastOrderStr);
        const mapped = mapTrackableToDisplay(lastOrder);
        if (mapped) loadedList.push(mapped);
      }
    } catch {}

    // Check localStorage history array if any
    try {
      const historyStr = localStorage.getItem('sangoub_orders_history');
      if (historyStr) {
        const history: TrackableOrder[] = JSON.parse(historyStr);
        for (const item of history) {
          if (!loadedList.some((o) => o.id === item.orderId)) {
            const mapped = mapTrackableToDisplay(item);
            if (mapped) loadedList.push(mapped);
          }
        }
      }
    } catch {}

    // Direct Query from Supabase orders table (Sole Database Source of Truth)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let query = supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });

      if (session?.user?.id) {
        query = query.eq('customer_id', session.user.id);
      }

      const { data: sbOrders } = await query.limit(30);
      if (sbOrders && sbOrders.length > 0) {
        for (const ord of sbOrders) {
          if (!loadedList.some((o) => o.id === ord.id)) {
            const statusKey = ord.status || 'pending';
            const st = STATUS_MAP[statusKey] || { label: 'قيد المعالجة', color: 'bg-gray-100 text-gray-800 border-gray-200' };
            loadedList.push({
              id: ord.id,
              orderNumber: formatOrderNumber(ord.order_number || ord.id),
              createdAt: ord.created_at || new Date().toISOString(),
              status: statusKey,
              statusText: st.label,
              statusColor: st.color,
              total: Number(ord.total_amount) || 0,
              paymentMethod: ord.payment_method === 'cash' ? 'نقدًا عند الاستلام' : 'دفع إلكتروني',
              destination: ord.delivery_address || ord.delivery_ministry || 'العاصمة الإدارية',
              items: Array.isArray(ord.order_items) ? ord.order_items.map((i: any) => ({
                name: i.product_name || 'صنف',
                quantity: i.quantity || 1,
                price: Number(i.price) || 0,
              })) : [],
              rawOrder: ord,
            });
          }
        }
      }
    } catch (err) {
      console.warn('Direct Supabase orders query notice:', err);
    }

    setOrders(loadedList);
    setLoading(false);
  };

  const mapTrackableToDisplay = (to: TrackableOrder): OrderItemDisplay => {
    const statusKey = to.orderStatus || 'delivering';
    const st = STATUS_MAP[statusKey] || { label: 'في الطريق للتسليم', color: 'bg-amber-50 text-amber-900 border-amber-300' };

    return {
      id: to.orderId,
      orderNumber: formatOrderNumber(to.orderId),
      createdAt: to.createdAt || to.time || new Date().toISOString(),
      status: statusKey,
      statusText: st.label,
      statusColor: st.color,
      total: to.total || 0,
      paymentMethod: to.paymentMethod === 'cash' ? 'نقدًا عند الاستلام' : 'دفع إلكتروني',
      destination: to.destination || 'عنوان التوصيل',
      items: to.items || [],
      rawOrder: to,
    };
  };

  const handleSearchByPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneSearch.trim()) return;
    setSearchError('');
    setLoading(true);

    try {
      const cleanPhone = phoneSearch.replace(/\D/g, '');

      // 1. Search in Supabase orders table first
      const { data: sbMatches } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .ilike('notes', `%${cleanPhone}%`)
        .order('created_at', { ascending: false })
        .limit(15);

      if (sbMatches && sbMatches.length > 0) {
        const fetchedOrders = sbMatches.map((ord: any) => {
          const statusKey = ord.status || 'pending';
          const st = STATUS_MAP[statusKey] || { label: 'قيد المعالجة', color: 'bg-gray-100 text-gray-700' };
          return {
            id: ord.id,
            orderNumber: ord.id.slice(0, 8).toUpperCase(),
            createdAt: ord.created_at || new Date().toISOString(),
            status: statusKey,
            statusText: st.label,
            statusColor: st.color,
            total: Number(ord.total_amount) || 0,
            paymentMethod: ord.payment_method === 'cash' ? 'نقدًا عند الاستلام' : 'إلكتروني',
            destination: ord.delivery_address || ord.delivery_ministry || 'العاصمة الإدارية',
            items: Array.isArray(ord.order_items) ? ord.order_items.map((i: any) => ({
              name: i.product_name || 'صنف',
              quantity: i.quantity || 1,
              price: Number(i.price) || 0,
            })) : [],
            rawOrder: ord,
          };
        });
        setOrders(fetchedOrders);
        return;
      }

      // 2. Fallback to API lookup endpoint
      const res = await fetch(`/api/orders/lookup?phone=${encodeURIComponent(cleanPhone)}`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data.orders && data.orders.length > 0) {
          const fetchedOrders = data.orders.map((ord: any) => ({
            id: ord.id,
            orderNumber: ord.orderNumber || ord.id.slice(0, 8),
            createdAt: ord.createdAt,
            status: ord.orderStatus,
            statusText: STATUS_MAP[ord.orderStatus]?.label || ord.orderStatus,
            statusColor: STATUS_MAP[ord.orderStatus]?.color || 'bg-gray-100 text-gray-700',
            total: ord.total,
            paymentMethod: ord.paymentMethod === 'cash' ? 'نقدًا عند الاستلام' : 'إلكتروني',
            destination: ord.destinationAddress || 'العاصمة الإدارية',
            items: ord.items || [],
            rawOrder: ord,
          }));
          setOrders(fetchedOrders);
        } else {
          setSearchError('لم يتم العثور على طلبات مسجلة بهذا الرقم');
        }
      } else {
        setSearchError('لم يتم العثور على طلبات مرتبطة برقم الهاتف المدخل');
      }
    } catch {
      setSearchError('تعذر البحث حالياً، برجاء المحاولة لاحقاً');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.destination.toLowerCase().includes(q) ||
      o.items.some((i) => i.name.toLowerCase().includes(q))
    );
  });

  const [showGuestSearch, setShowGuestSearch] = useState(false);

  return (
    <div className={`w-full ${isMobile ? 'px-3 py-2 pb-24' : 'max-w-4xl mx-auto px-4 py-8'} select-none font-['Cairo',sans-serif]`} dir="rtl">
      
      {/* 1. Mobile-First Clean App Bar */}
      <div className="flex items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-[#F0F1F3]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToHome}
            className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] active:scale-95 flex items-center justify-center text-[#111827] shadow-2xs transition-all cursor-pointer shrink-0"
            aria-label="الرجوع للرئيسية"
            title="رجوع"
          >
            <ChevronRight size={18} />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-[#111827] flex items-center gap-1.5">
              <span>طلباتك السابقة</span>
              {orders.length > 0 && (
                <span className="text-[10px] bg-[#FFF2EC] text-[#FF5900] font-bold px-1.5 py-0.2 rounded-full">
                  {orders.length}
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* WhatsApp Customer Support Button */}
        <button
          type="button"
          onClick={() => window.open('https://wa.me/201017799580?text=' + encodeURIComponent('مرحباً خدمة عملاء سنجوب، أحتاج مساعدة بخصوص طلباتي'), '_blank')}
          className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E8F8EE] text-[#16A34A] border border-[#BBF7D0] hover:bg-[#DCFCE7] active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
          title="تواصل مع الدعم الفني عبر واتساب"
        >
          <Phone size={11} className="text-[#16A34A]" />
          <span>الدعم الفني</span>
        </button>
      </div>

      {/* 2. Sleek Collapsible Guest Phone Lookup Card */}
      {showGuestSearch && (
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#FFD4C2] bg-gradient-to-r from-white to-[#FFF9F5] shadow-xs mb-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-start gap-2.5 mb-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center shrink-0">
              <Phone size={14} />
            </div>
            <div>
              <h2 className="text-xs font-black text-[#111827]">بحث عن طلب تم كـ زائر بدون حساب</h2>
              <p className="text-[10.5px] text-[#6B7280] font-medium">
                أدخل رقم الهاتف المسجل بالطلب لعرض مسار المندوب وبيانات الفاتورة
              </p>
            </div>
          </div>

          <form onSubmit={handleSearchByPhone} className="flex items-center gap-2">
            <input
              type="tel"
              value={phoneSearch}
              onChange={(e) => setPhoneSearch(e.target.value)}
              placeholder="01XXXXXXXXX"
              dir="ltr"
              className="px-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#D1D5DB] focus:border-[#FF5900] rounded-xl text-right flex-1 outline-hidden font-bold"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#FF5900] hover:bg-[#E04E00] text-white text-xs font-black rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
            >
              بحث
            </button>
          </form>

          {searchError && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2 flex items-center gap-1.5">
              <AlertCircle size={14} />
              <span>{searchError}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Filter / Search within listed orders (Compact) */}
      {orders.length > 0 && (
        <div className="relative mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم الطلب، اسم الصنف، أو العنوان…"
            className="w-full pr-9 pl-3 py-2 bg-white border border-[#E5E7EB] focus:border-[#FF5900] rounded-xl text-xs text-[#111827] outline-hidden shadow-2xs font-medium"
          />
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        </div>
      )}

      {/* 4. Orders List Container */}
      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-[#E5E7EB] shadow-xs">
          <div className="w-8 h-8 border-3 border-[#FF5900] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold text-[#6B7280]">جارٍ تحميل قائمة طلباتك…</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 sm:p-10 text-center border border-[#E5E7EB] shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center mx-auto mb-3">
            <ShoppingBag size={24} />
          </div>
          <h2 className="text-base font-black text-[#111827] mb-1">
            لا توجد طلبات سابقة مسجلة حالياً
          </h2>
          <p className="text-xs text-[#6B7280] max-w-xs mx-auto mb-4 leading-relaxed font-medium">
            عند إتمام طلباتك من متاجر سنجوب في العاصمة الإدارية ستظهر تفاصيلها وتتبعها المباشر هنا.
          </p>
          <button
            type="button"
            onClick={onBackToHome}
            className="px-5 py-2 bg-[#FF5900] hover:bg-[#E04E00] text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
          >
            تصفح المتاجر والبدء بالطلب
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl p-3 sm:p-3.5 border border-[#E5E7EB] hover:border-[#FF5900]/40 transition-all shadow-2xs"
            >
              {/* Order Card Top: ID, Status Badge & Time */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#F0F1F3]">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-[#111827]">
                    #{formatOrderNumber(order.orderNumber)}
                  </span>
                  <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md border ${order.statusColor}`}>
                    {order.statusText}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[10.5px] text-[#6B7280] font-medium">
                  <Clock size={11} className="text-[#9CA3AF]" />
                  <span>
                    {new Date(order.createdAt).toLocaleString('ar-EG', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* Order Items List */}
              <div className="py-2">
                <div className="space-y-1 text-[11px] text-[#374151]">
                  {order.items.length > 0 ? (
                    order.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between py-0.2">
                        <span className="truncate max-w-[70%]">
                          <strong className="text-[#111827] ml-1 font-bold">{it.quantity}x</strong>
                          <span>{it.name}</span>
                        </span>
                        <span className="text-[#6B7280] font-mono font-bold text-[10.5px]">
                          {formatEGP(it.price * it.quantity)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[#9CA3AF] text-[11px]">تفاصيل الأصناف مسجلة بالفاتورة</p>
                  )}
                </div>

                {/* Delivery Address */}
                <div className="flex items-center gap-1 text-[10.5px] text-[#6B7280] font-medium mt-1.5 pt-1.5 border-t border-dashed border-[#F0F1F3]">
                  <MapPin size={11} className="text-[#FF5900] shrink-0" />
                  <span className="truncate">{order.destination}</span>
                </div>
              </div>

              {/* Card Bottom: Total Price & Track Action Button */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F0F1F3]">
                <div className="flex items-center gap-1.5">
                  <div>
                    <span className="text-[9px] text-[#6B7280] block font-bold">إجمالي الطلب</span>
                    <strong className="text-xs sm:text-sm font-black text-[#111827] leading-none">
                      {formatEGP(order.total)}
                    </strong>
                  </div>
                  <span className="text-[9.5px] font-medium text-[#6B7280] bg-[#F9FAFB] px-1.5 py-0.5 rounded-md border border-[#E5E7EB]">
                    {order.paymentMethod}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const trackObj: TrackableOrder = {
                      orderId: order.orderNumber,
                      orderStatus: order.status as any,
                      itemsCount: order.items.reduce((s, i) => s + i.quantity, 0) || 1,
                      total: order.total,
                      destination: order.destination,
                      time: new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                      paymentMethod: 'cash',
                      items: order.items,
                      createdAt: order.createdAt,
                    };
                    onTrackOrder(trackObj);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-orange-50 hover:bg-orange-100 active:scale-95 text-[#FF5900] text-[10.5px] font-bold rounded-lg border border-orange-200 transition-all cursor-pointer shadow-2xs"
                >
                  <span>تتبع الطلب</span>
                  <ChevronLeft size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

