import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { HeroSlider } from '../components/HeroSlider';
import { ProductModal } from '../components/ProductModal';
import { formatEGP } from '../../utils/orderCalculations';
import { LAUNCH_CONFIG } from '../../config/launchConfig';
import type { Product } from '../../types';
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
  Store as StoreIcon,
  Sandwich
} from 'lucide-react';

interface HomePageProps {
  onOpenAreaModal: () => void;
}

// 8 Core Talabat Categories with clean mobile-first styling
const TALABAT_MAIN_SERVICES = [
  {
    id: 'food',
    name: 'مطاعم',
    subtext: 'خصم 50%',
    badge: 'شائع',
    badgeColor: 'bg-[#FF5900]',
    bgColor: 'bg-[#FFF2EC]',
    textColor: 'text-[#FF5900]',
    icon: UtensilsCrossed,
    categoryQuery: 'وجبات',
  },
  {
    id: 'mart',
    name: 'سنجوب بقالة',
    subtext: 'مقاضي وسوبرماركت',
    badge: 'طازج',
    badgeColor: 'bg-[#059669]',
    bgColor: 'bg-[#ECFDF5]',
    textColor: 'text-[#059669]',
    icon: Zap,
    categoryQuery: 'سوبرماركت',
  },
  {
    id: 'groceries',
    name: 'سوبرماركت',
    subtext: 'مقاضي البيت',
    badge: 'عروض',
    badgeColor: 'bg-[#2563EB]',
    bgColor: 'bg-[#EFF6FF]',
    textColor: 'text-[#2563EB]',
    icon: Milk,
    categoryQuery: 'سوبرماركت وبقالة',
  },
  {
    id: 'coffee_sweets',
    name: 'كافيهات',
    subtext: 'قهوة وسناكس',
    badge: 'طازج',
    badgeColor: 'bg-[#9333EA]',
    bgColor: 'bg-[#FAF5FF]',
    textColor: 'text-[#9333EA]',
    icon: Coffee,
    categoryQuery: 'مشروبات وكافيهات',
  },
  {
    id: 'pharmacy',
    name: 'صيدلية',
    subtext: 'عناية وصحة',
    badge: '24/7',
    badgeColor: 'bg-[#E11D48]',
    bgColor: 'bg-[#FFF1F2]',
    textColor: 'text-[#E11D48]',
    icon: HeartPulse,
    categoryQuery: 'صيدلية وعناية',
  },
  {
    id: 'breakfast',
    name: 'فطور',
    subtext: 'مخبوزات وفول',
    badge: 'صباحي',
    badgeColor: 'bg-[#D97706]',
    bgColor: 'bg-[#FFFBEB]',
    textColor: 'text-[#D97706]',
    icon: Sandwich,
    categoryQuery: 'فطور ومخبوزات',
  },
  {
    id: 'shawarma_sandwiches',
    name: 'سندوتشات',
    subtext: 'شاورما وحواوشي',
    badge: 'سريع',
    badgeColor: 'bg-[#EA580C]',
    bgColor: 'bg-[#FFF7ED]',
    textColor: 'text-[#EA580C]',
    icon: Pizza,
    categoryQuery: 'سندوتشات وشاورما',
  },
  {
    id: 'fruits_veg',
    name: 'خضار وفواكه',
    subtext: 'طازج يومياً',
    badge: 'طبيعي',
    badgeColor: 'bg-[#16A34A]',
    bgColor: 'bg-[#F0FDF4]',
    textColor: 'text-[#16A34A]',
    icon: Apple,
    categoryQuery: 'خضار وفواكه',
  },
];

export const HomePage: React.FC<HomePageProps> = ({ onOpenAreaModal }) => {
  const { 
    products, 
    stores, 
    applyCoupon, 
    appliedCoupon, 
    navigate,
    cartItems,
    subtotal,
    addToCart
  } = useStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'offers' | 'popular' | 'fast_delivery'>('all');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [couponCopied, setCouponCopied] = useState(false);

  const displayedServices = useMemo(() => {
    return TALABAT_MAIN_SERVICES.filter((serv) =>
      LAUNCH_CONFIG.enabledCategories.length === 0 || LAUNCH_CONFIG.enabledCategories.includes(serv.id)
    );
  }, []);

  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Flash deals & discounted products
  const flashDeals = useMemo(() => {
    return products.filter(
      (p) => (p.originalPrice && p.originalPrice > p.price) || p.badge?.includes('عرض') || p.badge?.includes('خصم')
    ).slice(0, 10);
  }, [products]);

  // Filter products by category or active filter
  const displayedProducts = useMemo(() => {
    let list = [...products];

    if (selectedCategory) {
      list = list.filter((p) => {
        const cat = (p.category || '').toLowerCase();
        const target = selectedCategory.toLowerCase();
        return cat.includes(target) || target.includes(cat);
      });
    }

    if (activeFilter === 'offers') {
      list = list.filter((p) => (p.originalPrice && p.originalPrice > p.price) || p.badge?.includes('عرض'));
    } else if (activeFilter === 'popular') {
      list = list.filter((p) => p.isPopular || p.badge?.includes('طلب') || p.badge?.includes('الأكثر'));
    } else if (activeFilter === 'fast_delivery') {
      list = list.filter((p) => p.category === 'فطور' || p.category === 'سندوتشات' || p.category === 'مشروبات');
    }

    return list;
  }, [products, selectedCategory, activeFilter]);

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

  const handleCopyCoupon = () => {
    applyCoupon('SANGOUB10');
    setCouponCopied(true);
    setTimeout(() => setCouponCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] pb-28 sm:pb-20 text-[#1F2937] overflow-x-hidden" dir="rtl">
      
      {/* ── Main Container ── */}
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 pt-3 sm:pt-6">

        {/* 1. HERO SLIDER */}
        <section className="mb-6">
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

        {/* 3. TALABAT CORE CATEGORIES (4 Cols on Mobile, 8 Cols on Desktop) */}
        <section aria-labelledby="talabat-services-heading" className="mb-6">
          <div className="flex items-center justify-between px-1 mb-2.5">
            <h2 id="talabat-services-heading" className="text-sm sm:text-base font-black text-[#111827] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF5900]" />
              <span>أقسام وخدمات سنجوب</span>
            </h2>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="text-xs font-bold text-[#FF5900] hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <span>عرض الكل</span>
              <ChevronLeft size={13} />
            </button>
          </div>

          {/* Squircles Grid */}
          <div className={`grid gap-2.5 sm:gap-3.5 w-full ${
            displayedServices.length <= 4 
              ? 'grid-cols-2 sm:grid-cols-4 max-w-md mx-auto' 
              : 'grid-cols-4 sm:grid-cols-4 lg:grid-cols-8'
          }`}>
            {displayedServices.map((serv) => {
              const Icon = serv.icon;
              const isSelected = selectedCategory === serv.categoryQuery;

              return (
                <button
                  key={serv.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(isSelected ? null : serv.categoryQuery);
                  }}
                  className="flex flex-col items-center gap-1.5 p-1 rounded-2xl transition-all cursor-pointer group text-center active:scale-95"
                >
                  {/* Squircle Icon Box */}
                  <div
                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-[#FF5900] text-white shadow-md shadow-[#FF5900]/30 scale-105 ring-2 ring-[#FF5900]'
                        : `${serv.bgColor} ${serv.textColor} border border-black/5 shadow-2xs group-hover:scale-105`
                    }`}
                  >
                    <Icon size={24} strokeWidth={2.2} />

                    {/* Mini Badge */}
                    {serv.badge && (
                      <span 
                        className={`absolute -top-1.5 -right-1 text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-2xs ${
                          isSelected ? 'bg-white text-[#FF5900]' : `${serv.badgeColor} text-white`
                        }`}
                      >
                        {serv.badge}
                      </span>
                    )}
                  </div>

                  {/* Category Title */}
                  <span className={`text-[11px] sm:text-xs font-black transition-colors truncate w-full ${
                    isSelected ? 'text-[#FF5900]' : 'text-[#1F2937] group-hover:text-[#FF5900]'
                  }`}>
                    {serv.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. COMPACT TALABAT MART BANNER (Clean Height & No Overlaps) */}
        <section className="mb-6">
          <div className="bg-gradient-to-r from-[#FF5900] via-[#FF6A1A] to-[#FF4500] rounded-2xl p-3.5 sm:p-5 text-white shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-[#FF5900] flex items-center justify-center shrink-0 shadow-xs">
                <Zap size={22} className="fill-[#FF5900]" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] bg-white/20 text-white px-2 py-0.2 rounded-full font-black">
                    سنجوب بقالة ⚡
                  </span>
                  <span className="text-[9px] bg-white text-[#FF5900] px-1.5 py-0.2 rounded-full font-black">
                    {LAUNCH_CONFIG.serviceAreaLabel}
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-black line-clamp-1">
                  سنجوب بقالة ومقاضي البيت لحد بابك
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedCategory('سوبرماركت وبقالة');
              }}
              className="px-3.5 py-1.5 bg-white text-[#FF5900] rounded-xl text-xs font-black shrink-0 shadow-xs active:scale-95 transition-transform"
            >
              تسوق الآن
            </button>
          </div>
        </section>

        {/* 5. FLASH DEALS (Horizontal Touch Scroll with Clean Snap) */}
        {flashDeals.length > 0 && (
          <section aria-labelledby="deals-heading" className="mb-6">
            <div className="flex items-center justify-between px-1 mb-2.5">
              <div>
                <h2 id="deals-heading" className="text-sm sm:text-base font-black text-[#111827] flex items-center gap-1.5">
                  <Flame size={18} className="text-[#FF5900]" />
                  <span>الأكثر طلباً ومقاضي اليوم ⭐</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('offers');
                  setSelectedCategory(null);
                }}
                className="text-xs font-bold text-[#FF5900] hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span>عرض الكل</span>
                <ChevronLeft size={13} />
              </button>
            </div>

            {/* Horizontal Scroll Track */}
            <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
              {flashDeals.map((product) => {
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
                      {/* Product Image & Badge */}
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#F9FAFB] mb-2">
                        <img
                          src={product.imageUrl || '/brand/sangoub-mark-white-128.png'}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
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
        )}

        {/* 6. POPULAR STORES HORIZONTAL SCROLL (Hidden in soft launch to protect merchant privacy) */}
        {!LAUNCH_CONFIG.hideMerchantNames && stores.length > 0 && (
          <section aria-labelledby="stores-heading" className="mb-6">
            <div className="flex items-center justify-between px-1 mb-2.5">
              <h2 id="stores-heading" className="text-sm sm:text-base font-black text-[#111827] flex items-center gap-1.5">
                <StoreIcon size={18} className="text-[#FF5900]" />
                <span>المطاعم والشركاء ⭐</span>
              </h2>
              <button
                type="button"
                onClick={() => setSelectedCategory('وجبات')}
                className="text-xs font-bold text-[#FF5900] hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span>جميع الشركاء</span>
                <ChevronLeft size={13} />
              </button>
            </div>

            {/* Horizontal Stores Scroll */}
            <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
              {stores.map((store) => (
                <div
                  key={store.id}
                  onClick={() => setSelectedCategory(store.name)}
                  className="w-[210px] sm:w-[240px] shrink-0 bg-white border border-[#E5E7EB] hover:border-[#FF5900]/40 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between select-none"
                >
                  {/* Store Banner */}
                  <div className="relative h-24 w-full bg-[#E5E7EB] overflow-hidden">
                    <img
                      src={store.bannerUrl || store.imageUrl || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80'}
                      alt={store.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    
                    {/* Delivery Time Badge */}
                    <span className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-xs text-[#111827] text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs flex items-center gap-1">
                      <Clock size={10} className="text-[#FF5900]" />
                      <span>{store.deliveryTime || '20-30 دقيقة'}</span>
                    </span>

                    {/* Delivery Fee Badge */}
                    <span className="absolute bottom-2 left-2 bg-[#059669] text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs">
                      {store.deliveryFee === 0 ? 'توصيل مجاني 🛵' : `توصيل ${formatEGP(store.deliveryFee)}`}
                    </span>
                  </div>

                  {/* Store Details */}
                  <div className="p-3 space-y-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="truncate">
                        <h3 className="text-xs sm:text-sm font-black text-[#111827] group-hover:text-[#FF5900] transition-colors truncate">
                          {store.name}
                        </h3>
                        <p className="text-[10px] text-[#6B7280] truncate">
                          {store.type || 'مطعم فطور وسندوتشات'}
                        </p>
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-0.5 bg-[#FFFBEB] border border-[#FDE68A] text-[#D97706] px-1.5 py-0.2 rounded-md text-[10px] font-black shrink-0">
                        <Star size={10} className="fill-[#D97706]" />
                        <span>{store.rating || 4.8}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7. VOUCHER & PROMO COUPON CARD (Hidden during soft launch) */}
        {LAUNCH_CONFIG.showCouponField && (
          <section className="mb-6">
            <div className="bg-gradient-to-r from-[#FFF5F0] via-white to-[#FFF5F0] border border-[#FFD4C2] rounded-2xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF5900] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Percent size={20} strokeWidth={2.5} />
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="bg-[#FF5900] text-white text-[9px] font-black px-2 py-0.2 rounded-full">
                      خصم 10%
                    </span>
                    <span className="text-xs font-black text-[#111827] font-mono">
                      SANGOUB10
                    </span>
                  </div>
                  <p className="text-[10px] text-[#6B7280]">
                    وفّر 10% فوراً على أول طلب لك في العاصمة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyCoupon}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  couponCopied || appliedCoupon?.code === 'SANGOUB10'
                    ? 'bg-[#10B981] text-white'
                    : 'bg-[#FF5900] hover:bg-[#E04E00] text-white active:scale-95'
                }`}
              >
                {couponCopied || appliedCoupon?.code === 'SANGOUB10' ? (
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

        {/* 8. PRODUCTS CATALOG & FILTER TABS (2 Cols on Mobile!) */}
        <section id="products-catalog" aria-labelledby="products-catalog-heading" className="mb-8">
          {/* Section Header & Filter Tabs */}
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

            {/* Filter Tabs Pills (Horizontal Scrollable on Mobile) */}
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

          {/* Products Grid: 2 cols on mobile, 3 on tablet, 4 on desktop */}
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

        {/* 9. TALABAT VALUE PROPOSITIONS & GUARANTEES */}
        <section className="bg-white border border-[#E5E7EB] rounded-2xl p-4 sm:p-6 shadow-xs mb-8">
          <div className="text-center max-w-md mx-auto mb-4">
            <span className="text-[10px] font-black text-[#FF5900] bg-[#FFF2EC] px-2.5 py-0.5 rounded-full uppercase">
              لماذا سنجوب Sangoub؟
            </span>
            <h3 className="text-sm sm:text-base font-black text-[#111827] mt-1.5">
              توصيل فوري لمكاتب ومنازل العاصمة الإدارية
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
            <div className="flex flex-col items-center text-center p-3 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]">
              <div className="w-9 h-9 rounded-xl bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center mb-1.5">
                <Bike size={18} />
              </div>
              <h4 className="text-[11px] font-black text-[#111827]">توصيل مباشر</h4>
              <p className="text-[9px] text-[#6B7280]">خدمة سريعة في {LAUNCH_CONFIG.serviceAreaLabel}</p>
            </div>

            <div className="flex flex-col items-center text-center p-3 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]">
              <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center mb-1.5">
                <Clock size={18} />
              </div>
              <h4 className="text-[11px] font-black text-[#111827]">تتبع مباشر</h4>
              <p className="text-[9px] text-[#6B7280]">لحظة بلحظة على الخريطة</p>
            </div>

            <div className="flex flex-col items-center text-center p-3 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]">
              <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mb-1.5">
                <ShieldCheck size={18} />
              </div>
              <h4 className="text-[11px] font-black text-[#111827]">دفع آمن</h4>
              <p className="text-[9px] text-[#6B7280]">كاش، إنستاباي، محافظ</p>
            </div>

            <div className="flex flex-col items-center text-center p-3 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]">
              <div className="w-9 h-9 rounded-xl bg-[#FAF5FF] text-[#9333EA] flex items-center justify-center mb-1.5">
                <Sparkles size={18} />
              </div>
              <h4 className="text-[11px] font-black text-[#111827]">دعم متواصل</h4>
              <p className="text-[9px] text-[#6B7280]">فريق خدمة مخصص</p>
            </div>
          </div>
        </section>

        {/* Soft Launch Entity Line */}
        <div className="text-center pb-6 pt-2 text-[10.5px] text-[#9CA3AF] font-bold">
          {LAUNCH_CONFIG.entityLine}
        </div>

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
      />

    </div>
  );
};
