import { useEffect, useRef, useState } from 'react';
import { OrderMap } from '../../components/OrderMap';
import { formatEGP } from '../../utils/orderCalculations';
import { CustomerPOSReceipt } from '../../components/CustomerPOSReceipt';
import { Receipt, Navigation, X } from 'lucide-react';
import type { Order } from '../../types';

export interface TrackableOrder {
  orderId: string;
  orderStatus?: import('../../types').Order['orderStatus'];
  coordinates?: import('../../types').Coordinates;
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
  const ref = useRef<HTMLDialogElement>(null);
  const [viewMode, setViewMode] = useState<'tracking' | 'receipt'>('tracking');

  useEffect(() => {
    if (isOpen && order) {
      setViewMode('tracking');
      ref.current?.showModal();
    } else {
      ref.current?.close();
    }
  }, [isOpen, order?.orderId]);

  if (!isOpen || !order) return null;

  const coordinates = order.coordinates || (
    order.destinationCoords
      ? { latitude: order.destinationCoords.lat, longitude: order.destinationCoords.lng }
      : undefined
  );

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
        storeId: it.storeId || 'store-foul-hind',
        category: 'طعام ومشروبات',
        is_available: true,
      } as any,
      quantity: it.quantity,
      extraPrice: 0,
      selectedOptions: {},
    })),
    subtotal: Math.max(0, order.total - 20),
    deliveryFee: 20,
    discount: 0,
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
          <CustomerPOSReceipt order={adaptedOrder} showTabs={true} />
        )}
      </div>
    </dialog>
  );
}
