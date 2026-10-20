import React from 'react';
import { Plus, Minus, Check } from 'lucide-react';
import type { Product } from '../types/index.ts';
import { SmartImage } from './SmartImage.tsx';
import { formatEGP } from '../utils/orderCalculations.ts';

interface ProductCardProps {
  product: Product;
  quantityInCart: number;
  onAddToCart: (product: Product) => void;
  onIncrement: (product: Product) => void;
  onDecrement: (product: Product) => void;
  onOpenDetails: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantityInCart,
  onAddToCart,
  onIncrement,
  onDecrement,
  onOpenDetails,
}) => {
  const hasOptions = Boolean(product.optionGroups && product.optionGroups.length > 0);

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasOptions) {
      onOpenDetails(product);
    } else {
      if (quantityInCart === 0) {
        onAddToCart(product);
      } else {
        onIncrement(product);
      }
    }
  };

  return (
    <div
      onClick={() => onOpenDetails(product)}
      className="bg-white rounded-2xl border border-slate-200/90 p-3 flex flex-col justify-between hover:border-orange-300 hover:shadow-md transition-all duration-200 group cursor-pointer relative"
    >
      {/* Top Real Food Photo / SmartImage */}
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 mb-2.5">
        <SmartImage
          src={product.imageUrl}
          alt={product.name}
          fallbackType={product.imageType}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Badge */}
        {product.badge && (
          <div className="absolute top-2 right-2 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
            {product.badge}
          </div>
        )}

        {/* Store attribution */}
        <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-xs truncate max-w-[85%]">
          {product.storeName}
        </div>
      </div>

      {/* Info Body */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-700 transition-colors">
            {product.name}
          </h4>
          <p className="text-[11px] text-slate-500 line-clamp-2 my-1 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Price and Cart Button Bar */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
          <div className="flex flex-col">
            <span className="text-sm font-extrabold text-slate-900 tabular-nums">
              {formatEGP(product.price)}
            </span>
            {product.originalPrice && (
              <span className="text-[10px] text-slate-400 line-through tabular-nums">
                {formatEGP(product.originalPrice)}
              </span>
            )}
          </div>

          {/* Action Trigger */}
          {quantityInCart > 0 && !hasOptions ? (
            <div
              className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl p-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onDecrement(product)}
                className="w-7 h-7 rounded-lg bg-white text-orange-800 hover:bg-orange-600 hover:text-white flex items-center justify-center transition-colors shadow-2xs font-bold"
                aria-label={`تقليل كمية ${product.name}`}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold text-orange-900 min-w-[18px] text-center tabular-nums">
                {quantityInCart}
              </span>
              <button
                onClick={() => onIncrement(product)}
                className="w-7 h-7 rounded-lg bg-orange-600 text-white hover:bg-orange-700 flex items-center justify-center transition-colors shadow-2xs font-bold"
                aria-label={`زيادة كمية ${product.name}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleActionClick}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs"
              aria-label={`إضافة ${product.name} إلى السلة`}
            >
              {quantityInCart > 0 && hasOptions ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>تعديل ({quantityInCart})</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>أضف</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
