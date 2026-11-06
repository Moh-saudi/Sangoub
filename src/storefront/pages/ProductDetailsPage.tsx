import React, { useState, useMemo } from 'react';
import type { Product } from '../../types';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../../utils/orderCalculations';
import { getProductSpecifications } from '../../utils/productSpecifications';
import { getStoreLogo, getStoreSlug, getProductSlug } from '../../utils/storeAssets';
import {
  ArrowRight,
  Heart,
  ShoppingBag,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Share2,
  Plus,
  Minus,
  Check,
  Sparkles,
  Tag,
  Layers,
  PackageCheck,
  Package,
} from 'lucide-react';
import { ProductCard } from '../components/ProductCard';

interface ProductDetailsPageProps {
  productId: string;
  onBack?: () => void;
  isMobile?: boolean;
}

export const ProductDetailsPage: React.FC<ProductDetailsPageProps> = ({
  productId,
  onBack,
  isMobile = false,
}) => {
  const {
    products,
    stores,
    cartItems,
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
  const [copiedLink, setCopiedLink] = useState(false);

  // Find target product
  const product = useMemo(() => {
    if (!products || products.length === 0) return null;
    const decoded = decodeURIComponent(productId).trim().toLowerCase();
    return (
      products.find((p) => {
        if (p.id === productId || p.id === decoded) return true;
        if (p.barcode && (p.barcode === productId || p.barcode === decoded)) return true;
        if (p.name && (p.name === decoded || p.name.toLowerCase() === decoded)) return true;

        const slug = decodeURIComponent(getProductSlug(p)).toLowerCase();
        if (slug === decoded || slug.replace(/-/g, ' ') === decoded.replace(/-/g, ' ')) return true;

        const simpleNameSlug = p.name.replace(/[\/\\#,+()$~%.'":*?<>{}]/g, '').replace(/—/g, '-').replace(/\s+/g, '-').toLowerCase();
        if (simpleNameSlug === decoded) return true;

        return false;
      }) || products[0]
    );
  }, [products, productId]);

  // Clean, professional product URL in browser address bar (no raw UUIDs or sku hashes)
  React.useEffect(() => {
    if (product) {
      const cleanSlug = getProductSlug(product);
      const current = window.location.pathname;
      const isRawUuid = /\/[0-9a-f]{8}-[0-9a-f]{4}/i.test(current) || current.includes('sku-');
      if (isRawUuid && cleanSlug) {
        window.history.replaceState({}, '', `/products/${cleanSlug}`);
      }
    }
  }, [product]);

  // Find store of this product
  const store = useMemo(() => {
    if (!product || !stores) return null;
    return stores.find(
      (s) => s.id === product.storeId || s.name === product.storeName
    );
  }, [product, stores]);

  // Product specifications
  const specs = useMemo(() => {
    return product ? getProductSpecifications(product) : null;
  }, [product]);

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

  // Reset / initialize options
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

  // Live total price
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

  if (!product || !specs) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center font-cairo" dir="rtl">
        <Package size={48} className="text-gray-300 mb-3" />
        <h2 className="text-lg font-black text-gray-800">الصنف غير متاح حالياً</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">قد يكون تم نقله أو انتهت كميته بالمخزن.</p>
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate('/'))}
          className="px-5 py-2.5 bg-[#FF5900] text-white rounded-xl text-xs font-black shadow-xs hover:bg-[#E04E00] transition cursor-pointer"
        >
          العودة للمتجر الرئيسي
        </button>
      </div>
    );
  }

  const wishlisted = isWishlisted(product.id);
  const storeLogo = store ? getStoreLogo(store) : '/brand/sangoub-mark-white-128.png';

  const handleSelectOption = (groupTitle: string, optionName: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupTitle]: optionName,
    }));
  };

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedOptions, 0);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2000);
  };

  const handleShare = () => {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 md:pb-16 font-cairo text-gray-900" dir="rtl">
      
      {/* ── 1. Top Navigation & Breadcrumbs ── */}
      <div className="bg-white border-b border-gray-200 py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-bold overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => (onBack ? onBack() : navigate('/'))}
              className="hover:text-[#FF5900] flex items-center gap-1 transition shrink-0"
            >
              <ArrowRight size={14} />
              <span>الرئيسية</span>
            </button>
            <span>/</span>
            {store && (
              <>
                <button
                  type="button"
                  onClick={() => navigate(`/stores/${getStoreSlug(store)}`)}
                  className="hover:text-[#FF5900] transition truncate shrink-0 max-w-[140px]"
                >
                  {store.name}
                </button>
                <span>/</span>
              </>
            )}
            <span className="text-gray-900 font-black truncate max-w-[200px]">
              {product.name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShare}
              className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition"
              title="مشاركة رابط الصنف"
              aria-label="مشاركة رابط الصنف"
            >
              {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
            </button>
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              className={`w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition ${
                wishlisted ? 'text-[#FF5900]' : 'text-gray-500'
              }`}
              title={wishlisted ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
              aria-label={wishlisted ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            >
              <Heart size={14} fill={wishlisted ? '#FF5900' : 'none'} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Main Product Presentation ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (Desktop) / Top Image (Mobile): 5 cols */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-200 p-6 flex flex-col items-center justify-center relative shadow-xs">
            {/* Badges on Top */}
            <div className="absolute top-4 right-4 flex flex-col gap-1.5 items-end z-10">
              {orderedBefore && (
                <span className="bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-xl shadow-xs flex items-center gap-1.5">
                  <CheckCircle2 size={13} />
                  <span>طلبته سابقاً ✓</span>
                </span>
              )}
              {product.badge && (
                <span className="bg-[#FF5900] text-white text-xs font-black px-3 py-1 rounded-xl shadow-xs">
                  {product.badge}
                </span>
              )}
            </div>

            {/* Product Image */}
            <div className="w-full aspect-square max-w-[380px] flex items-center justify-center overflow-hidden rounded-2xl bg-gray-50 p-4">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-contain"
                  loading="eager"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-300">
                  <ShoppingBag size={64} className="opacity-40 mb-2" />
                  <span className="text-sm font-bold text-gray-400">سنجوب</span>
                </div>
              )}
            </div>

            {/* Accurate Guarantees Pill (No false cold delivery on canned/dry items) */}
            <div className="w-full mt-6 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-gray-600">
              <div className="flex flex-col items-center gap-1">
                <Clock size={16} className="text-[#FF5900]" />
                <span>15-25 دقيقة</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>صلاحية مضمونة</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <PackageCheck size={16} className="text-blue-600" />
                <span>{specs.deliveryFeature}</span>
              </div>
            </div>
          </div>

          {/* Right Column: 7 cols (Details, Pricing, Specs & Buy Box) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Product Header */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs space-y-4">
              
              {/* Category & Store Meta with Merchant Logo */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => store && navigate(`/stores/${getStoreSlug(store)}`)}
                  className="bg-[#FFF2EC] hover:bg-[#FFE5D8] text-[#FF5900] text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-2 transition cursor-pointer"
                >
                  <img
                    src={storeLogo}
                    alt={product.storeName}
                    className="w-5 h-5 rounded-md object-contain bg-white"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
                    }}
                  />
                  <span>{product.storeName || 'سنجوب إكسبريس'}</span>
                </button>

                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <span className="bg-gray-100 px-2.5 py-1 rounded-lg">{specs.categoryName}</span>
                  {specs.netWeightOrVolume && (
                    <span className="bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg font-black">
                      {specs.netWeightOrVolume}
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Brand */}
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-snug">
                  {product.name}
                </h1>
                {product.nameEn && (
                  <p className="text-xs sm:text-sm text-gray-400 font-medium mt-1" dir="ltr">
                    {product.nameEn}
                  </p>
                )}
              </div>

              {/* Price Banner */}
              <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/80 border border-amber-200/70 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black text-[#FF5900]">
                    {formatEGP(product.price)}
                  </span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className="text-base text-gray-400 line-through font-bold">
                      {formatEGP(product.originalPrice)}
                    </span>
                  )}
                </div>

                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="bg-red-500 text-white text-xs font-black px-3 py-1 rounded-xl shadow-xs">
                    وفر {formatEGP(product.originalPrice - product.price)} (خصم {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%)
                  </span>
                )}
              </div>

              {/* Real Description from Database */}
              {product.description && (
                <div className="space-y-1.5 pt-1">
                  <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                    <Layers size={14} className="text-[#FF5900]" />
                    <span>تفاصيل الصنف:</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Option Groups (Modifiers, Sizes, Addons) */}
              {product.optionGroups && product.optionGroups.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs font-black text-gray-900">
                    <Sparkles size={14} className="text-[#FF5900]" />
                    <span>تخصيص الخيارات والإضافات:</span>
                  </div>

                  {product.optionGroups.map((group) => (
                    <div key={group.title} className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
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
              <div className="pt-2">
                <label htmlFor="pdp-note" className="block text-xs font-bold text-gray-900 mb-1">
                  ملاحظات خاصة للطلب (اختياري)
                </label>
                <input
                  id="pdp-note"
                  type="text"
                  placeholder="اكتب ملاحظاتك هنا..."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full h-11 px-4 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#FF5900] text-gray-900"
                />
              </div>

              {/* Action Buttons Row */}
              <div className="pt-4 border-t border-gray-100 flex items-center gap-2 sm:gap-3">
                {/* Quantity Selector */}
                <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 border border-gray-200 rounded-xl sm:rounded-2xl p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white border border-gray-200 text-gray-800 flex items-center justify-center font-black hover:bg-[#FFF2EC] hover:text-[#FF5900] transition active:scale-95 cursor-pointer"
                    aria-label="تقليل الكمية"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-7 sm:w-9 text-center text-xs sm:text-sm font-black text-gray-900 select-none">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white border border-gray-200 text-gray-800 flex items-center justify-center font-black hover:bg-[#FFF2EC] hover:text-[#FF5900] transition active:scale-95 cursor-pointer"
                    aria-label="زيادة الكمية"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                {/* Add to Cart Button */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={`flex-1 h-11 sm:h-12 px-3 sm:px-5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm flex items-center justify-between text-white transition-all shadow-md active:scale-98 cursor-pointer overflow-hidden ${
                    addedSuccess ? 'bg-emerald-600' : 'bg-[#FF5900] hover:bg-[#E04E00]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {addedSuccess ? (
                      <>
                        <Check size={18} strokeWidth={2.5} className="shrink-0" />
                        <span className="whitespace-nowrap font-black">تمت الإضافة!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag size={18} className="shrink-0" />
                        <span className="whitespace-nowrap font-black">أضف للسلة</span>
                      </>
                    )}
                  </div>
                  <span className="font-black text-xs sm:text-sm bg-black/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl shrink-0 whitespace-nowrap">
                    {formatEGP(totalPrice)}
                  </span>
                </button>
              </div>

            </div>

            {/* Specifications Card (Clean Real Attributes - No internal SKU or Barcode) */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs space-y-3">
              <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Tag size={16} className="text-[#FF5900]" />
                <span>المواصفات والبيانات المسجلة للصنف:</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {specs.customAttributes.map((attr, idx) => (
                  <div key={idx} className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <span className="text-[10px] text-gray-400 block font-bold">{attr.label}</span>
                    <span className="font-black text-gray-900 text-sm mt-0.5 block">{attr.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Store Information Card with Authentic Merchant Logo */}
            {store && (
              <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-xs flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <img
                    src={storeLogo}
                    alt={store.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-gray-100 shadow-2xs shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
                    }}
                  />
                  <div>
                    <h3 className="text-sm font-black text-gray-900">{store.name}</h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      {store.type || 'متجر معتمد للتوصيل الفوري في العاصمة'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/stores/${getStoreSlug(store)}`)}
                  className="px-4 py-2 bg-gray-100 hover:bg-[#FF5900] text-gray-700 hover:text-white rounded-xl text-xs font-black transition cursor-pointer"
                >
                  تصفح كافة منتجات المتجر
                </button>
              </div>
            )}

          </div>
        </div>

        {/* ── 3. Similar Products Section ── */}
        {similarProducts.length > 0 && (
          <section className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                  <Package size={20} className="text-[#FF5900]" />
                  <span>منتجات مشابهة وبدائل مقترحة:</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">
                  أصناف أخرى من نفس القسم والماركة متوفرة للتوصيل الفوري
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {similarProducts.map((sim) => (
                <ProductCard
                  key={sim.id}
                  product={sim}
                  onOpenModal={(p) => navigate(`/products/${getProductSlug(p)}`)}
                />
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
};
