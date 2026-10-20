import React from 'react';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import type { CartItem } from '../types/index.ts';
import { calculateCartSubtotal, formatEGP } from '../utils/orderCalculations.ts';

interface FloatingCartBarProps {
  items: CartItem[];
  onOpenCart: () => void;
  isSimulator?: boolean;
}

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({
  items,
  onOpenCart,
  isSimulator = false,
}) => {
  if (items.length === 0) return null;

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = calculateCartSubtotal(items);

  return (
    <div
      className={
        isSimulator
          ? 'sticky bottom-16 z-30 px-3 w-full pointer-events-none animate-in slide-in-from-bottom-4 duration-300'
          : 'fixed bottom-16 sm:bottom-6 left-0 right-0 z-30 px-4 pointer-events-none animate-in slide-in-from-bottom-4 duration-300'
      }
    >
      <div className="max-w-xl mx-auto pointer-events-auto">
        <button
          onClick={onOpenCart}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-2xl p-3 sm:p-3.5 shadow-xl shadow-orange-600/25 flex items-center justify-between gap-3 border border-orange-500 active:scale-[0.99] transition-all group cursor-pointer"
        >
          {/* Right side: Count & Icon */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white relative shadow-inner">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-orange-700 text-[11px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                {totalCount}
              </span>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold text-white transition-colors">
                عرض سلة مشتريات الحي الحكومي
              </div>
              <div className="text-[11px] text-orange-100">
                {totalCount} {totalCount === 1 ? 'وجبة' : 'وجبات ومنتجات'} جاهزة للطلب
              </div>
            </div>
          </div>

          {/* Left side: Total and Proceed button */}
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-extrabold text-white tabular-nums">
              {formatEGP(subtotal)}
            </span>
            <div className="flex items-center gap-1 bg-white text-orange-700 px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow-xs transition-colors">
              <span>إتمام الطلب</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
