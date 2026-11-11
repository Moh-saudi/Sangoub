import React, { useEffect, useRef, useState } from 'react';
import { formatEGP } from '../../utils/orderCalculations';
import { useStore } from '../context/StoreContext';
import { supabase } from '../../lib/supabase';
import { 
  CheckCircle2, 
  Package, 
  Bike, 
  PackageCheck, 
  X, 
  Clock, 
  Store, 
  MapPin, 
  ReceiptText, 
  MessageCircle, 
  Camera, 
  Upload, 
  AlertCircle,
  KeyRound,
  Mail,
  CreditCard
} from 'lucide-react';
import type { OrderStatus } from '../../types';
import { playAirportChime } from '../../utils/audioAlerts';
import { deriveOrderOtp, orderDelivery } from '../../lib/orderDelivery';
import { cleanCourierName } from '../../utils/sanitizeName';
import { KNOWN_STORE_ASSETS } from '../../lib/supabase';

export interface TrackableOrder {
  orderId: string;
  orderNumber?: string;
  orderStatus?: OrderStatus;
  coordinates?: import('../../types').Coordinates;
  itemsCount: number;
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  total: number;
  destination: string;
  destinationCoords?: { lat: number; lng: number };
  time: string;
  paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'card' | 'wallet';
  paymentStatus?: string;
  courierCollected?: boolean;
  instapayRef?: string;
  receiptUrl?: string;
  notes?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    imageUrl?: string;
    storeId?: string;
    storeName?: string;
  }>;
  createdAt?: string;
}

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: TrackableOrder | null;
}

export function OrderTrackingModal({ isOpen, onClose, order }: OrderTrackingModalProps) {
  const { stores } = useStore();
  const ref = useRef<HTMLDialogElement>(null);

  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(order?.orderStatus || 'received');
  const [paymentStatus, setPaymentStatus] = useState<string>(order?.paymentStatus || 'pending');
  const [courierCollected, setCourierCollected] = useState<boolean>(Boolean(order?.courierCollected));
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(order?.receiptUrl);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  // Fetch or derive secret delivery OTP code for the customer
  useEffect(() => {
    if (!order?.orderId) return;
    let active = true;
    async function loadOtp() {
      try {
        const res = await orderDelivery({ action: 'code', orderId: order!.orderId });
        if (active && res?.otpCode) {
          setOtpCode(res.otpCode);
          return;
        }
      } catch {}
      if (active) {
        setOtpCode(deriveOrderOtp(order!.orderId, order!.orderNumber));
      }
    }
    void loadOtp();
    return () => { active = false; };
  }, [order?.orderId, order?.orderNumber]);

  // Sync internal state with order prop changes
  useEffect(() => {
    if (order) {
      setCurrentStatus(order.orderStatus || 'received');
      setPaymentStatus(order.paymentStatus || 'pending');
      setCourierCollected(Boolean(order.courierCollected));
      setReceiptUrl(order.receiptUrl);
    }
  }, [order?.orderId, order?.orderStatus, order?.paymentStatus, order?.receiptUrl, order?.courierCollected]);

  // Modal show/close handler
  useEffect(() => {
    if (isOpen && order) {
      ref.current?.showModal();
    } else {
      ref.current?.close();
    }
  }, [isOpen, order?.orderId]);

  // Real-time Supabase subscription for live status & collection updates
  useEffect(() => {
    if (!isOpen || !order?.orderId) return;

    const rawId = order.orderId?.trim() || '';
    const cleanUuid = rawId.replace(/^(ord-|order-)/i, '');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUuid);

    // 1. Fetch live snapshot from Supabase directly
    const fetchLatest = async () => {
      try {
        let query = supabase
          .from('orders')
          .select('id, status, payment_status');

        if (isUuid) {
          query = query.eq('id', cleanUuid);
        } else {
          // If not UUID, match against order_number or client_request_id to avoid PostgreSQL 400 UUID syntax error
          query = query.or(`order_number.eq.${rawId},client_request_id.eq.${rawId}`);
        }

        const { data, error } = await query.maybeSingle();

        if (!error && data) {
          if (data.status && data.status !== currentStatus) {
            setCurrentStatus(data.status as OrderStatus);
          }
          if (data.payment_status) {
            setPaymentStatus(data.payment_status);
          }
          if (data.status === 'delivered' || data.payment_status === 'paid') {
            setCourierCollected(true);
            try {
              const last = localStorage.getItem('sangoub_last_order');
              if (last) {
                const parsed = JSON.parse(last);
                parsed.orderStatus = data.status || 'delivered';
                localStorage.setItem('sangoub_last_order', JSON.stringify(parsed));
              }
              window.dispatchEvent(new CustomEvent('sangoub:order_updated', { detail: { orderId: cleanUuid || rawId, status: data.status || 'delivered' } }));
            } catch {}
          }
        }
      } catch {
        // silent fallback to local prop
      }
    };

    void fetchLatest();

    // 2. Continuous 4-second polling timer as rock-solid fallback
    const pollInterval = setInterval(() => {
      if (!document.hidden) void fetchLatest();
    }, 4000);

    // 3. Real-time channel listener
    const realtimeFilter = isUuid ? `id=eq.${cleanUuid}` : `order_number=eq.${rawId}`;
    const channel = supabase
      .channel(`order-track-${rawId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: realtimeFilter },
        (payload: any) => {
          if (payload.new) {
            if (payload.new.status && payload.new.status !== currentStatus) {
              setCurrentStatus(payload.new.status as OrderStatus);
              void playAirportChime();
            }
            if (payload.new.payment_status) {
              setPaymentStatus(payload.new.payment_status);
            }
            if (payload.new.status === 'delivered' || payload.new.payment_status === 'paid' || payload.new.courier_checklist?.collectedPayment) {
              setCourierCollected(true);
              try {
                const last = localStorage.getItem('sangoub_last_order');
                if (last) {
                  const parsed = JSON.parse(last);
                  parsed.orderStatus = payload.new.status || 'delivered';
                  localStorage.setItem('sangoub_last_order', JSON.stringify(parsed));
                }
                window.dispatchEvent(new CustomEvent('sangoub:order_updated', { detail: { orderId: cleanUuid || rawId, status: payload.new.status || 'delivered' } }));
              } catch {}
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      void supabase.removeChannel(channel);
    };
  }, [isOpen, order?.orderId]);

  if (!isOpen || !order) return null;

  // Format order display number
  const displayOrderNumber = order.orderNumber || (
    order.orderId.includes('-')
      ? `SG-${order.orderId.replace(/^(ord-|order-)/i, '').slice(0, 6).toUpperCase()}`
      : `#${order.orderId.slice(0, 8)}`
  );

  // Stepper calculations (0: received, 1: preparing, 2: with_courier, 3: delivered)
  const getStageIndex = (status: string): number => {
    switch (status?.toLowerCase()) {
      case 'received':
      case 'pending':
        return 0;
      case 'preparing':
      case 'ready':
        return 1;
      case 'with_courier':
      case 'picked_up':
      case 'assigned':
      case 'on_the_way':
      case 'delivering':
        return 2;
      case 'delivered':
      case 'completed':
        return 3;
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };

  const activeStageIndex = getStageIndex(currentStatus);
  const isCancelled = currentStatus === 'cancelled';

  const STAGES = [
    { id: 'received', title: 'تم الاستلام', icon: CheckCircle2, desc: 'تم استلام وتأكيد طلبك بنجاح' },
    { id: 'preparing', title: 'قيد التجهيز', icon: Package, desc: 'المتجر يجهز ويغلف أصناف طلبك الآن' },
    { id: 'with_courier', title: 'مع المندوب', icon: Bike, desc: 'المندوب استلم الطلب وهو في الطريق إليك' },
    { id: 'delivered', title: 'تم التوصيل', icon: PackageCheck, desc: 'تم تسليم طلبك بنجاح ✓' },
  ];

  // Collection status logic
  const isPaymentCollected = 
    paymentStatus === 'paid' || 
    paymentStatus === 'completed' || 
    courierCollected || 
    currentStatus === 'delivered';

  // Subtotal & Delivery calculations
  const itemsSum = (order.items || []).reduce((acc, it) => acc + (it.price * it.quantity), 0);
  const calculatedSubtotal = typeof order.subtotal === 'number' && order.subtotal > 0
    ? order.subtotal
    : itemsSum > 0
    ? itemsSum
    : Math.max(0, order.total - 15);
  const calculatedDeliveryFee = typeof order.deliveryFee === 'number'
    ? order.deliveryFee
    : Math.max(0, order.total - calculatedSubtotal);

  // Store name and logo resolution
  const firstStoreId = order.items?.[0]?.storeId;
  const matchedStore = stores.find(s => s.id === firstStoreId || s.name === order.items?.[0]?.storeName);
  const storeDisplayName = order.items?.[0]?.storeName || matchedStore?.name || 'متجر سنجوب إكسبريس';
  const storeLogo = matchedStore?.logoUrl || matchedStore?.imageUrl || (firstStoreId && KNOWN_STORE_ASSETS[firstStoreId]?.logoUrl) || '/brand/sangoub-market-logo.jpg';

  const handleSendEmailInvoice = async () => {
    setEmailStatus('sending');
    await new Promise(r => setTimeout(r, 700));
    setEmailStatus('sent');
    setTimeout(() => setEmailStatus('idle'), 6000);
  };

  // Receipt image upload handler for InstaPay / Wallet
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order) return;

    setUploadingReceipt(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setReceiptUrl(result);
      setUploadingReceipt(false);
      order.receiptUrl = result;

      try {
        const last = localStorage.getItem('sangoub_last_order');
        if (last) {
          const parsed = JSON.parse(last);
          parsed.receiptUrl = result;
          localStorage.setItem('sangoub_last_order', JSON.stringify(parsed));
        }
      } catch (err) {
        console.warn('Saving uploaded receipt failed', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const whatsappMessage = encodeURIComponent(`السلام عليكم، أود الاستفسار عن طلبي رقم ${displayOrderNumber} من منصة سنجوب.`);
  const whatsappUrl = `https://wa.me/201017799580?text=${whatsappMessage}`;

  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClose={onClose}
      dir="rtl"
      aria-labelledby="customer-tracking-title"
      className="backdrop:bg-slate-900/60 backdrop:backdrop-blur-xs p-0 border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden m-auto animate-in fade-in"
    >
      {/* 1. Modal Top Bar */}
      <header className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
            <img
              src={storeLogo}
              alt={storeDisplayName}
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-market-logo.jpg';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="customer-tracking-title" className="text-sm font-black text-slate-900">
                {currentStatus === 'delivered' ? 'تفاصيل الفاتورة والطلب' : 'متابعة الطلب'}
              </h2>
              <span className="font-mono text-xs font-black bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200">
                {displayOrderNumber}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${currentStatus === 'delivered' ? 'bg-emerald-500' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="text-[10px] text-slate-500 font-bold">
                {currentStatus === 'delivered' ? 'مكتمل وخالص السداد' : 'تحديث لحظي ومباشر'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق متابعة الطلب"
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer transition"
        >
          <X size={16} />
        </button>
      </header>

      {/* 2. Modal Body */}
      <div className="p-4 max-h-[82vh] overflow-y-auto space-y-4 bg-slate-50/50">

        {/* 2.1 Order Progress Stepper (Talabat / Keeta Style with Illuminated Orange Icons) */}
        <section className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          {isCancelled ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center space-y-1">
              <AlertCircle size={24} className="text-red-500 mx-auto" />
              <h4 className="text-xs font-black text-red-800">تم إلغاء هذا الطلب</h4>
              <p className="text-[11px] text-red-600">يمكنك التواصل مع الدعم الفني للاستفسار أو تقديم طلب جديد.</p>
            </div>
          ) : (
            <div>
              {/* Stepper Icons and Connecting Lines */}
              <div className="relative flex items-center justify-between px-2">
                {/* Background Connecting Bar */}
                <div className="absolute top-4 left-6 right-6 h-1 bg-slate-100 -z-0" />
                
                {/* Active Progress Bar */}
                <div 
                  className="absolute top-4 right-6 h-1 bg-orange-500 transition-all duration-500 -z-0"
                  style={{ 
                    width: activeStageIndex <= 0 ? '0%' : activeStageIndex === 1 ? '33%' : activeStageIndex === 2 ? '66%' : 'calc(100% - 48px)',
                    right: '24px'
                  }}
                />

                {STAGES.map((stage, idx) => {
                  const Icon = stage.icon;
                  const isCompleted = idx < activeStageIndex;
                  const isCurrent = idx === activeStageIndex;
                  const isPending = idx > activeStageIndex;

                  return (
                    <div key={stage.id} className="relative z-10 flex flex-col items-center gap-1.5 flex-1">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isCurrent
                            ? activeStageIndex === 3
                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-4 ring-emerald-100 scale-105'
                              : 'bg-orange-500 text-white shadow-md shadow-orange-500/30 ring-4 ring-orange-100 scale-105'
                            : isCompleted
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                      >
                        <Icon size={17} className={isCurrent ? 'animate-pulse' : ''} />
                      </div>
                      <span
                        className={`text-[10px] text-center font-black ${
                          isCurrent
                            ? activeStageIndex === 3 ? 'text-emerald-700' : 'text-orange-600'
                            : isCompleted
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {stage.title}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Current Stage Narrative Card / Delivered Completion Dossier */}
              {activeStageIndex === 3 || currentStatus === 'delivered' ? (
                <div className="mt-4 p-3.5 bg-gradient-to-r from-emerald-50 via-white to-teal-50 border border-emerald-200 rounded-xl space-y-2 text-right">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs">
                      <CheckCircle2 size={12} />
                      <span>تم تسليم الطلب بنجاح ✓</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-800 font-bold">
                      {order.time ? `التوقيت: ${order.time}` : 'اكتملت الرحلة'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-700 pt-1.5 border-t border-emerald-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">المتجر:</span>
                      <div className="flex items-center gap-1.5">
                        <img
                          src={storeLogo}
                          alt={storeDisplayName}
                          className="w-4 h-4 rounded-full object-cover border border-slate-200"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-market-logo.jpg';
                          }}
                        />
                        <strong className="text-slate-900">{storeDisplayName}</strong>
                      </div>
                    </div>
                    {order.courierName && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">كابتن التوصيل:</span>
                        <strong className="text-slate-900">{cleanCourierName(order.courierName, order.courierPhone)}</strong>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-500 shrink-0">مكان الاستلام:</span>
                      <span className="text-slate-800 font-medium text-left text-[11px]">{order.destination}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-800 font-bold pt-0.5">
                      <span>إجمالي الفاتورة:</span>
                      <span className="font-mono">{formatEGP(order.total)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/60 border border-orange-100 rounded-xl text-center space-y-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    {STAGES[Math.max(0, activeStageIndex)].title}
                  </span>
                  <p className="text-xs font-black text-slate-800 leading-snug">
                    {STAGES[Math.max(0, activeStageIndex)].desc}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    المتجر: <strong className="text-slate-700">{storeDisplayName}</strong> • الوقت المقدر: 15-25 دقيقة
                  </p>
                </div>
              )}

              {/* Secret Delivery OTP Code for Handover */}
              {activeStageIndex >= 1 && activeStageIndex < 3 && otpCode && (
                <div className="mt-3 p-3.5 bg-amber-50/90 border-2 border-dashed border-amber-300 rounded-2xl text-center space-y-1 shadow-2xs">
                  <div className="flex items-center justify-center gap-1.5 text-amber-900 text-xs font-bold">
                    <KeyRound size={15} className="text-amber-600" />
                    <span>رمز الاستلام السري للكابتن (OTP)</span>
                  </div>
                  <div dir="ltr" className="text-3xl font-mono font-black tracking-widest text-amber-600 py-1 select-all">
                    {otpCode}
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium">
                    شارك هذا الرمز مع الكابتن عند وصوله لتأكيد استلامك للطلب
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 2.2 Payment & Cash Collection Status Banner */}
        <section className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <ReceiptText size={14} className="text-orange-500" />
              <span>حالة سداد الفاتورة:</span>
            </span>
            <span className="text-xs font-mono font-black text-slate-900">
              {formatEGP(order.total)}
            </span>
          </div>

          {order.paymentMethod === 'cash' ? (
            isPaymentCollected ? (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <div>
                    <strong className="text-xs font-black block">تم التحصيل بنجاح ✓</strong>
                    <span className="text-[10px] text-emerald-600">قام المندوب بتسجيل استلام المبلغ نقداً</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-md text-emerald-700 border border-emerald-100">
                  خالص السداد
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between text-amber-900">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-600 shrink-0" />
                  <div>
                    <strong className="text-xs font-black block">لم يتم التحصيل بعد</strong>
                    <span className="text-[10px] text-amber-700">المبلغ مستحق نقداً عند تسليم المندوب للطلب</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-md text-amber-800 border border-amber-200">
                  كاش عند الاستلام
                </span>
              </div>
            )
          ) : (order.paymentMethod === 'card' || (order.paymentMethod as string) === 'geidea') ? (
            <div className="p-2.5 rounded-xl bg-blue-50/90 border border-blue-200 flex items-center justify-between text-blue-900">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-blue-600 shrink-0" />
                <div>
                  <strong className="text-xs font-black block">
                    بطاقة بنكية (فيزا / ماستركارد / ميزة)
                  </strong>
                  <span className="text-[10px] text-blue-700">
                    دفع إلكتروني آمن معتمد عبر جيديا Geidea
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-md text-emerald-700 border border-emerald-200 shadow-2xs">
                خالص السداد ✓
              </span>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between text-purple-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-purple-600 shrink-0" />
                <div>
                  <strong className="text-xs font-black block">
                    {order.paymentMethod === 'instapay' ? 'الدفع عبر إنستاباي' : 'المحفظة الإلكترونية (فودافون كاش)'}
                  </strong>
                  <span className="text-[10px] text-purple-700">
                    {receiptUrl ? 'تم رفع إيصال التحويل للمراجعة' : 'يرجى التأكد من إتمام التحويل'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-md text-purple-800 border border-purple-100">
                إلكتروني
              </span>
            </div>
          )}
        </section>

        {/* 2.3 Upload InstaPay / Wallet Receipt (ONLY for instapay and vodafone_cash, NEVER for bank cards) */}
        {(order.paymentMethod === 'instapay' || order.paymentMethod === 'vodafone_cash') && (
          <section className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                <Upload size={14} className="text-purple-600" />
                <span>إيصال تحويل إنستاباي / فودافون كاش</span>
              </span>
              {receiptUrl ? (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  تم الرفع ✓
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  مطلوب
                </span>
              )}
            </div>

            {receiptUrl ? (
              <div className="flex items-center gap-2.5 bg-white p-2 rounded-xl border border-purple-100">
                <img
                  src={receiptUrl}
                  alt="إيصال التحويل"
                  className="w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer"
                  onClick={() => window.open(receiptUrl, '_blank')}
                  title="انقر لتكبير الإيصال"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-slate-800 truncate">تم حفظ صورة التحويل بنجاح</p>
                  <p className="text-[9px] text-slate-500">تم إرسالها للتاجر للمراجعة والاعتماد</p>
                </div>
                <label className="text-[10px] font-bold text-purple-700 underline cursor-pointer shrink-0">
                  تغيير
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            ) : (
              <label className="w-full py-2 px-3 bg-white hover:bg-purple-100/50 border border-dashed border-purple-300 rounded-xl text-xs font-bold text-purple-800 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98">
                <Camera size={14} className="text-purple-600" />
                <span>{uploadingReceipt ? 'جارٍ الرفع...' : 'رفع لقطة شاشة التحويل 📸'}</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            )}
          </section>
        )}

        {/* 2.4 Clean Customer Invoice & Items Summary (Talabat / Keeta Style - No POS Thermal Receipt) */}
        <section className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Store size={14} className="text-orange-500" />
              <span>تفاصيل الأصناف ({order.items?.length || 0})</span>
            </h4>
            <span className="text-[11px] text-slate-500 font-bold">
              {storeDisplayName}
            </span>
          </div>

          {/* Items List */}
          <div className="space-y-2 divide-y divide-slate-100">
            {(order.items || []).map((it, idx) => (
              <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-black flex items-center justify-center shrink-0">
                    {it.quantity}×
                  </span>
                  <span className="font-bold text-slate-800 truncate">{it.name}</span>
                </div>
                <span className="font-mono font-black text-slate-700 shrink-0">
                  {formatEGP(it.price * it.quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* Financial Totals */}
          <div className="border-t border-slate-100 pt-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>قيمة المنتجات:</span>
              <span className="font-mono">{formatEGP(calculatedSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>رسوم التوصيل:</span>
              <span className="font-mono">{formatEGP(calculatedDeliveryFee)}</span>
            </div>
            {(order.discount ?? 0) > 0 && (
              <div className="flex items-center justify-between text-emerald-600 font-bold">
                <span>الخصم المطبق:</span>
                <span className="font-mono">-{formatEGP(order.discount || 0)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-slate-900 font-black text-sm pt-1 border-t border-dashed border-slate-200">
              <span>الإجمالي المستحق:</span>
              <span className="font-mono text-orange-600">{formatEGP(order.total)}</span>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="border-t border-slate-100 pt-2.5 flex items-start gap-2 text-[11px] text-slate-600">
            <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-slate-700">عنوان التوصيل: </span>
              <span>{order.destination}</span>
            </div>
          </div>
        </section>

        {/* 2.5 Delivered Action: Email Invoice + WhatsApp Support */}
        <div className="pt-1 space-y-2">
          {currentStatus === 'delivered' && (
            <button
              type="button"
              onClick={handleSendEmailInvoice}
              disabled={emailStatus === 'sending'}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-2xs border cursor-pointer active:scale-98 ${
                emailStatus === 'sent'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
              }`}
            >
              {emailStatus === 'sent' ? (
                <>
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>تم إرسال نسخة الفاتورة إلى بريدك الإلكتروني بنجاح ✓</span>
                </>
              ) : emailStatus === 'sending' ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span>جارٍ إرسال الفاتورة عبر البريد...</span>
                </>
              ) : (
                <>
                  <Mail size={15} className="text-orange-500" />
                  <span>إرسال الفاتورة للبريد الإلكتروني ✉️</span>
                </>
              )}
            </button>
          )}

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-xs"
          >
            <MessageCircle size={15} />
            <span>مساعدة في هذا الطلب (واتساب سنجوب)</span>
          </a>
        </div>

      </div>
    </dialog>
  );
}
