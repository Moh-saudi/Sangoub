import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductModal } from '../components/ProductModal';
import { CartCheckoutModal } from '../components/CartCheckoutModal';
import { SangoubAuthModal } from '../components/SangoubAuthModal';
import { formatEGP } from '../../utils/orderCalculations';
import type { Product } from '../../types';
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
  ArrowLeft
} from 'lucide-react';

interface MobileStorefrontProps {
  onOpenAreaModal: () => void;
  onOpenCartModal?: () => void;
  onOpenRegisterModal?: () => void;
  onOpenTrackingModal?: () => void;
  activeOrder?: any;
}

// 8 Core Talabat Mobile Services
const TALABAT_MOBILE_SERVICES = [
  {
    id: 'food',
    name: 'مطاعم',
    badge: 'خصم 50%',
    badgeColor: 'bg-[#FF5900]',
    bgColor: 'bg-[#FFF2EC]',
    textColor: 'text-[#FF5900]',
    icon: UtensilsCrossed,
    query: 'وجبات',
  },
  {
    id: 'mart',
    name: 'سنجوب بقالة',
    badge: '20 دقيقة ⚡',
    badgeColor: 'bg-[#059669]',
    bgColor: 'bg-[#ECFDF5]',
    textColor: 'text-[#059669]',
    icon: Zap,
    query: 'سوبرماركت',
  },
  {
    id: 'groceries',
    name: 'سوبرماركت',
    badge: 'عروض',
    badgeColor: 'bg-[#2563EB]',
    bgColor: 'bg-[#EFF6FF]',
    textColor: 'text-[#2563EB]',
    icon: Milk,
    query: 'سوبرماركت وبقالة',
  },
  {
    id: 'coffee',
    name: 'كافيهات',
    badge: 'طازج',
    badgeColor: 'bg-[#9333EA]',
    bgColor: 'bg-[#FAF5FF]',
    textColor: 'text-[#9333EA]',
    icon: Coffee,
    query: 'مشروبات وكافيهات',
  },
  {
    id: 'pharmacy',
    name: 'صيدلية',
    badge: '24/7',
    badgeColor: 'bg-[#E11D48]',
    bgColor: 'bg-[#FFF1F2]',
    textColor: 'text-[#E11D48]',
    icon: HeartPulse,
    query: 'صيدلية وعناية',
  },
  {
    id: 'breakfast',
    name: 'فطور',
    badge: 'صباحي',
    badgeColor: 'bg-[#D97706]',
    bgColor: 'bg-[#FFFBEB]',
    textColor: 'text-[#D97706]',
    icon: Sandwich,
    query: 'فطور ومخبوزات',
  },
  {
    id: 'sandwiches',
    name: 'سندوتشات',
    badge: 'سريع',
    badgeColor: 'bg-[#EA580C]',
    bgColor: 'bg-[#FFF7ED]',
    textColor: 'text-[#EA580C]',
    icon: Pizza,
    query: 'سندوتشات وشاورما',
  },
  {
    id: 'fruits',
    name: 'خضار وفواكه',
    badge: 'طازج',
    badgeColor: 'bg-[#16A34A]',
    bgColor: 'bg-[#F0FDF4]',
    textColor: 'text-[#16A34A]',
    icon: Apple,
    query: 'خضار وفواكه',
  },
];

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
    user
  } = useStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'offers' | 'popular' | 'fast_delivery'>('all');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
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
    }
  }, [currentPath]);

  // Slider State & Touch Gestures
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const slides = [
    {
      id: 1,
      tag: 'أسرع توصيل طلبات',
      title: 'سنجوب يوصلك لحد باب بيتك أو مكتبك 🐿️',
      desc: 'خدمة التوصيل السريع لطلبك في 15-25 دقيقة أينما كنت.',
      btnText: 'اطلب الآن',
      badgeColor: '#FF5900',
      bgGradient: 'linear-gradient(135deg, #131921 0%, #1F2937 100%)',
      mascotImg: '/assets/sangoub/mascot-cheerful.png',
    },
    {
      id: 2,
      tag: 'فطور الصباح الساخن',
      title: 'قهوة وفطور طازج لبداية يوم مميز ☕',
      desc: 'ساندوتشات ومخبوزات ومشروبات ساخنة بأعلى جودة.',
      btnText: 'عروض الفطور',
      badgeColor: '#E65100',
      bgGradient: 'linear-gradient(135deg, #1E1B4B 0%, #2E1065 100%)',
      mascotImg: '/assets/sangoub/mascot-delivery.png',
    },
    {
      id: 3,
      tag: 'بقالة في 20د',
      title: 'سنجوب بقالة ومقاضي البيت السريعة 🛒',
      desc: 'ألبان ومياه وسناكس ومستلزماتك بأسرع توصيل.',
      btnText: 'تسوق البقالة',
      badgeColor: '#059669',
      bgGradient: 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
      mascotImg: '/assets/sangoub/mascot-trio.png',
    },
  ];

  // Auto-slide
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 40) {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    } else if (diff < -40) {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }
    touchStartX.current = null;
  };

  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Flash deals
  const flashDeals = useMemo(() => {
    return products.filter(
      (p) => (p.originalPrice && p.originalPrice > p.price) || p.badge?.includes('عرض') || p.badge?.includes('خصم')
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
      const target = selectedCategory.toLowerCase();
      list = list.filter((p) => {
        const cat = (p.category || '').toLowerCase();
        return cat.includes(target) || target.includes(cat);
      });
    }

    if (activeFilter === 'offers') {
      list = list.filter((p) => (p.originalPrice && p.originalPrice > p.price) || p.badge?.includes('عرض'));
    } else if (activeFilter === 'popular') {
      list = list.filter((p) => p.isPopular || p.badge?.includes('طلب'));
    } else if (activeFilter === 'fast_delivery') {
      list = list.filter((p) => p.category === 'فطور' || p.category === 'سندوتشات' || p.category === 'مشروبات');
    }

    return list;
  }, [products, searchQuery, selectedCategory, activeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const el = document.getElementById('mobile-products-grid');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] text-[#1F2937] pb-24 font-['Cairo',sans-serif] select-none" dir="rtl">
      
      {/* ══════════════════════════════════════════════════════════════
          1. TALABAT MOBILE NATIVE APP BAR
          ══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#F0F1F3] px-3.5 pt-2 pb-2.5 shadow-2xs">
        
        {/* Top Mini Row: Location & Brand */}
        <div className="flex items-center justify-between gap-2 mb-2">
          
          {/* Location Picker (1 Tap to switch) */}
          <button
            type="button"
            onClick={onOpenAreaModal}
            className="flex items-center gap-1.5 text-right active:opacity-75 transition-opacity"
            aria-label="تغيير موقع التوصيل"
          >
            <div className="w-7 h-7 rounded-full bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center shrink-0">
              <MapPin size={15} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] text-[#6B7280] font-bold">التوصيل إلى</span>
              <span className="text-xs font-black text-[#111827] flex items-center gap-1 max-w-[190px] truncate">
                <span>{serviceArea.name || 'حدد موقعك على الخريطة'}</span>
                <ChevronDown size={12} className="text-[#FF5900] shrink-0" />
              </span>
            </div>
          </button>

          {/* Sangoub Avatar & Brand */}
          <div className="flex items-center gap-1.5">
            <div className="flex flex-col items-end leading-none">
              <span className="text-xs font-black text-[#FF5900] tracking-tight">سنجوب</span>
              <span className="text-[8px] font-bold text-[#6B7280] tracking-wider uppercase">Sangoub</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#FFF2EC] border border-[#FFD4C2] flex items-center justify-center overflow-hidden">
              <img 
                src="/assets/sangoub/sangoub-favicon.png" 
                alt="سنجوب Sangoub" 
                className="w-6 h-6 object-contain"
              />
            </div>
          </div>

        </div>

        {/* Search Bar Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full bg-[#F3F4F6] rounded-xl border border-[#E5E7EB] focus-within:border-[#FF5900] focus-within:bg-white transition-all px-2.5 py-1.5">
          <Search size={15} className="text-[#9CA3AF] ml-2 shrink-0 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في سنجوب عن مطعم أو وجبة..."
            className="w-full bg-transparent text-xs text-[#111827] placeholder-[#9CA3AF] outline-none"
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

        {/* 2. DEDICATED MOBILE HERO SLIDER (Compact 120px Height) */}
        <div
          className="relative rounded-2xl overflow-hidden shadow-xs bg-[#131921] w-full"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="relative w-full h-[120px]">
            {slides.map((slide, index) => {
              const isActive = currentSlide === index;
              return (
                <div
                  key={slide.id}
                  onClick={() => setSelectedCategory(slide.id === 2 ? 'فطور ومخبوزات' : slide.id === 3 ? 'سوبرماركت' : null)}
                  className={`absolute inset-0 transition-opacity duration-300 ease-in-out cursor-pointer ${
                    isActive ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'
                  }`}
                  style={{ background: slide.bgGradient }}
                >
                  <div className="relative z-10 w-full h-full px-3 py-2 flex items-center justify-between gap-2">
                    
                    {/* Text */}
                    <div className="flex-1 max-w-[65%] flex flex-col justify-center space-y-1">
                      <span
                        className="inline-flex items-center gap-1 text-[8.5px] font-black px-2 py-0.2 rounded-full text-white w-fit shadow-2xs"
                        style={{ backgroundColor: slide.badgeColor }}
                      >
                        <Sparkles size={8} />
                        <span>{slide.tag}</span>
                      </span>

                      <h2 className="text-[11.5px] font-black text-white leading-tight line-clamp-2">
                        {slide.title}
                      </h2>

                      <div className="pt-0.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#FF5900] text-white text-[9.5px] font-black shadow-xs">
                          <span>{slide.btnText}</span>
                          <ArrowLeft size={9} />
                        </span>
                      </div>
                    </div>

                    {/* Mascot Illustration */}
                    <div className="w-[32%] h-full flex items-center justify-center shrink-0">
                      <img
                        src={slide.mascotImg}
                        alt="سنجوب Sangoub"
                        className="max-h-[102px] w-auto object-contain drop-shadow-md"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/assets/sangoub/sangoub-favicon.png';
                        }}
                      />
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          {/* Dots */}
          <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center gap-1 z-20 pointer-events-none">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  currentSlide === i ? 'w-3.5 bg-[#FF5900]' : 'w-1 bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 3. SANGOUB CATEGORIES HORIZONTAL SLIDER (Ultra-Compact 11x11 Squircles) */}
        <section aria-labelledby="mobile-categories-heading">
          <div className="flex items-center justify-between px-1 mb-1.5">
            <h2 id="mobile-categories-heading" className="text-xs font-black text-[#111827] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5900]" />
              <span>أقسام سنجوب</span>
            </h2>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="text-[10px] font-bold text-[#FF5900] hover:underline"
              >
                إلغاء التحديد ✕
              </button>
            )}
          </div>

          {/* Smooth Horizontal Touch Scroll of Categories (With Top Padding to prevent badge clipping) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-3.5 pb-1 -mx-3.5 px-3.5">
            {TALABAT_MOBILE_SERVICES.map((serv) => {
              const Icon = serv.icon;
              const isSelected = selectedCategory === serv.query;

              return (
                <button
                  key={serv.id}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? null : serv.query)}
                  className="flex flex-col items-center gap-1 shrink-0 w-[58px] active:scale-95 transition-transform"
                >
                  <div
                    className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-[#FF5900] text-white shadow-md shadow-[#FF5900]/30 scale-105'
                        : `${serv.bgColor} ${serv.textColor} border border-black/5 shadow-2xs`
                    }`}
                  >
                    <Icon size={20} strokeWidth={2.2} />
                    {serv.badge && (
                      <span
                        className={`absolute -top-1.5 -right-1 text-[6.5px] font-black px-1 py-0.2 rounded-full shadow-2xs ${
                          isSelected ? 'bg-white text-[#FF5900]' : `${serv.badgeColor} text-white`
                        }`}
                      >
                        {serv.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[9.5px] font-bold truncate w-full text-center ${
                      isSelected ? 'text-[#FF5900] font-black' : 'text-[#374151]'
                    }`}
                  >
                    {serv.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. SANGOUB GROCERY QUICK BAR */}
        <div
          onClick={() => setSelectedCategory('سوبرماركت')}
          className="bg-gradient-to-r from-[#FF5900] to-[#E04E00] rounded-2xl p-2.5 text-white shadow-xs flex items-center justify-between gap-2 cursor-pointer active:scale-98 transition-transform"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white text-[#FF5900] flex items-center justify-center shrink-0 font-black">
              <Zap size={18} className="fill-[#FF5900]" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black">سنجوب بقالة</span>
                <span className="text-[8px] bg-white/25 px-1.5 py-0.2 rounded-full font-bold">20 دقيقة ⚡</span>
              </div>
              <p className="text-[9px] text-white/90">بقالة ومقاضي البيت لحد بابك</p>
            </div>
          </div>
          <span className="text-[10px] font-black bg-white text-[#FF5900] px-2.5 py-1 rounded-xl shrink-0">
            اطلب الآن
          </span>
        </div>

        {/* 6. FLASH DEALS (Horizontal Swipe) */}
        {flashDeals.length > 0 && (
          <section aria-labelledby="mobile-flash-deals">
            <div className="flex items-center justify-between px-1 mb-2">
              <h2 id="mobile-flash-deals" className="text-xs font-black text-[#111827] flex items-center gap-1">
                <Flame size={15} className="text-[#FF5900]" />
                <span>عروض التوفير الحصرية 🔥</span>
              </h2>
              <button
                type="button"
                onClick={() => { setActiveFilter('offers'); setSelectedCategory(null); }}
                className="text-[10px] font-bold text-[#FF5900] flex items-center gap-0.5"
              >
                <span>الكل</span>
                <ChevronLeft size={11} />
              </button>
            </div>

            <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-3.5 px-3.5">
              {flashDeals.map((product) => {
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
                          src={product.imageUrl || '/assets/sangoub/sangoub-favicon.png'}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/assets/sangoub/sangoub-favicon.png';
                          }}
                        />
                        <span className="absolute top-1 right-1 bg-[#EF4444] text-white text-[8px] font-black px-1.5 py-0.2 rounded-md">
                          خصم
                        </span>
                      </div>
                      <h3 className="text-[11px] font-black text-[#111827] line-clamp-1 mb-0.5">
                        {product.name}
                      </h3>
                      <p className="text-[9px] text-[#6B7280] truncate mb-1">
                        {product.storeName}
                      </p>
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
                        src={product.imageUrl || '/assets/sangoub/sangoub-favicon.png'}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/assets/sangoub/sangoub-favicon.png';
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
                وقت الوصول التقديري: {activeOrder.time || '15-25 دقيقة'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-black bg-[#FF5900] text-white px-3 py-1.5 rounded-xl shadow-xs shrink-0">
            <span>تتبع الآن 🛵</span>
          </div>
        </aside>
      )}

      {/* ══════════════════════════════════════════════════════════════
          10. FIXED MOBILE BOTTOM NAVIGATION
          ══════════════════════════════════════════════════════════════ */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] px-3 py-1.5 flex items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
        aria-label="شريط التنقل السفلي"
      >
        <button
          type="button"
          onClick={() => { setSelectedCategory(null); setActiveFilter('all'); navigate('/'); }}
          className={`flex flex-col items-center justify-center flex-1 py-1 ${
            currentPath === '/' ? 'text-[#FF5900] font-black' : 'text-[#6B7280] font-bold'
          }`}
        >
          <Home size={20} strokeWidth={currentPath === '/' ? 2.5 : 1.8} />
          <span className="text-[10px] mt-0.5">الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => { setSelectedCategory('وجبات'); navigate('/categories'); }}
          className={`flex flex-col items-center justify-center flex-1 py-1 ${
            currentPath.startsWith('/categories') ? 'text-[#FF5900] font-black' : 'text-[#6B7280] font-bold'
          }`}
        >
          <LayoutGrid size={20} strokeWidth={currentPath.startsWith('/categories') ? 2.5 : 1.8} />
          <span className="text-[10px] mt-0.5">الأقسام</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveFilter('offers'); navigate('/offers'); }}
          className={`flex flex-col items-center justify-center flex-1 py-1 ${
            currentPath.startsWith('/offers') ? 'text-[#FF5900] font-black' : 'text-[#6B7280] font-bold'
          }`}
        >
          <Tag size={20} strokeWidth={currentPath.startsWith('/offers') ? 2.5 : 1.8} />
          <span className="text-[10px] mt-0.5">العروض</span>
        </button>

        <button
          type="button"
          onClick={handleOpenCart}
          className={`flex flex-col items-center justify-center flex-1 py-1 relative ${
            isCartModalOpen ? 'text-[#FF5900] font-black' : 'text-[#6B7280] font-bold'
          }`}
        >
          <div className="relative">
            <ShoppingBag size={20} strokeWidth={isCartModalOpen ? 2.5 : 1.8} />
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
          onClick={handleOpenRegister}
          className={`flex flex-col items-center justify-center flex-1 py-1 ${
            isRegisterModalOpen ? 'text-[#FF5900] font-black' : 'text-[#6B7280] font-bold'
          }`}
        >
          <User size={20} strokeWidth={isRegisterModalOpen ? 2.5 : 1.8} />
          <span className="text-[10px] mt-0.5">{user && !user.isGuest ? 'حسابي' : 'تسجيل'}</span>
        </button>
      </nav>

      {/* Product Details Modal */}
      <ProductModal
        product={selectedProductForModal}
        onClose={() => setSelectedProductForModal(null)}
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
