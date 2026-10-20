import React, { useState } from 'react';
import { X, Plus, Minus, ShoppingBag, Check } from 'lucide-react';
import type { Product } from '../types/index.ts';
import { SmartImage } from './SmartImage.tsx';
import { formatEGP } from '../utils/orderCalculations.ts';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCartWithOptions: (
    product: Product,
    quantity: number,
    selectedOptions: Record<string, string>,
    extraPrice: number,
    notes: string
  ) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCartWithOptions,
}) => {
  if (!product) return null;

  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (product.optionGroups) {
      product.optionGroups.forEach((grp) => {
        if (grp.options.length > 0) {
          initial[grp.title] = grp.options[0].name;
        }
      });
    }
    return initial;
  });
  const [notes, setNotes] = useState('');

  // Calculate extra price
  let totalExtraPrice = 0;
  if (product.optionGroups) {
    product.optionGroups.forEach((grp) => {
      const chosenName = selectedOptions[grp.title];
      const match = grp.options.find((o) => o.name === chosenName);
      if (match) {
        totalExtraPrice += match.price;
      }
    });
  }

  const finalUnitPrice = product.price + totalExtraPrice;
  const totalPrice = finalUnitPrice * quantity;

  const handleOptionSelect = (groupTitle: string, optionName: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupTitle]: optionName,
    }));
  };

  const handleConfirm = () => {
    onAddToCartWithOptions(product, quantity, selectedOptions, totalExtraPrice, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with real photo */}
        <div className="relative w-full h-48 sm:h-56 bg-slate-100 overflow-hidden shrink-0">
          <SmartImage
            src={product.imageUrl}
            alt={product.name}
            fallbackType={product.imageType}
            className="w-full h-full object-cover"
            aspectRatio="h-full"
          />
          <button
            onClick={onClose}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 right-4 bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
            {product.storeName}
          </div>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-slate-900">{product.name}</h3>
              <span className="text-lg font-extrabold text-orange-600 tabular-nums">
                {formatEGP(finalUnitPrice)}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Option groups */}
          {product.optionGroups && product.optionGroups.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {product.optionGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900">{group.title}</label>
                    <span className="text-[11px] text-slate-400">
                      {group.required ? 'إجباري' : 'اختياري'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.options.map((opt) => {
                      const isSelected = selectedOptions[group.title] === opt.name;
                      return (
                        <button
                          key={opt.name}
                          type="button"
                          onClick={() => handleOptionSelect(group.title, opt.name)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-right transition-all ${
                            isSelected
                              ? 'bg-orange-50 border-orange-500 text-orange-950 font-semibold'
                              : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-orange-600 bg-orange-600 text-white' : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <span className="text-xs">{opt.name}</span>
                          </div>
                          {opt.price > 0 && (
                            <span className="text-xs text-orange-800 font-bold tabular-nums">
                              +{formatEGP(opt.price)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes for restaurant */}
          <div className="pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-900 block mb-1.5">
              ملاحظات خاصة للمطعم أو التوصيل
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: بدون بصل، زيادة طحينة، وضع العيش منفصلاً..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            />
          </div>
        </div>

        {/* Footer with quantity and add to cart */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          {/* Quantity stepper */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-sm"
              aria-label="تقليل الكمية"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-900 min-w-[24px] text-center tabular-nums">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-lg bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center font-bold text-sm"
              aria-label="زيادة الكمية"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Submit button */}
          <button
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>إضافة للسلة ({formatEGP(totalPrice)})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
