import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../../utils/orderCalculations';
import { getStoreImage, getStoreLogo, getStoreSlug } from '../../utils/storeAssets';
import {
  Store as StoreIcon,
  Star,
  Clock,
  Bike,
  MapPin,
  ArrowRight,
  ChevronLeft,
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
  { id: 'breakfast', label: 'فطور ومخبوزات', icon: '🫓' },
  { id: 'cafe', label: 'كافيهات ومشروبات', icon: '☕' },
  { id: 'pharmacy', label: 'صيدليات ورعاية', icon: '💊' },
];

export const StoresPage: React.FC<StoresPageProps> = ({ onBackToHome, isMobile }) => {
  const { stores, disabledStoreTypes, navigate } = useStore();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const visibleCategoryTabs = useMemo(() => {
    return CATEGORY_TABS.filter((tab) => {
      if (tab.id === 'pharmacy' && disabledStoreTypes.includes('PHARM')) return false;
      if (tab.id === 'restaurant' && disabledStoreTypes.includes('REST')) return false;
      if (tab.id === 'cafe' && disabledStoreTypes.includes('CAFE')) return false;
      return true;
    });
  }, [disabledStoreTypes]);

  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      if (selectedCategory === 'all') return true;

      if (selectedCategory === 'seafood') {
        return (
          store.category === 'seafood' ||
          store.name.includes('بركات') ||
          store.name.includes('أسماك') ||
          (store.type && store.type.includes('بحرية'))
        );
      }

      if (selectedCategory === 'restaurant') {
        return (
          store.category === 'restaurant' ||
          store.category === 'sandwiches' ||
          store.name.includes('هند') ||
          store.name.includes('كشري') ||
          (store.type && store.type.includes('كشري'))
        );
      }

      if (selectedCategory === 'supermarket') {
        return (
          store.category === 'supermarket' ||
          store.name.includes('خير زمان') ||
          store.name.includes('هايبر') ||
          (store.type && store.type.includes('سوبر')) ||
          (store.type && store.type.includes('هايبر'))
        );
      }

      if (selectedCategory === 'breakfast') {
        return (
          store.category === 'breakfast' ||
          store.name.includes('فول') ||
          store.name.includes('فلافل') ||
          (store.type && store.type.includes('فطور'))
        );
      }

      if (selectedCategory === 'cafe') {
        return (
          store.category === 'cafe' ||
          store.name.includes('كافيه') ||
          (store.type && store.type.includes('كافيه')) ||
          (store.type && store.type.includes('مشروبات'))
        );
      }

      if (selectedCategory === 'pharmacy') {
        return (
          store.category === 'pharmacy' ||
          store.name.includes('صيدلية') ||
          (store.type && store.type.includes('طبية'))
        );
      }

      return store.category === selectedCategory;
    });
  }, [stores, selectedCategory]);

  const handleSelectStore = (storeId: string) => {
    navigate(`/stores/${getStoreSlug(storeId)}`);
  };

  const getCategoryFallbackEmoji = (cat?: string, name?: string) => {
    const n = (name || '').toLowerCase();
    if (n.includes('كشري') || n.includes('هند')) return '🍲';
    if (n.includes('سمك') || n.includes('بركات') || cat === 'seafood') return '🐟';
    if (n.includes('هايبر') || n.includes('سوبر') || cat === 'supermarket') return '🛒';
    if (n.includes('فول') || n.includes('فلافل') || cat === 'breakfast') return '🫓';
    if (n.includes('كافيه') || cat === 'cafe') return '☕';
    if (n.includes('صيدلية') || cat === 'pharmacy') return '💊';
    return '🏪';
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] pb-24 md:pb-16 font-cairo" dir="rtl">
      {/* ── 1. Clean, Compact, Light Page Header (Replaces previous giant dark banner) ── */}
      <div className="bg-white border-b border-[#E5E7EB] py-4 sm:py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-1.5 font-bold">
              <button
                type="button"
                onClick={() => (onBackToHome ? onBackToHome() : navigate('/'))}
                className="hover:text-[#FF5900] flex items-center gap-1 transition"
              >
                <ArrowRight size={14} />
                <span>الرئيسية</span>
              </button>
              <span>/</span>
              <span className="text-[#131921] font-black">جميع المتاجر والشركاء</span>
            </div>

            <h1 className="text-lg sm:text-2xl font-black text-[#131921]">
              المتاجر والشركاء في العاصمة الإدارية
            </h1>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
              تصفح أشهر المطاعم، السوبرماركت، والصيدليات المعتمدة للتوصيل السريع حتى بابك
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. Category Filter Pills (Aligned with Main Admin Categories) ── */}
      <div className="sticky top-0 z-30 bg-[#F7F7F8]/95 backdrop-blur-md border-b border-gray-200/80 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {visibleCategoryTabs.map((tab) => {
            const isSelected = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#FF5900] text-white shadow-xs'
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

      {/* ── 3. Stores Grid with Polished Cards & Real Logos ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {filteredStores.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-200 max-w-md mx-auto my-8 shadow-xs">
            <StoreIcon size={40} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-base font-black text-gray-800">لا توجد متاجر في هذا القسم</h2>
            <p className="text-xs text-gray-500 mt-1 mb-4">اختر قسماً آخر من الأعلى لعرض المتاجر المتاحة.</p>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="px-5 py-2 bg-[#FF5900] text-white rounded-xl text-xs font-black shadow-xs hover:bg-[#E04E00] transition"
            >
              عرض جميع المتاجر
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredStores.map((store) => {
              const bannerSrc = getStoreImage(store);
              const logoSrc = getStoreLogo(store);
              const fallbackEmoji = getCategoryFallbackEmoji(store.category, store.name);

              return (
                <div
                  key={store.id}
                  onClick={() => handleSelectStore(store.id)}
                  className="group bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#FF5900]/40 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer"
                >
                  {/* Top Banner Image with Badges */}
                  <div className="relative h-40 sm:h-44 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={bannerSrc}
                      alt={store.name}
                      className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                    {/* Delivery Time Badge */}
                    <div className="absolute top-3 right-3 bg-black/65 backdrop-blur-xs text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1">
                      <Clock size={12} className="text-[#FF5900]" />
                      <span>{store.deliveryTime || '20-30 دقيقة'}</span>
                    </div>

                    {/* Delivery Fee Badge */}
                    <div className="absolute top-3 left-3 bg-[#059669] text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1">
                      <Bike size={12} />
                      <span>
                        {store.deliveryFee === 0 ? 'توصيل مجاني' : `${formatEGP(store.deliveryFee)} توصيل`}
                      </span>
                    </div>

                    {/* Store Open/Closed Status Badge */}
                    <div className="absolute bottom-3 right-3">
                      {store.status === 'closed' ? (
                        <span className="bg-slate-900/85 backdrop-blur-xs text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1.5 border border-white/20">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span>مغلق حالياً</span>
                        </span>
                      ) : store.status === 'busy' ? (
                        <span className="bg-amber-600/90 backdrop-blur-xs text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1.5 border border-white/20">
                          <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                          <span>متوقف مؤقتاً</span>
                        </span>
                      ) : (
                        <span className="bg-emerald-600/90 backdrop-blur-xs text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1.5 border border-white/20">
                          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                          <span>مفتوح الآن</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Store Details Header with Integrated Logo & Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start gap-3 mb-2">
                        {/* Dedicated Crisp Merchant Logo */}
                        <div className="w-13 h-13 rounded-xl bg-white border border-[#E5E7EB] shadow-xs overflow-hidden flex items-center justify-center shrink-0">
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt={store.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                  target.parentElement.innerHTML = `<span class="text-2xl">${fallbackEmoji}</span>`;
                                }
                              }}
                            />
                          ) : (
                            <span className="text-2xl">{fallbackEmoji}</span>
                          )}
                        </div>

                        {/* Title & Category Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h2 className="text-sm sm:text-base font-black text-[#131921] group-hover:text-[#FF5900] transition-colors truncate">
                                {store.name}
                              </h2>
                              {store.status === 'closed' && (
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                                  مغلق
                                </span>
                              )}
                              {store.status === 'busy' && (
                                <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                                  مشغول
                                </span>
                              )}
                            </div>
                            {/* Rating */}
                            <div className="flex items-center gap-1 text-xs font-black text-[#131921] shrink-0 bg-[#FFFBEB] border border-amber-200/60 px-1.5 py-0.5 rounded-lg">
                              <Star size={12} className="text-amber-500 fill-amber-500" />
                              <span>{store.rating || 4.9}</span>
                            </div>
                          </div>

                          <p className="text-xs text-[#6B7280] font-medium line-clamp-1 mt-0.5">
                            {store.type || 'سوبرماركت ومأكولات طازجة'}
                          </p>

                          {store.locationInDistrict && (
                            <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1 line-clamp-1 mt-1">
                              <MapPin size={11} className="shrink-0 text-[#9CA3AF]" />
                              <span>{store.locationInDistrict}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Minimum Order & CTA */}
                    <div className="pt-3 border-t border-[#F3F4F6] flex items-center justify-between mt-2">
                      <span className="text-[11px] font-bold text-[#6B7280]">
                        الحد الأدنى: <strong className="text-[#131921]">{formatEGP(store.minOrder || 20)}</strong>
                      </span>

                      <span className="inline-flex items-center gap-1 text-xs font-black text-[#FF5900] group-hover:translate-x-[-2px] transition-transform">
                        <span>عرض المنيو</span>
                        <ChevronLeft size={15} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
