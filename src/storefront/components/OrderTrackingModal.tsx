import React, { useState, useEffect, useRef } from 'react';
import { formatEGP } from '../../utils/orderCalculations';
import { BRAND } from '../../brand';
import { LAUNCH_CONFIG } from '../../config/launchConfig';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  X,
  Phone,
  MessageCircle,
  Clock,
  MapPin,
  CheckCircle2,
  ChefHat,
  Bike,
  PackageCheck,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Banknote,
  Zap,
  Sparkles,
  Store,
  Compass
} from 'lucide-react';

export interface TrackableOrder {
  orderId: string;
  itemsCount: number;
  total: number;
  destination: string;
  destinationCoords?: { lat: number; lng: number };
  time: string;
  paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'card' | 'wallet';
  instapayRef?: string;
  receiptUrl?: string;
  notes?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    imageUrl?: string;
  }>;
  createdAt?: string;
}

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: TrackableOrder | null;
}

export type TrackingStage = 'received' | 'preparing' | 'with_courier' | 'delivered';

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const [currentStage, setCurrentStage] = useState<TrackingStage>('with_courier');
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [courierPos, setCourierPos] = useState<number>(0.65); // 0 = store, 1 = customer

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);

  // Fallback coords: Default to Cairo / Shorouk area
  const destCoords = order?.destinationCoords || { lat: 30.1258, lng: 31.6033 };
  const storeCoords = { lat: destCoords.lat - 0.018, lng: destCoords.lng - 0.022 };

  // Calculate courier coordinates interpolated between store and destination
  const getInterpolatedCoords = (progress: number) => {
    return {
      lat: storeCoords.lat + (destCoords.lat - storeCoords.lat) * progress,
      lng: storeCoords.lng + (destCoords.lng - storeCoords.lng) * progress,
    };
  };

  // Auto-progress simulation or stage updates
  useEffect(() => {
    if (!isOpen || !order) return;
    // Default to 'with_courier' for best demo experience, or progress naturally
    setCurrentStage('with_courier');
  }, [isOpen, order]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
    }).setView([destCoords.lat, destCoords.lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // 1. Store Marker (مطعم / متجر سنجوب)
    const storeIcon = L.divIcon({
      className: 'custom-store-pin',
      html: `
        <div style="background:#111827;color:white;padding:6px;border-radius:14px;box-shadow:0 4px 12px rgba(0,0,0,0.25);border:2px solid white;display:flex;align-items:center;justify-content:center;width:34px;height:34px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    L.marker([storeCoords.lat, storeCoords.lng], { icon: storeIcon })
      .bindPopup('<b>متجر سنجوب — مركز التحضير والتجهيز</b>')
      .addTo(map);

    // 2. Customer Destination Marker (مكان التوصيل المحدد)
    const destIcon = L.divIcon({
      className: 'custom-dest-pin',
      html: `
        <div style="background:#FF5900;color:white;padding:6px;border-radius:50%;box-shadow:0 4px 14px rgba(255,89,0,0.5);border:2.5px solid white;display:flex;align-items:center;justify-content:center;width:36px;height:36px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });
    L.marker([destCoords.lat, destCoords.lng], { icon: destIcon })
      .bindPopup(`<b>نقطة الاستلام:</b><br/>${order?.destination || 'مكان العميل'}`)
      .addTo(map);

    // 3. Route Polyline
    const routeLine = L.polyline(
      [
        [storeCoords.lat, storeCoords.lng],
        [
          (storeCoords.lat + destCoords.lat) / 2 + 0.002,
          (storeCoords.lng + destCoords.lng) / 2 - 0.003,
        ],
        [destCoords.lat, destCoords.lng],
      ],
      {
        color: '#FF5900',
        weight: 5,
        opacity: 0.85,
        dashArray: '8, 8',
      }
    ).addTo(map);

    // 4. Animated Courier Motorcycle Marker (Sangoub Squirrel Trio / Motorcycle)
    const initialCourierCoords = getInterpolatedCoords(courierPos);
    const courierIcon = L.divIcon({
      className: 'custom-courier-pin',
      html: `
        <div style="position:relative;width:52px;height:52px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.3));animation:courier-bounce 1.5s infinite alternate ease-in-out;">
          <div style="width:48px;height:48px;border-radius:50%;background:#FFF2EC;border:2.5px solid #FF5900;overflow:hidden;padding:2px;display:flex;align-items:center;justify-content:center;">
            <img src="/assets/sangoub/sangoub-trio-7.png" style="width:100%;height:100%;object-fit:contain;" alt="سنجوب على الموتوسيكل"/>
          </div>
          <span style="position:absolute;bottom:-4px;right:-4px;background:#059669;color:white;font-size:9px;font-weight:900;padding:1px 5px;border-radius:10px;border:1px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.2);">سنجوب</span>
        </div>
      `,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
    });

    const courierMarker = L.marker([initialCourierCoords.lat, initialCourierCoords.lng], {
      icon: courierIcon,
      zIndexOffset: 1000,
    }).addTo(map);
    courierMarkerRef.current = courierMarker;

    // Fit bounds to show route nicely
    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, destCoords.lat, destCoords.lng, storeCoords.lat, storeCoords.lng]);

  // Handle stage change & update courier position on map
  const handleStageSelect = (stage: TrackingStage) => {
    setCurrentStage(stage);
    let newProgress = 0.1;
    if (stage === 'received') newProgress = 0.05;
    else if (stage === 'preparing') newProgress = 0.25;
    else if (stage === 'with_courier') newProgress = 0.7;
    else if (stage === 'delivered') newProgress = 1.0;

    setCourierPos(newProgress);
    if (courierMarkerRef.current) {
      const newCoords = getInterpolatedCoords(newProgress);
      courierMarkerRef.current.setLatLng([newCoords.lat, newCoords.lng]);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs select-none transition-all"
      dir="rtl"
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl shadow-2xl border-t sm:border border-[#E5E7EB] flex flex-col max-h-[92dvh] sm:max-h-[88vh] font-['Cairo',sans-serif] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        
        {/* Mobile Pull-Down Pill */}
        <div className="w-12 h-1 bg-[#D1D5DB] rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Header Bar */}
        <div className="px-4 py-3 border-b border-[#F0F1F3] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF2EC] border border-[#FFD4C2] flex items-center justify-center shrink-0 p-1">
              <img
                src="/assets/sangoub/sangoub-trio-7.png"
                alt="تتبع سنجوب"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = BRAND.mascot.icon;
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs sm:text-sm text-[#111827]">
                  تتبع طلبك: {order.orderId}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  مباشر
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280]">
                {LAUNCH_CONFIG.showEta ? (
                  <>وقت الوصول المتوقع: <strong className="text-[#FF5900] font-black">{order.time || '15-25 دقيقة'}</strong></>
                ) : (
                  <>حالة الطلب: <strong className="text-[#FF5900] font-black">جاري التجهيز والتوصيل</strong></>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-[#6B7280] hover:bg-[#F3F4F6] active:bg-[#E5E7EB] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 no-scrollbar pb-5">
          
          {/* ══════════════════════════════════════════════════════════════
              1. LEAFLET INTERACTIVE ROUTE MAP
              ══════════════════════════════════════════════════════════════ */}
          <div className="relative w-full h-[210px] bg-[#E5E7EB] border-b border-[#E5E7EB]">
            <div
              ref={mapContainerRef}
              style={{ width: '100%', height: '100%', zIndex: 10 }}
            />

            {/* Floating Top Chip: Destination Address */}
            <div className="absolute top-2.5 right-2.5 left-2.5 z-20 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#E5E7EB] shadow-md flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin size={15} className="text-[#FF5900] shrink-0" />
                <span className="font-black text-[#111827] truncate">
                  {order.destination}
                </span>
              </div>
              <span className="text-[10px] text-[#059669] font-black shrink-0 bg-emerald-50 px-2 py-0.5 rounded-md">
                نقطة الاستلام
              </span>
            </div>

            {/* Floating Bottom Left: Recenter Map button */}
            <button
              type="button"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setView([destCoords.lat, destCoords.lng], 14);
                }
              }}
              className="absolute bottom-2.5 left-2.5 z-20 w-8 h-8 rounded-xl bg-white shadow-md border border-[#E5E7EB] flex items-center justify-center text-[#4B5563] hover:text-[#FF5900]"
              title="إعادة التوسيط"
            >
              <Compass size={17} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            
            {/* ══════════════════════════════════════════════════════════════
                2. SANGOUB STATUS BANNER WITH SQUIRREL CHARACTER
                ══════════════════════════════════════════════════════════════ */}
            <div className="bg-gradient-to-r from-[#FFF2EC] via-[#FFF8F5] to-[#FFF2EC] border border-[#FFD4C2] rounded-2xl p-3.5 flex items-center gap-3 relative overflow-hidden">
              <div className="w-16 h-16 rounded-2xl bg-white border border-[#FFD4C2] p-1 flex items-center justify-center shrink-0 shadow-xs">
                {currentStage === 'received' && (
                  <img
                    src="/assets/sangoub/mascot-cheerful.png"
                    alt="تم استلام الطلب"
                    className="w-full h-full object-contain"
                  />
                )}
                {currentStage === 'preparing' && (
                  <img
                    src="/assets/sangoub/mascot-poses.png"
                    alt="سنجوب يجهز الطلب"
                    className="w-full h-full object-contain"
                  />
                )}
                {currentStage === 'with_courier' && (
                  <img
                    src="/assets/sangoub/sangoub-trio-7.png"
                    alt="سنجوب على الموتوسيكل"
                    className="w-full h-full object-contain animate-pulse"
                  />
                )}
                {currentStage === 'delivered' && (
                  <img
                    src="/assets/sangoub/mascot-wink.png"
                    alt="تم التوصيل"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#FF5900] font-black uppercase tracking-wider">
                  حالة الطلب الحالية
                </p>
                <h4 className="font-black text-sm text-[#111827] leading-tight mt-0.5">
                  {currentStage === 'received' && 'تم استلام وتأكيد طلبك 📋'}
                  {currentStage === 'preparing' && 'سنجوب يقوم بتجهيز طلبك بعناية 🍳'}
                  {currentStage === 'with_courier' && 'سنجوب انطلق بالطلب على الموتوسيكل 🛵💨'}
                  {currentStage === 'delivered' && 'تم التوصيل بنجاح! بالهناء والشفاء 🎉'}
                </h4>
                <p className="text-[11px] text-[#6B7280] mt-0.5">
                  {currentStage === 'received' && 'تم إرسال الطلب للمتجر وتأكيده مع الكابتن'}
                  {currentStage === 'preparing' && 'التاجر يحضر وجباتك ومستلزماتك الطازجة'}
                  {currentStage === 'with_courier' && 'المندوب في طريقه لعنوانك بسرعة وأمان'}
                  {currentStage === 'delivered' && 'شكراً لثقتك في سنجوب، نتمنى لك تجربة ممتعة!'}
                </p>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                3. TALABAT-STYLE STEP PROGRESS TRACKER
                ══════════════════════════════════════════════════════════════ */}
            <div className="bg-[#F9FAFB] rounded-2xl p-3 border border-[#E5E7EB]">
              <div className="grid grid-cols-4 gap-1 text-center relative">
                
                {/* Step 1: Received */}
                <button
                  type="button"
                  onClick={() => handleStageSelect('received')}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      ['received', 'preparing', 'with_courier', 'delivered'].includes(currentStage)
                        ? 'bg-[#FF5900] text-white shadow-xs'
                        : 'bg-[#E5E7EB] text-[#6B7280]'
                    }`}
                  >
                    <CheckCircle2 size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-[#374151] mt-1 leading-tight">
                    تأكيد الطلب
                  </span>
                </button>

                {/* Step 2: Preparing */}
                <button
                  type="button"
                  onClick={() => handleStageSelect('preparing')}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      ['preparing', 'with_courier', 'delivered'].includes(currentStage)
                        ? 'bg-[#FF5900] text-white shadow-xs'
                        : 'bg-[#E5E7EB] text-[#6B7280]'
                    }`}
                  >
                    <ChefHat size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-[#374151] mt-1 leading-tight">
                    التجهيز
                  </span>
                </button>

                {/* Step 3: Out for Delivery */}
                <button
                  type="button"
                  onClick={() => handleStageSelect('with_courier')}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      ['with_courier', 'delivered'].includes(currentStage)
                        ? 'bg-[#FF5900] text-white shadow-xs animate-bounce'
                        : 'bg-[#E5E7EB] text-[#6B7280]'
                    }`}
                  >
                    <Bike size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-[#374151] mt-1 leading-tight">
                    في الطريق
                  </span>
                </button>

                {/* Step 4: Delivered */}
                <button
                  type="button"
                  onClick={() => handleStageSelect('delivered')}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      currentStage === 'delivered'
                        ? 'bg-[#059669] text-white shadow-xs'
                        : 'bg-[#E5E7EB] text-[#6B7280]'
                    }`}
                  >
                    <PackageCheck size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-[#374151] mt-1 leading-tight">
                    تم التسليم
                  </span>
                </button>
              </div>

              <div className="mt-2 text-center">
                <span className="text-[9px] text-[#9CA3AF]">
                  (اضغط على أي مرحلة لمحاكاة وتجربة تقدم حالة الطلب)
                </span>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                4. COURIER CONTACT CARD
                ══════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl p-3 border border-[#E5E7EB] shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-[#FFF2EC] border border-[#FFD4C2] p-1 flex items-center justify-center shrink-0">
                  <img
                    src="/assets/sangoub/sangoub-trio-7.png"
                    alt="كابتن سنجوب"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h5 className="font-black text-xs text-[#111827]">الكابتن أحمد سنجوب</h5>
                  <p className="text-[10px] text-[#6B7280]">سنجوب إكسبريس دليفري 🛵</p>
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold text-[#D97706]">
                    <span>★ 4.9</span>
                    <span className="text-[#9CA3AF]">(1,450 توصيلة ناجحة)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href="tel:01000000000"
                  className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors shadow-2xs"
                  title="اتصال هاتفي بالمندوب"
                >
                  <Phone size={16} />
                </a>
                <a
                  href="https://wa.me/201000000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 flex items-center justify-center transition-colors shadow-2xs"
                  title="محادثة واتساب سريعة"
                >
                  <MessageCircle size={16} />
                </a>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                5. ORDER DETAILS ACCORDION
                ══════════════════════════════════════════════════════════════ */}
            <div className="bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="w-full p-3 flex items-center justify-between text-xs font-black text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>تفاصيل وحساب الطلب ({order.itemsCount} أصناف)</span>
                  <span className="text-[#FF5900] font-black">{formatEGP(order.total)}</span>
                </div>
                {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showDetails && (
                <div className="p-3 pt-0 border-t border-[#E5E7EB] space-y-2 text-xs">
                  {/* Payment method */}
                  <div className="flex items-center justify-between py-1.5 border-b border-[#E5E7EB]">
                    <span className="text-[#6B7280]">طريقة الدفع:</span>
                    <span className="font-bold text-[#111827] flex items-center gap-1">
                      {order.paymentMethod === 'cash' && (
                        <>
                          <Banknote size={14} className="text-[#059669]" />
                          <span>كاش عند الاستلام</span>
                        </>
                      )}
                      {order.paymentMethod === 'instapay' && (
                        <>
                          <Zap size={14} className="text-[#FF5900]" />
                          <span>إنستاباي InstaPay</span>
                        </>
                      )}
                      {order.paymentMethod === 'card' && (
                        <>
                          <CreditCard size={14} className="text-[#2563EB]" />
                          <span>بطاقة بنكية إلكترونية</span>
                        </>
                      )}
                      {order.paymentMethod === 'wallet' && (
                        <>
                          <Sparkles size={14} className="text-[#FF5900]" />
                          <span>محفظة سنجوب</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Notes */}
                  {order.notes && (
                    <div className="py-1 border-b border-[#E5E7EB]">
                      <span className="text-[#6B7280] block text-[10px]">ملاحظاتك للمندوب:</span>
                      <span className="font-bold text-[#374151] text-[11px]">{order.notes}</span>
                    </div>
                  )}

                  {/* Items list */}
                  {order.items && order.items.length > 0 && (
                    <div className="py-1 space-y-1.5">
                      <span className="text-[#6B7280] block text-[10px]">الأصناف المطلوبة:</span>
                      {order.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span>
                            {it.name} <strong className="text-[#6B7280]">× {it.quantity}</strong>
                          </span>
                          <span className="font-bold text-[#111827]">{formatEGP(it.price * it.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total */}
                  <div className="pt-2 border-t border-[#E5E7EB] flex justify-between font-black text-xs">
                    <span>المبلغ الإجمالي المدفوع:</span>
                    <span className="text-[#FF5900]">{formatEGP(order.total)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Back to Shopping Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 bg-white hover:bg-[#F9FAFB] text-[#374151] border border-[#D1D5DB] text-xs font-black rounded-xl transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>متابعة التسوق وإغلاق الشاشة</span>
            </button>

          </div>
        </div>

      </div>
    </div>
  );
};
