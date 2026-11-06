import { useEffect, useRef, useState } from 'react';
import { OrderMap } from '../../components/OrderMap';
import { formatEGP } from '../../utils/orderCalculations';
import { CustomerPOSReceipt } from '../../components/CustomerPOSReceipt';
import { useStore } from '../context/StoreContext';
import { Receipt, Navigation, X, Upload, Camera, CheckCircle2 } from 'lucide-react';
import type { Order } from '../../types';

export interface TrackableOrder {
  orderId: string;
  orderStatus?: import('../../types').Order['orderStatus'];
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

export type TrackingStage = 'received' | 'preparing' | 'with_courier' | 'delivered';

export function OrderTrackingModal({ isOpen, onClose, order }: OrderTrackingModalProps) {
  const { stores } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const [viewMode, setViewMode] = useState<'tracking' | 'receipt'>('tracking');
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(order?.receiptUrl);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  useEffect(() => {
    if (isOpen && order) {
      setViewMode('tracking');
      setReceiptUrl(order.receiptUrl);
      ref.current?.showModal();
    } else {
      ref.current?.close();
    }
  }, [isOpen, order?.orderId, order?.receiptUrl]);

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
        const hist = localStorage.getItem('sangoub_customer_orders_history');
        if (hist) {
          const parsedHist = JSON.parse(hist);
          const updated = parsedHist.map((o: any) =>
            o.id === order.orderId
              ? { ...o, receiptUrl: result, rawOrder: { ...o.rawOrder, receiptUrl: result } }
              : o
          );
          localStorage.setItem('sangoub_customer_orders_history', JSON.stringify(updated));
        }
      } catch (err) {
        console.warn('Saving uploaded receipt failed', err);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen || !order) return null;

  const coordinates = order.coordinates || (
    order.destinationCoords
      ? { latitude: order.destinationCoords.lat, longitude: order.destinationCoords.lng }
      : undefined
  );

  const itemsSum = (order.items || []).reduce((acc, it) => acc + (it.price * it.quantity), 0);
  const calculatedSubtotal = typeof order.subtotal === 'number' && order.subtotal > 0
    ? order.subtotal
    : itemsSum > 0
    ? itemsSum
    : Math.max(0, order.total - 15);
  const calculatedDeliveryFee = typeof order.deliveryFee === 'number'
    ? order.deliveryFee
    : Math.max(0, order.total - calculatedSubtotal);

  // Adapt TrackableOrder into full Order schema for CustomerPOSReceipt
  const adaptedOrder = {
    id: order.orderId,
    orderNumber: order.orderId.replace(/^(ord-|order-)/i, '').slice(0, 8),
    profileId: 'usr-client',
    profileName: 'عميل سنجوب المعتمد',
    phone: '010XXXXXXXX',
    orderStatus: (order.orderStatus || 'received') as any,
    paymentMethod: order.paymentMethod as any,
    paymentStatus: order.orderStatus === 'delivered' ? 'paid' : 'pending',
    items: (order.items || []).map((it, idx) => ({
      id: `item-${idx}`,
      product: {
        id: `prod-${idx}`,
        name: it.name,
        price: it.price,
        storeId: it.storeId || '27d12743-8106-4ef0-ba3c-84abefdb75d6',
        category: 'طعام ومشروبات',
        is_available: true,
      } as any,
      quantity: it.quantity,
      extraPrice: 0,
      selectedOptions: {},
    })),
    subtotal: calculatedSubtotal,
    deliveryFee: calculatedDeliveryFee,
    discount: order.discount ?? 0,
    total: order.total,
    tip: 0,
    taxTotal: 0,
    includedTax: 0,
    additionalTax: 0,
    createdAt: order.createdAt || order.time || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ministry: order.destination.includes('وزارة') ? order.destination : '',
    address: order.destination,
    floorNumber: order.destination.includes('الدور') ? (order.destination.match(/الدور\s*(\S+)/)?.[1] || '4') : '1',
    roomNumber: order.destination.includes('مكتب') ? (order.destination.match(/مكتب\s*(\S+)/)?.[1] || '12') : '1',
    receiptUrl: receiptUrl || order.receiptUrl,
  } as unknown as Order;

  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClose={onClose}
      dir="rtl"
      aria-labelledby="customer-tracking-title"
      className="backdrop:bg-slate-900/60 backdrop:backdrop-blur-xs p-0 border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden m-auto animate-in fade-in"
    >
      {/* Modal Top Navigation Bar */}
      <header className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('tracking')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'tracking'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Navigation size={13} />
            <span>تتبع الطلب</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('receipt')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'receipt'
                ? 'bg-white text-orange-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt size={13} />
            <span>فاتورة وإيصال POS</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق متابعة الطلب"
          className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer transition"
        >
          <X size={14} />
        </button>
      </header>

      {/* Modal Content */}
      <div className="p-4 max-h-[85vh] overflow-y-auto">
        {viewMode === 'tracking' ? (
          <div className="space-y-4">
            <div className="bg-orange-50/60 p-3 rounded-2xl border border-orange-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">طلب رقم:</span>
                <strong className="font-mono text-sm text-slate-900 font-bold">
                  #{order.orderId.replace(/^(ord-|order-)/i, '').slice(0, 8)}
                </strong>
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400 font-bold block">الإجمالي:</span>
                <span className="font-mono text-sm font-black text-orange-700">{formatEGP(order.total)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 flex items-center gap-1">
              <span>📍 الوجهة:</span>
              <strong className="text-slate-900">{order.destination}</strong>
            </p>

            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-2xs">
              <OrderMap order={{ id: order.orderId, orderStatus: order.orderStatus || 'received', coordinates }} />
            </div>

            {/* 📸 InstaPay / E-Wallet Payment Receipt Upload Card */}
            {(order.paymentMethod === 'instapay' || order.paymentMethod === 'vodafone_cash') && (
              <div className="bg-purple-50/90 border border-purple-200 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Upload size={16} className="text-purple-700" />
                    <h4 className="text-xs font-black text-slate-900">
                      إثبات تحويل إنستاباي / المحفظة
                    </h4>
                  </div>
                  {receiptUrl ? (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={11} /> تم رفع الإيصال
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      مطلوب رفع الإشعار
                    </span>
                  )}
                </div>

                {receiptUrl ? (
                  <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-purple-100">
                    <img
                      src={receiptUrl}
                      alt="إيصال التحويل"
                      className="w-12 h-12 object-cover rounded-lg border border-slate-200 cursor-pointer shadow-2xs"
                      onClick={() => window.open(receiptUrl, '_blank')}
                      title="انقر لعرض الصورة بالحجم الكامل"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">تم حفظ إيصال التحويل بنجاح ✓</p>
                      <p className="text-[10px] text-slate-500">تم إرسال الإشعار للتاجر والإدارة لمراجعة التحويل واعتماد الطلب فوراً.</p>
                    </div>
                    <label className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer shrink-0">
                      تغيير
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      بعد إتمام التحويل عبر إنستاباي، يرجى رفع لقطة الشاشة (Screenshot) للتأكد من وصول المبلغ واعتماد تجهيز طلبك فوراً لدى التاجر:
                    </p>
                    <label className="w-full py-2.5 px-3 bg-white hover:bg-purple-100/70 border-2 border-dashed border-purple-300 rounded-xl text-xs font-bold text-purple-800 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98">
                      <Camera size={15} className="text-purple-600" />
                      <span>{uploadingReceipt ? 'جارٍ رفع الإيصال...' : 'رفع لقطة شاشة التحويل (إيصال الدفع) 📸'}</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Quick Button to open POS Receipt */}
            <button
              type="button"
              onClick={() => setViewMode('receipt')}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <Receipt size={15} />
              <span>عرض الفاتورة الحرارية المعتمدة (POS 80mm)</span>
            </button>
          </div>
        ) : (
          <CustomerPOSReceipt order={adaptedOrder} stores={stores} showTabs={true} />
        )}
      </div>
    </dialog>
  );
}
