import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../../utils/orderCalculations';
import {
  Search,
  Store as StoreIcon,
  Star,
  Clock,
  Bike,
  MapPin,
  ChevronLeft,
  ArrowRight,
  Filter,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface StoresPageProps {
  onBackToHome?: () => void;
  isMobile?: boolean;
}

const CATEGORY_TABS = [
  { id: 'all', label: 'الكل', icon: '✨' },
  { id: 'restaurant', label: 'مطاعم وكشري', icon: '🍲' },
  { id: 'supermarket', label: 'سوبرماركت وهايبر', icon: '🛒' },
  { id: 'seafood', label: 'أسماك ومأكولات بحرية', icon: '🐟' },
  { id: 'cafe', label: 'كافيهات وسناكس', icon: '☕' },
  { id: 'pharmacy', label: 'صيدليات ورعاية', icon: '💊' },
];

export const StoresPage: React.FC<StoresPageProps> = ({ onBackToHome, isMobile }) => {
  const { stores, navigate } = useStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      // 1. Category Filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'seafood') {
          const isSeafood = store.name.includes('بركات') || store.name.includes('أسماك') || store.type?.includes('بحرية');
          if (!isSeafood) return false;
        } else if (selectedCategory === 'restaurant') {
          const isRestaurant = store.category === 'restaurant' || store.category === 'breakfast' || store.type?.includes('كشري') || store.type?.includes('مطعم');
          if (!isRestaurant) return false;
        } else if (selectedCategory === 'supermarket') {
          const isSupermarket = store.category === 'supermarket' || store.type?.includes('سوبر') || store.type?.includes('هايبر');
          if (!isSupermarket) return false;
        } else if (store.category !== selectedCategory) {
          return false;
        }
      }

      // 2. Search query filter
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchName = store.name.toLowerCase().includes(query);
        const matchType = (store.type || '').toLowerCase().includes(query);
        const matchLocation = (store.locationInDistrict || '').toLowerCase().includes(query);
        return matchName || matchType || matchLocation;
      }

      return true;
    });
  }, [stores, selectedCategory, search]);

  const handleSelectStore = (storeId: string) => {
    navigate(`/stores/${encodeURIComponent(storeId)}`);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] pb-24 md:pb-16 font-cairo" dir="rtl">
      {/* ── Page Hero / Header Banner ── */}
      <div className="bg-gradient-to-r from-[#131921] via-[#1E293B] to-[#0F172A] text-white pt-5 pb-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb / Back button */}
          <div className="flex items-center gap-2 text-xs text-gray-300 mb-3">
            <button
              type="button"
              onClick={() => onBackToHome ? onBackToHome() : navigate('/')}
              className="hover:text-white flex items-center gap-1 transition font-bold cursor-pointer"
            >
              <ArrowRight size={14} />
              <span>الرئيسية</span>
            </button>
            <span>/</span>
            <span className="text-[#FF5900] font-black">جميع المتاجر والشركاء</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF5900]/20 border border-[#FF5900]/40 text-[#FF5900] text-xs font-black mb-2">
                <Sparkles size={13} />
                <span>المتاجر المعتمدة في سنجوب 🇪🇬</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight">
                المتاجر والشركاء في منطقتك
              </h1>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-xl">
                اطلب من أشهر المطاعم، السوبرماركت، ومحلات المأكولات الطازجة المعتمدة بأسرع توصيل حتى بابك.
              </p>
            </div>

            {/* Quick stats badge */}
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 shrink-0 w-fit">
              <StoreIcon className="text-[#FF5900]" size={22} />
              <div>
                <p className="text-sm font-black text-white">{stores.length} متجر متاح</p>
                <p className="text-[10px] text-gray-300">توصيل سريع ومضمون</p>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="mt-5 relative max-w-2xl">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المطعم أو السوبرماركت (مثال: كشري هند، بركات، خير زمان، هايبر وان)..."
              className="w-full bg-white text-[#111827] text-xs sm:text-sm font-bold pl-4 pr-11 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#FF5900] shadow-sm transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold transition"
              >
                مسح
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Category Filter Pills ── */}
      <div className="sticky top-0 z-30 bg-[#F7F7F8]/95 backdrop-blur-md border-b border-gray-200/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {CATEGORY_TABS.map((tab) => {
            const isSelected = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.8 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#FF5900] text-white shadow-sm scale-102'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stores Grid ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {filteredStores.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-200 max-w-md mx-auto my-8 shadow-xs">
            <StoreIcon size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-black text-gray-800">لا توجد متاجر تطابق بحثك</h3>
            <p className="text-xs text-gray-500 mt-1 mb-4">جرب البحث بكلمات أخرى أو اختر قسماً مختلفاً من الأعلى.</p>
            <button
              type="button"
              onClick={() => { setSearch(''); setSelectedCategory('all'); }}
              className="px-4 py-2 bg-[#FF5900] text-white rounded-xl text-xs font-black shadow-xs hover:bg-[#E04E00] transition"
            >
              عرض جميع المتاجر
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredStores.map((store) => (
              <div
                key={store.id}
                onClick={() => handleSelectStore(store.id)}
                className="group bg-white rounded-3xl border border-[#E5E7EB] hover:border-[#FF5900]/40 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between cursor-pointer active:scale-[0.99]"
              >
                {/* Store Banner & Badges */}
                <div className="relative h-40 sm:h-44 w-full bg-slate-200 overflow-hidden">
                  <img
                    src={store.bannerUrl || store.imageUrl || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80'}
                    alt={store.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Delivery Time Badge */}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1">
                    <Clock size={12} className="text-[#FF5900]" />
                    <span>{store.deliveryTime || '20-30 دقيقة'}</span>
                  </div>

                  {/* Delivery Fee Badge */}
                  <div className="absolute top-3 left-3 bg-[#059669] text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1">
                    <Bike size={12} />
                    <span>{store.deliveryFee === 0 ? 'توصيل مجاني' : `${formatEGP(store.deliveryFee)} توصيل`}</span>
                  </div>

                  {/* Store Logo floating over bottom-right of banner */}
                  <div className="absolute -bottom-1 right-4 w-14 h-14 rounded-2xl bg-white border-2 border-white shadow-md overflow-hidden flex items-center justify-center shrink-0">
                    {store.logoUrl ? (
                      <img src={store.logoUrl} alt={store.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{store.logo || '🏪'}</span>
                    )}
                  </div>

                  {/* Rating on banner bottom-left */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-white/95 text-slate-900 px-2.5 py-0.5 rounded-xl text-xs font-black shadow-xs">
                    <Star size={13} className="text-amber-500 fill-amber-500" />
                    <span>{store.rating || 4.9}</span>
                    <span className="text-[10px] text-gray-500">({store.ratingCount || 100}+)</span>
                  </div>
                </div>

                {/* Store Info Content */}
                <div className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-base font-black text-[#111827] group-hover:text-[#FF5900] transition-colors truncate">
                        {store.name}
                      </h2>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="مفتوح الآن" />
                    </div>

                    <p className="text-xs text-gray-500 font-medium line-clamp-1 mb-2.5">
                      {store.type || 'سوبرماركت ومأكولات طازجة'}
                    </p>

                    {store.locationInDistrict && (
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 line-clamp-1 mb-2">
                        <MapPin size={12} className="shrink-0 text-gray-400" />
                        <span>{store.locationInDistrict}</span>
                      </p>
                    )}
                  </div>

                  {/* Footer of Card: Minimum order & Browse Button */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-auto">
                    <span className="text-[11px] font-bold text-gray-500">
                      الحد الأدنى: <strong className="text-gray-800">{formatEGP(store.minOrder || 20)}</strong>
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-black text-[#FF5900] group-hover:translate-x-[-3px] transition-transform">
                      <span>عرض المنيو</span>
                      <ChevronLeft size={14} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
