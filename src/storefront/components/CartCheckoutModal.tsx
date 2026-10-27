import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { formatEGP, cleanDisplayAddress } from '../../utils/orderCalculations';
import { BRAND } from '../../brand';
import { LAUNCH_CONFIG } from '../../config/launchConfig';
import { storage } from '../../lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
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
  AlertCircle,
  UploadCloud,
  Image as ImageIcon,
  Loader2,
  Copy,
  CheckCircle2,
} from 'lucide-react';

interface CartCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestRegister: () => void;
  onOpenAreaModal: () => void;
  onOrderPlaced?: (order: TrackableOrder) => void;
}

type CheckoutPaymentMethod = 'cash' | 'instapay' | 'vodafone_cash' | 'card' | 'wallet';

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
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('cash');
  const [instapayRef, setInstapayRef] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [vodafoneSender, setVodafoneSender] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Receipt upload states
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPaymentError('يرجى اختيار ملف صورة صالح للإيصال.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPaymentError('حجم صورة الإيصال يجب ألا يتجاوز 8 ميجابايت.');
      return;
    }

    setPaymentError(null);
    setReceiptFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedAccount(label);
    setTimeout(() => setCopiedAccount(null), 2500);
  };

  const handlePlaceOrder = async () => {
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

    // 3. Upload receipt if present
    let finalReceiptUrl = '';
    if (receiptFile && user?.id) {
      setIsUploadingReceipt(true);
      try {
        const fileExt = receiptFile.name.split('.').pop() || 'jpg';
        const fileRef = storageRef(storage, `receipts/${user.id}/${Date.now()}_receipt.${fileExt}`);
        await uploadBytes(fileRef, receiptFile);
        finalReceiptUrl = await getDownloadURL(fileRef);
      } catch (err) {
        console.warn('Firebase Storage upload failed or not configured, saving reference fallback:', err);
        // Fallback: don't fail order creation, use base64 preview or placeholder note
        finalReceiptUrl = receiptPreview || '';
      } finally {
        setIsUploadingReceipt(false);
      }
    }

    // Compose notes with receipt link
    const notesParts = [orderNotes.trim()];
    if (paymentMethod === 'vodafone_cash' && vodafoneSender.trim()) {
      notesParts.push(`تحويل فودافون كاش من رقم: ${vodafoneSender.trim()}`);
    }
    if (paymentMethod === 'instapay' && instapayRef.trim()) {
      notesParts.push(`مرجع إنستاباي: ${instapayRef.trim()}`);
    }
    if (finalReceiptUrl) {
      notesParts.push(`[إيصال التحويل: ${finalReceiptUrl}]`);
    } else if (receiptFile) {
      notesParts.push('[تم إرفاق إيصال الدفع]');
    }
    const finalNotes = notesParts.filter(Boolean).join(' | ');

    // 4. Build order object
    const orderNumber = `SNG-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder: TrackableOrder = {
      orderId: orderNumber,
      itemsCount: cartItems.reduce((acc, it) => acc + it.quantity, 0),
      total: total,
      destination: cleanDisplayAddress(serviceArea.name || LAUNCH_CONFIG.serviceAreaLabel),
      destinationCoords: {
        lat: serviceArea.latitude || 30.1258,
        lng: serviceArea.longitude || 31.6033,
      },
      time: LAUNCH_CONFIG.showEta ? (serviceArea.deliveryTime || '15-25 دقيقة') : '',
      paymentMethod: paymentMethod,
      instapayRef: instapayRef.trim() || vodafoneSender.trim(),
      receiptUrl: finalReceiptUrl,
      notes: finalNotes,
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
                توصيل لحد بابك داخل {LAUNCH_CONFIG.serviceAreaLabel} 🐿️
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
                تصفح مقاضي سنجوب وأضف مستلزماتك المفضلة
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#FF5900] text-white text-xs font-black rounded-xl hover:bg-[#E04E00] transition-colors cursor-pointer"
              >
                تصفح البقالة الآن
              </button>
            </div>
          ) : (
            <>
              {/* 1. Delivery Address Card */}
              <div className="bg-[#FFF9F6] border border-[#FFD9C8] rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-lg bg-[#FF5900] text-white flex items-center justify-center shrink-0">
                    <MapPin size={11} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9.5px] text-[#9A3412] font-black leading-tight">
                      عنوان استلام الطلب:
                    </p>
                    <p className="text-[11px] font-bold text-[#1F2937] truncate leading-snug">
                      {cleanDisplayAddress(serviceArea.name || LAUNCH_CONFIG.serviceAreaLabel)}
                    </p>
                    {LAUNCH_CONFIG.showEta && (
                      <p className="text-[8.5px] text-[#6B7280] leading-tight">
                        وقت التوصيل التقديري: {serviceArea.deliveryTime || '20-30 دقيقة'}
                      </p>
                    )}
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
                    className="text-[9.5px] text-red-500 font-bold hover:underline cursor-pointer"
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
                          className="w-4 h-4 rounded-md bg-[#F3F4F6] hover:bg-red-50 hover:text-red-600 flex items-center justify-center font-black text-[10px] text-[#4B5563] cursor-pointer"
                        >
                          {item.quantity === 1 ? <Trash2 size={9} /> : <Minus size={9} />}
                        </button>
                        <span className="text-[10px] font-black text-[#111827] min-w-[12px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-4 h-4 rounded-md bg-[#FF5900] text-white flex items-center justify-center font-black text-[10px] cursor-pointer"
                        >
                          <Plus size={9} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Coupon Section (Controlled by config) */}
              {LAUNCH_CONFIG.showCouponField && (
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
                        className="text-red-500 font-bold hover:underline cursor-pointer"
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
                        placeholder="أدخل كود الخصم"
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
              )}

              {/* 4. Compact Notes Field */}
              <div>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="ملاحظات للمندوب (اختياري: رقم العمارة، علامة مميزة…)"
                  className="w-full px-2.5 py-1.5 text-[11px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none text-[#111827] font-bold placeholder:text-[10px] placeholder:font-normal"
                />
              </div>

              {/* 5. Payment Methods with Logos & Receipt Upload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10.5px] font-black text-[#374151]">طريقة الدفع:</p>
                  {!isCashAllowed && (
                    <span className="text-[8.5px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                      الكاش متاح فقط للطلبات الأقل من 300 ج.م
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Option 1: Cash on Delivery */}
                  <button
                    type="button"
                    disabled={!isCashAllowed}
                    onClick={() => {
                      if (isCashAllowed) {
                        setPaymentMethod('cash');
                        setPaymentError(null);
                      }
                    }}
                    className={`p-2 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      !isCashAllowed
                        ? 'opacity-40 bg-gray-100 border-gray-200 cursor-not-allowed'
                        : paymentMethod === 'cash'
                        ? 'border-[#FF5900] bg-[#FFF2EC] text-[#FF5900] ring-1 ring-[#FF5900] cursor-pointer shadow-2xs'
                        : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[10.5px]">كاش عند الاستلام</span>
                      <Banknote size={15} className={paymentMethod === 'cash' ? 'text-[#FF5900]' : 'text-[#6B7280]'} />
                    </div>
                    <span className="text-[8.5px] text-[#6B7280] block mt-1">
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
                    className={`p-2 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                      paymentMethod === 'instapay'
                        ? 'border-[#FF5900] bg-[#FFF2EC] text-[#FF5900] ring-1 ring-[#FF5900] shadow-2xs'
                        : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[10.5px]">إنستاباي InstaPay</span>
                      <img
                        src="/assets/payments/instapay.png"
                        alt="InstaPay"
                        className="h-4 w-auto object-contain"
                      />
                    </div>
                    <span className="text-[8.5px] text-[#6B7280] block mt-1">تحويل بنكي فوري</span>
                  </button>

                  {/* Option 3: Vodafone Cash */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('vodafone_cash');
                      setPaymentError(null);
                    }}
                    className={`p-2 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                      paymentMethod === 'vodafone_cash'
                        ? 'border-[#FF5900] bg-[#FFF2EC] text-[#FF5900] ring-1 ring-[#FF5900] shadow-2xs'
                        : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[10.5px]">فودافون كاش</span>
                      <img
                        src="/assets/payments/vodafone-cash.png"
                        alt="Vodafone Cash"
                        className="h-4 w-auto object-contain"
                      />
                    </div>
                    <span className="text-[8.5px] text-[#6B7280] block mt-1">محفظة إلكترونية</span>
                  </button>

                  {/* Option 4: Visa / MasterCard */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('card');
                      setPaymentError(null);
                    }}
                    className={`p-2 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-[#FF5900] bg-[#FFF2EC] text-[#FF5900] ring-1 ring-[#FF5900] shadow-2xs'
                        : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[10.5px]">بطاقة بنكية</span>
                      <img
                        src="/assets/payments/visa-mastercard.png"
                        alt="Visa & MasterCard"
                        className="h-4 w-auto object-contain"
                      />
                    </div>
                    <span className="text-[8.5px] text-[#6B7280] block mt-1">فيزا / ماستركارد</span>
                  </button>

                  {/* Option 5: Sangoub Wallet (Hidden if disabled) */}
                  {LAUNCH_CONFIG.showWallet && (
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
                        {user ? `رصيدك: ${walletBalance} ج.م` : 'سجل للدفع'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Sub-details & Receipt Upload for InstaPay */}
                {paymentMethod === 'instapay' && (
                  <div className="mt-2 p-2.5 bg-[#FFF8F5] border border-[#FFD4C2] rounded-xl text-xs space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-[#9A3412] font-black">حساب إنستاباي المعتمد:</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(LAUNCH_CONFIG.instapayAccount, 'instapay')}
                        className="inline-flex items-center gap-1 font-mono font-black text-[#FF5900] bg-white px-2 py-0.5 rounded border border-[#FFD4C2] hover:bg-orange-50 cursor-pointer"
                        title="نسخ الحساب"
                      >
                        {copiedAccount === 'instapay' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        <span>{LAUNCH_CONFIG.instapayAccount}</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      value={instapayRef}
                      onChange={(e) => setInstapayRef(e.target.value)}
                      placeholder="اسم حسابك أو رقم المعاملة على إنستاباي (اختياري)"
                      className="w-full px-2.5 py-1 text-[10.5px] bg-white border border-[#D1D5DB] rounded-lg outline-none font-bold"
                    />

                    {/* Receipt Upload Component */}
                    <div className="border border-dashed border-[#FFB899] bg-white rounded-xl p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-[#9A3412] flex items-center gap-1">
                          <ImageIcon size={12} className="text-[#FF5900]" />
                          رفع إيصال أو سكرين شوت التحويل (لتأكيد فوري):
                        </span>
                        {receiptPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveReceipt}
                            className="text-[9px] text-red-500 font-bold hover:underline cursor-pointer"
                          >
                            حذف الإيصال
                          </button>
                        )}
                      </div>

                      {receiptPreview ? (
                        <div className="flex items-center gap-2 bg-[#F9FAFB] p-1.5 rounded-lg border border-[#E5E7EB]">
                          <img
                            src={receiptPreview}
                            alt="Receipt Preview"
                            className="w-12 h-12 object-cover rounded-md border border-[#D1D5DB]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-emerald-700 truncate flex items-center gap-1">
                              <CheckCircle2 size={11} className="shrink-0" />
                              تم إرفاق إيصال الدفع بنجاح
                            </p>
                            <p className="text-[8.5px] text-[#6B7280] truncate">
                              {receiptFile?.name} ({(receiptFile?.size ? (receiptFile.size / 1024).toFixed(0) : 0)} KB)
                            </p>
                          </div>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 py-2 px-3 bg-[#FFF9F6] hover:bg-[#FFF2EC] border border-[#FFD9C8] rounded-lg cursor-pointer transition-colors text-center">
                          <UploadCloud size={16} className="text-[#FF5900]" />
                          <span className="text-[10px] font-black text-[#FF5900]">
                            اضغط لاختيار صورة إيصال التحويل
                          </span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleReceiptChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-details & Receipt Upload for Vodafone Cash */}
                {paymentMethod === 'vodafone_cash' && (
                  <div className="mt-2 p-2.5 bg-[#FFF5F5] border border-red-200 rounded-xl text-xs space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-red-900 font-black">رقم فودافون كاش المعتمد:</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(LAUNCH_CONFIG.vodafoneCashNumber, 'vodafone')}
                        className="inline-flex items-center gap-1 font-mono font-black text-red-600 bg-white px-2 py-0.5 rounded border border-red-200 hover:bg-red-50 cursor-pointer"
                        title="نسخ الرقم"
                      >
                        {copiedAccount === 'vodafone' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        <span>{LAUNCH_CONFIG.vodafoneCashNumber}</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      value={vodafoneSender}
                      onChange={(e) => setVodafoneSender(e.target.value)}
                      placeholder="رقم المحفظة التي قمت بالتحويل منها (لتأكيد استلام المبلغ)"
                      className="w-full px-2.5 py-1 text-[10.5px] bg-white border border-[#D1D5DB] rounded-lg outline-none font-bold"
                    />

                    {/* Receipt Upload Component */}
                    <div className="border border-dashed border-red-300 bg-white rounded-xl p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-red-900 flex items-center gap-1">
                          <ImageIcon size={12} className="text-red-600" />
                          رفع إيصال أو سكرين شوت رسالة التحويل:
                        </span>
                        {receiptPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveReceipt}
                            className="text-[9px] text-red-500 font-bold hover:underline cursor-pointer"
                          >
                            حذف الإيصال
                          </button>
                        )}
                      </div>

                      {receiptPreview ? (
                        <div className="flex items-center gap-2 bg-[#F9FAFB] p-1.5 rounded-lg border border-[#E5E7EB]">
                          <img
                            src={receiptPreview}
                            alt="Receipt Preview"
                            className="w-12 h-12 object-cover rounded-md border border-[#D1D5DB]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-emerald-700 truncate flex items-center gap-1">
                              <CheckCircle2 size={11} className="shrink-0" />
                              تم إرفاق إيصال الدفع بنجاح
                            </p>
                            <p className="text-[8.5px] text-[#6B7280] truncate">
                              {receiptFile?.name} ({(receiptFile?.size ? (receiptFile.size / 1024).toFixed(0) : 0)} KB)
                            </p>
                          </div>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 py-2 px-3 bg-red-50/70 hover:bg-red-50 border border-red-200 rounded-lg cursor-pointer transition-colors text-center">
                          <UploadCloud size={16} className="text-red-600" />
                          <span className="text-[10px] font-black text-red-600">
                            اضغط لاختيار صورة إشعار التحويل
                          </span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleReceiptChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-details for Card */}
                {paymentMethod === 'card' && (
                  <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-blue-900 text-[10.5px] font-black">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-blue-600" />
                        <span>دفع إلكتروني آمن ومشفر 100%</span>
                      </div>
                      <img
                        src="/assets/payments/visa-mastercard.png"
                        alt="Visa MasterCard"
                        className="h-4 object-contain"
                      />
                    </div>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="رقم البطاقة (أو سيتم فتح نافذة الدفع البنكية المباشرة)"
                      className="w-full px-2.5 py-1 text-[10.5px] bg-white border border-blue-200 rounded-lg outline-none font-bold"
                    />

                    {/* Receipt Upload Component (optional for card) */}
                    <div className="border border-dashed border-blue-200 bg-white rounded-xl p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-blue-900 flex items-center gap-1">
                          <ImageIcon size={12} className="text-blue-600" />
                          رفع إيصال الدفع الإلكتروني (اختياري للتحقق):
                        </span>
                        {receiptPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveReceipt}
                            className="text-[9px] text-red-500 font-bold hover:underline cursor-pointer"
                          >
                            حذف الإيصال
                          </button>
                        )}
                      </div>

                      {receiptPreview ? (
                        <div className="flex items-center gap-2 bg-[#F9FAFB] p-1.5 rounded-lg border border-[#E5E7EB]">
                          <img
                            src={receiptPreview}
                            alt="Receipt Preview"
                            className="w-12 h-12 object-cover rounded-md border border-[#D1D5DB]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-emerald-700 truncate flex items-center gap-1">
                              <CheckCircle2 size={11} className="shrink-0" />
                              تم إرفاق إيصال الدفع بنجاح
                            </p>
                            <p className="text-[8.5px] text-[#6B7280] truncate">
                              {receiptFile?.name}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-50/50 hover:bg-blue-50 border border-blue-200 rounded-lg cursor-pointer transition-colors text-center">
                          <UploadCloud size={16} className="text-blue-600" />
                          <span className="text-[10px] font-black text-blue-700">
                            اضغط لاختيار صورة إيصال الدفع
                          </span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleReceiptChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
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
                  <span>رسوم التوصيل:</span>
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
              disabled={isUploadingReceipt}
              onClick={handlePlaceOrder}
              className="w-full h-11 bg-[#FF5900] hover:bg-[#E04E00] active:scale-[0.98] disabled:bg-gray-300 text-white text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-between px-3.5"
            >
              <div className="flex items-center gap-1.5">
                {isUploadingReceipt ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    <span>جاري رفع إيصال الدفع وتأكيد الطلب...</span>
                  </>
                ) : (
                  <>
                    <Bike size={17} />
                    <span>تأكيد الطلب</span>
                  </>
                )}
              </div>
              <span className="text-sm font-mono">{formatEGP(total)}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
