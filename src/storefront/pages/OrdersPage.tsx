import React, { useState, useEffect } from 'react';
import { Package, Clock, MapPin, ChevronRight, ChevronLeft, Search, Phone, ExternalLink, AlertCircle, ShoppingBag, ArrowRight, Star, CheckCircle2 } from 'lucide-react';
import { formatEGP } from '../../utils/orderCalculations';
import { supabase, KNOWN_STORE_ASSETS } from '../../lib/supabase';
import { authenticatedApi } from '../../lib/authenticatedApi';
import type { TrackableOrder } from '../components/OrderTrackingModal';
import { useStore } from '../context/StoreContext';

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
  items: Array<{ name: string; quantity: number; price: number; imageUrl?: string }>;
  storeId?: string;
  storeName?: string;
  customerRating?: number;
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
  const { stores, products, user } = useStore();
  const [orders, setOrders] = useState<OrderItemDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searchError, setSearchError] = useState('');

  // Ratings map stored locally and synced to Supabase: { [orderId]: { rating: number, ratedAt: string } }
  const [ratings, setRatings] = useState<Record<string, { rating: number; ratedAt: string }>>(() => {
    try {
      const saved = localStorage.getItem('sangoub_order_ratings');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleRateOrder = async (orderId: string, star: number) => {
    const updatedRatings = {
      ...ratings,
      [orderId]: { rating: star, ratedAt: new Date().toISOString() },
    };
    setRatings(updatedRatings);
    try {
      localStorage.setItem('sangoub_order_ratings', JSON.stringify(updatedRatings));
      window.dispatchEvent(new CustomEvent('sangoub:order_rated', { detail: { orderId, rating: star } }));
    } catch {}

    // Persist directly to Supabase orders table via notes tag (avoids 400 Bad Request on non-existent customer_rating column)
    try {
      const ord = orders.find(o => o.id === orderId);
      const existingNotes = ord?.rawOrder?.notes || '';
      const cleanNotes = existingNotes.replace(/\[RATING:\d+\]/g, '').trim();
      const updatedNotes = cleanNotes ? `${cleanNotes} [RATING:${star}]` : `[RATING:${star}]`;

      await supabase
        .from('orders')
        .update({
          notes: updatedNotes,
        })
        .eq('id', orderId);
    } catch (err) {
      console.warn('Saving rating notice:', err);
    }
  };

  // Helper to resolve store name & logo for an order
  const getStoreInfo = (order: OrderItemDisplay) => {
    const raw = order.rawOrder;
    const storeId = order.storeId || raw?.store_id || raw?.items?.[0]?.storeId;
    const matched = stores.find(s => s.id === storeId || (raw?.restaurant_name && s.name === raw?.restaurant_name));
    const knownAsset = storeId ? KNOWN_STORE_ASSETS[storeId] : undefined;
    
    const name = matched?.name || raw?.restaurant_name || raw?.stores?.name || order.storeName || 'متجر سنجوب إكسبريس';
    const logo = matched?.logoUrl || matched?.imageUrl || knownAsset?.logoUrl || '/brand/sangoub-market-logo.jpg';

    return { name, logo };
  };

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
    } catch { }

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
    } catch { }

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
          const statusKey = ord.status || 'pending';
          const st = STATUS_MAP[statusKey] || { label: 'قيد المعالجة', color: 'bg-gray-100 text-gray-800 border-gray-200' };
          const existingRating = ord.customer_rating || (ord.notes?.match(/\[RATING:(\d+)\]/)?.[1] ? Number(ord.notes.match(/\[RATING:(\d+)\]/)[1]) : undefined);

          const freshDisplay: OrderItemDisplay = {
            id: ord.id,
            orderNumber: formatOrderNumber(ord.order_number || ord.id),
            createdAt: ord.created_at || new Date().toISOString(),
            status: statusKey,
            statusText: st.label,
            statusColor: st.color,
            total: Number(ord.total_amount) || 0,
            paymentMethod: ord.payment_method === 'cash' ? 'نقدًا عند الاستلام' : 'دفع إلكتروني',
            destination: ord.delivery_address || ord.delivery_ministry || 'العاصمة الإدارية',
            storeId: ord.store_id,
            storeName: ord.restaurant_name,
            customerRating: existingRating,
            items: Array.isArray(ord.order_items) ? ord.order_items.map((i: any) => ({
              name: i.product_name || 'صنف',
              quantity: i.quantity || 1,
              price: Number(i.price) || 0,
              imageUrl: i.image_url,
            })) : [],
            rawOrder: ord,
          };

          const existingIdx = loadedList.findIndex(
            (o) => o.id === ord.id || (ord.client_request_id && o.rawOrder?.client_request_id === ord.client_request_id) || (ord.order_number && o.orderNumber === formatOrderNumber(ord.order_number))
          );
          if (existingIdx >= 0) {
            loadedList[existingIdx] = freshDisplay;
          } else {
            loadedList.push(freshDisplay);
          }

          // If this order in DB is delivered or cancelled, sync localStorage sangoub_last_order and activeOrder
          if (statusKey === 'delivered' || statusKey === 'cancelled') {
            try {
              const lastStr = localStorage.getItem('sangoub_last_order');
              if (lastStr) {
                const parsed = JSON.parse(lastStr);
                if (parsed.orderId === ord.id || parsed.orderNumber === ord.order_number || parsed.orderId === ord.client_request_id) {
                  parsed.orderStatus = statusKey;
                  localStorage.setItem('sangoub_last_order', JSON.stringify(parsed));
                  window.dispatchEvent(new CustomEvent('sangoub:order_updated', { detail: { orderId: ord.id, status: statusKey } }));
                }
              }
            } catch {}
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
      orderNumber: formatOrderNumber(to.orderNumber || to.orderId),
      createdAt: to.createdAt || to.time || new Date().toISOString(),
      status: statusKey,
      statusText: st.label,
      statusColor: st.color,
      total: to.total || 0,
      paymentMethod: to.paymentMethod === 'cash' ? 'نقدًا عند الاستلام' : 'دفع إلكتروني',
      destination: to.destination || 'عنوان التوصيل',
      storeId: to.items?.[0]?.storeId,
      storeName: to.items?.[0]?.storeName,
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
          {filteredOrders.map((order) => {
            const storeInfo = getStoreInfo(order);
            const isDelivered = order.status === 'delivered';
            const currentOrderRating = ratings[order.id]?.rating || order.customerRating || 0;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-3 sm:p-3.5 border border-[#E5E7EB] hover:border-[#FF5900]/40 transition-all shadow-2xs"
              >
                {/* Order Card Top: Merchant Logo, Name, ID, Status Badge & Time */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#F0F1F3]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Merchant Logo */}
                    <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/80 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                      <img
                        src={storeInfo.logo}
                        alt={storeInfo.name}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-market-logo.jpg';
                        }}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-xs text-[#111827]">
                          #{formatOrderNumber(order.orderNumber)}
                        </span>
                        <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md border ${order.statusColor}`}>
                          {order.statusText}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#4B5563] font-bold block truncate" title={storeInfo.name}>
                        {storeInfo.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-[#6B7280] font-medium shrink-0">
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

                {/* Order Items List with Compact Product Thumbnails */}
                <div className="py-2.5">
                  <div className="space-y-1.5 text-[11px] text-[#374151]">
                    {order.items.length > 0 ? (
                      order.items.map((it, idx) => {
                        const matchedProduct = products.find(
                          (p) => p.name.trim().toLowerCase() === it.name.trim().toLowerCase()
                        );
                        const itemImg = it.imageUrl || matchedProduct?.imageUrl;

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1 border-b border-dashed border-[#F3F4F6] last:border-b-0 gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0 max-w-[75%]">
                              {/* Product Thumbnail */}
                              {itemImg ? (
                                <img
                                  src={itemImg}
                                  alt={it.name}
                                  className="w-7 h-7 rounded-lg object-cover border border-slate-200/80 bg-slate-50 shrink-0 shadow-2xs"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center shrink-0 text-[10px] font-black">
                                  🛍️
                                </div>
                              )}
                              <span className="truncate text-xs font-semibold text-[#111827]">
                                <strong className="text-[#FF5900] ml-1 font-bold">{it.quantity}x</strong>
                                <span>{it.name}</span>
                              </span>
                            </div>
                            <span className="text-[#374151] font-mono font-bold text-[10.5px] shrink-0">
                              {formatEGP(it.price * it.quantity)}
                            </span>
                          </div>
                        );
                      })
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

                {/* Card Bottom: Total Price & Dynamic Action Button */}
                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#F0F1F3]">
                  <div className="flex items-center gap-1.5">
                    <div>
                      <span className="text-[9px] text-[#6B7280] block font-bold">إجمالي الطلب</span>
                      <strong className="text-xs sm:text-sm font-black text-[#111827] leading-none">
                        {formatEGP(order.total)}
                      </strong>
                    </div>
                    <span className="text-[9px] font-medium text-[#6B7280] bg-[#F9FAFB] px-1.5 py-0.5 rounded-md border border-[#E5E7EB]">
                      {order.paymentMethod}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const trackObj: TrackableOrder = {
                        orderId: order.id || order.orderNumber,
                        orderNumber: order.orderNumber,
                        orderStatus: order.status as any,
                        itemsCount: order.items.reduce((s, i) => s + i.quantity, 0) || 1,
                        total: order.total,
                        destination: order.destination,
                        time: new Date(order.createdAt).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                        paymentMethod: (order.paymentMethod.includes('كاش') ? 'cash' : 'instapay') as any,
                        items: order.items,
                        createdAt: order.createdAt,
                      };
                      onTrackOrder(trackObj);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-lg border transition-all cursor-pointer shadow-2xs active:scale-95 ${
                      isDelivered
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-orange-50 hover:bg-orange-100 text-[#FF5900] border-orange-200'
                    }`}
                  >
                    <span>{isDelivered ? 'تفاصيل الفاتورة 📄' : 'تتبع الطلب 🛵'}</span>
                    <ChevronLeft size={12} />
                  </button>
                </div>

                {/* 5-Star Customer Rating Under Delivered Orders */}
                {isDelivered && (
                  <div className="mt-2.5 pt-2 border-t border-dashed border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-[#F9FAFB]/80 -mx-3 -mb-3 sm:-mx-3.5 sm:-mb-3.5 p-2.5 rounded-b-2xl">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-[#4B5563]">
                      <span>{currentOrderRating > 0 ? 'تقييمك للمتجر والتجربة:' : 'قيّم تجربتك مع هذا المتجر:'}</span>
                      {currentOrderRating > 0 && (
                        <span className="text-[9.5px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-bold">
                          تم الحفظ بنجاح ✓
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isFilled = star <= currentOrderRating;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleRateOrder(order.id, star)}
                            className="p-1 hover:scale-125 active:scale-95 transition-transform cursor-pointer"
                            title={`تقييم ${star} نجوم`}
                            aria-label={`تقييم ${star} نجوم من 5`}
                          >
                            <Star
                              size={16}
                              className={`transition-colors ${
                                isFilled
                                  ? 'text-amber-400 fill-amber-400 filter drop-shadow-xs'
                                  : 'text-slate-300 hover:text-amber-300'
                              }`}
                            />
                          </button>
                        );
                      })}
                      {currentOrderRating > 0 && (
                        <span className="text-[11px] font-black text-amber-600 font-mono mr-1">
                          {currentOrderRating}/5
                        </span>
                      )}
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

