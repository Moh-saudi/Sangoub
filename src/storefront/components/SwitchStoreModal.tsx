import React from 'react';
import { ShoppingBag, AlertCircle, X, ArrowLeft } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function SwitchStoreModal() {
  const { pendingStoreSwitch, confirmStoreSwitch, cancelStoreSwitch } = useStore();

  if (!pendingStoreSwitch) return null;

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
      dir="rtl"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="switch-store-title"
        className="bg-white rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl shadow-xs">
            <ShoppingBag size={24} />
          </div>
          <button
            type="button"
            onClick={cancelStoreSwitch}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          <h3 id="switch-store-title" className="text-lg font-black text-slate-900">
            بدء سلة جديدة؟
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            سلتك الحالية تحتوي على منتجات من متجر{' '}
            <strong className="text-slate-900 font-black">
              "{pendingStoreSwitch.currentStoreName}"
            </strong>
            . هل تريد إفراغ السلة وبدء سلة جديدة من متجر{' '}
            <strong className="text-orange-700 font-black">
              "{pendingStoreSwitch.newStoreName}"
            </strong>
            ، أم المتابعة مع المتجر الحالي؟
          </p>
        </div>

        <div className="pt-2 space-y-2.5">
          <button
            type="button"
            onClick={confirmStoreSwitch}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all"
          >
            <span>موافق، فتح سلة جديدة من "{pendingStoreSwitch.newStoreName}"</span>
            <ArrowLeft size={16} />
          </button>

          <button
            type="button"
            onClick={cancelStoreSwitch}
            className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
          >
            إلغاء والمتابعة من "{pendingStoreSwitch.currentStoreName}"
          </button>
        </div>
      </div>
    </div>
  );
}

