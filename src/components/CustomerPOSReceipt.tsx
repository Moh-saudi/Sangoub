import React, { useState } from 'react';
import { Printer, Download, Check, MapPin, Store as StoreIcon, ShieldCheck, QrCode } from 'lucide-react';
import type { Order, Store } from '../types';
import { formatEGP } from '../utils/orderCalculations';
import { tafqeetEGP } from '../utils/tafqeet';

export interface CustomerPOSReceiptProps {
  order: Order;
  stores?: Store[];
  selectedStoreId?: string;
  onClose?: () => void;
  showTabs?: boolean;
}

export function CustomerPOSReceipt({
  order,
  stores = [],
  selectedStoreId: initialStoreId,
  onClose,
  showTabs = true,
}: CustomerPOSReceiptProps) {
  // Extract distinct store IDs from order items
  const storeIdsInOrder = Array.from(
    new Set(order.items.map((item) => item.product.storeId || '27d12743-8106-4ef0-ba3c-84abefdb75d6'))
  );

  const [activeStoreId, setActiveStoreId] = useState<string>(
    initialStoreId || (storeIdsInOrder.length > 1 ? 'all' : storeIdsInOrder[0] || '27d12743-8106-4ef0-ba3c-84abefdb75d6')
  );

  const [copiedLink, setCopiedLink] = useState(false);

  // Active Store Object with resilient fallback
  const fallbackStore = {
    id: activeStoreId || 'sangoub-main',
    name: (order.items?.[0]?.product as any)?.storeName || 'متجر سنجوب المعتمد',
    category: 'تسوق عام',
    imageUrl: '/brand/sangoub-market-logo.jpg',
    locationInDistrict: 'المنصة الرئيسية - سنجوب',
    isActive: true,
  } as unknown as Store;

  const currentStore: Store =
    stores.find((s) => s.id === activeStoreId) ||
    stores.find((s) => s.id === storeIdsInOrder[0]) ||
    stores[0] ||
    fallbackStore;

  // Filter items based on active store tab
  const displayItems = activeStoreId === 'all'
    ? order.items
    : order.items.filter((item) => (item.product.storeId || '27d12743-8106-4ef0-ba3c-84abefdb75d6') === activeStoreId);

  // Calculations for current receipt view
  const itemsSubtotal = displayItems.reduce(
    (sum, item) => sum + (item.product.price + (item.extraPrice || 0)) * item.quantity,
    0
  );

  const isMultiStore = storeIdsInOrder.length > 1;
  const storeCount = storeIdsInOrder.length || 1;

  // Exact matching total: If order.total is present, receipt MUST strictly match
  const hasExactOrderTotal = typeof order.total === 'number' && order.total > 0;

  // Proportional or store-specific delivery fee matching order exactly
  const actualDeliveryFee = typeof order.deliveryFee === 'number'
    ? order.deliveryFee
    : hasExactOrderTotal
      ? Math.max(0, order.total - itemsSubtotal)
      : 15;

  const deliveryShare = isMultiStore && activeStoreId !== 'all'
    ? Math.round(actualDeliveryFee / storeCount)
    : actualDeliveryFee;

  // Proportional discount if any
  const discountShare = isMultiStore && activeStoreId !== 'all'
    ? Math.round((order.discount || 0) / storeCount)
    : (order.discount || 0);

  // Exact matching total between tracking and receipt
  const receiptTotal = hasExactOrderTotal && (activeStoreId === 'all' || !isMultiStore)
    ? order.total
    : Math.max(0, itemsSubtotal + deliveryShare - discountShare);

  // Clean 1-page printing isolating the receipt completely from background DOM
  const handlePrint = () => {
    const printEl = document.getElementById('sangoub-pos-thermal-paper');
    if (!printEl) {
      window.print();
      return;
    }

    try {
      let iframe = document.getElementById('sangoub-pos-print-frame') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'sangoub-pos-print-frame';
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '80mm';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
      }

      const frameDoc = iframe.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(`
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
            <meta charset="utf-8" />
            <title>فاتورة سنجوب #${order.orderNumber || order.id}</title>
            <style>
              @page {
                size: 80mm auto;
                margin: 0;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                font-family: 'Courier New', Courier, monospace, 'Cairo', sans-serif;
              }
              body {
                background: #fff;
                color: #000;
                width: 76mm;
                margin: 0 auto;
                padding: 3mm 2mm;
                font-size: 11px;
                line-height: 1.4;
              }
              .text-center { text-align: center; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .items-center { align-items: center; }
              .font-bold { font-weight: bold; }
              .font-mono { font-family: monospace; }
              img { max-width: 100%; }
            </style>
          </head>
          <body>
            ${printEl.outerHTML}
          </body>
          </html>
        `);
        frameDoc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }, 150);
        return;
      }
    } catch {
      // Fallback to direct print
    }
    window.print();
  };

  const isGovMinistry = Boolean(order.ministry || order.floorNumber || order.roomNumber);

  return (
    <div className="pos-receipt-wrapper flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      {/* 1. Header Toolbar (Hidden on Print - Only POS Print and Close) */}
      <div className="no-print w-full max-w-[360px] flex items-center justify-between gap-2 mb-3 bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
        >
          <Printer size={15} />
          <span>طباعة الفاتورة (POS 80mm)</span>
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            إغلاق
          </button>
        )}
      </div>

      {/* 2. Multi-Store Switcher Tabs (Hidden on Print) */}
      {showTabs && isMultiStore && (
        <div className="no-print w-full max-w-[360px] flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveStoreId('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 cursor-pointer ${activeStoreId === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
          >
            كل المتاجر (مجمع)
          </button>
          {storeIdsInOrder.map((sid) => {
            const st = stores.find((s) => s.id === sid);
            const isCurrent = activeStoreId === sid;
            return (
              <button
                key={sid}
                type="button"
                onClick={() => setActiveStoreId(sid)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${isCurrent
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
              >
                {st?.imageUrl && (
                  <img src={st.imageUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                )}
                <span>{st?.name || 'متجر'}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. The 80mm Standard Thermal POS Receipt Paper */}
      <article
        id="sangoub-pos-thermal-paper"
        className="pos-receipt-paper w-full max-w-[80mm] min-w-[280px] bg-white text-slate-900 border border-dashed border-slate-300 p-4 sm:p-5 shadow-sm font-mono text-xs leading-relaxed select-text"
        style={{
          boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
          fontFamily: "'Courier New', Courier, monospace, 'Cairo', sans-serif",
        }}
      >
        {/* Merchant Branding & Logo */}
        <div className="text-center pb-3 border-b border-dashed border-slate-400">
          {activeStoreId === 'all' ? (
            <div className="flex flex-col items-center justify-center">
              <img
                src="/brand/sangoub-logo-256x256.png"
                alt="سنجوب"
                className="w-16 h-16 object-contain mb-1.5 drop-shadow-xs"
              />
              <h2 className="font-black text-sm text-slate-900 tracking-tight">سنجوب لتكنولوجيا التوصيل الذكي 2026</h2>
              <span className="text-[10px] text-slate-600 font-bold">فاتورة طلب مجمع متعدد المتاجر</span>
              <span className="text-[9px] text-slate-500 font-mono mt-0.5">
                س.ت: 104829 · ب.ض: 492-810-721
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              {/* Official Sangoub platform endorsement badge */}
              <div className="flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-950 text-[9px] font-bold mb-2 w-fit mx-auto">
                <img
                  src="/brand/sangoub-logo-128x128.png"
                  alt="سنجوب"
                  className="w-3.5 h-3.5 object-contain"
                />
                <span>سنجوب لتكنولوجيا التوصيل الذكي 2026 · شريك رسمي</span>
              </div>

              {currentStore?.imageUrl ? (
                <img
                  src={currentStore.imageUrl}
                  alt={currentStore.name || 'متجر'}
                  className="w-14 h-14 rounded-full object-cover border border-slate-300 mb-1.5 shadow-2xs"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mb-1 font-bold">
                  <StoreIcon size={22} />
                </div>
              )}
              <h2 className="font-black text-sm text-slate-900 tracking-tight">{currentStore?.name || 'متجر معتمد'}</h2>
              <p className="text-[10px] text-slate-600 mt-0.5">
                {currentStore?.locationInDistrict || 'المنصة الرئيسية - سنجوب'}
              </p>
              <span className="text-[9px] text-slate-500 font-bold block mt-0.5">
                س.ت: 104829 · ب.ض: 492-810-721
              </span>
            </div>
          )}
        </div>

        {/* Receipt Order Metadata */}
        <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-slate-600">رقم الفاتورة:</span>
            <strong className="font-mono text-slate-950 font-bold">
              #POS-{order.orderNumber || order.id.slice(-6).toUpperCase()}
            </strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">التاريخ والوقت:</span>
            <span className="text-slate-900 font-mono">
              {new Date(order.createdAt || Date.now()).toLocaleDateString('ar-EG')} - {new Date(order.createdAt || Date.now()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">العميل:</span>
            <strong className="text-slate-900 font-bold">{order.profileName || 'عميل معتمد'}</strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">الهاتف:</span>
            <span className="font-mono text-slate-900">{order.phone || '01XXXXXXXXX'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">طريقة السداد:</span>
            <strong className="font-bold text-slate-900">
              {order.paymentMethod === 'cash'
                ? 'نقدًا عند الاستلام (كاش)'
                : (order.paymentMethod === 'card' || order.paymentMethod === 'geidea')
                  ? 'بطاقة بنكية (فيزا / ماستركارد / ميزة) - جيديا'
                  : order.paymentMethod === 'vodafone_cash'
                    ? 'محفظة إلكترونية (فودافون كاش)'
                    : order.paymentMethod === 'instapay'
                      ? 'تحويل إنستاباي'
                      : 'دفع إلكتروني معتمد'}
            </strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">حالة السداد:</span>
            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${order.paymentStatus === 'paid'
                ? 'bg-emerald-100 text-emerald-900'
                : order.paymentMethod === 'cash'
                  ? 'bg-amber-100 text-amber-900'
                  : (order as any).receiptUrl
                    ? 'bg-blue-100 text-blue-900'
                    : 'bg-rose-100 text-rose-900'
              }`}>
              {order.paymentStatus === 'paid'
                ? 'تم استلام المبلغ ومعتمد بنكياً (خالص السداد ✓)'
                : order.paymentMethod === 'cash'
                  ? 'معلق للتسديد كاش عند الاستلام'
                  : (order as any).receiptUrl
                    ? 'إيصال التحويل مرفوع (قيد المراجعة ⏳)'
                    : 'بانتظار التحويل ورفع الإيصال ⚠️'}
            </span>
          </div>
        </div>

        {/* Delivery Destination Notice (Government vs Residential) */}
        <div className="py-2 border-b border-dashed border-slate-400 bg-slate-50/70 p-2 rounded-md my-1 text-[10px]">
          <div className="flex items-start gap-1 text-slate-700">
            <MapPin size={12} className="text-orange-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900">
                {order.ministry || (order as any).address || (order as any).destination || 'الحي الحكومي - مبنى الخدمات'}
              </strong>
              {isGovMinistry ? (
                <span className="text-emerald-800 font-bold block mt-0.5">
                  الدور {order.floorNumber || 'الأرضي'} · مكتب {order.roomNumber || 'الاستقبال'} · (التسليم على بوابة الوزارة الرئيسية)
                </span>
              ) : (
                <span className="text-slate-600 block mt-0.5">
                  العمارة {(order as any).buildingNumber || '1'} · الدور {order.floorNumber || '1'} · شقة {(order as any).apartmentNumber || '1'} (التسليم لباب الشقة)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Itemized Table (Monospace POS Columns) */}
        <div className="py-2.5 border-b border-dashed border-slate-400">
          <div className="flex justify-between text-[11px] font-bold text-slate-800 pb-1.5 border-b border-slate-300">
            <span className="w-1/2 text-right">الصنف</span>
            <span className="w-1/6 text-center">الكمية</span>
            <span className="w-1/6 text-left">السعر</span>
            <span className="w-1/6 text-left">الإجمالي</span>
          </div>

          <div className="divide-y divide-dotted divide-slate-200 py-1 space-y-1.5">
            {displayItems.map((item, idx) => {
              const unitPrice = item.product.price + (item.extraPrice || 0);
              const lineTotal = unitPrice * item.quantity;
              return (
                <div key={item.id || idx} className="pt-1.5 text-[11px]">
                  <div className="flex justify-between items-start">
                    <span className="w-1/2 text-right font-bold text-slate-900 leading-tight">
                      {item.product.name}
                    </span>
                    <span className="w-1/6 text-center font-mono font-bold">{item.quantity}</span>
                    <span className="w-1/6 text-left font-mono">{formatEGP(unitPrice)}</span>
                    <span className="w-1/6 text-left font-mono font-bold">{formatEGP(lineTotal)}</span>
                  </div>
                  {/* Selected Options/Addons */}
                  {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                    <div className="text-[9px] text-slate-500 pr-1 mt-0.5">
                      {Object.entries(item.selectedOptions).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-1">
          <div className="flex justify-between items-center text-slate-700">
            <span>إجمالي الأصناف:</span>
            <span className="font-mono font-bold text-slate-900">{formatEGP(itemsSubtotal)}</span>
          </div>

          <div className="flex justify-between items-center text-slate-700">
            <span>رسوم التوصيل والخدمة:</span>
            <span className="font-mono text-slate-900">{formatEGP(deliveryShare)}</span>
          </div>

          {discountShare > 0 && (
            <div className="flex justify-between items-center text-rose-700 font-bold">
              <span>الخصم والعروض الترويجية:</span>
              <span className="font-mono">- {formatEGP(discountShare)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-slate-500 text-[10px]">
            <span>ضريبة القيمة المضافة:</span>
            <span>شاملة 14%</span>
          </div>
        </div>

        {/* Final Amount Due Box */}
        <div className="my-3 p-2.5 bg-slate-900 text-white rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-300 block">الصافي المستحق النهائي:</span>
            <strong className="text-base font-black font-mono tracking-tight block">
              {formatEGP(receiptTotal)}
            </strong>
          </div>
          <div className="text-left">
            <span className="text-[9px] text-slate-400 block">جنيه مصري</span>
            <span className="text-[10px] font-bold text-emerald-400">سعر نهائي شامل</span>
          </div>
        </div>

        {/* Arabic Tafqeet (Written in words) */}
        <div className="text-center p-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-800 mb-3">
          {tafqeetEGP(receiptTotal)}
        </div>

        {/* Electronic Verification QR Code & Barcode */}
        <div className="text-center pt-2 flex flex-col items-center justify-center">
          {/* Simulated Authentic POS Barcode */}
          <div className="w-full flex items-center justify-center gap-0.5 h-7 mb-1.5 px-4 overflow-hidden opacity-80">
            {[4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 1, 4, 3, 1, 2, 3, 1, 4, 2, 1, 3, 2].map((w, i) => (
              <span
                key={i}
                className="bg-slate-900 h-full inline-block"
                style={{ width: `${w * 1.5}px` }}
              />
            ))}
          </div>
          <span className="font-mono text-[9px] text-slate-600 tracking-widest block mb-2">
            * {order.id.slice(0, 16).toUpperCase()} *
          </span>

          <div className="flex items-center justify-center gap-1.5 my-1.5">
            <img
              src="/brand/sangoub-logo-128x128.png"
              alt="سنجوب"
              className="w-5 h-5 object-contain opacity-95"
            />
            <span className="font-black text-[11px] text-slate-900 tracking-tight">سنجوب Sangoub</span>
          </div>

          <p className="text-[10px] text-slate-700 font-bold">سنجوب لتكنولوجيا التوصيل الذكي 2026 - نسعد بخدمتكم دائماً</p>
          <span className="text-[8px] text-slate-500 block mt-0.5">
            إيصال طلب إلكتروني فوري معتمد لدى كافة المتاجر والشركاء
          </span>
        </div>

        {/* Receipt Paper Bottom Zig-Zag / Cut Effect */}
        <div className="receipt-cut-edge mt-3 pt-2 text-center text-slate-300 tracking-widest text-[9px]">
          - - - - - - - - - - - - - - - - - - - - - -
        </div>
      </article>

      {/* Global Print Styles for POS 80mm and PDF Export (Strictly 1 Page) */}
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
          }
          body * {
            visibility: hidden !important;
          }
          #sangoub-pos-thermal-paper,
          #sangoub-pos-thermal-paper * {
            visibility: visible !important;
          }
          #sangoub-pos-thermal-paper {
            position: fixed !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            max-width: 78mm !important;
            min-width: 78mm !important;
            margin: 0 auto !important;
            padding: 3mm 2mm !important;
            border: none !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
