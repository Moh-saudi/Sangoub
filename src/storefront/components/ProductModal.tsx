import React, { useState, useMemo } from 'react';
import type { Product } from '../../types';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../../utils/orderCalculations';
import { X, Plus, Minus, ShoppingBag, Check, Heart, Sparkles } from 'lucide-react';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Reset when product changes
  React.useEffect(() => {
    if (product) {
      setQuantity(1);
      setSpecialInstructions('');
      setAddedSuccess(false);
      // Auto-select first option in each group if available
      const initial: Record<string, string> = {};
      if (product.optionGroups && product.optionGroups.length > 0) {
        product.optionGroups.forEach((group) => {
          if (group.options && group.options.length > 0) {
            initial[group.title] = group.options[0].name;
          }
        });
      }
      setSelectedOptions(initial);
    }
  }, [product]);

  if (!product) return null;

  const wishlisted = isWishlisted(product.id);

  // Calculate live total price with selected option price modifiers
  const totalPrice = useMemo(() => {
    let base = product.price;
    if (product.optionGroups) {
      product.optionGroups.forEach((group) => {
        const selectedName = selectedOptions[group.title];
        if (selectedName) {
          const found = group.options?.find((o) => o.name === selectedName);
          if (found) {
            const add = found.price || (found as any).priceModifier || 0;
            base += add;
          }
        }
      });
    }
    return base * quantity;
  }, [product, selectedOptions, quantity]);

  const handleSelectOption = (groupTitle: string, optionName: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupTitle]: optionName,
    }));
  };

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedOptions, 0);
    setAddedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal / Sheet Container */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[92dvh] sm:max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        
        {/* Floating Close & Wishlist Buttons */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleWishlist(product.id)}
            className={`w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-md flex items-center justify-center transition-colors ${
              wishlisted ? 'text-[#FF5900]' : 'text-[#6B7280] hover:text-[#2D3142]'
            }`}
            aria-label={wishlisted ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
          >
            <Heart size={16} fill={wishlisted ? '#FF5900' : 'none'} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          {/* Product Image Banner */}
          <div className="relative w-full aspect-16/10 bg-[#F7F8FA] flex items-center justify-center overflow-hidden">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-contain p-4"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/assets/sangoub/sangoub-favicon.png';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-[#9CA3AF]">
                <ShoppingBag size={48} className="opacity-40 mb-2" />
                <span className="text-xs font-bold">سنجوب</span>
              </div>
            )}

            {/* Badge */}
            {product.badge && (
              <span className="absolute top-3 right-3 bg-[#FF5900] text-white text-[10px] font-black px-2.5 py-1 rounded-md shadow-xs">
                {product.badge}
              </span>
            )}
          </div>

          {/* Details Body */}
          <div className="p-4 sm:p-5">
            {/* Store & Category */}
            <div className="flex items-center justify-between text-xs text-[#6B7280] mb-1">
              <span className="font-bold text-[#FF5900] bg-[#FFF2EC] px-2 py-0.5 rounded-md">
                {product.storeName || 'متجر سنجوب'}
              </span>
              {product.category && <span>{product.category}</span>}
            </div>

            {/* Title */}
            <h2 id="product-modal-title" className="text-lg sm:text-xl font-black text-[#2D3142] mb-1">
              {product.name}
            </h2>

            {/* Description */}
            {product.description && (
              <p className="text-xs text-[#6B7280] leading-relaxed mb-4">
                {product.description}
              </p>
            )}

            {/* Price Row */}
            <div className="flex items-baseline gap-2 mb-4 pb-3 border-b border-[#E7E9EE]">
              <span className="text-xl font-black text-[#FF5900]">
                {formatEGP(product.price)}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-xs text-[#9CA3AF] line-through font-semibold">
                  {formatEGP(product.originalPrice)}
                </span>
              )}
            </div>

            {/* Option Groups (Modifiers, Sizes, Addons) */}
            {product.optionGroups && product.optionGroups.length > 0 && (
              <div className="space-y-4 mb-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#2D3142]">
                  <Sparkles size={14} className="text-[#FF5900]" />
                  <span>تخصيص طلبك:</span>
                </div>

                {product.optionGroups.map((group) => (
                  <div key={group.title} className="bg-[#F7F8FA] p-3 rounded-xl border border-[#E7E9EE]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-[#2D3142]">{group.title}</span>
                      <span className="text-[10px] text-[#6B7280]">
                        {selectedOptions[group.title] ? `تم اختيار: ${selectedOptions[group.title]}` : 'اختر واحداً'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {group.options.map((option) => {
                        const isSelected = selectedOptions[group.title] === option.name;
                        return (
                          <button
                            key={option.name}
                            type="button"
                            onClick={() => handleSelectOption(group.title, option.name)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isSelected
                                ? 'bg-[#FF5900] text-white shadow-xs'
                                : 'bg-white text-[#2D3142] border border-[#E7E9EE] hover:border-[#FF5900]'
                            }`}
                          >
                            <span>{option.name}</span>
                            {(option.price > 0 || (option as any).priceModifier > 0) && (
                              <span className={`text-[10px] ${isSelected ? 'text-white/90' : 'text-[#FF5900]'}`}>
                                (+{formatEGP(option.price || (option as any).priceModifier)})
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

            {/* Special Instructions Note */}
            <div>
              <label htmlFor="modal-note" className="block text-xs font-bold text-[#2D3142] mb-1">
                ملاحظات خاصة (اختياري)
              </label>
              <input
                id="modal-note"
                type="text"
                placeholder="مثلاً: بدون بصل، صوص إضافي، درجة التسوية..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-[#F7F8FA] border border-[#E7E9EE] rounded-xl outline-none focus:border-[#FF5900] text-[#2D3142]"
              />
            </div>
          </div>
        </div>

        {/* Sticky Bottom Actions Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-[#E7E9EE] flex items-center gap-3">
          {/* Quantity Selector */}
          <div className="flex items-center gap-1 bg-[#F7F8FA] border border-[#E7E9EE] rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-white border border-[#E7E9EE] text-[#2D3142] flex items-center justify-center font-black hover:bg-[#FFF2EC] hover:text-[#FF5900] transition-colors"
              aria-label="تقليل الكمية"
            >
              <Minus size={13} />
            </button>
            <span className="w-8 text-center text-xs font-black text-[#2D3142]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-lg bg-white border border-[#E7E9EE] text-[#2D3142] flex items-center justify-center font-black hover:bg-[#FFF2EC] hover:text-[#FF5900] transition-colors"
              aria-label="زيادة الكمية"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={addedSuccess}
            className={`flex-1 h-11 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-between transition-all shadow-md ${
              addedSuccess
                ? 'bg-[#10B981] text-white'
                : 'bg-[#FF5900] hover:bg-[#e04e00] text-white active:scale-98'
            }`}
          >
            {addedSuccess ? (
              <span className="w-full flex items-center justify-center gap-1.5 text-center">
                <Check size={16} strokeWidth={3} />
                <span>تمت الإضافة بنجاح إلى السلة!</span>
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <ShoppingBag size={15} />
                  <span>أضف إلى السلة</span>
                </span>
                <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs font-black">
                  {formatEGP(totalPrice)}
                </span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
