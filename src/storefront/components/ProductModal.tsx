import React, { useState, useMemo } from 'react';
import type { Product } from '../../types';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../../utils/orderCalculations';
import { getProductSpecifications } from '../../utils/productSpecifications';
import { getStoreLogo, getStoreSlug, getProductSlug } from '../../utils/storeAssets';
import {
  X,
  Plus,
  Minus,
  ShoppingBag,
  Check,
  Heart,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Tag,
  Layers,
  Package,
} from 'lucide-react';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSelectProduct?: (product: Product) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onSelectProduct,
}) => {
  const {
    products,
    stores,
    addToCart,
    toggleWishlist,
    isWishlisted,
    isProductOrderedBefore,
    navigate,
  } = useStore();

  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Specifications and extracted metadata
  const specs = useMemo(() => {
    return product ? getProductSpecifications(product) : null;
  }, [product]);

  // Find store of this product
  const store = useMemo(() => {
    if (!product || !stores) return null;
    return stores.find(
      (s) => s.id === product.storeId || s.name === product.storeName
    );
  }, [product, stores]);

  const storeLogo = store ? getStoreLogo(store) : '/brand/sangoub-mark-white-128.png';

  // Check if previously ordered
  const orderedBefore = useMemo(() => {
    return product ? isProductOrderedBefore(product.id, product.name) : false;
  }, [product, isProductOrderedBefore]);

  // Similar Products from same category or store
  const similarProducts = useMemo(() => {
    if (!product || !products) return [];
    return products
      .filter(
        (p) =>
          p.id !== product.id &&
          (p.category === product.category || p.storeId === product.storeId)
      )
      .slice(0, 8);
  }, [product, products]);

  // Reset when product changes
  React.useEffect(() => {
    if (product) {
      setQuantity(1);
      setSpecialInstructions('');
      setAddedSuccess(false);
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

  // Calculate live total price with selected option price modifiers
  const totalPrice = useMemo(() => {
    if (!product) return 0;
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

  if (!product || !specs) return null;

  const wishlisted = isWishlisted(product.id);

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
    }, 700);
  };

  const handleOpenFullPage = () => {
    onClose();
    navigate(`/products/${getProductSlug(product)}`);
  };

  const handleSwitchToSimilar = (sim: Product) => {
    if (onSelectProduct) {
      onSelectProduct(sim);
    } else {
      onClose();
      navigate(`/products/${getProductSlug(sim)}`);
    }
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
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250 font-cairo">
        
        {/* Floating Close & Wishlist & Full Page Buttons */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleOpenFullPage}
            className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md shadow-xs flex items-center justify-center text-gray-700 hover:text-[#FF5900] transition"
            title="فتح صفحة الصنف المستقلة"
            aria-label="فتح صفحة الصنف المستقلة"
          >
            <ExternalLink size={14} />
          </button>
          <button
            type="button"
            onClick={() => toggleWishlist(product.id)}
            className={`w-8 h-8 rounded-full bg-white/95 backdrop-blur-md shadow-xs flex items-center justify-center transition ${
              wishlisted ? 'text-[#FF5900]' : 'text-gray-500 hover:text-gray-800'
            }`}
            aria-label={wishlisted ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
          >
            <Heart size={14} fill={wishlisted ? '#FF5900' : 'none'} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
            aria-label="إغلاق"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {/* 1. Product Image Banner */}
          <div className="relative w-full aspect-16/10 bg-[#F8F9FA] flex items-center justify-center overflow-hidden border-b border-gray-100">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-contain p-4"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400">
                <ShoppingBag size={48} className="opacity-40 mb-2" />
                <span className="text-xs font-bold">سنجوب</span>
              </div>
            )}

            {/* Badges on Top Right */}
            <div className="absolute top-3 right-3 flex flex-col gap-1 items-end z-10">
              {orderedBefore && (
                <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  <span>طلبته سابقاً ✓</span>
                </span>
              )}
              {product.badge && (
                <span className="bg-[#FF5900] text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-xs">
                  {product.badge}
                </span>
              )}
            </div>
          </div>

          {/* 2. Details Body */}
          <div className="p-4 sm:p-5 space-y-4">
            
            {/* Store & Category Header with Store Logo */}
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              <button
                type="button"
                onClick={() => {
                  if (store) {
                    onClose();
                    navigate(`/stores/${getStoreSlug(store)}`);
                  }
                }}
                className="font-bold text-[#FF5900] bg-[#FFF2EC] hover:bg-[#FFE5D8] px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              >
                <img
                  src={storeLogo}
                  alt={product.storeName}
                  className="w-4 h-4 rounded-md object-contain bg-white"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
                  }}
                />
                <span>{product.storeName || 'متجر سنجوب'}</span>
              </button>

              <div className="flex items-center gap-1.5 text-gray-500 font-bold">
                <span className="bg-gray-100 px-2 py-0.5 rounded-md text-[11px]">{specs.categoryName}</span>
                {specs.netWeightOrVolume && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px] font-black">
                      {specs.netWeightOrVolume}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <h2 id="product-modal-title" className="text-lg sm:text-xl font-black text-gray-900 leading-snug">
                {product.name}
              </h2>
              {product.nameEn && (
                <p className="text-xs text-gray-400 font-medium mt-0.5" dir="ltr">
                  {product.nameEn}
                </p>
              )}
            </div>

            {/* Price & Savings Row */}
            <div className="flex items-baseline justify-between bg-amber-50/60 border border-amber-200/60 rounded-xl p-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#FF5900]">
                  {formatEGP(product.price)}
                </span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-sm text-gray-400 line-through font-bold">
                    {formatEGP(product.originalPrice)}
                  </span>
                )}
              </div>

              {product.originalPrice && product.originalPrice > product.price && (
                <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-md shadow-2xs">
                  وفر {formatEGP(product.originalPrice - product.price)} ({Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%)
                </span>
              )}
            </div>

            {/* Description from Control Panel */}
            {product.description && (
              <div className="space-y-1">
                <h3 className="text-xs font-black text-gray-900 flex items-center gap-1">
                  <Layers size={13} className="text-[#FF5900]" />
                  <span>تفاصيل الصنف:</span>
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {product.description}
                </p>
              </div>
            )}

            {/* Clean Specifications Grid (No SKU or Barcode) */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-black text-gray-900 flex items-center gap-1">
                <Tag size={13} className="text-[#FF5900]" />
                <span>المواصفات والبيانات المسجلة:</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {specs.customAttributes.map((attr, idx) => (
                  <div key={idx} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[10px] text-gray-400 block font-bold">{attr.label}</span>
                    <span className="font-black text-gray-900 mt-0.5 block">{attr.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Option Groups (Modifiers, Sizes, Addons) */}
            {product.optionGroups && product.optionGroups.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-gray-900">
                  <Sparkles size={14} className="text-[#FF5900]" />
                  <span>تخصيص طلبك:</span>
                </div>

                {product.optionGroups.map((group) => (
                  <div key={group.title} className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-gray-900">{group.title}</span>
                      <span className="text-[10px] text-gray-500 font-bold">
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
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#FF5900] text-white shadow-xs'
                                : 'bg-white text-gray-700 border border-gray-200 hover:border-[#FF5900]'
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
              <label htmlFor="modal-note" className="block text-xs font-bold text-gray-900 mb-1">
                ملاحظات خاصة للطلب (اختياري)
              </label>
              <input
                id="modal-note"
                type="text"
                placeholder="اكتب ملاحظاتك هنا..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#FF5900] text-gray-900"
              />
            </div>

            {/* 3. SIMILAR PRODUCTS SECTION */}
            {similarProducts.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black text-gray-900 flex items-center gap-1">
                    <Package size={14} className="text-[#FF5900]" />
                    <span>منتجات مشابهة قد تحتاجها:</span>
                  </h3>
                  <span className="text-[10px] text-gray-400 font-bold">
                    من نفس القسم
                  </span>
                </div>

                <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-1 px-1">
                  {similarProducts.map((sim) => {
                    const simOrdered = isProductOrderedBefore(sim.id, sim.name);
                    return (
                      <div
                        key={sim.id}
                        onClick={() => handleSwitchToSimilar(sim)}
                        className="w-[125px] sm:w-[135px] shrink-0 bg-white border border-gray-200 hover:border-[#FF5900] rounded-xl p-2 flex flex-col justify-between shadow-2xs hover:shadow-xs transition cursor-pointer select-none relative group"
                      >
                        {simOrdered && (
                          <span className="absolute top-1 right-1 z-10 bg-emerald-600 text-white text-[7.5px] font-black px-1 py-0.5 rounded shadow-2xs">
                            طلبته سابقاً
                          </span>
                        )}
                        <div className="w-full aspect-square rounded-lg bg-gray-50 overflow-hidden mb-1.5 flex items-center justify-center">
                          {sim.imageUrl ? (
                            <img
                              src={sim.imageUrl}
                              alt={sim.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <ShoppingBag size={20} className="text-gray-300" />
                          )}
                        </div>
                        <h4 className="text-[11px] font-black text-gray-900 truncate leading-tight mb-1" title={sim.name}>
                          {sim.name}
                        </h4>
                        <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-50">
                          <span className="text-xs font-black text-[#FF5900]">
                            {formatEGP(sim.price)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(sim, 1);
                            }}
                            className="w-6 h-6 rounded-lg bg-[#FFF2EC] text-[#FF5900] hover:bg-[#FF5900] hover:text-white flex items-center justify-center transition active:scale-95"
                            title="إضافة للسلة"
                          >
                            <Plus size={13} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Direct Link to Full Product Page Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleOpenFullPage}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>عرض صفحة الصنف المستقلة ومشاركة الرابط</span>
                <ExternalLink size={12} />
              </button>
            </div>

          </div>
        </div>

        {/* Sticky Bottom Actions Bar */}
        <div className="p-2.5 sm:p-4 bg-white border-t border-gray-200 flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quantity Selector */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 border border-gray-200 rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white border border-gray-200 text-gray-800 flex items-center justify-center font-black hover:bg-[#FFF2EC] hover:text-[#FF5900] transition active:scale-95 cursor-pointer"
              aria-label="تقليل الكمية"
            >
              <Minus size={13} />
            </button>
            <span className="w-6 sm:w-8 text-center text-xs font-black text-gray-900 select-none">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white border border-gray-200 text-gray-800 flex items-center justify-center font-black hover:bg-[#FFF2EC] hover:text-[#FF5900] transition active:scale-95 cursor-pointer"
              aria-label="زيادة الكمية"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            onClick={handleAddToCart}
            className={`flex-1 h-11 sm:h-12 px-3 sm:px-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm flex items-center justify-between text-white transition-all shadow-md active:scale-98 cursor-pointer overflow-hidden ${
              addedSuccess ? 'bg-emerald-600' : 'bg-[#FF5900] hover:bg-[#E04E00]'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {addedSuccess ? (
                <>
                  <Check size={16} strokeWidth={2.5} className="shrink-0" />
                  <span className="whitespace-nowrap font-black">تمت الإضافة!</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={16} className="shrink-0" />
                  <span className="whitespace-nowrap font-black">أضف للسلة</span>
                </>
              )}
            </div>
            <span className="font-black text-xs sm:text-sm bg-black/20 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg shrink-0 whitespace-nowrap">
              {formatEGP(totalPrice)}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
