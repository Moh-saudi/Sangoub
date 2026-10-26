import React from 'react';
import type { Product } from '../../types';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../../utils/orderCalculations';
import { Plus, Minus, Heart, ShoppingBag, Clock, Star } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onOpenModal?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenModal }) => {
  const { cartItems, addToCart, updateQuantity, toggleWishlist, isWishlisted, navigate } = useStore();

  const cartItem = cartItems.find((item) => item.product.id === product.id);
  const quantity = cartItem ? cartItem.quantity : 0;
  const wishlisted = isWishlisted(product.id);

  const handleCardClick = () => {
    if (onOpenModal) {
      onOpenModal(product);
    } else {
      navigate(`/products/${product.id}`);
    }
  };

  const handleFavClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.optionGroups && product.optionGroups.length > 0) {
      if (onOpenModal) {
        onOpenModal(product);
      } else {
        navigate(`/products/${product.id}`);
      }
    } else {
      addToCart(product, 1);
    }
  };

  const handlePlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cartItem) {
      updateQuantity(cartItem.id, 1);
    } else {
      addToCart(product, 1);
    }
  };

  const handleMinus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cartItem) {
      updateQuantity(cartItem.id, -1);
    }
  };

  return (
    <article 
      onClick={handleCardClick}
      className="bg-white border border-[#E5E7EB] hover:border-[#FF5900]/40 rounded-2xl p-2 sm:p-3 flex flex-col justify-between shadow-2xs hover:shadow-md transition-all cursor-pointer group relative select-none" 
      aria-label={product.name}
    >
      {/* Wishlist Button */}
      <button
        type="button"
        onClick={handleFavClick}
        className={`absolute top-3 left-3 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
          wishlisted
            ? 'bg-white text-[#FF5900] shadow-xs'
            : 'bg-white/80 backdrop-blur-xs text-[#9CA3AF] hover:text-[#FF5900] hover:bg-white'
        }`}
        aria-label={wishlisted ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
      >
        <Heart size={14} fill={wishlisted ? '#FF5900' : 'none'} />
      </button>

      {/* Product Image Box (1:1 Ratio) */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#F9FAFB] mb-2">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/sangoub/sangoub-favicon.png';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#9CA3AF]">
            <ShoppingBag size={26} className="opacity-40 mb-1" />
            <span className="text-[10px] font-bold">سنجوب</span>
          </div>
        )}

        {/* Badge (Offers / Most Popular) */}
        {product.badge && (
          <span className="absolute top-2 right-2 bg-[#FF5900] text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow-xs">
            {product.badge}
          </span>
        )}
      </div>

      {/* Product Details */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Store Name */}
          <p className="text-[10px] font-bold text-[#6B7280] truncate mb-0.5" title={product.storeName}>
            {product.storeName || 'سنجوب'}
          </p>

          {/* Product Name */}
          <h3 className="text-xs sm:text-sm font-black text-[#111827] group-hover:text-[#FF5900] transition-colors line-clamp-2 min-h-[30px] leading-tight mb-1" title={product.name}>
            {product.name}
          </h3>

          {/* Delivery speed / Prep pill */}
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 w-fit px-1.5 py-0.5 rounded mb-1.5">
            <Clock size={10} />
            <span>15-25 دقيقة</span>
          </div>
        </div>

        {/* Price & Action Row */}
        <div className="flex items-center justify-between pt-1.5 border-t border-[#F3F4F6] mt-auto">
          <div className="flex flex-col leading-tight">
            <span className="text-xs sm:text-sm font-black text-[#FF5900]">
              {formatEGP(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-[10px] text-[#9CA3AF] line-through">
                {formatEGP(product.originalPrice)}
              </span>
            )}
          </div>

          {quantity > 0 ? (
            <div 
              className="flex items-center gap-1 bg-[#FFF2EC] border border-[#FFD4C2] rounded-xl px-1.5 py-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                type="button" 
                onClick={handleMinus} 
                className="w-5 h-5 rounded-lg bg-white text-[#FF5900] flex items-center justify-center active:scale-95 shadow-2xs font-black cursor-pointer"
                aria-label="تقليل الكمية"
              >
                <Minus size={11} strokeWidth={3} />
              </button>
              <span className="text-xs font-black text-[#FF5900] px-1">{quantity}</span>
              <button 
                type="button" 
                onClick={handlePlus} 
                className="w-5 h-5 rounded-lg bg-[#FF5900] text-white flex items-center justify-center active:scale-95 shadow-2xs font-black cursor-pointer"
                aria-label="زيادة الكمية"
              >
                <Plus size={11} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddClick}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full sm:rounded-xl bg-[#FFF2EC] hover:bg-[#FF5900] text-[#FF5900] hover:text-white transition-all flex items-center justify-center shadow-2xs active:scale-95 cursor-pointer font-black"
              aria-label={`إضافة ${product.name} إلى السلة`}
              title="إضافة إلى السلة"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
