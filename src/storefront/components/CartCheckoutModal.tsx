import { useState, useMemo, useEffect } from 'react';
import {
  X,
  Minus,
  Plus,
  Trash2,
  Clock,
  Banknote,
  MapPin,
  Home,
  Briefcase,
  Navigation,
  User,
  Phone,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Zap,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatEGP, applyCouponDiscount } from '../../utils/orderCalculations';
import { matchStoreId, getStoreLogo } from '../../utils/storeAssets';
import { getMerchantPaymentSettings } from '../../utils/merchantPaymentSettings';
import { supabase, resolveSupabaseStoreUuid } from '../../lib/supabase';
import type { TrackableOrder } from './OrderTrackingModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRequestRegister: () => void;
  onOpenAreaModal: () => void;
  onOrderPlaced?: (order: TrackableOrder) => void;
}

export function CartCheckoutModal({
  isOpen,
  onClose,
  onRequestRegister,
  onOpenAreaModal,
  onOrderPlaced,
}: Props) {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    deliveryFee,
    discount,
    total,
    appliedCoupon,
    applyCoupon,
    stores,
    user,
    serviceArea,
  } = useStore();

  // Delivery & Customer Form (Universal: Home, Work, Anywhere)
  const [placeType, setPlaceType] = useState<'home' | 'work' | 'other'>('home');
  const [fullName, setFullName] = useState(
    user?.fullName && user.fullName !== 'زائر بدون تسجيل' ? user.fullName : ''
  );
  const [phone, setPhone] = useState(user?.phone || '');
  const [hasWhatsApp, setHasWhatsApp] = useState(true);
  const [customWhatsApp, setCustomWhatsApp] = useState('');
  const [streetAddress, setStreetAddress] = useState(
    serviceArea?.name || user?.ministry || ''
  );
  const [buildingNumber, setBuildingNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState(user?.floorNumber || '');
  const [unitNumber, setUnitNumber] = useState(user?.roomNumber || '');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Sanitize Egyptian Phone Number: only digits, convert Arabic numbers ٠-٩ to 0-9, max 11 digits
  const sanitizePhone = (val: string) => {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let converted = val;
    arabicDigits.forEach((d, idx) => {
      converted = converted.replaceAll(d, String(idx));
    });
    return converted.replace(/\D/g, '').slice(0, 11);
  };

  // Mandatory User Authentication Requirement
  const isUserAuthenticated = Boolean(
    user && user.id && user.fullName && user.fullName !== 'زائر بدون تسجيل' && user.phone
  );

  // Sync state whenever authenticated user profile changes
  useEffect(() => {
    if (user && user.fullName && user.fullName !== 'زائر بدون تسجيل') {
      setFullName(user.fullName);
      if (user.phone) setPhone(user.phone);
      if (user.ministry && !streetAddress) setStreetAddress(user.ministry);
      if (user.floorNumber && !floorNumber) setFloorNumber(user.floorNumber);
      if (user.roomNumber && !unitNumber) setUnitNumber(user.roomNumber);
    }
  }, [user]);

  // Restore guest profile from localStorage if not logged in
  useEffect(() => {
    if (!user || user.fullName === 'زائر بدون تسجيل' || !user.phone) {
      try {
        const saved = localStorage.getItem('sangoub_guest_profile');
        if (saved) {
          const p = JSON.parse(saved);
          if (p.fullName && !fullName) setFullName(p.fullName);
          if (p.phone && !phone) setPhone(p.phone);
          if (p.streetAddress && !streetAddress) setStreetAddress(p.streetAddress);
          if (p.buildingNumber && !buildingNumber) setBuildingNumber(p.buildingNumber);
          if (p.floorNumber && !floorNumber) setFloorNumber(p.floorNumber);
          if (p.unitNumber && !unitNumber) setUnitNumber(p.unitNumber);
          if (p.placeType) setPlaceType(p.placeType);
          if (typeof p.hasWhatsApp === 'boolean') setHasWhatsApp(p.hasWhatsApp);
          if (p.customWhatsApp) setCustomWhatsApp(p.customWhatsApp);
        }
      } catch (e) {
        console.warn('Failed to parse sangoub_guest_profile', e);
      }
    }
  }, [user]);

  // Business Rule: Cash on Delivery is strictly allowed ONLY for orders up to 300 EGP
  const isCashAllowed = total <= 300;

  // Payment Method State (defaults to InstaPay if total > 300)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'card'>(
    total <= 300 ? 'cash' : 'instapay'
  );

  // Automatically switch away from cash if cart total exceeds 300 EGP
  useEffect(() => {
    if (!isCashAllowed && paymentMethod === 'cash') {
      setPaymentMethod('instapay');
    }
  }, [isCashAllowed, paymentMethod]);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Identify the store of the current cart
  const currentStoreId = cartItems[0]?.product?.storeId || 'a0000000-0000-0000-0000-000000000001';
  const currentStore = useMemo(() => {
    const found = stores.find(
      (s) => matchStoreId(s.id, currentStoreId) || s.id === currentStoreId || (s as any).slug === currentStoreId
    );
    const name = found?.name || (currentStoreId.includes('falafel') || currentStoreId.includes('27d12743')
      ? 'فول وفلافل العاصمة'
      : currentStoreId.includes('pharmacy') || currentStoreId.includes('b1111111')
      ? 'صيدلية العاصمة المركزية - 24/7'
      : currentStoreId.includes('cafe') || currentStoreId.includes('55508f0e')
      ? 'كافيه العاصمة'
      : 'سنجوب ماركت');

    return {
      id: currentStoreId,
      name,
      logo: found ? getStoreLogo(found) : '/brand/sangoub-market-logo.jpg',
      deliveryTime: found?.deliveryTime || '15-25 دقيقة',
    };
  }, [currentStoreId, stores]);

  // Merchant Payment Settings (loaded directly from dashboard config)
  const merchantPayment = useMemo(() => {
    return getMerchantPaymentSettings(currentStoreId);
  }, [currentStoreId]);

  if (!isOpen) return null;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    const res = applyCoupon(couponCode.trim());
    setCouponMessage({
      text: res.message,
      error: !res.success,
    });
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isUserAuthenticated) {
      setError('يرجى تسجيل الدخول أو إنشاء حساب جديد أولاً لإتمام وتأكيد طلبك.');
      onRequestRegister();
      return;
    }

    if (!cartItems.length) {
      setError('السلة فارغة. يرجى اختيار الأصناف أولاً.');
      return;
    }

    const cleanName = fullName.trim();
    const cleanPhone = sanitizePhone(phone);
    const cleanAddress = streetAddress.trim();

    if (!cleanName || cleanName.length < 2) {
      setError('يرجى إدخال اسم المستلم.');
      return;
    }

    if (!cleanPhone || cleanPhone.length !== 11 || !cleanPhone.startsWith('01')) {
      setError('يرجى إدخال رقم هاتف محمول مصري صحيح مكوّن من 11 رقماً يبدأ بـ 01.');
      return;
    }

    if (!cleanAddress) {
      setError('يرجى إدخال عنوان التوصيل (المنطقة / الشارع).');
      return;
    }

    if (paymentMethod === 'cash' && total > 300) {
      setError('خيار الدفع نقدًا عند الاستلام متاح فقط للطلبات حتى 300 ج.م كحد أقصى. يرجى اختيار السداد عبر إنستاباي أو المحفظة الإلكترونية.');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderId = 'SNG-' + Math.floor(100000 + Math.random() * 900000);
      const currentTime = new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const fullNotes = [
        deliveryNotes.trim(),
        hasWhatsApp ? '🟢 واتساب متاح على الرقم' : '',
      ].filter(Boolean).join(' • ');

      const destinationParts = [
        cleanAddress,
        buildingNumber.trim() ? `عمارة/مبنى ${buildingNumber.trim()}` : '',
        floorNumber.trim() ? `الدور ${floorNumber.trim()}` : '',
        unitNumber.trim()
          ? placeType === 'work'
            ? `مكتب ${unitNumber.trim()}`
            : `شقة ${unitNumber.trim()}`
          : '',
      ].filter(Boolean);

      const destination = destinationParts.join(' • ') || cleanAddress;

      const trackable: TrackableOrder = {
        orderId,
        orderStatus: 'received',
        itemsCount: cartItems.reduce((acc, i) => acc + i.quantity, 0),
        subtotal,
        deliveryFee,
        discount,
        total,
        destination,
        time: currentTime,
        paymentMethod,
        notes: fullNotes || undefined,
        createdAt: new Date().toISOString(),
        items: cartItems.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price + (item.extraPrice || 0),
          imageUrl: item.product.imageUrl,
          storeId: currentStore.id,
          storeName: currentStore.name,
        })),
      };

      // Direct InstaPay Redirection: opens registered link directly
      if (paymentMethod === 'instapay' && merchantPayment.instapayLink) {
        try {
          window.open(merchantPayment.instapayLink, '_blank', 'noopener,noreferrer');
        } catch (err) {
          console.warn('Direct InstaPay window.open failed:', err);
        }
      }

      // Persist profile to localStorage for instant auto-fill next time
      try {
        localStorage.setItem(
          'sangoub_guest_profile',
          JSON.stringify({
            fullName: cleanName,
            phone: cleanPhone,
            streetAddress: cleanAddress,
            buildingNumber: buildingNumber.trim(),
            floorNumber: floorNumber.trim(),
            unitNumber: unitNumber.trim(),
            placeType,
            hasWhatsApp,
            customWhatsApp,
          })
        );
      } catch (err) {
        console.warn('Saving guest profile failed', err);
      }

      // Persist in localStorage for instant tracking & history
      try {
        localStorage.setItem('sangoub_last_order', JSON.stringify(trackable));
        const existingHistory = JSON.parse(
          localStorage.getItem('sangoub_customer_orders_history') || '[]'
        );
        const nextHistory = [
          {
            id: trackable.orderId,
            orderNumber: trackable.orderId,
            createdAt: trackable.createdAt,
            status: 'received',
            statusText: 'قيد التجهيز ⏳',
            statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
            total: trackable.total,
            paymentMethod:
              paymentMethod === 'cash'
                ? 'الدفع نقدًا عند الاستلام'
                : paymentMethod === 'instapay'
                ? 'إنستاباي / فودافون كاش'
                : 'بطاقة بنكية (جيديا)',
            destination: trackable.destination,
            items: trackable.items,
            rawOrder: trackable,
          },
          ...existingHistory,
        ];
        localStorage.setItem('sangoub_customer_orders_history', JSON.stringify(nextHistory));
      } catch (err) {
        console.warn('LocalStorage save failed:', err);
      }

      // Persist directly to Supabase PostgreSQL (Sole Database Source of Truth)
      try {
        const targetStoreUuid = resolveSupabaseStoreUuid(currentStore.id);
        const { data: sbOrder } = await supabase.from('orders').insert({
          customer_id: user?.id && !user.isGuest ? user.id : null,
          store_id: targetStoreUuid,
          status: 'pending',
          subtotal: subtotal,
          delivery_fee: deliveryFee,
          total_amount: total,
          delivery_address: destination,
          delivery_ministry: cleanAddress,
          delivery_floor: floorNumber.trim() || null,
          delivery_room: unitNumber.trim() || null,
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'cash' ? 'pending' : 'paid',
          notes: fullNotes || null,
        }).select().single();

        if (sbOrder?.id) {
          await supabase.from('order_items').insert(
            cartItems.map((item) => ({
              order_id: sbOrder.id,
              product_id: item.product.id && item.product.id.length === 36 ? item.product.id : null,
              product_name: item.product.name,
              price: item.product.price + (item.extraPrice || 0),
              quantity: item.quantity,
            }))
          );
        }
      } catch (sbErr) {
        console.warn('Supabase order insert warning:', sbErr);
      }

      // Clear cart
      clearCart();

      if (onOrderPlaced) {
        onOrderPlaced(trackable);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الطلب. يرجى المحاولة ثانية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[125] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-review-title"
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Header */}
        <header className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-orange-50/50 via-white to-amber-50/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black shadow-md shadow-orange-500/20">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h2 id="cart-review-title" className="text-lg sm:text-xl font-black text-slate-900">
                سلة المشتريات
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {cartItems.length} {cartItems.length === 1 ? 'صنف' : 'أصناف'} • {currentStore.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="إغلاق السلة"
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-36 sm:pb-24 overscroll-contain">
          {!cartItems.length ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-orange-100 text-orange-600 flex items-center justify-center text-4xl shadow-inner">
                🛒
              </div>
              <h3 className="text-lg font-black text-slate-800">السلة فارغة حالياً</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                تصفح أصناف ومتاجر منصة سنجوب وأضف المنتجات لتصلك في أسرع وقت.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors"
              >
                تصفح المنتجات الآن
              </button>
            </div>
          ) : (
            <>
              {/* 🏷️ STORE HEADER & ITEMS CARD */}
              <div className="border-2 border-orange-200/90 rounded-2xl overflow-hidden bg-white shadow-xs">
                {/* Store Card Header */}
                <div className="px-4 py-3.5 bg-gradient-to-r from-orange-50/60 to-amber-50/40 border-b border-orange-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={currentStore.logo}
                      alt={currentStore.name}
                      className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200 shrink-0 p-0.5 shadow-xs"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          '/brand/sangoub-mark-white-128.png';
                      }}
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 truncate">
                        {currentStore.name}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {cartItems.length} {cartItems.length === 1 ? 'صنف' : 'أصناف'}
                      </span>
                    </div>
                  </div>

                  {/* Delivery ETA Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-orange-200 text-orange-900 text-xs font-bold shrink-0 shadow-xs">
                    <Clock size={13} className="text-orange-600" />
                    <span>توصيل: {currentStore.deliveryTime}</span>
                  </div>
                </div>

                {/* Items List */}
                <ul className="divide-y divide-slate-100">
                  {cartItems.map((item) => (
                    <li
                      key={item.id}
                      className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.product.imageUrl && (
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="min-w-0 space-y-0.5">
                          <h5 className="text-sm font-bold text-slate-900 truncate">
                            {item.product.name}
                          </h5>
                          {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                            <p className="text-[11px] text-slate-500 truncate">
                              {Object.entries(item.selectedOptions)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' • ')}
                            </p>
                          )}
                          <p className="text-xs font-black text-orange-700">
                            {formatEGP(
                              (item.product.price + (item.extraPrice || 0)) * item.quantity
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          aria-label={`تقليل كمية ${item.product.name}`}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center font-black text-sm text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`زيادة كمية ${item.product.name}`}
                          disabled={item.quantity >= 50}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors disabled:opacity-40"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label={`حذف ${item.product.name}`}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors mr-1"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 👤 AUTHENTICATION STATUS & MANDATORY REGISTRATION BANNER */}
              {!isUserAuthenticated ? (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
                        <User size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900">
                          تسجيل الدخول مطلوب لإتمام وتأكيد الطلب
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          سجّل دخولك أو أنشئ حسابك الآن لحفظ طلبك في بروفايلك ومتابعته بالخريطة.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onRequestRegister}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded-xl text-xs font-black shrink-0 shadow-sm transition-all cursor-pointer"
                    >
                      دخول / إنشاء حساب ➔
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      ✓
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900">{user?.fullName}</h4>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full">
                          حساب معتمد
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5" dir="ltr">
                        {user?.phone}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onRequestRegister}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                  >
                    تعديل بيانات الحساب
                  </button>
                </div>
              )}

              {/* 📍 DELIVERY DETAILS SECTION */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                    <MapPin size={17} className="text-orange-600" />
                    <span>عنوان وتفاصيل التوصيل</span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAreaModal}
                    className="flex items-center gap-1.5 text-xs font-bold text-orange-700 hover:text-orange-800 bg-orange-100/70 hover:bg-orange-100 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Navigation size={13} />
                    <span>تحديد على الخريطة</span>
                  </button>
                </div>

                {/* Location Type Selector (Segmented Pill - 100% Single Line on Mobile) */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setPlaceType('home')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                      placeType === 'home'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    <Home size={14} className="shrink-0" />
                    <span>منزل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlaceType('work')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                      placeType === 'work'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    <Briefcase size={14} className="shrink-0" />
                    <span>مكتب / عمل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlaceType('other')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                      placeType === 'other'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    <MapPin size={14} className="shrink-0" />
                    <span>مكان آخر</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      اسم المستلم <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User size={14} className="absolute right-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="الاسم بالكامل"
                        required
                        className="w-full pr-8 pl-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      رقم الهاتف للتواصل <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={14} className="absolute right-3 top-3 text-slate-400" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        dir="ltr"
                        maxLength={11}
                        value={phone}
                        onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                        placeholder="01xxxxxxxxx"
                        required
                        className="w-full pr-8 pl-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-mono font-bold text-right"
                      />
                    </div>
                    {phone.length > 0 && phone.length < 11 && (
                      <span className="text-[10px] text-amber-700 font-bold block mt-1">
                        يجب أن يتكون الرقم من 11 رقماً ويبدأ بـ 01
                      </span>
                    )}
                    {phone.length === 11 && /^01[0125][0-9]{8}$/.test(phone) && (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        رقم هاتف مصري معتمد ✓
                      </span>
                    )}
                  </div>

                  {/* 🟢 WhatsApp Confirmation with Official Logo (Without word "المعتمد") */}
                  <div className="sm:col-span-2 bg-[#F0FDF4] border border-[#DCFCE7] rounded-2xl p-3 flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasWhatsApp}
                        onChange={(e) => setHasWhatsApp(e.target.checked)}
                        className="w-4 h-4 rounded text-[#16A34A] focus:ring-[#16A34A] accent-[#16A34A] cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#15803D]">
                        هل عليه واتساب؟
                      </span>
                    </label>
                    <div className="flex items-center gap-1.5" title="WhatsApp">
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10.5" fill="#25D366" />
                        <path
                          d="M17.5 14.4c-.2-.1-1.3-.6-1.5-.7-.2-.1-.4-.1-.5.1-.2.2-.6.7-.7.9-.1.1-.3.2-.5.1-.2-.1-.9-.3-1.8-1.1-.7-.6-1.1-1.3-1.3-1.6-.1-.2 0-.4.1-.5.1-.1.2-.2.3-.4.1-.1.1-.2.2-.3 0-.1 0-.3-.1-.4s-.5-1.3-.7-1.7c-.2-.5-.4-.4-.5-.4h-.4c-.2 0-.5.1-.7.3-.2.2-.8.8-.8 2 0 1.2.9 2.3 1 2.5.1.2 1.7 2.6 4.1 3.7.6.3 1 .4 1.4.5.6.2 1.1.2 1.6.1.5-.1 1.3-.6 1.5-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.5-.3z"
                          fill="#ffffff"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-bold mb-1">
                      العنوان / المنطقة / الشارع <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="اسم الحي أو المنطقة أو الشارع الرئيسي..."
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-medium"
                    />
                  </div>

                  {/* Compact 3-column row for Building, Floor, and Apartment on Mobile */}
                  <div className="sm:col-span-2 grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-700 font-bold mb-1 truncate">
                        المبنى/العمارة
                      </label>
                      <input
                        type="text"
                        value={buildingNumber}
                        onChange={(e) => setBuildingNumber(e.target.value)}
                        placeholder="عمارة 15"
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-700 font-bold mb-1 truncate">
                        الدور/الطابق
                      </label>
                      <input
                        type="text"
                        value={floorNumber}
                        onChange={(e) => setFloorNumber(e.target.value)}
                        placeholder="الدور 2"
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-700 font-bold mb-1 truncate">
                        {placeType === 'work' ? 'رقم المكتب' : 'الشقة/الوحدة'}
                      </label>
                      <input
                        type="text"
                        value={unitNumber}
                        onChange={(e) => setUnitNumber(e.target.value)}
                        placeholder={placeType === 'work' ? 'مكتب 204' : 'شقة 12'}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-bold mb-1">علامة مميزة أو تعليمات التوصيل</label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="مثال: بجوار صيدلية... أو الاتصال قبل الوصول"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 💳 PAYMENT METHODS SELECTION SECTION (With Official Logos & Direct InstaPay Redirect) */}
              <div className="border-2 border-orange-200/80 rounded-2xl p-4 bg-orange-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-orange-600" />
                    <h4 className="text-sm font-black text-slate-900">اختر طريقة الدفع</h4>
                  </div>
                  <span className="text-[11px] font-bold text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full">
                    متاح 3 طرق للدفع
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Option 1: Cash on Delivery (Restricted to <= 300 EGP) */}
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all ${
                      !isCashAllowed
                        ? 'opacity-60 bg-slate-100/90 border-slate-200 cursor-not-allowed select-none'
                        : paymentMethod === 'cash'
                        ? 'border-orange-500 bg-white shadow-sm ring-2 ring-orange-500/20 cursor-pointer'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      disabled={!isCashAllowed}
                      checked={paymentMethod === 'cash' && isCashAllowed}
                      onChange={() => isCashAllowed && setPaymentMethod('cash')}
                      className="mt-1 accent-orange-600 disabled:opacity-40"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Banknote size={20} className={isCashAllowed ? "text-emerald-600" : "text-slate-400"} />
                          <span className={`font-black text-sm ${isCashAllowed ? "text-slate-900" : "text-slate-400 line-through"}`}>
                            الدفع عند الاستلام (كاش)
                          </span>
                        </div>
                        {isCashAllowed ? (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                            متاح (للطلبات حتى 300 ج.م)
                          </span>
                        ) : (
                          <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200">
                            مغلق (أكثر من 300 ج.م)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {isCashAllowed
                          ? 'ادفع نقدًا لمندوب التوصيل فور وصول واستلام طلبك في موقعك.'
                          : '⚠️ الدفع عند الاستلام غير متاح لأن إجمالي الطلب يتجاوز 300 ج.م. يرجى السداد إلكترونيًا عبر إنستاباي أو البطاقة.'}
                      </p>
                    </div>
                  </label>

                  {/* Option 2: InstaPay & Vodafone Cash (With Official Uploaded Logos & Direct Redirection) */}
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      paymentMethod === 'instapay'
                        ? 'border-orange-500 bg-white shadow-sm ring-2 ring-orange-500/20'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="instapay"
                      checked={paymentMethod === 'instapay'}
                      onChange={() => setPaymentMethod('instapay')}
                      className="mt-1.5 accent-orange-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5">
                          <img
                            src="/payments/instapay.png"
                            alt="InstaPay"
                            className="h-6 object-contain"
                          />
                          <img
                            src="/payments/vodafone-cash.png"
                            alt="Vodafone Cash"
                            className="h-6 object-contain"
                          />
                        </div>
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">
                          تحويل مباشر
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        دفع فوري عبر إنستاباي أو المحافظ الإلكترونية. سيتم فتح رابط الدفع المعتمد للمتجر فور تأكيد الطلب.
                      </p>
                    </div>
                  </label>

                  {/* Option 3: Card / Visa & Mastercard & Geidea (Locked / Coming Soon) */}
                  <label
                    className="flex items-start gap-3 p-3.5 rounded-2xl border-2 border-slate-200 bg-slate-100/80 opacity-60 cursor-not-allowed select-none transition-all"
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      disabled={true}
                      checked={false}
                      className="mt-1.5 accent-orange-600 disabled:opacity-40 cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5">
                          <img
                            src="/payments/visa-mastercard.png"
                            alt="Visa and MasterCard"
                            className="h-6 sm:h-7 object-contain grayscale"
                          />
                        </div>
                        <span className="text-[10px] font-black bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span>بوابة جيديا · قريباً</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        بوابة الدفع بالبطاقات البنكية (جيديا) قيد التفعيل حالياً. يرجى السداد عبر إنستاباي أو نقدًا عند الاستلام.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* COUPON INPUT */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="أدخل كود الخصم (إن وجد)"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs uppercase font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
                >
                  تطبيق الكود
                </button>
              </div>
              {couponMessage && (
                <p
                  className={`text-xs font-bold ${
                    couponMessage.error ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {couponMessage.text}
                </p>
              )}

              {/* FINANCIAL SUMMARY */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>قيمة المنتجات</span>
                  <span className="font-bold text-slate-800">{formatEGP(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>رسوم التوصيل</span>
                  <span className="font-bold text-slate-800">{formatEGP(deliveryFee)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>خصم الكوبون ({appliedCoupon?.code})</span>
                    <span>-{formatEGP(discount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline text-sm font-black text-slate-900">
                  <span>الإجمالي المستحق</span>
                  <span className="text-base text-orange-600">{formatEGP(total)}</span>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold"
                >
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {cartItems.length > 0 && (
          <footer className="p-4 sm:p-5 border-t border-slate-200 bg-white shrink-0">
            <button
              onClick={!isUserAuthenticated ? onRequestRegister : handleSubmitOrder}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:opacity-50 text-white rounded-2xl p-4 font-black text-base flex justify-center items-center gap-2 shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <span>جارٍ تأكيد وإرسال الطلب...</span>
              ) : !isUserAuthenticated ? (
                <>
                  <span>تسجيل الدخول / إنشاء حساب للمتابعة • {formatEGP(total)}</span>
                  <User size={18} />
                </>
              ) : (
                <>
                  <span>
                    تأكيد وإرسال طلب {currentStore.name} • {formatEGP(total)}
                  </span>
                  <ArrowRight size={18} className="rotate-180" />
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span>تسوق آمن وسريع ومضمون 100% مع منصة سنجوب</span>
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}
