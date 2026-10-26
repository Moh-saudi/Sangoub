import React from 'react';
import type { Product } from '../../types';
import { useStore } from '../context/StoreContext';
import { BRAND } from '../../brand';
import { formatEGP } from '../../utils/orderCalculations';
import { Plus, Check, Tag } from 'lucide-react';

interface SangoubOfferCardProps {
  product: Product;
}

export const SangoubOfferCard: React.FC<SangoubOfferCardProps> = ({ product }) => {
  const { cartItems, addToCart, navigate } = useStore();
  const cartItem = cartItems.find((item) => item.product.id === product.id);
  const isInCart = Boolean(cartItem && cartItem.quantity > 0);

  const discountPercent = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null;

  const handleCardClick = () => {
    navigate(`/products/${product.id}`);
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
  };

  return (
    <div 
      onClick={handleCardClick}
      className="sg-offer-card featured group cursor-pointer"
      dir="rtl"
    >
      {/* Small Winking Sangoub Mascot in Top-Left Corner (Spec 4.4) */}
      <img
        src={BRAND.mascot.wink}
        alt="سنجوب العروض"
        className="sg-offer-mascot"
        loading="lazy"
      />

      {/* Top Tag & Store Name */}
      <div className="flex items-center justify-between pl-14 mb-2">
        <span className="inline-flex items-center gap-1 bg-[#FF5900] text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
          <Tag size={12} />
          {discountPercent ? `وفر ${discountPercent}%` : 'عرض سنجوب الخاص'}
        </span>
        <span className="text-xs font-semibold text-[#6B7280] truncate max-w-[130px]">
          {product.storeName}
        </span>
      </div>

      {/* Main Image Box */}
      <div className="w-full aspect-[4/3] bg-white rounded-xl overflow-hidden mb-3 p-3 flex items-center justify-center border border-[#E7E9EE] relative">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="text-center text-[#6B7280]">
            <span className="text-4xl block mb-1">🎁</span>
            <span className="text-xs font-bold">عرض خاص</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-extrabold text-[#2D3142] text-base line-clamp-1 mb-1">
            {product.name}
          </h3>
          <p className="text-xs text-[#6B7280] line-clamp-2 leading-relaxed mb-3">
            {product.description || 'عرض حصري لفترة محدودة عبر متجر سنجوب بالعاصمة'}
          </p>
        </div>

        {/* Pricing and Action */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E7E9EE]/80">
          <div className="flex items-baseline gap-2">
            <span className="font-black text-xl text-[#FF5900]">
              {formatEGP(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-xs text-[#6B7280] line-through">
                {formatEGP(product.originalPrice)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddClick}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
              isInCart
                ? 'bg-[#10B981] text-white'
                : 'bg-[#FF5900] hover:bg-[#e04e00] text-white active:scale-95'
            }`}
          >
            {isInCart ? (
              <>
                <Check size={14} />
                <span>بالسلة ({cartItem?.quantity})</span>
              </>
            ) : (
              <>
                <Plus size={14} />
                <span>اقتنص العرض</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
