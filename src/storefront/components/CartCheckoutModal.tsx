import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { formatEGP, cleanDisplayAddress } from '../../utils/orderCalculations';
import { BRAND } from '../../brand';
import type { TrackableOrder } from './OrderTrackingModal';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Clock,
  Bike,
  Sparkles,
  Tag,
  Check,
  X,
  CreditCard,
  Banknote,
  Zap,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface CartCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestRegister: () => void;
  onOpenAreaModal: () => void;
  onOrderPlaced?: (order: TrackableOrder) => void;
}

export const CartCheckoutModal: React.FC<CartCheckoutModalProps> = ({
  isOpen,
  onClose,
  onRequestRegister,
  onOpenAreaModal,
  onOrderPlaced,
}) => {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    deliveryFee,
    discount,
    total,
    serviceArea,
    user,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
  } = useStore();

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'card' | 'wallet'>('cash');
  const [instapayRef, setInstapayRef] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Business Rules for Payments:
  // 1. Cash on Delivery is ONLY allowed for orders under 300 EGP.
  const isCashAllowed = total < 300;

  // 2. Sangoub Wallet can only be used if balance >= total.
  const walletBalance = user?.walletBalance || 0;
  const isWalletAllowed = Boolean(user && walletBalance >= total && total > 0);

  // Auto-switch away from Cash if total >= 300 EGP
  useEffect(() => {
    if (!isCashAllowed && paymentMethod === 'cash') {
      setPaymentMethod('instapay');
    }
  }, [total, isCashAllowed, paymentMethod]);

  if (!isOpen) return null;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    if (!couponCode.trim()) return;

    const res = applyCoupon(couponCode);
    if (!res.success) {
      setCouponError(res.message);
    } else {
      setCouponCode('');
    }
  };

  const handlePlaceOrder = () => {
    setPaymentError(null);

    // 1. If customer has no registered account, prompt them to register on Sangoub first!
    if (!user || user.isGuest) {
      onRequestRegister();
      return;
    }

    // 2. Validate Payment Constraints
    if (paymentMethod === 'cash' && !isCashAllowed) {
      setPaymentError(`الدفع عند الاستلام متاح للطلبات أقل من 300 ج.م فقط (قيمة طلبك: ${formatEGP(total)}). يرجى اختيار وسيلة دفع أخرى.`);
      return;
    }

    if (paymentMethod === 'wallet' && !isWalletAllowed) {
      setPaymentError(`رصيد محفظة سنجوب غير كافٍ (${walletBalance} ج.م) لإتمام هذا الطلب (${formatEGP(total)}).`);
      return;
    }

    // 3. Build order object
    const orderNumber = `SNG-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder: TrackableOrder = {
      orderId: orderNumber,
      itemsCount: cartItems.reduce((acc, it) => acc + it.quantity, 0),
      total: total,
      destination: cleanDisplayAddress(serviceArea.name),
      destinationCoords: {
        lat: serviceArea.latitude || 30.1258,
        lng: serviceArea.longitude || 31.6033,
      },
      time: '15-25 دقيقة',
      paymentMethod: paymentMethod,
      instapayRef: instapayRef.trim(),
      notes: orderNotes.trim(),
      items: cartItems.map((it) => ({
        name: it.product.name,
        quantity: it.quantity,
        price: it.product.price + (it.extraPrice || 0),
        imageUrl: it.product.imageUrl,
      })),
      createdAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    clearCart();
    onClose();

    if (onOrderPlaced) {
      onOrderPlaced(newOrder);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[125] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs select-none transition-all"
      dir="rtl"
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl shadow-2xl border-t sm:border border-[#E5E7EB] flex flex-col max-h-[92dvh] sm:max-h-[88vh] font-['Cairo',sans-serif] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        
        {/* Mobile Pull-Down Indicator */}
        <div className="w-12 h-1 bg-[#D1D5DB] rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-4 py-2.5 border-b border-[#F0F1F3] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center shrink-0">
              <ShoppingBag size={15} />
            </div>
            <div>
              <h3 className="font-black text-xs sm:text-sm text-[#111827] leading-tight">
                سلة سنجوب وإتمام التوصيل
              </h3>
              <p className="text-[10px] text-[#6B7280]">
                سنجوب يوصلك بأسرع وقت في أي مكان 🐿️
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full text-[#6B7280] hover:bg-[#F3F4F6] active:bg-[#E5E7EB] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="إغلاق"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-3.5 py-2.5 overflow-y-auto overscroll-contain flex-1 space-y-2.5 pb-5 no-scrollbar">
          
          {cartItems.length === 0 ? (
            /* EMPTY CART VIEW */
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-[#F3F4F6] text-[#9CA3AF] mx-auto flex items-center justify-center mb-2">
                <ShoppingBag size={22} />
              </div>
              <h4 className="text-xs font-black text-[#111827]">سلة التسوق فارغة حالياً</h4>
              <p className="text-[11px] text-[#6B7280] mt-0.5 mb-3">
                تصفح المطاعم ومقاضي سنجوب وأضف وجباتك ومستلزماتك المفضلة
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#FF5900] text-white text-xs font-black rounded-xl hover:bg-[#E04E00] transition-colors cursor-pointer"
              >
                تصفح الأقسام الآن
              </button>
            </div>
          ) : (
            <>
              {/* 1. Calm & Comfortable Delivery Address Card */}
              <div className="bg-[#FFF9F6] border border-[#FFD9C8] rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-lg bg-[#FF5900] text-white flex items-center justify-center shrink-0">
                    <MapPin size={11} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9.5px] text-[#9A3412] font-black leading-tight">
                      عنوان استلام الطلب المحدد:
                    </p>
                    <p className="text-[11px] font-bold text-[#1F2937] truncate leading-snug">
                      {cleanDisplayAddress(serviceArea.name)}
                    </p>
                    <p className="text-[8.5px] text-[#6B7280] leading-tight">
                      وقت التوصيل التقديري: {serviceArea.deliveryTime || '20-30 دقيقة'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAreaModal();
                  }}
                  className="text-[9.5px] font-bold text-[#FF5900] bg-white px-2 py-0.5 rounded-lg border border-[#FFD9C8] hover:bg-[#FFF2EC] shrink-0 cursor-pointer shadow-2xs"
                >
                  تغيير العنوان
                </button>
              </div>

              {/* 2. Compact Items List */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10.5px] font-black text-[#374151]">
                    أصناف الطلب ({cartItems.reduce((acc, it) => acc + it.quantity, 0)}):
                  </span>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[9.5px] text-red-500 font-bold hover:underline"
                  >
                    تفريغ السلة
                  </button>
                </div>

                <div className="divide-y divide-[#F3F4F6] bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] overflow-hidden max-h-[135px] sm:max-h-[160px] overflow-y-auto no-scrollbar">
                  {cartItems.map((item) => (
                    <div key={item.id} className="p-1.5 px-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={item.product.imageUrl || BRAND.mascot.icon}
                          alt={item.product.name}
                          className="w-7 h-7 rounded-lg object-cover shrink-0 bg-white border border-[#E5E7EB]"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = BRAND.mascot.icon;
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-[10.5px] font-black text-[#111827] truncate leading-tight">
                            {item.product.name}
                          </p>
                          <p className="text-[9.5px] font-bold text-[#FF5900]">
                            {formatEGP(item.product.price + (item.extraPrice || 0))}
                          </p>
                        </div>
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center gap-1 shrink-0 bg-white px-1 py-0.5 rounded-lg border border-[#E5E7EB]">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-4 h-4 rounded-md bg-[#F3F4F6] hover:bg-red-50 hover:text-red-600 flex items-center justify-center font-black text-[10px] text-[#4B5563]"
                        >
                          {item.quantity === 1 ? <Trash2 size={9} /> : <Minus size={9} />}
                        </button>
                        <span className="text-[10px] font-black text-[#111827] min-w-[12px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-4 h-4 rounded-md bg-[#FF5900] text-white flex items-center justify-center font-black text-[10px]"
                        >
                          <Plus size={9} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Sleek Coupon Section */}
              <div className="bg-[#F9FAFB] p-1.5 rounded-xl border border-[#E5E7EB]">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between text-[10px] px-1">
                    <div className="flex items-center gap-1.5 text-[#059669] font-bold">
                      <Tag size={12} />
                      <span>كوبون مفعل ({appliedCoupon.code}) - خصم {appliedCoupon.value}%</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-red-500 font-bold hover:underline"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-1.5">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="أدخل كود الخصم (مثال: SANGOUB10)"
                      className="flex-1 px-2.5 py-1 text-[11px] bg-white border border-[#D1D5DB] rounded-lg focus:border-[#FF5900] outline-none text-[#111827] font-bold"
                    />
                    <button
                      type="submit"
                      disabled={!couponCode.trim()}
                      className="px-2.5 py-1 bg-[#FF5900] text-white text-[10px] font-black rounded-lg disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer"
                    >
                      تطبيق
                    </button>
                  </form>
                )}
                {couponError && (
                  <p className="text-[9px] text-red-500 font-bold mt-1 text-center">{couponError}</p>
                )}
              </div>

              {/* 4. Compact Notes Field */}
              <div>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="ملاحظات للمندوب (اختياري: الاتصال عند الوصول..)"
                  className="w-full px-2.5 py-1.5 text-[11px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none text-[#111827] font-bold placeholder:text-[10px] placeholder:font-normal"
                />
              </div>

              {/* 5. 4 Payment Methods: Cash (< 300 EGP), InstaPay, Card, Wallet */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10.5px] font-black text-[#374151]">طريقة الدفع:</p>
                  {!isCashAllowed && (
                    <span className="text-[8.5px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-bold">
                      الكاش متاح فقط للطلبات الأقل من 300 ج.م
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Option 1: Cash on Delivery (Restricted to < 300 EGP) */}
                  <button
                    type="button"
                    disabled={!isCashAllowed}
                    onClick={() => {
                      if (isCashAllowed) {
                        setPaymentMethod('cash');
                        setPaymentError(null);
                      }
                    }}
                    className={`p-2 rounded-xl border text-right transition-all ${
                      !isCashAllowed
                        ? 'opacity-40 bg-gray-100 border-gray-200 cursor-not-allowed'
                        : paymentMethod === 'cash'
                        ? 'border-[#FF5900] bg-[#FFF2EC] text-[#FF5900] ring-1 ring-[#FF5900] cursor-pointer'
                        : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-[10.5px]">
                      <Banknote size={13} className={paymentMethod === 'cash' ? 'text-[#FF5900]' : 'text-[#6B7280]'} />
                      <span>كاش عند الاستلام</span>
                    </div>
                    <span className="text-[8.5px] text-[#6B7280] block mt-0.5">
                      {isCashAllowed ? 'الدفع نقداً للمندوب' : 'متاح لأقل من 300 ج.م'}
                    </span>
                  </button>

                  {/* Option 2: InstaPay */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('instapay');
                      setPaymentError(null);
                    }}
                    className={`p-2 rounded-xl border text-right transition-all cursor-pointer ${
                      paymentMethod === 'instapay'
                        ? 'border-[#FF5900] bg-[#FFF2EC] text-[#FF5900] ring-1 ring-[#FF5900]'
                        : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-[10.5px]">
                      <Zap size={13} className={paymentMethod === 'instapay' ? 'text-[#FF5900]' : 'text-[#6B7280]'} />
                      <span>إنستاباي InstaPay</span>
                    </div>
                    <span className="text-[8.5px] text-[#6B7280] block mt-0.5">تحويل بنكي فوري</span>
                  </button>

                  {/* Option 3: Electronic Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('card');
                      setPaymentError(null);
                    }}
                    className={`p-2 rounded-xl border text-right transition-all cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-[#FF5900] bg-[#FFF2EC] text-[#FF5900] ring-1 ring-[#FF5900]'
                        : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-[10.5px]">
                      <CreditCard size={13} className={paymentMethod === 'card' ? 'text-[#FF5900]' : 'text-[#6B7280]'} />
                      <span>بطاقة إلكترونية</span>
                    </div>
                    <span className="text-[8.5px] text-[#6B7280] block mt-0.5">فيزا / ماستركارد / ميزة</span>
                  </button>

                  {/* Option 4: Sangoub Wallet (Requires balance >= total) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isWalletAllowed) {
                        setPaymentError(`رصيد محفظة سنجوب غير كافٍ (${walletBalance} ج.م) لإتمام هذا الطلب (${formatEGP(total)}).`);
                        return;
                      }
                      setPaymentMethod('wallet');
                      setPaymentError(null);
                    }}
                    className={`p-2 rounded-xl border text-right transition-all ${
                      !isWalletAllowed
                        ? 'opacity-60 bg-gray-50 border-gray-200 cursor-pointer'
                        : paymentMethod === 'wallet'
                        ? 'border-[#FF5900] bg-[#FFF2EC] text-[#FF5900] ring-1 ring-[#FF5900] cursor-pointer'
                        : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-[10.5px]">
                      <Sparkles size={13} className={paymentMethod === 'wallet' ? 'text-[#FF5900]' : 'text-[#6B7280]'} />
                      <span>محفظة سنجوب</span>
                    </div>
                    <span className={`text-[8.5px] block mt-0.5 font-bold ${isWalletAllowed ? 'text-[#059669]' : 'text-red-500'}`}>
                      {user ? `رصيدك: ${walletBalance} ج.م ${!isWalletAllowed ? '(غير كافٍ)' : ''}` : 'سجل للدفع'}
                    </span>
                  </button>
                </div>

                {/* Sub-details for selected payment */}
                {paymentMethod === 'instapay' && (
                  <div className="mt-2 p-2 bg-[#FFF8F5] border border-[#FFD4C2] rounded-xl text-xs space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-[#9A3412] font-black">حساب إنستاباي المعتمد:</span>
                      <span className="font-mono font-black text-[#FF5900] bg-white px-2 py-0.5 rounded border border-[#FFD4C2]">
                        sangoub@instapay
                      </span>
                    </div>
                    <input
                      type="text"
                      value={instapayRef}
                      onChange={(e) => setInstapayRef(e.target.value)}
                      placeholder="اسم حسابك أو رقم المعاملة على إنستاباي (اختياري لتسريع التأكيد)"
                      className="w-full px-2 py-1 text-[10.5px] bg-white border border-[#D1D5DB] rounded-lg outline-none font-bold"
                    />
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="mt-2 p-2 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 text-blue-700 text-[10.5px] font-black">
                      <ShieldCheck size={14} />
                      <span>دفع آمن 100% مشفر بالكامل (Visa / Mastercard / Meeza)</span>
                    </div>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="رقم البطاقة (أو سيتم فتح بوابة الدفع الفوري الآمنة)"
                      className="w-full px-2 py-1 text-[10.5px] bg-white border border-blue-200 rounded-lg outline-none font-bold"
                    />
                  </div>
                )}

                {paymentError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-600 rounded-xl text-[10.5px] font-bold flex items-center gap-1.5 animate-in fade-in">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}
              </div>

              {/* 6. Compact Price Breakdown */}
              <div className="bg-[#F9FAFB] px-2.5 py-1.5 rounded-xl border border-[#E5E7EB] space-y-0.5 text-[10.5px]">
                <div className="flex justify-between text-[#6B7280]">
                  <span>إجمالي الأصناف:</span>
                  <span className="font-bold text-[#111827]">{formatEGP(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#6B7280]">
                  <span>رسوم التوصيل السريع من سنجوب:</span>
                  <span className="font-bold text-[#111827]">{formatEGP(deliveryFee)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-[#059669] font-bold">
                    <span>خصم الكوبون:</span>
                    <span>-{formatEGP(discount)}</span>
                  </div>
                )}
                <div className="border-t border-[#E5E7EB] pt-1 flex justify-between font-black text-xs text-[#111827]">
                  <span>المبلغ الإجمالي:</span>
                  <span className="text-[#FF5900] text-sm">{formatEGP(total)}</span>
                </div>
              </div>

              {/* Guest notice if not logged in */}
              {(!user || user.isGuest) && (
                <div className="bg-[#FFF2EC] border border-[#FFD4C2] rounded-xl p-2 flex items-center gap-1.5 text-[10px] text-[#9A3412]">
                  <Sparkles size={14} className="text-[#FF5900] shrink-0" />
                  <span>
                    عند الضغط على تأكيد الطلب، سيُطلب منك تسجيل حساب سريع على سنجوب لفتح حسابك ومتابعة الطلب 🐿️
                  </span>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer / Sticky Action Button */}
        {cartItems.length > 0 && (
          <div className="p-2.5 border-t border-[#E5E7EB] bg-white shrink-0">
            <button
              type="button"
              onClick={handlePlaceOrder}
              className="w-full h-11 bg-[#FF5900] hover:bg-[#E04E00] active:scale-[0.98] text-white text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-between px-3.5"
            >
              <div className="flex items-center gap-1.5">
                <Bike size={17} />
                <span>تأكيد الطلب وبدء التتبع المباشر 🛵</span>
              </div>
              <span className="text-sm">{formatEGP(total)}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
