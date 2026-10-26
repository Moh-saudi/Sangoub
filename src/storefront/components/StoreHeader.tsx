import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { BRAND } from '../../brand';
import { 
  Search, 
  ShoppingBag, 
  Heart, 
  User, 
  MapPin, 
  Menu, 
  X, 
  ChevronDown,
  Sparkles,
  Phone,
  Tag,
  Clock,
  ArrowRight
} from 'lucide-react';

interface StoreHeaderProps {
  onOpenAreaModal?: () => void;
  onOpenTrackingModal?: () => void;
  hasActiveOrder?: boolean;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  onOpenAreaModal,
  onOpenTrackingModal,
  hasActiveOrder,
}) => {
  const { 
    currentPath, 
    navigate, 
    cartItems, 
    wishlistIds, 
    serviceArea, 
    searchQuery, 
    setSearchQuery,
    user,
    categories
  } = useStore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navLinks = [
    { label: 'الرئيسية', path: '/' },
    { label: 'تتبع طلبك المباشر 🛵', path: '/track' },
    { label: 'أقسام المتجر', path: '/categories' },
    { label: 'المتاجر والشركاء', path: '/stores' },
    { label: 'عروض اليوم الحصرية 🔥', path: '/offers' },
    { label: 'سلة المشتريات', path: '/cart' },
    { label: 'المفضلة', path: '/wishlist' },
    { label: 'من نحن', path: '/about' },
    { label: 'تواصل معنا', path: '/contact' },
    { label: 'الأسئلة الشائعة', path: '/faq' },
    { label: 'الشروط والسياسات', path: '/policies/terms' },
  ];

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════
          TALABAT SIGNATURE CLEAN WHITE & ORANGE HEADER
          ══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#F0F1F3] shadow-xs" dir="rtl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          {/* Main Top Bar */}
          <div className="flex items-center justify-between gap-3 sm:gap-6 h-16">
            
            {/* Right: Hamburger & Brand Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="p-2 rounded-xl text-[#374151] hover:text-[#FF5900] hover:bg-[#FFF5F0] transition-colors cursor-pointer"
                aria-label="القائمة الجانبية"
                title="القائمة"
              >
                <Menu size={22} />
              </button>

              <a 
                href="/" 
                onClick={(e) => { e.preventDefault(); navigate('/'); }} 
                className="flex items-center gap-2 text-decoration-none group"
                aria-label="الرئيسية"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#FFF2EC] border border-[#FFD4C2] flex items-center justify-center shadow-xs overflow-hidden">
                  <img 
                    src="/assets/sangoub/sangoub-favicon.png" 
                    alt="شعار سنجوب Sangoub" 
                    className="w-7 h-7 object-contain group-hover:scale-105 transition-transform"
                    width="28" 
                    height="28" 
                  />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-base sm:text-lg font-black text-[#FF5900] tracking-tight">
                    سنجوب
                  </span>
                  <span className="text-[9px] font-bold text-[#6B7280] tracking-wider uppercase">
                    SANGOUB
                  </span>
                </div>
              </a>
            </div>

            {/* Middle: Talabat-Style Location Delivery Chip (Desktop & Tablet) */}
            <button
              type="button"
              onClick={onOpenAreaModal}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#F9FAFB] hover:bg-[#FFF5F0] border border-[#E5E7EB] hover:border-[#FF5900]/40 transition-all cursor-pointer shrink-0 text-right"
              title="انقر لتغيير منطقة التوصيل"
            >
              <div className="w-7 h-7 rounded-xl bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center shrink-0">
                <MapPin size={15} />
              </div>
              <div className="flex flex-col leading-tight max-w-[170px] lg:max-w-[220px]">
                <span className="text-[10px] font-bold text-[#6B7280]">
                  التوصيل إلى:
                </span>
                <span className="text-xs font-black text-[#111827] truncate flex items-center gap-1">
                  <span>{serviceArea.name || 'حدد موقعك على الخريطة'}</span>
                  <ChevronDown size={12} className="text-[#FF5900]" />
                </span>
              </div>
            </button>

            {/* Center: Search Bar (Desktop) */}
            <form onSubmit={handleSearchSubmit} className="hidden sm:flex flex-1 max-w-md mx-2">
              <div className="flex items-center w-full bg-[#F3F4F6] rounded-2xl border border-[#E5E7EB] focus-within:border-[#FF5900] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#FF5900]/10 transition-all p-1">
                <Search size={16} className="text-[#9CA3AF] mr-2 shrink-0 pointer-events-none" />
                <input
                  type="search"
                  className="w-full bg-transparent text-xs sm:text-sm text-[#111827] placeholder-[#9CA3AF] px-2 py-1 outline-none"
                  placeholder="ابحث عن مطعم، بقالة، صيدلية، أو وجبة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="بحث في المتجر"
                />
                <button 
                  type="submit" 
                  className="px-3.5 py-1.5 bg-[#FF5900] hover:bg-[#E04E00] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                  aria-label="بحث"
                >
                  بحث
                </button>
              </div>
            </form>

            {/* Left: Actions (User, Wishlist, Cart) */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              
              {/* Account button */}
              <button
                type="button"
                onClick={() => navigate(user ? '/account' : '/login')}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl hover:bg-[#F9FAFB] transition-colors cursor-pointer text-right"
                title={user ? user.fullName || 'حسابي' : 'تسجيل الدخول'}
              >
                <div className="w-8 h-8 rounded-full bg-[#F3F4F6] text-[#374151] flex items-center justify-center">
                  <User size={16} />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] text-[#9CA3AF]">
                    {user ? 'أهلاً بك،' : 'تسجيل'}
                  </span>
                  <span className="text-xs font-black text-[#111827] truncate max-w-[80px]">
                    {user ? user.fullName?.split(' ')[0] || 'حسابي' : 'الدخول'}
                  </span>
                </div>
              </button>

              {/* Wishlist */}
              <button
                type="button"
                onClick={() => navigate('/wishlist')}
                className="relative p-2 rounded-2xl hover:bg-[#FFF5F0] text-[#374151] hover:text-[#FF5900] transition-colors cursor-pointer"
                aria-label="المفضلة"
                title="المفضلة"
              >
                <Heart size={20} />
                {wishlistIds.length > 0 && (
                  <span className="absolute top-1 left-1 bg-[#FF5900] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {wishlistIds.length}
                  </span>
                )}
              </button>

              {/* Live Tracking Button */}
              <button
                type="button"
                onClick={() => {
                  if (onOpenTrackingModal) onOpenTrackingModal();
                  else navigate('/track');
                }}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-black border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                title="تتبع الطلب المباشر"
              >
                <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                  <img src="/assets/sangoub/sangoub-trio-7.png" alt="موتوسيكل سنجوب" className="w-full h-full object-contain" />
                </div>
                <span>تتبع الطلب</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </button>

              {/* Talabat Orange Cart Button */}
              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-[#FF5900] hover:bg-[#E04E00] active:scale-97 text-white font-bold transition-all shadow-sm shadow-[#FF5900]/25 cursor-pointer"
                aria-label="سلة المشتريات"
                title="السلة"
              >
                <div className="relative flex items-center">
                  <ShoppingBag size={18} />
                  {totalCartCount > 0 && (
                    <span className="absolute -top-2 -left-2.5 bg-white text-[#FF5900] text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                      {totalCartCount > 99 ? '99+' : totalCartCount}
                    </span>
                  )}
                </div>
                <span className="text-xs sm:text-sm font-black hidden xs:inline">
                  السلة
                </span>
              </button>

            </div>

          </div>

          {/* Mobile Location & Search Row (Only on mobile screens) */}
          <div className="block sm:hidden pb-3 pt-1 space-y-2">
            {/* Mobile Location Button */}
            <button
              type="button"
              onClick={onOpenAreaModal}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-[#F9FAFB] rounded-xl text-xs font-bold text-[#111827] border border-[#E5E7EB] cursor-pointer"
            >
              <div className="flex items-center gap-1.5 truncate">
                <MapPin size={14} className="text-[#FF5900] shrink-0" />
                <span className="truncate">
                  التوصيل إلى: <strong className="text-[#FF5900]">{serviceArea.name}</strong>
                </span>
              </div>
              <span className="text-[10px] text-[#6B7280] flex items-center gap-1 shrink-0">
                <span>{serviceArea.deliveryTime}</span>
                <ChevronDown size={12} />
              </span>
            </button>

            {/* Mobile Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex items-center w-full bg-[#F3F4F6] rounded-xl border border-[#E5E7EB] focus-within:border-[#FF5900] focus-within:bg-white p-1">
              <Search size={15} className="text-[#9CA3AF] mr-2 shrink-0 pointer-events-none" />
              <input
                type="search"
                className="w-full bg-transparent text-xs text-[#111827] placeholder-[#9CA3AF] px-2 py-1 outline-none"
                placeholder="ابحث عن مطعم أو وجبة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="بحث"
              />
              <button 
                type="submit" 
                className="px-3 py-1 bg-[#FF5900] text-white rounded-lg text-xs font-bold shrink-0"
              >
                بحث
              </button>
            </form>
          </div>

        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          TALABAT SIDEBAR DRAWER (Light, Clean, Elegant)
          ══════════════════════════════════════════════════════════════ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[700] flex" dir="rtl">
          {/* Backdrop */}
          <div 
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="bg-[#FF5900] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  <User size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm">
                    {user ? `أهلاً، ${user.fullName || 'ضيفنا'}` : 'أهلاً بك في سنجوب | Sangoub'}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    أسرع توصيل لمكاتب ومنازل العاصمة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-xl hover:bg-white/10"
                aria-label="إغلاق القائمة"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Links */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <span className="text-[11px] font-black text-[#9CA3AF] uppercase px-3 block mb-2">
                التنقل السريع
              </span>

              {navLinks.map((link) => {
                const isActive = currentPath === link.path;
                return (
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => {
                      navigate(link.path);
                      setDrawerOpen(false);
                    }}
                    className={`w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-[#FFF2EC] text-[#FF5900] font-black'
                        : 'text-[#374151] hover:bg-[#F9FAFB] hover:text-[#FF5900]'
                    }`}
                  >
                    <span>{link.label}</span>
                    <ArrowRight size={14} className="text-[#9CA3AF] rotate-180" />
                  </button>
                );
              })}

              <div className="pt-4 border-t border-[#F3F4F6] mt-4">
                <span className="text-[11px] font-black text-[#9CA3AF] uppercase px-3 block mb-2">
                  تواصل ودعم
                </span>
                <a
                  href={BRAND.supportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#059669] hover:bg-[#ECFDF5] transition-colors flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Phone size={15} />
                    <span>خدمة العملاء (واتساب)</span>
                  </span>
                  <span className="text-[10px] bg-[#059669] text-white px-2 py-0.5 rounded-full font-bold">24/7</span>
                </a>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-[#F9FAFB] border-t border-[#E5E7EB] text-center">
              <p className="text-[11px] text-[#6B7280]">
                سنجوب Sangoub © 2026 · جميع الحقوق محفوظة
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
