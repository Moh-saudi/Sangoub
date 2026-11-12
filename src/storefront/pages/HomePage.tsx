import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { HeroSlider } from '../components/HeroSlider';
import { ProductModal } from '../components/ProductModal';
import { MerchantLogoCard } from '../components/MerchantLogoCard';
import { CategoryRail } from '../components/CategoryRail';
import { formatEGP } from '../../utils/orderCalculations';
import { LAUNCH_CONFIG } from '../../config/launchConfig';
import { getStoreLogo, matchStoreId } from '../../utils/storeAssets';
import type { Product } from '../../types';
import { 
  matchProductToCategory, 
  getCategoryProductCount, 
  getCategoryMerchants 
} from '../../utils/categoryMatching';
import { 
  getActiveStoreTypes, 
  getSupermarketCategories 
} from '../../constants/taxonomy';
import { 
  Sparkles, 
  Coffee, 
  UtensilsCrossed, 
  Milk, 
  Apple, 
  Pizza, 
  Tag, 
  Copy, 
  Check, 
  Percent, 
  HeartPulse, 
  Flame, 
  Clock, 
  Star, 
  Bike, 
  ShieldCheck, 
  Plus, 
  Zap, 
  ShoppingBag,
  ChevronLeft,
  Sandwich
} from 'lucide-react';

interface HomePageProps {
  onOpenAreaModal: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onOpenAreaModal }) => {
  const { 
    currentPath,
    products, 
    stores, 
    martBanner,
    supermarketCategories,
    activeStoreTypes,
    applyCoupon, 
    appliedCoupon, 
    activeCoupons,
    navigate,
    cartItems,
    subtotal,
    addToCart,
    searchQuery,
    setSearchQuery,
    homeSections
  } = useStore();

  const activeSections = useMemo(() => {
    return Array.isArray(homeSections) && homeSections.length > 0
      ? homeSections
      : [
          { type: 'slider' as const, enabled: true },
          { type: 'stores' as const, enabled: true },
          { type: 'offers' as const, enabled: true },
          { type: 'products' as const, enabled: true }
        ];
  }, [homeSections]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'offers' | 'popular' | 'fast_delivery'>('all');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [couponCopied, setCouponCopied] = useState(false);

  useEffect(() => {
    if (currentPath === '/offers' || window.location.pathname === '/offers') {
      setSelectedCategory(null);
      setActiveFilter('offers');
      setTimeout(() => {
        const grid = document.getElementById('products-grid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [currentPath]);

  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Use the popularity flag populated by the catalog; deals remain available in the filter below.
  const popularProducts = useMemo(() => {
    return products.filter(
      (p) => p.isPopular || p.badge?.includes('طلب') || p.badge?.includes('الأكثر')
    ).slice(0, 10);
  }, [products]);

  // Filter products by search query, category, or active filter
  const displayedProducts = useMemo(() => {
    let list = [...products];

    if (searchQuery?.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const isOffersKeyword = q.includes('عرض') || q.includes('عروض') || q.includes('تخفيض') || q.includes('خصم') || q.includes('وفر');

      list = list.filter((p) => {
        if (p.name.toLowerCase().includes(q)) return true;
        if (p.storeName?.toLowerCase().includes(q)) return true;
        if (p.category?.toLowerCase().includes(q)) return true;
        if ((p as any).category_code?.toLowerCase().includes(q)) return true;
        if ((p as any).categoryName?.toLowerCase().includes(q)) return true;
        if (p.description?.toLowerCase().includes(q)) return true;
        if (p.brand?.toLowerCase().includes(q) || (p as any).brand_name?.toLowerCase().includes(q)) return true;
        if (p.badge?.toLowerCase().includes(q) || p.offerTitle?.toLowerCase().includes(q)) return true;
        if (isOffersKeyword && ((p.originalPrice && p.originalPrice > p.price) || p.badge?.includes('عرض') || p.badge?.includes('خصم') || Boolean(p.offerTitle))) {
          return true;
        }
        return false;
      });
    }

    if (selectedCategory && !searchQuery?.trim()) {
      list = list.filter((p) => matchProductToCategory(p, selectedCategory));
    }

    if (activeFilter === 'offers' && !searchQuery?.trim()) {
      list = list.filter((p) => {
        // Exclude paused / out of stock items from customer offers page
        if (p.inStock === false || (p as any).is_available === false) return false;

        // Exclude closed or inactive stores
        const store = stores.find(s => matchStoreId(s.id, p.storeId) || s.id === p.storeId || (s.name && p.storeName === s.name));
        if (p.storeId && p.storeId !== 'a0000000-0000-0000-0000-000000000001') {
          if (!store || store.status === 'closed' || (store as any).is_active === false || (store as any).stopped_at) return false;
        } else {
          const central = stores.find(st => st.id === 'a0000000-0000-0000-0000-000000000001' || st.name?.includes('سنجوب'));
          if (central?.status === 'closed') return false;
        }

        if (p.offerStatus === 'pending_approval' || p.offerStatus === 'rejected') return false;
        return (p.originalPrice && p.originalPrice > p.price) || p.badge?.includes('عرض') || p.badge?.includes('خصم') || Boolean(p.offerTitle);
      }).sort((a, b) => {
        const origA = a.originalPrice || a.price;
        const origB = b.originalPrice || b.price;
        const discA = origA > 0 ? ((origA - a.price) / origA) : 0;
        const discB = origB > 0 ? ((origB - b.price) / origB) : 0;
        if (discB !== discA) return discB - discA; // Highest discount percentage first (% الأعلى خصماً)
        const savingsA = Math.max(0, origA - a.price);
        const savingsB = Math.max(0, origB - b.price);
        return savingsB - savingsA; // Highest savings in EGP second (أعلى توفير)
      });
    } else if (activeFilter === 'popular' && !searchQuery?.trim()) {
      list = list.filter((p) => p.isPopular || p.badge?.includes('طلب') || p.badge?.includes('الأكثر'));
    } else if (activeFilter === 'fast_delivery' && !searchQuery?.trim()) {
      list = list.filter((p) => p.category === 'فطور' || p.category === 'سندوتشات' || p.category === 'مشروبات');
    }

    return list;
  }, [products, searchQuery, selectedCategory, activeFilter, stores]);

  // URL query params listener (e.g. ?product=id or ?filter=offers from slider / notifications)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const prodId = params.get('product');
      if (prodId && products.length > 0) {
        const found = products.find(p => p.id === prodId);
        if (found) setSelectedProductForModal(found);
      }
      const filter = params.get('filter');
      if (filter === 'offers') {
        setActiveFilter('offers');
      }
    } catch {
      // Ignore
    }
  }, [products]);

  const featuredCoupon = activeCoupons[0];

  const handleCopyCoupon = () => {
    if (!featuredCoupon) return;
    applyCoupon(featuredCoupon.code);
    setCouponCopied(true);
    setTimeout(() => setCouponCopied(false), 2500);
  };

  // Dynamic product count per category
  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    supermarketCategories.forEach((c) => {
      counts[c.code] = getCategoryProductCount(products, c.code, c.name_ar);
    });
    return counts;
  }, [products, supermarketCategories]);

  // Merchants offering items in selected category
  const categoryMerchants = useMemo(() => {
    if (!selectedCategory) return [];
    return getCategoryMerchants(products, selectedCategory, stores);
  }, [selectedCategory, products, stores]);


  // ── Modular Homepage Sections (Driven by Admin Config) ──────────
  const renderSliderSection = () => (
    <section key="home-slider" className="mb-6">
      <HeroSlider
        onOpenAreaModal={onOpenAreaModal}
        onSelectProduct={(p) => setSelectedProductForModal(p)}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          const grid = document.getElementById('products-grid');
          if (grid) grid.scrollIntoView({ behavior: 'smooth' });
        }}
        onSelectOffers={() => {
          setActiveFilter('offers');
          const grid = document.getElementById('products-grid');
          if (grid) grid.scrollIntoView({ behavior: 'smooth' });
        }}
      />
    </section>
  );

  const renderStoresSection = () => {
    if (LAUNCH_CONFIG.hideMerchantNames || stores.length === 0) return null;
    return (
      <section key="home-stores" aria-labelledby="stores-heading" className="mb-6">
        <div className="flex items-center justify-between px-1 mb-2.5">
          <div className="flex items-center gap-1.5">
            <h2 id="stores-heading" className="text-xs sm:text-sm font-bold text-[#111827]">
              المتاجر
            </h2>
            <span className="text-[10px] text-[#6B7280] font-medium">({stores.length})</span>
          </div>
          <a
            href="/stores"
            onClick={(e) => {
              e.preventDefault();
              navigate('/stores');
            }}
            className="text-[10.5px] font-bold text-[#FF5900] hover:text-[#E04E00] flex items-center gap-0.5 text-decoration-none transition-colors"
          >
            <span>عرض الكل</span>
            <ChevronLeft size={11} />
          </a>
        </div>

        <div className="flex items-stretch gap-2.5 overflow-x-auto overscroll-x-contain touch-pan-x snap-x snap-mandatory pb-2 w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stores.map((store) => (
            <MerchantLogoCard key={store.id} store={store} className="w-[75vw] max-w-[270px] shrink-0 snap-start sm:w-[250px]" />
          ))}
        </div>
      </section>
    );
  };

  const renderOffersSection = () => {
    if (popularProducts.length === 0) return null;
    return (
      <section key="home-offers" aria-labelledby="popular-products-heading" className="mb-6">
        <div className="flex items-center justify-between px-1 mb-2.5">
          <div>
            <h2 id="popular-products-heading" className="text-sm sm:text-base font-black text-[#111827] flex items-center gap-1.5">
              <Flame size={18} className="text-[#FF5900]" />
              <span>الأكثر طلباً الآن</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('popular');
              setSelectedCategory(null);
            }}
            className="text-xs font-bold text-[#FF5900] hover:underline cursor-pointer flex items-center gap-0.5"
          >
            <span>عرض الكل</span>
            <ChevronLeft size={13} />
          </button>
        </div>

        <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar pb-2 pt-1 w-full overscroll-x-contain touch-pan-x">
          {popularProducts.map((product) => {
            const discountPct = product.originalPrice && product.originalPrice > product.price
              ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
              : 0;

            return (
              <div
                key={product.id}
                onClick={() => setSelectedProductForModal(product)}
                className="w-[145px] sm:w-[180px] shrink-0 bg-white border border-[#E5E7EB] hover:border-[#FF5900]/40 rounded-2xl p-2.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all cursor-pointer group select-none"
              >
                <div>
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#F9FAFB] mb-2">
                    <img
                      src={product.imageUrl || '/brand/sangoub-market-logo.jpg'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-market-logo.jpg';
                      }}
                    />
                    {discountPct > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-[#EF4444] text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs">
                        خصم {discountPct}%
                      </span>
                    )}
                  </div>

                  <h3 className="text-xs font-black text-[#111827] line-clamp-1 mb-0.5 group-hover:text-[#FF5900] transition-colors">
                    {product.name}
                  </h3>
                  {!LAUNCH_CONFIG.hideMerchantNames && (
                    <p className="text-[10px] text-[#6B7280] line-clamp-1 mb-1.5">
                      {product.storeName}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-[#F3F4F6]">
                  <div className="leading-tight">
                    <span className="text-xs sm:text-sm font-black text-[#FF5900] block">
                      {formatEGP(product.price)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-[9px] text-[#9CA3AF] line-through">
                        {formatEGP(product.originalPrice)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (product.optionGroups && product.optionGroups.length > 0) {
                        setSelectedProductForModal(product);
                      } else {
                        addToCart(product, 1);
                      }
                    }}
                    className="w-7 h-7 rounded-lg bg-[#FFF2EC] text-[#FF5900] hover:bg-[#FF5900] hover:text-white active:scale-95 transition-all flex items-center justify-center font-black cursor-pointer shadow-2xs"
                    title="أضف للسلة"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const renderProductsSection = () => (
    <div key="home-products" className="space-y-6">
      {/* Category rail */}
      <section className="mb-6">
        <CategoryRail
          categories={supermarketCategories}
          selectedCategory={selectedCategory}
          onSelect={(category) => {
            setSelectedCategory(category);
            const grid = document.getElementById('products-grid');
            if (category && grid) grid.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {selectedCategory && categoryMerchants.length > 0 && (
          <div className="mt-3.5 p-3.5 bg-white rounded-2xl border border-[#E5E7EB] shadow-xs flex flex-wrap items-center gap-3">
            <span className="text-xs font-black text-[#111827] shrink-0">المتاجر المتوفرة في ({selectedCategory}):</span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {categoryMerchants.map((merchant) => (
                <div
                  key={merchant.id}
                  onClick={() => navigate(`/stores/${merchant.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] shrink-0 cursor-pointer hover:border-[#FF5900] transition-colors text-xs font-bold font-tajawal"
                  style={{ fontFamily: "'Tajawal', sans-serif" }}
                >
                  <img
                    src={getStoreLogo(merchant)}
                    alt={merchant.name}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span>{merchant.name}</span>
                  {merchant.status === 'closed' ? (
                    <span className="text-[10px] text-gray-500 bg-gray-200/80 px-1.5 py-0.5 rounded-md font-bold">
                      مغلق
                    </span>
                  ) : merchant.status === 'busy' ? (
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md font-bold">
                      مشغول
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="مفتوح الآن" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SANGOUB MART BANNER */}
      {martBanner?.enabled !== false && (
        <section className="mb-6">
          <div className="bg-gradient-to-r from-[#FF5900] via-[#FF6A1A] to-[#FF4500] rounded-2xl p-3.5 sm:p-5 text-white shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-[#FF5900] flex items-center justify-center shrink-0 shadow-xs">
                <Zap size={22} className="fill-[#FF5900]" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] bg-white/20 text-white px-2 py-0.2 rounded-full font-black">
                    {martBanner?.badge || 'سنجوب بقالة ⚡'}
                  </span>
                  {martBanner?.areaText && (
                    <span className="text-[9px] bg-white text-[#FF5900] px-1.5 py-0.2 rounded-full font-black">
                      {martBanner.areaText}
                    </span>
                  )}
                </div>
                <h3 className="text-xs sm:text-sm font-black line-clamp-1">
                  {martBanner?.title || 'سنجوب ماركت وكل طلبات البيت لحد بابك'}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedCategory(martBanner?.targetCategory || 'سوبرماركت');
                const grid = document.getElementById('products-grid');
                if (grid) grid.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-4 py-2 bg-white text-[#FF5900] rounded-xl text-xs sm:text-sm font-black shrink-0 shadow-xs active:scale-95 transition-transform hover:bg-[#FFF2EC] cursor-pointer"
            >
              {martBanner?.btnText || 'تسوق الآن'}
            </button>
          </div>
        </section>
      )}

      {/* VOUCHER & PROMO COUPON CARD */}
      {LAUNCH_CONFIG.showCouponField && featuredCoupon && (
        <section className="mb-6">
          <div className="bg-gradient-to-r from-[#FFF5F0] via-white to-[#FFF5F0] border border-[#FFD4C2] rounded-2xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF5900] text-white flex items-center justify-center shadow-xs shrink-0">
                <Percent size={20} strokeWidth={2.5} />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="bg-[#FF5900] text-white text-[9px] font-black px-2 py-0.2 rounded-full">
                    خصم {featuredCoupon.discountType === 'percent' ? `${featuredCoupon.value}%` : `${featuredCoupon.value} ج.م`}
                  </span>
                  <span className="text-xs font-black text-[#111827] font-mono">
                    {featuredCoupon.code}
                  </span>
                </div>
                <p className="text-[10px] text-[#6B7280]">
                  {featuredCoupon.description || (featuredCoupon.minOrder > 0 ? `الحد الأدنى للطلب: ${featuredCoupon.minOrder} ج.م` : 'متاح لجميع الطلبات')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyCoupon}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                couponCopied || appliedCoupon?.code === featuredCoupon.code
                  ? 'bg-[#10B981] text-white'
                  : 'bg-[#FF5900] hover:bg-[#E04E00] text-white active:scale-95'
              }`}
            >
              {couponCopied || appliedCoupon?.code === featuredCoupon.code ? (
                <>
                  <Check size={14} strokeWidth={3} />
                  <span>تم التطبيق!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>نسخ وتطبيق</span>
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* PRODUCTS CATALOG & FILTER TABS */}
      <section id="products-catalog" aria-labelledby="products-catalog-heading" className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-2.5 px-1 border-b border-[#E5E7EB] pb-3 mb-4">
          <div>
            <h2 id="products-catalog-heading" className="text-sm sm:text-base font-black text-[#111827] flex items-center gap-1.5">
              <Sparkles size={18} className="text-[#FF5900]" />
              <span>
                {selectedCategory
                  ? `قسم ${selectedCategory}`
                  : activeFilter === 'offers'
                  ? 'عروض وتخفيضات اليوم'
                  : activeFilter === 'popular'
                  ? 'الأكثر طلباً بالعاصمة'
                  : activeFilter === 'fast_delivery'
                  ? 'أسرع توصيل للمكاتب'
                  : 'قائمة الأصناف المتاحة'}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full py-0.5">
            <button
              type="button"
              onClick={() => { setActiveFilter('all'); setSelectedCategory(null); }}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === 'all' && !selectedCategory
                  ? 'bg-[#111827] text-white shadow-xs'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              الكل
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === 'popular' ? 'all' : 'popular')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                activeFilter === 'popular'
                  ? 'bg-[#FF5900] text-white shadow-xs'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#FF5900]'
              }`}
            >
              <Flame size={12} />
              <span>الأكثر طلباً</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === 'offers' ? 'all' : 'offers')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                activeFilter === 'offers'
                  ? 'bg-[#FF5900] text-white shadow-xs'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#FF5900]'
              }`}
            >
              <Tag size={12} />
              <span>عروض التوفير</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === 'fast_delivery' ? 'all' : 'fast_delivery')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                activeFilter === 'fast_delivery'
                  ? 'bg-[#059669] text-white shadow-xs'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#059669]'
              }`}
            >
              <Bike size={12} />
              <span>أسرع توصيل</span>
            </button>

            {(selectedCategory || activeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null);
                  setActiveFilter('all');
                }}
                className="text-xs font-bold text-[#FF5900] px-2 py-0.5 rounded-lg hover:underline cursor-pointer whitespace-nowrap"
              >
                إلغاء الفلترة ✕
              </button>
            )}
          </div>
        </div>

        {displayedProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full">
            {displayedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenModal={(p) => setSelectedProductForModal(p)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#E5E7EB] p-6 max-w-sm mx-auto shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center mx-auto mb-2.5">
              <ShoppingBag size={24} />
            </div>
            <h3 className="text-sm font-black text-[#111827] mb-1">لا توجد نتائج مطابقة</h3>
            <p className="text-[11px] text-[#6B7280] mb-4">
              جرّب إزالة خيارات الفلترة لمشاهدة جميع الأصناف.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                setActiveFilter('all');
              }}
              className="px-4 py-2 bg-[#FF5900] hover:bg-[#E04E00] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <span>عرض كل المنتجات</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
  return (
    <div className="min-h-screen bg-[#F7F7F8] pb-28 sm:pb-20 text-[#1F2937] overflow-x-hidden" dir="rtl">
      
      {/* ── Main Container ── */}
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 pt-3 sm:pt-6">
        {/* Dynamic Sections Ordered by Admin */}
        {activeSections.map((sec) => {
          if (sec.enabled === false) return null;
          switch (sec.type) {
            case 'slider':
              return renderSliderSection();
            case 'stores':
              return renderStoresSection();
            case 'offers':
              return renderOffersSection();
            case 'products':
              return renderProductsSection();
            default:
              return null;
          }
        })}

      </div>

      {/* 10. STICKY FLOATING CART BAR ON MOBILE */}
      {cartItemCount > 0 && (
        <div 
          className="sm:hidden fixed bottom-16 inset-x-3.5 z-40 animate-fade-in-up"
          dir="rtl"
        >
          <div 
            onClick={() => navigate('/cart')}
            className="bg-[#FF5900] text-white p-3 rounded-2xl shadow-xl flex items-center justify-between cursor-pointer active:scale-98 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-xs">
                {cartItemCount}
              </div>
              <div>
                <p className="text-[10px] text-white/90 leading-tight">عناصر في السلة</p>
                <p className="text-xs font-black leading-tight">{formatEGP(subtotal)}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-black bg-white/20 px-3 py-1 rounded-xl">
              <span>إتمام الطلب</span>
              <ChevronLeft size={14} />
            </div>
          </div>
        </div>
      )}

      {/* 11. INTERACTIVE PRODUCT MODAL */}
      <ProductModal
        product={selectedProductForModal}
        onClose={() => setSelectedProductForModal(null)}
        onSelectProduct={(p) => setSelectedProductForModal(p)}
      />

    </div>
  );
};
