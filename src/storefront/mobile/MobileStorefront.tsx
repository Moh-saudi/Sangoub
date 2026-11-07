import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductModal } from '../components/ProductModal';
import { StoresPage } from '../pages/StoresPage';
import { StoreDetailsPage } from '../pages/StoreDetailsPage';
import { ProductDetailsPage } from '../pages/ProductDetailsPage';
import { OrdersPage } from '../pages/OrdersPage';
import { AccountPage } from '../pages/AccountPage';
import { CartCheckoutModal } from '../components/CartCheckoutModal';
import { SangoubAuthModal } from '../components/SangoubAuthModal';
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
  MapPin,
  Search,
  Bike,
  ShoppingBag,
  Zap,
  UtensilsCrossed,
  Milk,
  Coffee,
  HeartPulse,
  Sandwich,
  Pizza,
  Apple,
  Sparkles,
  Flame,
  Tag,
  Clock,
  Star,
  Plus,
  Minus,
  Heart,
  ChevronDown,
  ChevronLeft,
  Home,
  LayoutGrid,
  User,
  ArrowLeft,
  Store as StoreIcon,
  Bell
} from 'lucide-react';

import { 
  STORE_TYPES, 
  SUPERMARKET_CATEGORY_TEMPLATES, 
  getActiveStoreTypes, 
  getSupermarketCategories 
} from '../../constants/taxonomy';

interface MobileStorefrontProps {
  onOpenAreaModal: () => void;
  onOpenCartModal?: () => void;
  onOpenRegisterModal?: () => void;
  onOpenTrackingModal?: (order?: any) => void;
  activeOrder?: any;
}

export const MobileStorefront: React.FC<MobileStorefrontProps> = ({
  onOpenAreaModal,
  onOpenCartModal,
  onOpenRegisterModal,
  onOpenTrackingModal,
  activeOrder,
}) => {
  const {
    products,
    stores,
    supermarketCategories,
    activeStoreTypes,
    cartItems,
    addToCart,
    updateQuantity,
    toggleWishlist,
    isWishlisted,
    subtotal,
    serviceArea,
    searchQuery,
    setSearchQuery,
    navigate,
    currentPath,
    user,
    banners,
    martBanner,
    handleBannerClick,
    unreadNotificationsCount,
    setIsNotificationsModalOpen
  } = useStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'offers' | 'popular' | 'fast_delivery'>('all');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const isStoresList = currentPath === '/stores';
  const isSingleStore = currentPath.startsWith('/stores/');
  const isSingleProduct = currentPath.startsWith('/products/') || currentPath.startsWith('/product/');
  const isOrdersPage = currentPath === '/my-orders' || currentPath === '/orders' || currentPath === '/track';
  const isAccountPage = currentPath === '/account' || currentPath === '/profile' || currentPath === '/settings' || currentPath === '/addresses';
  const currentStoreId = isSingleStore ? decodeURIComponent(currentPath.replace(/^\/stores\//, '').replace(/\/$/, '')) : '';
  const currentProductId = isSingleProduct ? decodeURIComponent(currentPath.replace(/^\/(products|product)\//, '').replace(/\/$/, '')) : '';
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const handleOpenCart = () => {
    if (onOpenCartModal) {
      onOpenCartModal();
    } else {
      setIsCartModalOpen(true);
    }
  };

  const handleOpenRegister = () => {
    if (onOpenRegisterModal) {
      onOpenRegisterModal();
    } else {
      setIsRegisterModalOpen(true);
    }
  };

  useEffect(() => {
    if (currentPath === '/cart') {
      handleOpenCart();
    } else if (currentPath === '/login' || currentPath === '/register') {
      handleOpenRegister();
    } else if (currentPath === '/offers') {
      setActiveFilter('offers');
      setSelectedCategory(null);
      setTimeout(() => {
        const grid = document.getElementById('mobile-products-grid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [currentPath]);

  // Dynamic Mobile Slider State (Synced with Admin App Content / Campaigns)
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const activeSlides = banners && banners.length > 0 ? banners : [];

  useEffect(() => {
    if (currentSlide >= activeSlides.length) {
      setCurrentSlide(0);
    }
  }, [activeSlides.length, currentSlide]);

  // Auto-slide every 4.5 seconds
  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [activeSlides.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || activeSlides.length <= 1) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 40) {
      setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
    } else if (diff < -40) {
      setCurrentSlide((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
    }
    touchStartX.current = null;
  };

  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Popular products are selected by the catalog's popularity metadata.
  const popularProducts = useMemo(() => {
    return products.filter(
      (p) => p.isPopular || p.badge?.includes('طلب') || p.badge?.includes('الأكثر')
    ).slice(0, 8);
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.storeName?.toLowerCase().includes(q));
    }

    if (selectedCategory) {
      list = list.filter((p) => matchProductToCategory(p, selectedCategory));
    }

    if (activeFilter === 'offers') {
      list = list.filter((p) => {
        const isClosed = stores.some((s) => s.status === 'closed' && (matchStoreId(s.id, p.storeId) || s.id === p.storeId || (s.name && p.storeName === s.name)));
        if (isClosed) return false;
        return (p.originalPrice && p.originalPrice > p.price) || p.badge?.includes('عرض') || p.badge?.includes('خصم') || Boolean(p.offerTitle);
      });
    } else if (activeFilter === 'popular') {
      list = list.filter((p) => p.isPopular || p.badge?.includes('طلب'));
    } else if (activeFilter === 'fast_delivery') {
      list = list.filter((p) => p.category === 'فطور' || p.category === 'سندوتشات' || p.category === 'مشروبات');
    }

    return list;
  }, [products, searchQuery, selectedCategory, activeFilter, stores]);

  // Dynamic product count per category
  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    supermarketCategories.forEach((c) => {
      counts[c.code] = getCategoryProductCount(products, c.code, c.name_ar);
    });
    return counts;
  }, [products, supermarketCategories]);

  // Merchants available for the selected category
  const categoryMerchants = useMemo(() => {
    if (!selectedCategory) return [];
    return getCategoryMerchants(products, selectedCategory, stores);
  }, [selectedCategory, products, stores]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const el = document.getElementById('mobile-products-grid');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] text-[#1F2937] pb-24 font-['Cairo',sans-serif] select-none" dir="rtl">
      
      {/* ══════════════════════════════════════════════════════════════
          1. TALABAT MOBILE NATIVE APP BAR (STICKY FIXED)
          ══════════════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#F0F1F3] px-3.5 pt-2 pb-2.5 shadow-xs w-full sangoub-sticky-header"
        style={{ position: 'sticky', top: 0, zIndex: 50 }}
      >
        
        {/* Top Mini Row: Brand (Right in RTL) & Location (Left in RTL) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          
          {/* 1. Sangoub Avatar & Brand (Right side in RTL - Click to Home) */}
          <button
            type="button"
            onClick={() => { setSelectedCategory(null); setActiveFilter('all'); navigate('/'); }}
            className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform shrink-0"
            aria-label="الرئيسية - سنجوب"
            title="الرئيسية"
          >
            <div className="w-8 h-8 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center overflow-hidden shadow-2xs">
              <img 
                src="/brand/sangoub-mark-white-128.png"
                alt="سنجوب Sangoub" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col items-start leading-none text-right">
              <span className="text-xs sm:text-sm font-black text-[#FF5900] tracking-tight">سنجوب</span>
              <span className="text-[8px] font-bold text-[#6B7280] tracking-wider uppercase">SANGOUB</span>
            </div>
          </button>

          {/* 2. Left Side Actions: Compact Location + Notification Bell */}
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Compact Location Chip */}
            <button
              type="button"
              onClick={onOpenAreaModal}
              className="flex items-center gap-1 px-2 py-1 rounded-xl bg-[#F9FAFB] hover:bg-[#FFF5F0] border border-[#E5E7EB] text-right active:scale-95 transition-all max-w-[130px] sm:max-w-[150px] cursor-pointer"
              aria-label="تغيير موقع التوصيل"
              title="انقر لتغيير العنوان"
            >
              <div className="w-5 h-5 rounded-lg bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center shrink-0">
                <MapPin size={11} />
              </div>
              <span className="text-[11px] font-black text-[#111827] truncate">
                {serviceArea.name || 'حدد موقعك'}
              </span>
              <ChevronDown size={10} className="text-[#FF5900] shrink-0" />
            </button>

            {/* Notification Bell Button */}
            <button
              type="button"
              onClick={() => setIsNotificationsModalOpen(true)}
              className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-xl bg-[#F9FAFB] hover:bg-[#FFF5F0] border border-[#E5E7EB] text-[#111827] flex items-center justify-center relative cursor-pointer active:scale-95 transition-all shrink-0"
              aria-label="الإشعارات والتنبيهات"
              title="الإشعارات"
            >
              <Bell size={15} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-3.5 px-1 rounded-full bg-[#FF5900] text-white text-[9px] font-black flex items-center justify-center border border-white shadow-2xs">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>

        </div>

        {/* Search Bar Input (No browser cyan outline) */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full bg-[#F3F4F6] rounded-xl border border-[#E5E7EB] focus-within:border-[#FF5900] focus-within:bg-white transition-all px-2.5 py-1.5">
          <Search size={15} className="text-[#9CA3AF] ml-2 shrink-0 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن صنف أو بقالة…"
            style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
            className="w-full bg-transparent text-xs text-[#111827] placeholder-[#9CA3AF] !outline-none !border-none !ring-0 !shadow-none font-medium"
            aria-label="بحث في سنجوب"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[#9CA3AF] hover:text-[#111827] text-xs font-bold px-1"
            >
              ✕
            </button>
          )}
        </form>

      </header>

      {/* ══════════════════════════════════════════════════════════════
          MAIN MOBILE BODY
          ══════════════════════════════════════════════════════════════ */}
      <main className="px-3.5 pt-2 space-y-3">
        {isSingleProduct ? (
          <ProductDetailsPage
            productId={currentProductId}
            onBack={() => navigate('/')}
            isMobile={true}
          />
        ) : isSingleStore ? (
          <StoreDetailsPage
            storeId={currentStoreId}
            onBackToStores={() => navigate('/stores')}
            isMobile={true}
          />
        ) : isStoresList ? (
          <StoresPage
            onBackToHome={() => navigate('/')}
            isMobile={true}
          />
        ) : isOrdersPage ? (
          <OrdersPage
            onBackToHome={() => navigate('/')}
            onTrackOrder={(ord) => {
              if (onOpenTrackingModal) onOpenTrackingModal(ord);
            }}
            isMobile={true}
          />
        ) : isAccountPage ? (
          <AccountPage
            onBackToHome={() => navigate('/')}
            onOpenAreaModal={onOpenAreaModal}
            isMobile={true}
          />
        ) : (
          <>
        {/* 2. DEDICATED MOBILE HERO SLIDER (Compact 120px Height) */}
        {activeSlides.length > 0 && (
          <div
            className="relative rounded-2xl overflow-hidden shadow-xs bg-[#131921] w-full"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            aria-label="سلايدر العروض الترويجية"
          >
            <div className="relative w-full h-[120px]">
              {activeSlides.map((slide, index) => {
                const isActive = currentSlide === index;
                const hasImage = Boolean(slide.imageUrl || (slide.image && (slide.image.startsWith('http') || slide.image.startsWith('/'))));
                const hasTextOverlay = !slide.hideOverlay && Boolean(slide.title || slide.subtitle || (slide.btnText && slide.btnText.trim()) || (slide.tag && slide.tag.trim()));
                const bannerImgUrl = slide.imageUrl || slide.image;

                return (
                  <div
                    key={slide.id || index}
                    onClick={() => {
                      handleBannerClick(slide, {
                        onSelectProduct: (p) => setSelectedProductForModal(p),
                        onSelectOffers: () => {
                          setActiveFilter('offers');
                          const grid = document.getElementById('mobile-products-grid');
                          if (grid) grid.scrollIntoView({ behavior: 'smooth' });
                        },
                        onSelectCategory: (cat) => {
                          setSelectedCategory(cat);
                          const grid = document.getElementById('mobile-products-grid');
                          if (grid) grid.scrollIntoView({ behavior: 'smooth' });
                        },
                      });
                    }}
                    className={`absolute inset-0 transition-opacity duration-300 ease-in-out cursor-pointer ${
                      isActive ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'
                    }`}
                    style={{ background: slide.bgGradient || 'linear-gradient(135deg, #131921 0%, #1F2937 100%)' }}
                  >
                    {hasImage ? (
                      /* Real Image Banner Layout with Scrim for Text Legibility */
                      <div className="relative w-full h-full overflow-hidden">
                        <img
                          src={bannerImgUrl}
                          alt={slide.title || 'عرض سنجوب'}
                          className="absolute inset-0 w-full h-full object-cover object-center"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                        {/* Scrim & text/buttons only rendered when banner is not a clean graphic design */}
                        {hasTextOverlay && (
                          <div className="absolute inset-0 bg-gradient-to-l from-[#0F172A]/90 via-[#0F172A]/55 to-transparent/10 z-10 py-2.5 px-3.5 pr-7 flex flex-col justify-center max-w-[78%]">
                            {slide.tag && (
                              <span
                                className="inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.2 rounded-full text-white w-fit mb-1 shadow-2xs"
                                style={{ backgroundColor: slide.badgeColor || '#FF5900' }}
                              >
                                <Sparkles size={8} />
                                <span>{slide.tag}</span>
                              </span>
                            )}

                            {slide.title && (
                              <h2 className="text-[11.5px] font-black text-white leading-tight line-clamp-2 drop-shadow-sm">
                                {slide.title}
                              </h2>
                            )}

                            {(slide.subtitle || slide.desc) && (
                              <p className="text-[9px] text-gray-200 line-clamp-1 mt-0.5 font-medium">
                                {slide.subtitle || slide.desc}
                              </p>
                            )}

                            {slide.btnText && (
                              <div className="pt-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#FF5900] text-white text-[9px] font-black shadow-xs">
                                  <span>{slide.btnText}</span>
                                  <ArrowLeft size={9} />
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Mascot + Gradient Layout */
                      <div className="relative z-10 w-full h-full px-3 py-2 flex items-center justify-between gap-2">
                        {/* Text */}
                        <div className="flex-1 max-w-[65%] flex flex-col justify-center space-y-1">
                          {slide.tag && (
                            <span
                              className="inline-flex items-center gap-1 text-[8.5px] font-black px-2 py-0.2 rounded-full text-white w-fit shadow-2xs"
                              style={{ backgroundColor: slide.badgeColor || '#FF5900' }}
                            >
                              <Sparkles size={8} />
                              <span>{slide.tag}</span>
                            </span>
                          )}

                          <h2 className="text-[11.5px] font-black text-white leading-tight line-clamp-2">
                            {slide.title}
                          </h2>

                          {(slide.subtitle || slide.desc) && (
                            <p className="text-[9px] text-gray-300 line-clamp-1">
                              {slide.subtitle || slide.desc}
                            </p>
                          )}

                          <div className="pt-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#FF5900] text-white text-[9.5px] font-black shadow-xs">
                              <span>{slide.btnText || 'اطلب الآن'}</span>
                              <ArrowLeft size={9} />
                            </span>
                          </div>
                        </div>

                        {/* Mascot Illustration */}
                        <div className="w-[32%] h-full flex items-center justify-center shrink-0">
                          <img
                            src={slide.mascotImg || '/assets/sangoub/mascot-cheerful.png'}
                            alt="سنجوب Sangoub"
                            className="max-h-[102px] w-auto object-contain drop-shadow-md"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dots */}
            {activeSlides.length > 1 && (
              <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center gap-1 z-20 pointer-events-none">
                {activeSlides.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      currentSlide === i ? 'w-3.5 bg-[#FF5900]' : 'w-1 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Two-row swipeable category rail */}
        <section>
          <CategoryRail
            categories={supermarketCategories}
            selectedCategory={selectedCategory}
            compact
            onSelect={(category) => {
              setSelectedCategory(category);
              const grid = document.getElementById('mobile-products-grid');
              if (category && grid) grid.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {/* If a category is selected: Show Merchants Strip */}
          {selectedCategory && categoryMerchants.length > 0 && (
            <div className="mt-2 p-2 bg-white rounded-xl border border-[#E5E7EB] shadow-2xs">
              <p className="text-[9.5px] font-black text-[#111827] mb-1.5 flex items-center gap-1">
                <span>المتاجر التي توفر منتجات في ({selectedCategory}):</span>
                <span className="text-[#FF5900]">({categoryMerchants.length})</span>
              </p>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {categoryMerchants.map((merchant) => (
                  <div
                    key={merchant.id}
                    onClick={() => navigate(`/stores/${merchant.id}`)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] shrink-0 cursor-pointer active:scale-95"
                  >
                    <img
                      src={getStoreLogo(merchant)}
                      alt={merchant.name}
                      className="w-5 h-5 rounded-full object-cover border border-[#E5E7EB]"
                    />
                    <span className="text-[9px] font-black text-[#1F2937]">{merchant.name}</span>
                    {merchant.status === 'closed' ? (
                      <span className="text-[8px] text-gray-500 bg-gray-200/80 px-1 py-0.2 rounded-md font-bold">مغلق</span>
                    ) : merchant.status === 'busy' ? (
                      <span className="text-[8px] text-amber-700 bg-amber-100 px-1 py-0.2 rounded-md font-bold">مشغول</span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 5. SANGOUB GROCERY QUICK BAR (Dynamic & Configurable from Admin Dashboard) */}
        {martBanner?.enabled !== false && (
          <div
            onClick={() => setSelectedCategory(martBanner?.targetCategory || 'سوبرماركت')}
            className="bg-gradient-to-r from-[#FF5900] via-[#FF6A1A] to-[#FF4500] rounded-2xl p-2.5 sm:p-3 text-white shadow-xs flex items-center justify-between gap-2 cursor-pointer active:scale-98 transition-transform"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white text-[#FF5900] flex items-center justify-center shrink-0 font-black shadow-xs">
                <Zap size={18} className="fill-[#FF5900]" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[8.5px] bg-white/25 px-1.5 py-0.2 rounded-full font-bold">
                    {martBanner?.badge || 'سنجوب بقالة ⚡'}
                  </span>
                  {martBanner?.areaText && (
                    <span className="text-[8px] bg-white text-[#FF5900] px-1.5 py-0.2 rounded-full font-black">
                      {martBanner.areaText}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-black text-white">{martBanner?.title || 'سنجوب ماركت وكل طلبات البيت لحد بابك'}</p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-xl bg-white text-[#FF5900] text-[9.5px] font-black shrink-0 shadow-xs">
              {martBanner?.btnText || 'تسوق الآن'}
            </span>
          </div>
        )}

        {/* 6. Popular products */}
        {popularProducts.length > 0 && (
          <section aria-labelledby="mobile-popular-products">
            <div className="flex items-center justify-between px-1 mb-2">
              <h2 id="mobile-popular-products" className="text-xs font-black text-[#111827] flex items-center gap-1">
                <Flame size={15} className="text-[#FF5900]" />
                <span>الأكثر طلباً الآن</span>
              </h2>
              <button
                type="button"
                onClick={() => { setActiveFilter('popular'); setSelectedCategory(null); }}
                className="text-[10px] font-bold text-[#FF5900] flex items-center gap-0.5"
              >
                <span>الكل</span>
                <ChevronLeft size={11} />
              </button>
            </div>

            <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1 w-full overscroll-x-contain touch-pan-x">
              {popularProducts.map((product) => {
                const cartItem = cartItems.find((item) => item.product.id === product.id);
                const qty = cartItem ? cartItem.quantity : 0;

                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProductForModal(product)}
                    className="w-[135px] shrink-0 bg-white border border-[#E5E7EB] rounded-2xl p-2 flex flex-col justify-between shadow-2xs active:scale-98 transition-transform cursor-pointer"
                  >
                    <div>
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#F9FAFB] mb-1.5">
                        <img
                          src={product.imageUrl || '/brand/sangoub-market-logo.jpg'}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-market-logo.jpg';
                          }}
                        />
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="absolute top-1 right-1 bg-[#EF4444] text-white text-[8px] font-black px-1.5 py-0.2 rounded-md">
                            خصم
                          </span>
                        )}
                      </div>
                      <h3 className="text-[11px] font-black text-[#111827] line-clamp-1 mb-0.5">
                        {product.name}
                      </h3>
                      {!LAUNCH_CONFIG.hideMerchantNames && (
                        <p className="text-[9px] text-[#6B7280] truncate mb-1">
                          {product.storeName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6]">
                      <div className="leading-tight">
                        <span className="text-xs font-black text-[#FF5900] block">
                          {formatEGP(product.price)}
                        </span>
                        {product.originalPrice && (
                          <span className="text-[9px] text-[#9CA3AF] line-through">
                            {formatEGP(product.originalPrice)}
                          </span>
                        )}
                      </div>

                      {qty > 0 ? (
                        <div
                          className="flex items-center gap-1 bg-[#FFF2EC] rounded-lg px-1 py-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => updateQuantity(cartItem!.id, -1)}
                            className="w-4 h-4 bg-white text-[#FF5900] rounded flex items-center justify-center font-black text-xs"
                          >
                            <Minus size={9} strokeWidth={3} />
                          </button>
                          <span className="text-[11px] font-black text-[#FF5900]">{qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(cartItem!.id, 1)}
                            className="w-4 h-4 bg-[#FF5900] text-white rounded flex items-center justify-center font-black text-xs"
                          >
                            <Plus size={9} strokeWidth={3} />
                          </button>
                        </div>
                      ) : (
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
                          className="w-6 h-6 rounded-lg bg-[#FFF2EC] text-[#FF5900] active:bg-[#FF5900] active:text-white flex items-center justify-center font-black"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 6.5 POPULAR STORES HORIZONTAL SCROLL (Mobile) */}
        {stores.length > 0 && (
          <section aria-labelledby="mobile-stores-heading" className="mb-4">
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="flex items-center gap-1.5">
                <h2 id="mobile-stores-heading" className="text-xs sm:text-sm font-bold text-[#111827]">
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
                className="text-[10px] font-bold text-[#FF5900] hover:underline flex items-center gap-0.5 text-decoration-none"
              >
                <span>عرض الكل</span>
                <ChevronLeft size={11} />
              </a>
            </div>

            <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-2 pt-0.5 w-full overscroll-x-contain touch-pan-x snap-x snap-mandatory">
              {stores.map((store) => (
                <MerchantLogoCard key={store.id} store={store} className="w-[75vw] max-w-[260px] shrink-0 snap-start" />
              ))}
            </div>
          </section>
        )}

        {/* 7. QUICK FILTER CHIPS (Horizontal Scroll) */}
        <section id="mobile-products-grid" className="pt-1">
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-xs font-black text-[#111827]">
              {selectedCategory ? `قسم: ${selectedCategory}` : 'قائمة الوجبات والأصناف'}
            </h2>
            <span className="text-[10px] text-[#6B7280]">
              {filteredProducts.length} صنف متاح
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
            <button
              type="button"
              onClick={() => { setActiveFilter('all'); setSelectedCategory(null); }}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                activeFilter === 'all' && !selectedCategory
                  ? 'bg-[#111827] text-white shadow-xs'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280]'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === 'popular' ? 'all' : 'popular')}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 transition-all ${
                activeFilter === 'popular'
                  ? 'bg-[#FF5900] text-white shadow-xs'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280]'
              }`}
            >
              <Flame size={11} />
              <span>الأكثر طلباً</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === 'offers' ? 'all' : 'offers')}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 transition-all ${
                activeFilter === 'offers'
                  ? 'bg-[#FF5900] text-white shadow-xs'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280]'
              }`}
            >
              <Tag size={11} />
              <span>عروض التوفير</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === 'fast_delivery' ? 'all' : 'fast_delivery')}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 transition-all ${
                activeFilter === 'fast_delivery'
                  ? 'bg-[#059669] text-white shadow-xs'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280]'
              }`}
            >
              <Bike size={11} />
              <span>أسرع توصيل</span>
            </button>
          </div>

          {/* 8. PRODUCTS 2-COLUMN GRID (Compact, Sleek & Modern) */}
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {filteredProducts.map((product) => {
                const cartItem = cartItems.find((item) => item.product.id === product.id);
                const quantity = cartItem ? cartItem.quantity : 0;
                const wishlisted = isWishlisted(product.id);

                return (
                  <article
                    key={product.id}
                    onClick={() => setSelectedProductForModal(product)}
                    className="bg-white border border-[#E5E7EB] rounded-xl p-1.5 flex flex-col justify-between shadow-2xs active:scale-98 transition-all relative select-none"
                  >
                    {/* Wishlist Heart */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(product.id);
                      }}
                      className="absolute top-2.5 left-2.5 z-10 w-5 h-5 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-[#9CA3AF] shadow-2xs"
                      aria-label="المفضلة"
                    >
                      <Heart size={11} fill={wishlisted ? '#FF5900' : 'none'} className={wishlisted ? 'text-[#FF5900]' : ''} />
                    </button>

                    {/* Image */}
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-[#F9FAFB] mb-1">
                      <img
                        src={product.imageUrl || '/brand/sangoub-market-logo.jpg'}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-market-logo.jpg';
                        }}
                      />
                      {product.badge && (
                        <span className="absolute top-1 right-1 bg-[#FF5900] text-white text-[7.5px] font-black px-1.5 py-0.2 rounded-md">
                          {product.badge}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-[8px] font-bold text-[#6B7280] truncate mb-0.5">
                          {product.storeName || 'سنجوب'}
                        </p>
                        <h3 className="text-[10.5px] font-bold text-[#111827] line-clamp-1 mb-0.5" title={product.name}>
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-1 text-[7.5px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded w-fit mb-1">
                          <Clock size={8} />
                          <span>15-25 د</span>
                        </div>
                      </div>

                      {/* Price & Counter */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6] mt-auto">
                        <div className="leading-tight">
                          <span className="text-[11px] font-black text-[#FF5900]">
                            {formatEGP(product.price)}
                          </span>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-[7.5px] text-[#9CA3AF] line-through block">
                              {formatEGP(product.originalPrice)}
                            </span>
                          )}
                        </div>

                        {quantity > 0 ? (
                          <div
                            className="flex items-center gap-0.5 bg-[#FFF2EC] border border-[#FFD4C2] rounded-lg px-1 py-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => updateQuantity(cartItem!.id, -1)}
                              className="w-3.5 h-3.5 bg-white text-[#FF5900] rounded flex items-center justify-center font-black"
                              aria-label="تقليل"
                            >
                              <Minus size={8} strokeWidth={3} />
                            </button>
                            <span className="text-[11px] font-black text-[#FF5900] px-0.5">{quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(cartItem!.id, 1)}
                              className="w-3.5 h-3.5 bg-[#FF5900] text-white rounded flex items-center justify-center font-black"
                              aria-label="زيادة"
                            >
                              <Plus size={8} strokeWidth={3} />
                            </button>
                          </div>
                        ) : (
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
                            className="w-6 h-6 rounded-lg bg-[#FFF2EC] active:bg-[#FF5900] text-[#FF5900] active:text-white flex items-center justify-center font-black shadow-2xs"
                            aria-label={`إضافة ${product.name}`}
                          >
                            <Plus size={13} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-white rounded-2xl border border-[#E5E7EB] p-4">
              <ShoppingBag size={24} className="text-[#9CA3AF] mx-auto mb-1.5" />
              <p className="text-xs font-bold text-[#6B7280]">لا توجد نتائج في هذا القسم</p>
              <button
                type="button"
                onClick={() => { setSelectedCategory(null); setActiveFilter('all'); }}
                className="mt-2 text-xs font-black text-[#FF5900]"
              >
                عرض كل الأصناف
              </button>
            </div>
          )}
        </section>

        {/* Soft Launch Entity Line */}
        <div className="text-center py-4 text-[9.5px] text-[#9CA3AF] font-bold">
          {LAUNCH_CONFIG.entityLine}
        </div>
          </>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════
          9. STICKY FLOATING CART BAR (Displays when Cart > 0)
          ══════════════════════════════════════════════════════════════ */}
      {cartItemCount > 0 && (
        <aside
          aria-label="سلة المشتريات السريعة"
          className="fixed bottom-16 inset-x-3.5 z-40 animate-fade-in-up"
        >
          <div
            role="button"
            tabIndex={0}
            aria-label="سلة المشتريات السريعة"
            onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();handleOpenCart()}}}
            onClick={handleOpenCart}
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

            <div className="flex items-center gap-1 text-xs font-black bg-white/20 px-3 py-1.5 rounded-xl">
              <span>إتمام الطلب</span>
              <ChevronLeft size={14} />
            </div>
          </div>
        </aside>
      )}

      {/* ══════════════════════════════════════════════════════════════
          9.5 LIVE ORDER TRACKING FLOATING BANNER
          ══════════════════════════════════════════════════════════════ */}
      {activeOrder && (
        <aside
          onClick={() => {
            if (onOpenTrackingModal) onOpenTrackingModal();
            else navigate('/track');
          }}
          className="fixed bottom-[64px] inset-x-3 z-45 bg-[#111827] text-white p-2.5 rounded-2xl shadow-xl border border-white/10 flex items-center justify-between cursor-pointer animate-in slide-in-from-bottom-2 duration-200"
          aria-label="تتبع الطلب الجاري"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FFF2EC] p-0.5 flex items-center justify-center shrink-0 border border-[#FFD4C2]">
              <img
                src="/assets/sangoub/sangoub-trio-7.png"
                alt="تتبع الطلب"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-white flex items-center gap-1.5 truncate">
                <span>طلبك قيد التوصيل ({activeOrder.orderId})</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              </p>
              <p className="text-[10px] text-gray-300">
                {LAUNCH_CONFIG.showEta
                  ? `وقت الوصول التقديري: ${activeOrder.time || '15-25 دقيقة'}`
                  : 'حالة الطلب: قيد التوصيل والمتابعة'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-black bg-[#FF5900] text-white px-3 py-1.5 rounded-xl shadow-xs shrink-0">
            <span>تتبع الآن 🛵</span>
          </div>
        </aside>
      )}

      {/* ══════════════════════════════════════════════════════════════
          10. INSTAGRAM-STYLE FLOATING MOBILE BOTTOM NAVIGATION DOCK
          ══════════════════════════════════════════════════════════════ */}
      <nav
        className="fixed bottom-3 inset-x-3 max-w-lg mx-auto z-50 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-1.5 flex items-center justify-around shadow-[0_8px_32px_rgba(0,0,0,0.14)] transition-all"
        aria-label="شريط التنقل السفلي العائم"
      >
        <button
          type="button"
          onClick={() => { setSelectedCategory(null); setActiveFilter('all'); navigate('/'); }}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all cursor-pointer ${
            currentPath === '/' ? 'text-[#FF5900] font-black' : 'text-[#6B7280] font-bold hover:text-[#111827]'
          }`}
        >
          <Home size={19} strokeWidth={currentPath === '/' ? 2.5 : 1.8} />
          <span className="text-[10px] mt-0.5">الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/stores')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all cursor-pointer ${
            currentPath.startsWith('/stores') ? 'text-[#FF5900] font-black' : 'text-[#6B7280] font-bold hover:text-[#111827]'
          }`}
        >
          <StoreIcon size={19} strokeWidth={currentPath.startsWith('/stores') ? 2.5 : 1.8} />
          <span className="text-[10px] mt-0.5">المتاجر</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/my-orders')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all cursor-pointer ${
            isOrdersPage ? 'text-[#FF5900] font-black' : 'text-[#6B7280] font-bold hover:text-[#111827]'
          }`}
        >
          <Clock size={19} strokeWidth={isOrdersPage ? 2.5 : 1.8} />
          <span className="text-[10px] mt-0.5">طلباتي</span>
        </button>

        <button
          type="button"
          onClick={handleOpenCart}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all cursor-pointer relative ${
            isCartModalOpen ? 'text-[#FF5900] font-black' : 'text-[#6B7280] font-bold hover:text-[#111827]'
          }`}
        >
          <div className="relative">
            <ShoppingBag size={19} strokeWidth={isCartModalOpen ? 2.5 : 1.8} />
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -left-2 bg-[#FF5900] text-white text-[9px] font-black min-w-[15px] h-3.5 px-0.5 rounded-full flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5">السلة</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/account')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all cursor-pointer ${
            isAccountPage ? 'text-[#FF5900] font-black' : 'text-[#6B7280] font-bold hover:text-[#111827]'
          }`}
        >
          <User size={19} strokeWidth={isAccountPage ? 2.5 : 1.8} />
          <span className="text-[10px] mt-0.5">حسابي</span>
        </button>
      </nav>

      {/* Product Details Modal */}
      <ProductModal
        product={selectedProductForModal}
        onClose={() => setSelectedProductForModal(null)}
        onSelectProduct={(p) => setSelectedProductForModal(p)}
      />

      {/* Cart & Checkout Modal (Fallback if not provided by parent) */}
      {!onOpenCartModal && (
        <CartCheckoutModal
          isOpen={isCartModalOpen}
          onClose={() => {
            setIsCartModalOpen(false);
            if (currentPath === '/cart') navigate('/');
          }}
          onRequestRegister={() => {
            setIsCartModalOpen(false);
            setIsRegisterModalOpen(true);
          }}
          onOpenAreaModal={onOpenAreaModal}
          onOrderPlaced={() => {
            if (onOpenTrackingModal) onOpenTrackingModal();
          }}
        />
      )}

      {/* Sangoub Authentication & Profile Modal (Fallback if not provided by parent) */}
      {!onOpenRegisterModal && (
        <SangoubAuthModal
          isOpen={isRegisterModalOpen}
          onClose={() => {
            setIsRegisterModalOpen(false);
            if (currentPath === '/login' || currentPath === '/register' || currentPath === '/account' || currentPath === '/profile') navigate('/');
          }}
          onSuccess={() => {
            setIsRegisterModalOpen(false);
            if (cartItemCount > 0) {
              setIsCartModalOpen(true);
            }
          }}
        />
      )}

    </div>
  );
};
