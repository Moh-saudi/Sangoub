import React, { useState } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  MapPin,
  Tag,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Building,
  User,
  Phone,
  ArrowRight,
  ShieldCheck,
  Clock,
  CalendarClock,
  Zap,
} from 'lucide-react';
import type { CartItem, Coupon, Order, PaymentMethod, Profile } from '../types/index.ts';
import {
  calculateCartSubtotal,
  applyCouponDiscount,
  calculateOrderTotal,
  formatEGP,
} from '../utils/orderCalculations.ts';
import { ProductSvg } from './ProductSvg.tsx';
import { MINISTRIES_LIST } from '../data/seedData.ts';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  user: Profile;
  availableCoupons: Coupon[];
  appliedCoupon: Coupon | null;
  onApplyCoupon: (code: string) => { success: boolean; message: string };
  onRemoveCoupon: () => void;
  onIncrementItem: (item: CartItem) => void;
  onDecrementItem: (item: CartItem) => void;
  onRemoveItem: (itemId: string) => void;
  onOrderCreated: (order: Order) => void;
  onRequireAuth?: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({
  isOpen,
  onClose,
  items,
  user,
  availableCoupons,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  onIncrementItem,
  onDecrementItem,
  onRemoveItem,
  onOrderCreated,
  onRequireAuth,
}) => {
  if (!isOpen) return null;

  // Checkout form state
  const [ministry, setMinistry] = useState<string>(
    user.ministry && user.ministry !== 'اختر الوزارة عند إتمام الطلب' ? user.ministry : 'وزارة النقل'
  );
  const [floorNumber, setFloorNumber] = useState<string>(user.floorNumber || 'الدور الخامس');
  const [roomNumber, setRoomNumber] = useState<string>(user.roomNumber || 'مكتب 504');
  const [fullName, setFullName] = useState<string>(
    user.fullName === 'زائر بدون تسجيل' ? '' : user.fullName || ''
  );
  const [phone, setPhone] = useState<string>(user.phone || '');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [tip, setTip] = useState<number>(10);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('instapay');

  // Order Scheduling ('جدولة الطلب') state
  const [deliveryTimingMode, setDeliveryTimingMode] = useState<'now' | 'scheduled'>('now');
  const [selectedSchedulePreset, setSelectedSchedulePreset] = useState<string>(
    '12:00 ظهراً (قبل استراحة الغداء بـ 30 دقيقة)'
  );
  const [customScheduleTime, setCustomScheduleTime] = useState<string>('12:00');

  const SCHEDULE_PRESETS = [
    {
      id: 'pre-lunch-30',
      label: '12:00 ظهراً (قبل استراحة الغداء بـ 30 دقيقة)',
      subtitle: 'الأكثر اختياراً · تصل الوجبة ساخنة لمكتبك قبل بدء الاستراحة',
    },
    {
      id: 'lunch-exact',
      label: '12:30 ظهراً (موعد استراحة الغداء الرسمية)',
      subtitle: 'التسليم في بداية وقت الاستراحة مباشرة',
    },
    {
      id: 'morning-break',
      label: '10:30 صباحاً (استراحة الفطور والقهوة الصباحية)',
      subtitle: 'مثالي لطلبات الفول والفلافل والقهوة الصباحية',
    },
    {
      id: 'afternoon-meeting',
      label: '02:00 عصراً (وجبة منتصف الدوام والاجتماعات)',
      subtitle: 'مناسب لاجتماعات الإدارات المركزية بعد الظهر',
    },
    {
      id: 'custom',
      label: 'تحديد وقت مخصص',
      subtitle: 'اختر الساعة والدقيقة التي تناسب جدول عملك بالوزارة',
    },
  ];

  const resolvedScheduledLabel =
    selectedSchedulePreset === 'تحديد وقت مخصص'
      ? `الساعة ${customScheduleTime} (توقيت مخصص قبل الاستراحة/الاجتماع)`
      : selectedSchedulePreset;

  // Sync state whenever authenticated user changes (e.g. after Google login)
  React.useEffect(() => {
    if (user && !user.isGuest) {
      if (user.fullName && user.fullName !== 'زائر بدون تسجيل') setFullName(user.fullName);
      if (user.phone) setPhone(user.phone);
      if (user.ministry && user.ministry !== 'اختر الوزارة عند إتمام الطلب') setMinistry(user.ministry);
      if (user.floorNumber) setFloorNumber(user.floorNumber);
      if (user.roomNumber) setRoomNumber(user.roomNumber);
    }
  }, [user]);

  // Coupon input
  const [couponInput, setCouponInput] = useState<string>('');
  const [couponFeedback, setCouponFeedback] = useState<{ success?: boolean; text?: string } | null>(null);

  // InstaPay simulation state
  const [instapayCopied, setInstapayCopied] = useState(false);
  const [instapayRef, setInstapayRef] = useState('INSTA-' + Math.floor(100000 + Math.random() * 900000));

  // Geidea card details
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const subtotal = calculateCartSubtotal(items);
  const deliveryFee = 10;
  const couponResult = applyCouponDiscount(subtotal, appliedCoupon);
  const discount = couponResult.discount;
  const grandTotal = calculateOrderTotal(subtotal, deliveryFee, discount, tip);

  const handleApplyCouponCode = (codeToApply: string) => {
    const res = onApplyCoupon(codeToApply.trim().toUpperCase());
    if (res.success) {
      setCouponFeedback({ success: true, text: res.message });
      setCouponInput('');
    } else {
      setCouponFeedback({ success: false, text: res.message });
    }
  };

  const handleCopyInstaPay = () => {
    navigator.clipboard?.writeText('gov.district@instapay');
    setInstapayCopied(true);
    setTimeout(() => setInstapayCopied(false), 2000);
  };

  const handleSubmitOrder = () => {
    setFormError(null);

    if (items.length === 0) {
      setFormError('سلة المشتريات فارغة');
      return;
    }

    if (user.isGuest) {
      setFormError('يرجى تسجيل الدخول أو المتابعة بحساب Google أولاً لتأكيد طلبك وتحديد مكان التوصيل بمكتبك');
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    if (!fullName.trim() || !phone.trim() || !ministry.trim() || !floorNumber.trim()) {
      setFormError('يرجى استكمال جميع بيانات الموظف ومقر الوزارة للتوصيل الدقيق');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const isOrderScheduled = deliveryTimingMode === 'scheduled';
      const newOrder: Order = {
        id: 'ord-' + Date.now(),
        orderNumber: 'CAP-' + Math.floor(1000 + Math.random() * 9000),
        profileId: user.id,
        profileName: fullName,
        phone,
        ministry,
        floorNumber,
        roomNumber,
        items: [...items],
        subtotal,
        deliveryFee,
        discount,
        couponCode: appliedCoupon?.code,
        tip,
        total: grandTotal,
        paymentMethod,
        paymentStatus: paymentMethod === 'cash' ? 'cash_on_delivery' : 'paid',
        orderStatus: 'received',
        createdAt: 'الآن',
        isScheduled: isOrderScheduled,
        scheduledDeliveryTime: isOrderScheduled ? resolvedScheduledLabel : undefined,
        estimatedDelivery: isOrderScheduled
          ? `مجدول للتوصيل: ${resolvedScheduledLabel}`
          : 'خلال 15-20 دقيقة للأدوار',
        notes: orderNotes,
      };

      setIsSubmitting(false);
      onOrderCreated(newOrder);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in">
      <div
        className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              🛒
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">سلة طلبات الحي الحكومي</h3>
              <p className="text-xs text-slate-500">
                {items.length} {items.length === 1 ? 'صنف' : 'أصناف'} مخصصة للموظف
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
            aria-label="إغلاق السلة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div id="cart-scroll-container" className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Delivery Location Section */}
          <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-950">
                  موقع التسليم بالحي الحكومي (توصيل للدور والمكتب)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-300/60">
                34 وزارة
              </span>
            </div>

            {user.isGuest && (
              <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-3 flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    !
                  </div>
                  <div>
                    <h5 className="font-bold text-amber-950 text-xs">
                      أنت تتصفح كزائر — تسجيل الدخول مطلوب لإتمام التوصيل
                    </h5>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      لتوصيل وجبتك لمكتبك بدقة ومتابعة المندوب، يرجى تسجيل الدخول أو المتابعة بحساب Google.
                    </p>
                  </div>
                </div>
                {onRequireAuth && (
                  <button
                    type="button"
                    onClick={onRequireAuth}
                    className="shrink-0 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>دخول Google</span>
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">الوزارة أو الهيئة</label>
                <select
                  value={ministry}
                  onChange={(e) => setMinistry(e.target.value)}
                  className="w-full p-2 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-900 font-medium"
                >
                  {MINISTRIES_LIST.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">الدور والغرفة / المكتب</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={floorNumber}
                    onChange={(e) => setFloorNumber(e.target.value)}
                    placeholder="الدور (مثال: الخامس)"
                    className="w-1/2 p-2 bg-white border border-emerald-200 rounded-xl text-slate-900 font-medium"
                  />
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="مكتب 504"
                    className="w-1/2 p-2 bg-white border border-emerald-200 rounded-xl text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">اسم الموظف المستلم</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="الاسم ثلاثي"
                  className="w-full p-2 bg-white border border-emerald-200 rounded-xl text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">رقم الهاتف للتواصل</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full p-2 bg-white border border-emerald-200 rounded-xl text-slate-900 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Order Scheduling Section ('جدولة الطلب') */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-orange-600" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    موعد التوصيل وجدولة الطلب
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    اطلب الآن أو جدول توصيل وجبتك قبل استراحة الغداء أو الاجتماعات
                  </p>
                </div>
              </div>
            </div>

            {/* Segmented Mode Toggle: Immediate vs Scheduled */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => setDeliveryTimingMode('now')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                  deliveryTimingMode === 'now'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>توصيل فوري (15-20 دقيقة)</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryTimingMode('scheduled')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                  deliveryTimingMode === 'scheduled'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>جدولة لوقت محدد</span>
              </button>
            </div>

            {/* Scheduled Time Options */}
            {deliveryTimingMode === 'scheduled' && (
              <div className="space-y-2.5 pt-1">
                <span className="text-[11px] font-bold text-slate-700 block">
                  اختر موعد وصول المندوب لمكتبك بالدور:
                </span>

                <div className="grid grid-cols-1 gap-2">
                  {SCHEDULE_PRESETS.map((preset) => {
                    const isSelected = selectedSchedulePreset === preset.label;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedSchedulePreset(preset.label)}
                        className={`p-2.5 rounded-xl border text-right flex items-center justify-between gap-2 transition-all ${
                          isSelected
                            ? 'bg-orange-50 border-orange-500 text-orange-950 ring-1 ring-orange-500/30'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold flex items-center gap-1.5">
                            <Clock
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected ? 'text-orange-600' : 'text-slate-400'
                              }`}
                            />
                            <span>{preset.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 pr-5">
                            {preset.subtitle}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-orange-600 shrink-0 stroke-[3]" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Time Input when 'تحديد وقت مخصص' is chosen */}
                {selectedSchedulePreset === 'تحديد وقت مخصص' && (
                  <div className="p-3 bg-white rounded-xl border border-orange-300 flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-900 block">
                        حدد ساعة التسليم المطلوبة:
                      </label>
                      <span className="text-[10px] text-slate-500">
                        يبدأ المطبخ في التجهيز قبل الموعد بـ 25 دقيقة لضمان وصول الوجبة ساخنة
                      </span>
                    </div>
                    <input
                      type="time"
                      value={customScheduleTime}
                      onChange={(e) => setCustomScheduleTime(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600"
                    />
                  </div>
                )}

                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    سيتم حجز طلبك في مطبخ المطعم وتجهيزه ليصل إلى{' '}
                    <strong>
                      {ministry} ({floorNumber})
                    </strong>{' '}
                    في تمام: <strong>{resolvedScheduledLabel}</strong>.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 mb-2.5 flex items-center justify-between">
              <span>الأصناف المطلوبة</span>
              <span className="text-slate-400 font-normal">
                المجموع الفرعي: {formatEGP(subtotal)}
              </span>
            </h4>

            {items.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-sm">سلتك فارغة حالياً</p>
                <p className="text-xs text-slate-400 mt-1">تصفح قائمة الطعام والسوبر ماركت لإضافة وجباتك</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => {
                  const itemUnitPrice = item.product.price + (item.extraPrice || 0);
                  const itemTotal = itemUnitPrice * item.quantity;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <ProductSvg type={item.product.imageType} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-slate-900 truncate">
                          {item.product.name}
                        </h5>
                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-1">
                          <span className="text-emerald-700 font-medium">{item.product.storeName}</span>
                          {Object.entries(item.selectedOptions).map(([key, val]) => (
                            <span key={key} className="text-slate-600">
                              · {val}
                            </span>
                          ))}
                        </div>
                        {item.notes && (
                          <p className="text-[10px] text-amber-700 italic truncate">
                            ملاحظة: {item.notes}
                          </p>
                        )}
                        <div className="text-xs font-bold text-slate-800 mt-0.5 tabular-nums">
                          {formatEGP(itemTotal)}
                        </div>
                      </div>

                      {/* Stepper & Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                          <button
                            onClick={() => onDecrementItem(item)}
                            className="w-6 h-6 rounded-lg bg-white text-slate-700 hover:text-rose-600 flex items-center justify-center font-bold text-xs shadow-2xs"
                            aria-label="تقليل"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-slate-900 w-6 text-center tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onIncrementItem(item)}
                            className="w-6 h-6 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center font-bold text-xs shadow-2xs"
                            aria-label="زيادة"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                          aria-label="حذف الصنف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vouchers and Coupons Section */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-slate-900">قسائم الخصم ومحفظة الموظف</h4>
              </div>
              {appliedCoupon && (
                <button
                  onClick={onRemoveCoupon}
                  className="text-xs text-rose-600 hover:underline font-semibold"
                >
                  إلغاء تفعيل القسيمة
                </button>
              )}
            </div>

            {/* Input bar */}
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="أدخل كود القسيمة (مثال: GOV100)"
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono uppercase"
              />
              <button
                type="button"
                onClick={() => handleApplyCouponCode(couponInput)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                تطبيق
              </button>
            </div>

            {couponFeedback && (
              <div
                className={`text-xs p-2 rounded-xl flex items-center gap-1.5 ${
                  couponFeedback.success
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-rose-100 text-rose-900'
                }`}
              >
                {couponFeedback.success ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                <span>{couponFeedback.text}</span>
              </div>
            )}

            {/* Quick Available Vouchers Pill-free List */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-slate-500 block">قسائم موظفي العاصمة المتاحة لك:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableCoupons.map((c) => {
                  const isCurrent = appliedCoupon?.code === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleApplyCouponCode(c.code)}
                      className={`text-right p-2.5 rounded-xl border text-xs transition-all ${
                        isCurrent
                          ? 'bg-amber-50 border-amber-400 text-amber-950 font-semibold ring-1 ring-amber-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="font-mono text-amber-700">{c.code}</span>
                        <span>{c.discountType === 'fixed' ? `${c.value} ج.م` : `${c.value}%`}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{c.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Delivery Tip Selector */}
          <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-900 block">إكرامية لمندوب الحي الحكومي</span>
              <span className="text-[11px] text-slate-500">تقدير مجهود التوصيل وصعود الأدوار</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 5, 10, 15, 20].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTip(t)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors tabular-nums ${
                    tip === t
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {t === 0 ? 'بدون' : `${t} ج`}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900">طريقة الدفع الرقمي</h4>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                بوابات دفع رسمية معتمدة
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {/* InstaPay */}
              <button
                type="button"
                onClick={() => setPaymentMethod('instapay')}
                className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                  paymentMethod === 'instapay'
                    ? 'bg-purple-50/90 border-purple-600 ring-2 ring-purple-600/20 text-purple-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="h-8 w-14 bg-white rounded-lg border border-purple-200/80 flex items-center justify-center p-1 shadow-2xs">
                  <img
                    src="/assets/aistudio/GKV136_InstaPay-logobase.net_c6183093.png"
                    alt="إنستا باي InstaPay"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <span className="text-xs font-bold">إنستا باي</span>
                <span className="text-[10px] text-purple-700 font-medium">تحويل فوري (IPA)</span>
              </button>

              {/* Geidea & Visa Bank Cards */}
              <button
                type="button"
                onClick={() => setPaymentMethod('geidea')}
                className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                  paymentMethod === 'geidea'
                    ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-600/20 text-blue-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="h-8 w-14 bg-white rounded-lg border border-blue-200/80 flex items-center justify-center p-1 shadow-2xs">
                  <img
                    src="/assets/aistudio/visa--logo_fb3e8f25.png"
                    alt="Visa فيزا"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <span className="text-xs font-bold">بطاقات بنكية</span>
                <span className="text-[10px] text-blue-700 font-medium">Visa وميزة وجيديا</span>
              </button>

              {/* Cash on delivery */}
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-600/20 text-emerald-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="h-8 w-14 bg-emerald-50 rounded-lg border border-emerald-200/80 flex items-center justify-center p-1 shadow-2xs">
                  <Banknote className="w-5 h-5 text-emerald-700" />
                </div>
                <span className="text-xs font-bold">نقدي (كاش)</span>
                <span className="text-[10px] text-emerald-700 font-medium">لمندوب الدور</span>
              </button>
            </div>

            {/* Payment Sub-details */}
            {paymentMethod === 'instapay' && (
              <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-200 text-xs text-purple-950 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span>عنوان الدفع اللحظي (IPA):</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-purple-300 text-purple-900">
                      gov.district@instapay
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyInstaPay}
                      className="p-1 text-purple-700 hover:text-purple-900"
                      title="نسخ"
                    >
                      {instapayCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-purple-800 leading-relaxed">
                  حول المبلغ الإجمالي ({formatEGP(grandTotal)}) مباشرة عبر تطبيق إنستا باي باسم حساب:
                  <strong className="mx-1">فود كورت الحي الحكومي بالعاصمة</strong>.
                  الرقم المرجعي المحجوز لطلبك: <span className="font-mono font-bold text-slate-900">{instapayRef}</span>
                </div>
              </div>
            )}

            {paymentMethod === 'geidea' && (
              <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200 text-xs text-blue-950 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    بوابة دفع جيديا الآمنة (Geidea Payments Gateway)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">3D Secure</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-600 block mb-0.5">رقم البطاقة</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full p-2 bg-white border border-blue-200 rounded-xl font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 block mb-0.5">الانتهاء / CVV</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-1/2 p-2 bg-white border border-blue-200 rounded-xl font-mono text-center text-xs"
                      />
                      <input
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-1/2 p-2 bg-white border border-blue-200 rounded-xl font-mono text-center text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'cash' && (
              <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-xs text-emerald-950">
                الدفع نقداً عند استلام الوجبات في مكتبك بالدور ({floorNumber}). يُرجى تحضير المبلغ مضبوطاً ({formatEGP(grandTotal)}) لتسهيل حركة المندوب.
              </div>
            )}
          </div>

          {/* Special Notes */}
          <div>
            <label className="text-xs font-bold text-slate-900 block mb-1">
              ملاحظات المندوب أو أمن المبنى
            </label>
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="مثال: المصعد الشمالي، الاتصال عند مدخل الوزارة..."
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          {/* Pricing Breakdown Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>قيمة الأصناف:</span>
              <span className="font-semibold text-slate-900 tabular-nums">{formatEGP(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>توصيل سريع لأدوار الوزارة:</span>
              <span className="font-semibold text-slate-900 tabular-nums">{formatEGP(deliveryFee)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>خصم القسيمة ({appliedCoupon?.code}):</span>
                <span className="tabular-nums">-{formatEGP(discount)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>إكرامية المندوب:</span>
                <span className="font-semibold text-slate-900 tabular-nums">+{formatEGP(tip)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
              <span>المجموع الإجمالي:</span>
              <span className="text-lg font-extrabold text-emerald-800 tabular-nums">
                {formatEGP(grandTotal)}
              </span>
            </div>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">الإجمالي للدفع</span>
            <span className="text-base font-extrabold text-orange-600 tabular-nums">
              {formatEGP(grandTotal)}
            </span>
          </div>

          <button
            onClick={handleSubmitOrder}
            disabled={isSubmitting || items.length === 0}
            className="flex-1 max-w-xs py-3 px-5 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-98 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : deliveryTimingMode === 'scheduled' ? (
              <>
                <CalendarClock className="w-4 h-4" />
                <span>تأكيد جدولة الطلب</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>تأكيد الطلب الآن</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
