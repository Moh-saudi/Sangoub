import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { BRAND } from '../../brand';
import { LAUNCH_CONFIG } from '../../config/launchConfig';
import { 
  Search, 
  ShoppingBag, 
  User, 
  MapPin, 
  Menu, 
  X, 
  ChevronDown,
  Sparkles,
  Phone,
  Tag,
  Clock,
  ArrowRight,
  ShieldCheck
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
  const [avatarError, setAvatarError] = useState(false);
  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const isAdmin = user?.role === 'admin' || user?.email === 'meskllcqa@gmail.com' || user?.id === '07492416-8a8e-434b-9094-391abb21272e';

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navLinks = [
    { label: 'الرئيسية', path: '/' },
    { label: 'المتاجر والشركاء ⭐', path: '/stores' },
    { label: 'عروض اليوم الحصرية 🔥', path: '/offers' },
    { label: 'أقسام المتجر', path: '/categories' },
    { label: 'طلباتي السابقة', path: '/my-orders' },
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
          TALABAT SIGNATURE CLEAN WHITE & ORANGE HEADER (STICKY FIXED)
          ══════════════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB] shadow-xs w-full sangoub-sticky-header"
        style={{ position: 'sticky', top: 0, zIndex: 50 }}
        dir="rtl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Main Top Bar - Spacious, Elegant & Balanced */}
          <div className="flex items-center justify-between gap-3 sm:gap-6 h-[68px]">
            
            {/* Right: Hamburger & Brand Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
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
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white border border-[#E5E7EB] flex items-center justify-center overflow-hidden shadow-2xs group-hover:border-[#FF5900]/40 transition-all">
                  <img 
                    src="/brand/sangoub-mark-white-128.png"
                    alt="سنجوب" 
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                    width="32" 
                    height="32" 
                  />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-lg sm:text-xl font-black text-[#FF5900] tracking-tight">
                    سنجوب
                  </span>
                  <span className="text-[9px] font-bold text-[#6B7280] tracking-wider uppercase">
                    SANGOUB
                  </span>
                </div>
              </a>
            </div>

            {/* Middle: Talabat-Style Compact Location Delivery Chip (Desktop & Tablet) */}
            <button
              type="button"
              onClick={onOpenAreaModal}
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#F9FAFB] hover:bg-[#FFF5F0] border border-[#E5E7EB] hover:border-[#FF5900]/40 transition-all cursor-pointer shrink-0 text-right group"
              title="انقر لتغيير منطقة التوصيل"
            >
              <div className="w-6 h-6 rounded-lg bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MapPin size={13} />
              </div>
              <div className="flex flex-col leading-tight max-w-[110px] lg:max-w-[135px]">
                <span className="text-[9px] font-bold text-[#6B7280]">
                  التوصيل إلى:
                </span>
                <span className="text-[11px] font-black text-[#111827] group-hover:text-[#FF5900] truncate">
                  {serviceArea.name || 'حدد موقعك'}
                </span>
              </div>
              <ChevronDown size={11} className="text-[#FF5900] shrink-0" />
            </button>

            {/* Center: Search Bar (Desktop) - Clean & Integrated */}
            <form onSubmit={handleSearchSubmit} className="hidden sm:flex flex-1 max-w-lg mx-2 lg:mx-6">
              <div className="relative flex items-center w-full bg-[#F3F4F6] hover:bg-[#EFEFF2] focus-within:bg-white rounded-2xl border border-[#E5E7EB] focus-within:border-[#FF5900] focus-within:ring-3 focus-within:ring-[#FF5900]/15 transition-all px-3 py-2">
                <Search size={17} className="text-[#9CA3AF] shrink-0 ml-2 pointer-events-none" />
                <input
                  type="search"
                  style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                  className="w-full bg-transparent text-xs sm:text-sm text-[#111827] placeholder-[#9CA3AF] !outline-none !border-none !ring-0 !shadow-none font-medium"
                  placeholder="ابحث عن وجبة، بقالة، صيدلية، أو متجر…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="بحث في المتجر"
                />
                {searchQuery.trim() && (
                  <button 
                    type="submit" 
                    className="px-3 py-1 bg-[#FF5900] hover:bg-[#E04E00] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                    aria-label="بحث"
                  >
                    بحث
                  </button>
                )}
              </div>
            </form>

            {/* Left: Actions (User, My Orders, Wishlist, Order Tracking if active, Cart) */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              
              {/* My Orders Button (Desktop Direct Access) */}
              <button
                type="button"
                onClick={() => navigate('/my-orders')}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl hover:bg-[#F9FAFB] text-[#374151] hover:text-[#FF5900] border border-transparent hover:border-[#E5E7EB] transition-colors cursor-pointer text-xs font-bold"
                title="طلباتي السابقة"
              >
                <Clock size={15} className="text-[#FF5900]" />
                <span>طلباتي</span>
              </button>
              
              {/* Account button */}
              <button
                type="button"
                onClick={() => navigate(user ? '/account' : '/login')}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl hover:bg-[#F9FAFB] transition-colors cursor-pointer text-right"
                title={user ? user.fullName || 'حسابي' : 'تسجيل الدخول'}
              >
                <div className="w-8 h-8 rounded-full bg-[#F3F4F6] text-[#374151] overflow-hidden flex items-center justify-center shrink-0">
                  {user?.avatarUrl && !avatarError ? (
                    <img 
                      src={user.avatarUrl} 
                      alt="" 
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                      className="w-full h-full object-cover" 
                    />
                  ) : user ? (
                    <div className="w-full h-full flex items-center justify-center font-black text-xs bg-orange-100 text-[#FF5900]">
                      {user.fullName?.trim().charAt(0).toUpperCase() || user.email?.trim().charAt(0).toUpperCase() || 'س'}
                    </div>
                  ) : (
                    <User size={16} />
                  )}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
                    {user ? (isAdmin ? 'مدير النظام' : 'أهلاً بك،') : 'تسجيل'}
                    {isAdmin && <ShieldCheck size={10} className="text-purple-600 inline" />}
                  </span>
                  <span className="text-xs font-black text-[#111827] truncate max-w-[85px]">
                    {user ? user.fullName?.split(' ')[0] || 'حسابي' : 'الدخول'}
                  </span>
                </div>
              </button>



              {/* Live Tracking Button - ONLY RENDERED WHEN THERE IS AN ACTUAL LIVE ACTIVE ORDER */}
              {hasActiveOrder && (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenTrackingModal) onOpenTrackingModal();
                    else navigate('/track');
                  }}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-black border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                  title="تتبع الطلب الجاري"
                >
                  <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                    <img src="/assets/sangoub/sangoub-trio-7.png" alt="موتوسيكل سنجوب" className="w-full h-full object-contain" />
                  </div>
                  <span>تتبع طلبك</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                </button>
              )}

              {/* Talabat Orange Cart Button */}
              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl bg-[#FF5900] hover:bg-[#E04E00] active:scale-97 text-white font-bold transition-all shadow-sm shadow-[#FF5900]/25 cursor-pointer"
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
                {LAUNCH_CONFIG.showEta && <span>{serviceArea.deliveryTime}</span>}
                <ChevronDown size={12} />
              </span>
            </button>

            {/* Mobile Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex items-center w-full bg-[#F3F4F6] rounded-xl border border-[#E5E7EB] focus-within:border-[#FF5900] focus-within:bg-white p-1">
              <Search size={15} className="text-[#9CA3AF] mr-2 shrink-0 pointer-events-none" />
              <input
                type="search"
                style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                className="w-full bg-transparent text-xs text-[#111827] placeholder-[#9CA3AF] px-2 py-1 !outline-none !border-none !ring-0 !shadow-none font-medium"
                placeholder="ابحث عن صنف أو بقالة…"
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
                <div className="w-10 h-10 rounded-2xl bg-white/20 overflow-hidden flex items-center justify-center shrink-0">
                  {user?.avatarUrl && !avatarError ? (
                    <img 
                      src={user.avatarUrl} 
                      alt="" 
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                      className="w-full h-full object-cover" 
                    />
                  ) : user ? (
                    <div className="w-full h-full flex items-center justify-center font-black text-sm bg-white/30 text-white">
                      {user.fullName?.trim().charAt(0).toUpperCase() || user.email?.trim().charAt(0).toUpperCase() || 'س'}
                    </div>
                  ) : (
                    <User size={20} className="text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-sm">
                    {user ? `أهلاً، ${user.fullName || 'ضيفنا'}` : 'أهلاً بك في سنجوب | Sangoub'}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    {isAdmin ? 'مدير النظام المعتمد 🛡️' : 'أسرع توصيل لمكاتب ومنازل العاصمة'}
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
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    navigate('/contact');
                  }}
                  className="w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#111827] hover:bg-[#F3F4F6] transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Phone size={15} className="text-[#FF5900]" />
                    <span>خدمة العملاء والمساعدة</span>
                  </span>
                  <span className="text-[10px] bg-[#FF5900] text-white px-2 py-0.5 rounded-full font-bold">24/7</span>
                </button>
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
