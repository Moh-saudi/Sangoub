import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import type { Product } from '../../types';
import { formatEGP } from '../../utils/orderCalculations';
import { getStoreImage, getStoreLogo, getStoreSlug, resolveStoreSlug } from '../../utils/storeAssets';
import {
  ArrowRight,
  Star,
  Clock,
  Bike,
  MapPin,
  Plus,
  ShoppingBag,
  Sparkles,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { ProductModal } from '../components/ProductModal';

interface StoreDetailsPageProps {
  storeId: string;
  onBackToStores?: () => void;
  isMobile?: boolean;
}

export const StoreDetailsPage: React.FC<StoreDetailsPageProps> = ({
  storeId,
  onBackToStores,
  isMobile,
}) => {
  const { stores, products, navigate, addToCart } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);

  // Find the target store
  const store = useMemo(() => {
    const canonicalId = resolveStoreSlug(storeId);
    return stores.find(
      (s) =>
        s.id === canonicalId ||
        s.id === storeId ||
        getStoreSlug(s) === storeId ||
        s.id === decodeURIComponent(storeId) ||
        s.name === storeId ||
        s.name === decodeURIComponent(storeId) ||
        (storeId.includes('sangoub') && (s.id === 'a0000000-0000-0000-0000-000000000001' || s.name.includes('سنجوب')))
    ) || stores[0];
  }, [stores, storeId]);

  // Clean, professional URL slug in address bar (e.g. /stores/sangoub-market instead of raw UUID)
  React.useEffect(() => {
    if (store) {
      const friendlySlug = getStoreSlug(store);
      const current = window.location.pathname;
      if (current.includes('a0000000-0000-0000-0000-000000000001') || (store.id && current === `/stores/${store.id}`)) {
        window.history.replaceState({}, '', `/stores/${friendlySlug}`);
      }
    }
  }, [store]);

  // Find all products belonging to this store
  const storeProducts = useMemo(() => {
    if (!store) return [];
    return products.filter((p) => {
      const isSangoub =
        store.id === 'a0000000-0000-0000-0000-000000000001' ||
        store.name?.includes('سنجوب');

      if (isSangoub) {
        return (
          p.storeId === 'a0000000-0000-0000-0000-000000000001' ||
          p.storeId === '54a6c2f6-6c29-4177-ac65-32fadddea83d' ||
          !p.storeId ||
          p.storeName?.includes('سنجوب')
        );
      }

      return (
        p.storeId === store.id ||
        p.storeName === store.name ||
        (p.storeId && store.id && p.storeId.includes(store.id))
      );
    });
  }, [products, store]);

  // Categories available inside this store
  const storeCategories = useMemo(() => {
    const set = new Set<string>();
    storeProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [storeProducts]);

  // Filtered products for active category / search
  const filteredProducts = useMemo(() => {
    return storeProducts.filter((product) => {
      if (selectedCategory !== 'all' && product.category !== selectedCategory) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchName = product.name.toLowerCase().includes(query);
        const matchDesc = (product.description || '').toLowerCase().includes(query);
        return matchName || matchDesc;
      }
      return true;
    });
  }, [storeProducts, selectedCategory, search]);

  if (!store) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] p-8 text-center font-cairo" dir="rtl">
        <p className="text-gray-500 text-sm mb-3">المتجر المطلوب غير موجود أو غير متاح حالياً.</p>
        <button
          type="button"
          onClick={() => onBackToStores ? onBackToStores() : navigate('/stores')}
          className="px-4 py-2 bg-[#FF5900] text-white rounded-xl text-xs font-bold"
        >
          العودة للمتاجر
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] pb-24 md:pb-16 font-cairo" dir="rtl">
      {/* ── Store Header Banner ── */}
      <div className="relative bg-[#111827] text-white">
        <div className="relative h-44 sm:h-64 w-full bg-slate-800 overflow-hidden">
          <img
            src={getStoreImage(store)}
            alt={store.name}
            className="w-full h-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/50 to-transparent" />

          {/* Back button */}
          <button
            type="button"
            onClick={() => onBackToStores ? onBackToStores() : navigate('/stores')}
            className="absolute top-4 right-4 z-20 bg-black/60 hover:bg-black/85 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition cursor-pointer shadow-md"
          >
            <ArrowRight size={14} />
            <span>جميع المتاجر</span>
          </button>
        </div>

        {/* Store Profile Floating Header Card */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative -mt-16 sm:-mt-20 z-10 pb-4">
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-slate-900">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 border-orange-100 shadow-md overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src={getStoreLogo(store)}
                  alt={store.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = 'none';
                    if (target.parentElement) {
                      target.parentElement.innerHTML = `<span class="text-3xl">🏪</span>`;
                    }
                  }}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-2xl font-black text-[#111827]">{store.name}</h1>
                  {store.status === 'open' && (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-black border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>مفتوح</span>
                    </span>
                  )}
                  {store.status === 'busy' && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full text-[11px] font-black border border-amber-200">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>مشغول مؤقتاً</span>
                    </span>
                  )}
                  {store.status === 'closed' && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[11px] font-black border border-slate-300">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>مغلق حالياً</span>
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">{store.type}</p>
                {store.locationInDistrict && (
                  <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-1">
                    <MapPin size={12} className="text-gray-400" />
                    <span>{store.locationInDistrict}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Badges Info */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
              <div className="bg-amber-50 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border border-amber-200/60">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                <span>{store.rating || 4.9}</span>
                <span className="text-[10px] text-amber-700">({store.ratingCount || 100}+)</span>
              </div>

              <div className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1">
                <Clock size={13} className="text-[#FF5900]" />
                <span>{store.deliveryTime || '20-30 دقيقة'}</span>
              </div>

              <div className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border border-emerald-200/60">
                <Bike size={13} className="text-emerald-600" />
                <span>{store.deliveryFee === 0 ? 'توصيل مجاني' : `${formatEGP(store.deliveryFee)} توصيل`}</span>
              </div>

              <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold">
                الحد الأدنى: <strong>{formatEGP(store.minOrder || 20)}</strong>
              </div>
            </div>
          </div>

          {store.status === 'closed' && (
            <div className="mt-3 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs font-bold flex items-center gap-2 shadow-xs">
              <span className="text-base shrink-0">⛔</span>
              <span>تنبيه: هذا المتجر مغلق حالياً ولا يستقبل طلبات جديدة. يمكنك تصفح قائمة الأصناف والأسعار.</span>
            </div>
          )}
          {store.status === 'busy' && (
            <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-bold flex items-center gap-2 shadow-xs">
              <span className="text-base shrink-0">⏳</span>
              <span>تنبيه: هذا المتجر متوقف مؤقتاً أو مشغول حالياً في تحضير الطلبات، قد يستغرق التوصيل وقتاً أطول.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Category Filters and Search inside Store ── */}
      <div className="sticky top-0 z-30 bg-[#F7F7F8]/95 backdrop-blur-md border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#FF5900] text-white shadow-xs'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              الكل ({storeProducts.length})
            </button>
            {storeCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#FF5900] text-white shadow-xs'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search inside this store */}
          <div className="relative sm:w-64 shrink-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث داخل قائمة المتجر…"
              className="w-full bg-white text-xs font-bold pl-3 pr-9 py-2 rounded-xl border border-gray-200 outline-none focus:border-[#FF5900]"
            />
          </div>
        </div>
      </div>

      {/* ── Products List for this Store ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-200 max-w-md mx-auto my-6 shadow-xs">
            <ShoppingBag size={36} className="mx-auto text-gray-300 mb-2" />
            <h3 className="text-sm font-black text-gray-800">لا توجد منتجات مطابقة في هذا القسم</h3>
            <p className="text-xs text-gray-500 mt-1 mb-3">جرب اختيار قسم آخر أو تغيير كلمة البحث.</p>
            <button
              type="button"
              onClick={() => { setSelectedCategory('all'); setSearch(''); }}
              className="px-3 py-1.5 bg-[#FF5900] text-white rounded-xl text-xs font-bold"
            >
              عرض كل منتجات المتجر
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProductForModal(product)}
                className="group bg-white rounded-2xl border border-gray-200 hover:border-[#FF5900]/50 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer active:scale-[0.98]"
              >
                {/* Product Image */}
                <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                  <img
                    src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {product.badge && (
                    <span className="absolute top-2 right-2 bg-[#FF5900] text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs">
                      {product.badge}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-gray-900 line-clamp-1 group-hover:text-[#FF5900] transition-colors">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Price & Add to Cart button */}
                  <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-[#FF5900] block">
                        {formatEGP(product.price)}
                      </span>
                      {product.originalPrice && (
                        <span className="text-[9px] text-gray-400 line-through">
                          {formatEGP(product.originalPrice)}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={store.status === 'closed'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (store.status === 'closed') return;
                        if (product.optionGroups && product.optionGroups.length > 0) {
                          setSelectedProductForModal(product);
                        } else {
                          addToCart(product, 1, {}, 0);
                        }
                      }}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition shadow-2xs font-bold ${
                        store.status === 'closed'
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-orange-50 hover:bg-[#FF5900] text-[#FF5900] hover:text-white cursor-pointer'
                      }`}
                      title={store.status === 'closed' ? "المتجر مغلق" : "أضف إلى السلة"}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Product Options Modal */}
      <ProductModal
        product={selectedProductForModal}
        onClose={() => setSelectedProductForModal(null)}
        onSelectProduct={(p) => setSelectedProductForModal(p)}
      />
    </div>
  );
};

