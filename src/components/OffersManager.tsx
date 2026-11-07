import React, { useState, useMemo } from 'react';
import {
  Tag,
  Search,
  Plus,
  Edit2,
  Trash2,
  Percent,
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Flame,
  Check,
  TrendingUp,
  Package,
  Layers,
  ShoppingBag,
  SlidersHorizontal,
  ChevronDown,
  Info
} from 'lucide-react';
import type { Product, Store, Order } from '../types';
import { formatEGP } from '../utils/orderCalculations';
import { matchStoreId } from '../utils/storeAssets';
import { getStoreSlug } from '../utils/storeAssets';
import { saveRecord } from '../lib/firebase';
import { supabase } from '../lib/supabase';

export interface OffersManagerProps {
  products: Product[];
  stores: Store[];
  orders?: Order[];
  fixedStoreId?: string; // Merchant scope: If passed, only products belonging to this store are managed
  onProductUpdate?: (updatedProduct: Product) => void;
}

const OCCASION_PRESETS = [
  { label: 'شهر رمضان المبارك', icon: '🌙' },
  { label: 'عروض الصيف والانتعاش', icon: '☀️' },
  { label: 'الجمعة البيضاء والتوفير', icon: '🛍️' },
  { label: 'عروض العودة للدراسة', icon: '🎒' },
  { label: 'ساعة الغداء التوفيرية', icon: '🍽️' },
  { label: 'عروض الصباح والقهوة', icon: '☕' },
  { label: 'افتتاح وتدشين الفرع', icon: '🎉' },
];

const BADGE_PRESETS = [
  '🔥 عرض خاص',
  '⚡ صفقة سريعة',
  '🌟 الأكثر طلباً',
  '🏷️ وفر أكثر',
  '💎 حصري لسنجوب',
  '💥 خصم نصف السعر',
];

export function OffersManager({
  products,
  stores,
  fixedStoreId,
}: OffersManagerProps) {
  
  // Filter products scoped to store if fixedStoreId is provided
  const scopedProducts = useMemo(() => {
    if (!fixedStoreId) return products.filter((p) => !p.archived);
    return products.filter((p) => !p.archived && matchStoreId(p.storeId, fixedStoreId));
  }, [products, fixedStoreId]);

  // Current store object (if fixedStoreId)
  const currentStore = useMemo(() => {
    if (!fixedStoreId) return undefined;
    return stores.find((s) => matchStoreId(s.id, fixedStoreId));
  }, [stores, fixedStoreId]);

  // All active offers: items with valid originalPrice > price
  const activeOffers = useMemo(() => {
    return scopedProducts.filter(
      (p) => typeof p.originalPrice === 'number' && p.originalPrice > p.price
    );
  }, [scopedProducts]);

  // ── Filters & Search State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'occasion' | 'hot' | 'out_of_stock'>('all');
  const [discountTier, setDiscountTier] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'discount_desc' | 'price_asc' | 'price_desc' | 'savings_desc' | 'name'>('discount_desc');

  // ── Modal State for Launching / Editing Offer ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form Fields
  const [formOriginalPrice, setFormOriginalPrice] = useState<number>(0);
  const [formSalePrice, setFormSalePrice] = useState<number>(0);
  const [formDiscountPercent, setFormDiscountPercent] = useState<number>(20);
  const [formOfferTitle, setFormOfferTitle] = useState('');
  const [formIsOccasion, setFormIsOccasion] = useState(false);
  const [formOccasionName, setFormOccasionName] = useState('');
  const [formBadge, setFormBadge] = useState('🔥 عرض خاص');
  const [formMaxPerOrder, setFormMaxPerOrder] = useState<number>(3);
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState('');

  // Execution states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4500);
  };

  // ── Metrics Calculation ──
  const metrics = useMemo(() => {
    const totalOffers = activeOffers.length;
    const inStockOffers = activeOffers.filter((o) => o.inStock).length;
    const occasionOffers = activeOffers.filter((o) => Boolean(o.isOccasion)).length;
    const hotDeals = activeOffers.filter((o) => {
      const disc = Math.round((1 - o.price / (o.originalPrice || o.price)) * 100);
      return disc >= 30;
    }).length;

    const avgDiscount = totalOffers > 0
      ? Math.round(
          activeOffers.reduce((acc, o) => acc + (1 - o.price / (o.originalPrice || o.price)), 0) /
            totalOffers *
            100
        )
      : 0;

    const totalSavings = activeOffers.reduce(
      (acc, o) => acc + ((o.originalPrice || o.price) - o.price),
      0
    );

    return { totalOffers, inStockOffers, occasionOffers, hotDeals, avgDiscount, totalSavings };
  }, [activeOffers]);

  // Unique categories in scoped products
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    activeOffers.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [activeOffers]);

  // Filtered & Sorted Offers List
  const filteredOffers = useMemo(() => {
    return activeOffers.filter((product) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = product.name.toLowerCase().includes(q);
        const matchTitle = (product.offerTitle || '').toLowerCase().includes(q);
        const matchOccasion = (product.occasionName || '').toLowerCase().includes(q);
        const matchCat = (product.category || '').toLowerCase().includes(q);
        const matchStore = (product.storeName || '').toLowerCase().includes(q);
        if (!matchName && !matchTitle && !matchOccasion && !matchCat && !matchStore) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === 'in_stock' && !product.inStock) return false;
      if (statusFilter === 'out_of_stock' && product.inStock) return false;
      if (statusFilter === 'occasion' && !product.isOccasion) return false;
      if (statusFilter === 'hot') {
        const disc = Math.round((1 - product.price / (product.originalPrice || product.price)) * 100);
        if (disc < 30) return false;
      }

      // 3. Discount Tier
      if (discountTier !== 'all') {
        const disc = Math.round((1 - product.price / (product.originalPrice || product.price)) * 100);
        if (discountTier === '10-20' && (disc < 10 || disc > 20)) return false;
        if (discountTier === '20-35' && (disc <= 20 || disc > 35)) return false;
        if (discountTier === '35-50' && (disc <= 35 || disc > 50)) return false;
        if (discountTier === '50plus' && disc <= 50) return false;
      }

      // 4. Category Filter
      if (categoryFilter !== 'all' && product.category !== categoryFilter) {
        return false;
      }

      // 5. Store Filter (Admin only)
      if (!fixedStoreId && storeFilter && product.storeId !== storeFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const discA = Math.round((1 - a.price / (a.originalPrice || a.price)) * 100);
      const discB = Math.round((1 - b.price / (b.originalPrice || b.price)) * 100);
      const savingsA = (a.originalPrice || a.price) - a.price;
      const savingsB = (b.originalPrice || b.price) - b.price;

      if (sortBy === 'discount_desc') return discB - discA;
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'savings_desc') return savingsB - savingsA;
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      return 0;
    });
  }, [activeOffers, searchQuery, statusFilter, discountTier, categoryFilter, storeFilter, sortBy, fixedStoreId]);

  // Open modal for editing an existing offer
  const handleEditOffer = (product: Product) => {
    setSelectedProduct(product);
    const orig = product.originalPrice || product.price;
    const sale = product.price;
    const disc = orig > sale ? Math.round((1 - sale / orig) * 100) : 20;

    setFormOriginalPrice(orig);
    setFormSalePrice(sale);
    setFormDiscountPercent(disc);
    setFormOfferTitle(product.offerTitle || `${product.name} - عرض ترويجي`);
    setFormIsOccasion(Boolean(product.isOccasion));
    setFormOccasionName(product.occasionName || '');
    setFormBadge(product.badge || '🔥 عرض خاص');
    setFormMaxPerOrder(product.maxPerOrder || 3);
    setFormStartDate(product.offerStartDate || new Date().toISOString().split('T')[0]);
    setFormEndDate(product.offerEndDate || '');
    setIsModalOpen(true);
  };

  // Open modal for a new offer on a picked product
  const handlePickProduct = (product: Product) => {
    const productStore = stores.find(s => matchStoreId(s.id, product.storeId) || s.id === product.storeId);
    if (productStore && productStore.status === 'closed') {
      alert(`لا يمكن تفعيل أو إضافة عرض لمتجر مغلق (${productStore.name}). يرجى فتح المتجر أولاً لتفعيل عروضه للعملاء.`);
      return;
    }

    setSelectedProduct(product);
    setIsPickerOpen(false);
    const orig = product.originalPrice && product.originalPrice > product.price
      ? product.originalPrice
      : product.price;
    const initialDisc = 20;
    const calculatedSale = Math.max(1, Math.round(orig * (1 - initialDisc / 100)));

    setFormOriginalPrice(orig);
    setFormSalePrice(calculatedSale);
    setFormDiscountPercent(initialDisc);
    setFormOfferTitle(product.offerTitle || `${product.name} - عرض ترويجي`);
    setFormIsOccasion(Boolean(product.isOccasion));
    setFormOccasionName(product.occasionName || '');
    setFormBadge(product.badge || '🔥 عرض خاص');
    setFormMaxPerOrder(product.maxPerOrder || 3);
    setFormStartDate(product.offerStartDate || new Date().toISOString().split('T')[0]);
    setFormEndDate(product.offerEndDate || '');
    setIsModalOpen(true);
  };

  // Live calculator helpers
  const handleOriginalPriceChange = (newOrig: number) => {
    setFormOriginalPrice(newOrig);
    if (newOrig > 0 && formDiscountPercent > 0) {
      const newSale = Math.max(1, Math.round(newOrig * (1 - formDiscountPercent / 100)));
      setFormSalePrice(newSale);
    }
  };

  const handleDiscountPercentChange = (newPercent: number) => {
    setFormDiscountPercent(newPercent);
    if (formOriginalPrice > 0) {
      const newSale = Math.max(1, Math.round(formOriginalPrice * (1 - newPercent / 100)));
      setFormSalePrice(newSale);
    }
  };

  const handleSalePriceChange = (newSale: number) => {
    setFormSalePrice(newSale);
    if (formOriginalPrice > 0 && formOriginalPrice > newSale) {
      const calculatedPercent = Math.round((1 - newSale / formOriginalPrice) * 100);
      setFormDiscountPercent(calculatedPercent);
    }
  };

  // Toggle Offer In-Stock status
  const handleToggleAvailability = async (product: Product) => {
    try {
      const newStatus = !product.inStock;
      await saveRecord('products', product.id, {
        storeId: product.storeId,
        name: product.name,
        price: product.price,
        inStock: newStatus,
      });

      try {
        await supabase
          .from('products')
          .update({
            is_available: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);
      } catch (err) {
        console.warn('Supabase toggle notice:', err);
      }

      product.inStock = newStatus;
      showFeedback(`تم تحديث حالة الصنف إلى ${newStatus ? 'متوفر بالمخزن' : 'غير متوفر مؤقتاً'}.`);
    } catch (err: any) {
      showFeedback(err?.message || 'تعذر تحديث حالة التوفر.', 'error');
    }
  };

  // Cancel / Delete Offer and restore original price
  const handleCancelOffer = async (product: Product) => {
    const orig = product.originalPrice || product.price;
    if (
      !window.confirm(
        `هل أنت متأكد من إلغاء العرض عن "${product.name}" واستعادة السعر الأصلي الطبيعي (${formatEGP(
          orig
        )})؟`
      )
    ) {
      return;
    }

    try {
      setIsSubmitting(true);
      await saveRecord('products', product.id, {
        storeId: product.storeId,
        name: product.name,
        price: orig,
        originalPrice: null,
        offerTitle: null,
        isOccasion: false,
        occasionName: null,
        badge: null,
        inStock: product.inStock !== false,
      });

      try {
        await supabase
          .from('products')
          .update({
            price: orig,
            original_price: null,
            badge: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);
      } catch (err) {
        console.warn('Supabase offer cancel notice:', err);
      }

      product.price = orig;
      product.originalPrice = undefined;
      product.offerTitle = undefined;
      product.isOccasion = false;
      product.occasionName = undefined;
      product.badge = undefined;

      showFeedback(`تم إلغاء العرض بنجاح واستعادة السعر الأساسي لـ "${product.name}".`);
    } catch (err: any) {
      showFeedback(err?.message || 'تعذر إلغاء العرض. يرجى المحاولة مجدداً.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save new / updated offer
  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const productStore = stores.find(s => matchStoreId(s.id, selectedProduct.storeId) || s.id === selectedProduct.storeId);
    if (productStore && productStore.status === 'closed') {
      alert(`لا يمكن تفعيل أو حفظ عرض لمتجر مغلق حالياً (${productStore.name}). يرجى فتح المتجر أولاً لتفعيل عروضه.`);
      return;
    }

    if (formSalePrice <= 0 || formOriginalPrice <= formSalePrice) {
      alert('السعر قبل الخصم يجب أن يكون أكبر من سعر البيع المخفض.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        storeId: selectedProduct.storeId,
        name: selectedProduct.name,
        description: selectedProduct.description || '',
        category: selectedProduct.category || 'عام',
        price: Number(formSalePrice),
        originalPrice: Number(formOriginalPrice),
        offerTitle: formOfferTitle.trim() || `${selectedProduct.name} - عرض خاص`,
        isOccasion: Boolean(formIsOccasion),
        occasionName: formIsOccasion && formOccasionName.trim() ? formOccasionName.trim() : undefined,
        badge: formBadge.trim() || (formIsOccasion ? formOccasionName.trim() : '🔥 عرض خاص'),
        offerStartDate: formStartDate || undefined,
        offerEndDate: formEndDate || undefined,
        maxPerOrder: Number(formMaxPerOrder) > 0 ? Number(formMaxPerOrder) : undefined,
        inStock: true,
      };

      await saveRecord('products', selectedProduct.id, payload);

      try {
        await supabase
          .from('products')
          .update({
            price: Number(formSalePrice),
            original_price: Number(formOriginalPrice),
            is_available: true,
            badge: payload.badge,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedProduct.id);
      } catch (err) {
        console.warn('Supabase offer save warning:', err);
      }

      Object.assign(selectedProduct, payload);
      setIsModalOpen(false);
      showFeedback(`تم تفعيل وحفظ العرض الترويجي بنجاح على "${selectedProduct.name}"!`);
    } catch (err: any) {
      showFeedback(err?.message || 'تعذر حفظ بيانات العرض. يرجى التأكد من الاتصال والمحاولة مجدداً.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Feedback Toast Alert ── */}
      {feedbackMsg && (
        <div
          role="alert"
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md transition-all animate-in fade-in ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          1. HEADER & ACTION BAR
          ════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-[11px] font-black border border-orange-200 inline-flex items-center gap-1.5">
              <Tag size={12} className="text-orange-600" />
              <span>منظومة العروض والحملات الترويجية</span>
            </span>
            {currentStore && (
              <span className="text-xs font-bold text-slate-500">• فرع: {currentStore.name}</span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            عروض وتخفيضات {currentStore ? currentStore.name : 'المنتجات'}
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            أطلق عروض تخفيض موسمية، صفقات حارّة، وعروض المناسبات الخاصة لأصنافك لجذب عملاء الحي الحكومي وزيادة مبيعات المتجر.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href={currentStore ? `/stores/${getStoreSlug(currentStore)}` : '/offers'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="معاينة ظهور العروض في واجهة المتجر للعملاء"
          >
            <ExternalLink size={14} />
            <span>معاينة بالمتجر ↗</span>
          </a>

          <button
            type="button"
            onClick={() => {
              setPickerSearch('');
              setIsPickerOpen(true);
            }}
            className="px-5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>إضافة وتفعيل عرض جديد</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          2. METRIC CARDS (INTERACTIVE COUNTERS)
          ════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Active Offers */}
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`bg-white rounded-2xl p-4 border text-right transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/20 shadow-xs'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">إجمالي العروض</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Tag size={16} />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
            {metrics.totalOffers}
          </span>
          <span className="text-[10px] text-slate-400 font-bold block mt-0.5">صنف مخفّض بالمنيو</span>
        </button>

        {/* Card 2: In Stock & Live */}
        <button
          type="button"
          onClick={() => setStatusFilter('in_stock')}
          className={`bg-white rounded-2xl p-4 border text-right transition-all cursor-pointer ${
            statusFilter === 'in_stock'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-xs'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700">متاح للطلب الآن</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
            {metrics.inStockOffers}
          </span>
          <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">جاهز للتوصيل الفوري</span>
        </button>

        {/* Card 3: Occasion Campaigns */}
        <button
          type="button"
          onClick={() => setStatusFilter('occasion')}
          className={`bg-white rounded-2xl p-4 border text-right transition-all cursor-pointer ${
            statusFilter === 'occasion'
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-xs'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-700">عروض المناسبات</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
          </div>
          <span className="text-2xl font-black text-indigo-700 font-mono mt-1 block">
            {metrics.occasionOffers}
          </span>
          <span className="text-[10px] text-indigo-500 font-bold block mt-0.5">مواسم وأعياد خاصة</span>
        </button>

        {/* Card 4: Hot Deals 30%+ */}
        <button
          type="button"
          onClick={() => setStatusFilter('hot')}
          className={`bg-white rounded-2xl p-4 border text-right transition-all cursor-pointer ${
            statusFilter === 'hot'
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20 shadow-xs'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700">صفقات كبرى 30%+</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Flame size={16} />
            </div>
          </div>
          <span className="text-2xl font-black text-rose-700 font-mono mt-1 block">
            {metrics.hotDeals}
          </span>
          <span className="text-[10px] text-rose-500 font-bold block mt-0.5">خصومات قوية مشجعة</span>
        </button>

        {/* Card 5: Average Discount % */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300">متوسط الخصم</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 text-orange-400 flex items-center justify-center">
              <Percent size={15} />
            </div>
          </div>
          <span className="text-2xl font-black text-orange-400 font-mono mt-1 block">
            {metrics.avgDiscount}%
          </span>
          <span className="text-[10px] text-slate-300 font-bold block mt-0.5">
            إجمالي وفر: {formatEGP(metrics.totalSavings)}
          </span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          3. TAILORED FILTER & SEARCH TOOLBAR
          ════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-80 lg:w-96">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث بالاسم، اسم العرض، أو اسم المناسبة…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 text-xs font-bold scrollbar-none">
            {[
              { id: 'all', label: 'جميع العروض', count: metrics.totalOffers },
              { id: 'in_stock', label: '🟢 متاح للطلب', count: metrics.inStockOffers },
              { id: 'occasion', label: '🌙 مناسبات', count: metrics.occasionOffers },
              { id: 'hot', label: '🔥 30%+ وفر', count: metrics.hotDeals },
              { id: 'out_of_stock', label: '⏸️ غير متاح', count: metrics.totalOffers - metrics.inStockOffers },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                    statusFilter === tab.id ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Discount Tier Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500">نسبة الخصم:</span>
            <select
              value={discountTier}
              onChange={(e) => setDiscountTier(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">كل النسب</option>
              <option value="10-20">خصم 10% إلى 20%</option>
              <option value="20-35">خصم 20% إلى 35%</option>
              <option value="35-50">خصم 35% إلى 50%</option>
              <option value="50plus">خصم 50%+ (نصف السعر)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500">التصنيف:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">كل التصنيفات ({availableCategories.length})</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Store Filter (Only in Admin view) */}
          {!fixedStoreId && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500">المتجر:</span>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="">جميع المتاجر ({stores.length})</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 mr-auto">
            <span className="text-[10px] font-bold text-slate-500">الترتيب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="discount_desc">الأعلى نسبة خصم %</option>
              <option value="savings_desc">الأكبر توفيراً (ج.م)</option>
              <option value="price_asc">الأقل سعراً بعد الخصم</option>
              <option value="price_desc">الأعلى سعراً بعد الخصم</option>
              <option value="name">الاسم أبجدياً</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(searchQuery || statusFilter !== 'all' || discountTier !== 'all' || categoryFilter !== 'all' || storeFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setDiscountTier('all');
                setCategoryFilter('all');
                setStoreFilter('');
              }}
              className="text-[11px] text-orange-600 hover:text-orange-700 font-bold px-2 py-1 cursor-pointer"
            >
              مسح التصفية
            </button>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          4. OFFERS GRID (ENTERPRISE NOON / TALABAT CARDS)
          ════════════════════════════════════════════════════════════ */}
      {filteredOffers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-2xs space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
            <Tag size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900">
              {activeOffers.length === 0 ? 'لا توجد عروض ترويجية نشطة حالياً' : 'لا توجد عروض تطابق نتائج البحث والتصفية'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {activeOffers.length === 0
                ? 'ابدأ بتنشيط المبيعات الآن عبر إضافة خصم على أصنافك المميزة وتحديد نسبة التوفير ليراها عملاء الحي فوراً.'
                : 'جرب تغيير خيارات التصفية أو البحث لإظهار بقية العروض المسجلة.'}
            </p>
          </div>
          {activeOffers.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                setPickerSearch('');
                setIsPickerOpen(true);
              }}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xs font-bold inline-flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Plus size={15} />
              <span>إضافة وتفعيل أول عرض</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setDiscountTier('all');
                setCategoryFilter('all');
                setStoreFilter('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              إعادة تعيين الفلاتر
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOffers.map((product) => {
            const orig = product.originalPrice || product.price;
            const sale = product.price;
            const discountPercent = Math.round((1 - sale / orig) * 100);
            const savingsAmount = orig - sale;
            const store = stores.find((s) => s.id === product.storeId);

            return (
              <div
                key={product.id}
                className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Image & Badges Ribbon */}
                  <div className="h-44 w-full bg-slate-100 relative overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 text-3xl">
                        🍽️
                      </div>
                    )}

                    {/* Gradient Vignette */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                    {/* Top Right: Discount Percentage Ribbon */}
                    <div className="absolute top-3 right-3 bg-gradient-to-r from-rose-600 to-orange-600 text-white px-3 py-1 rounded-xl text-xs font-black shadow-md flex items-center gap-1">
                      <span>خصم {discountPercent}%</span>
                    </div>

                    {/* Top Left: Occasion or Custom Badge */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                      {product.isOccasion ? (
                        <span className="bg-indigo-600/95 backdrop-blur-xs text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1">
                          <span>🌙 {product.occasionName || 'مناسبة خاصة'}</span>
                        </span>
                      ) : product.badge ? (
                        <span className="bg-slate-900/85 backdrop-blur-xs text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold shadow-xs">
                          {product.badge}
                        </span>
                      ) : null}

                      {/* In-Stock Indicator */}
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[9px] font-bold shadow-2xs ${
                          product.inStock
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {product.inStock ? '🟢 متاح للطلب' : '⏸️ موقوف مؤقتاً'}
                      </span>
                    </div>

                    {/* Bottom overlay: Store name if in Admin mode */}
                    {!fixedStoreId && store && (
                      <div className="absolute bottom-2.5 right-3 text-white text-[11px] font-bold drop-shadow-md flex items-center gap-1">
                        <ShoppingBag size={12} className="text-orange-400" />
                        <span>{store.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    {/* Category & Offer Title */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-bold">{product.category}</span>
                        {product.maxPerOrder && (
                          <span className="text-slate-500 font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded">
                            أقصى حد: {product.maxPerOrder} قطع
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-black text-slate-900 truncate" title={product.name}>
                        {product.name}
                      </h3>

                      {product.offerTitle && (
                        <p className="text-[11px] font-bold text-orange-600 flex items-center gap-1 truncate">
                          <Sparkles size={11} className="shrink-0" />
                          <span>{product.offerTitle}</span>
                        </p>
                      )}
                    </div>

                    {/* Pricing & Real Savings Box */}
                    <div className="p-3 bg-gradient-to-r from-orange-50/70 to-amber-50/60 rounded-2xl border border-orange-200/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">السعر بعد الخصم:</span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <strong className="text-base font-black text-slate-900 font-mono">
                            {formatEGP(sale)}
                          </strong>
                          <del className="text-xs text-slate-400 font-mono">
                            {formatEGP(orig)}
                          </del>
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="px-2 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 block text-center">
                          وفرت {formatEGP(savingsAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Schedule / Validity Date if present */}
                    {(product.offerStartDate || product.offerEndDate) && (
                      <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5 pt-0.5">
                        <Calendar size={12} className="text-slate-400" />
                        <span>
                          ساري
                          {product.offerStartDate && ` من ${product.offerStartDate}`}
                          {product.offerEndDate ? ` حتى ${product.offerEndDate}` : ' (مستمر)'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAvailability(product)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                      product.inStock
                        ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                    title="تغيير حالة التوافر الفوري للطلب"
                  >
                    {product.inStock ? 'إيقاف مؤقت' : 'تفعيل للطلب'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEditOffer(product)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-orange-50 text-orange-700 border border-slate-200 hover:border-orange-200 text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Edit2 size={12} />
                      <span>تعديل</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleCancelOffer(product)}
                      className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                      title="إلغاء الخصم واستعادة السعر الأصلي"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          5. MODAL: STEP 1 - PRODUCT PICKER
          ════════════════════════════════════════════════════════════ */}
      {isPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <header className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                  <Tag size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">اختر الصنف المراد تطبيق العرض عليه</h3>
                  <p className="text-[11px] text-slate-500">
                    {currentStore ? `أصناف منيو ${currentStore.name}` : 'جميع أصناف الكتالوج'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            </header>

            {/* Picker Search */}
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو التصنيف أو السعر…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100">
              {scopedProducts
                .filter((p) => {
                  if (!pickerSearch.trim()) return true;
                  const q = pickerSearch.trim().toLowerCase();
                  return (
                    p.name.toLowerCase().includes(q) ||
                    (p.category || '').toLowerCase().includes(q) ||
                    (p.storeName || '').toLowerCase().includes(q)
                  );
                })
                .map((p) => {
                  const productStore = stores.find((s) => matchStoreId(s.id, p.storeId) || s.id === p.storeId);
                  const isStoreClosed = productStore?.status === 'closed';
                  const hasOffer = typeof p.originalPrice === 'number' && p.originalPrice > p.price;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePickProduct(p)}
                      className={`w-full py-2.5 px-3 rounded-2xl flex items-center justify-between gap-3 text-right transition ${
                        isStoreClosed ? 'opacity-60 bg-slate-50 cursor-not-allowed' : 'hover:bg-orange-50/70 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/80">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 text-lg">
                              🍽️
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{p.name}</h4>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {p.category} {productStore?.name ? `· ${productStore.name}` : p.storeName ? `· ${p.storeName}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <strong className="text-xs font-black font-mono text-slate-900 block">
                          {formatEGP(p.price)}
                        </strong>
                        {isStoreClosed ? (
                          <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded inline-block mt-0.5">
                            متجر مغلق 🚫
                          </span>
                        ) : hasOffer ? (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded inline-block mt-0.5">
                            عرض نشط حالياً 🔥
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          6. MODAL: STEP 2 - LAUNCH / EDIT OFFER DETAILS
          ════════════════════════════════════════════════════════════ */}
      {isModalOpen && selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <header className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                  <Tag size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">إدارة وتفعيل العرض الترويجي</h3>
                  <p className="text-[11px] text-slate-500">حدد نسبة الخصم وسعر البيع وشروط العرض</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            </header>

            <form onSubmit={handleSaveOffer} className="p-5 space-y-4 text-xs overflow-y-auto">
              {/* Product Info Summary Header */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
                    {selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 text-xl">
                        🍽️
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-slate-900 truncate">{selectedProduct.name}</h4>
                    <span className="text-[10px] text-slate-500 block truncate">{selectedProduct.category}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setIsPickerOpen(true);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-orange-600 hover:bg-orange-50 rounded-lg cursor-pointer shrink-0"
                >
                  تغيير الصنف
                </button>
              </div>

              {/* ── Smart Discount Calculator ── */}
              <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-orange-950 flex items-center gap-1.5">
                    <Percent size={14} className="text-orange-600" />
                    <span>حاسبة الخصم والتسعير الذكية</span>
                  </span>
                  <span className="text-[10px] text-orange-700 font-bold">
                    وفرت: {formatEGP(Math.max(0, formOriginalPrice - formSalePrice))} ({formDiscountPercent}%)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* Original Price */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      السعر الأساسي (ج.م) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={formOriginalPrice || ''}
                      onChange={(e) => handleOriginalPriceChange(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Discount Percentage % */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      نسبة الخصم (%) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="90"
                      step="1"
                      value={formDiscountPercent || ''}
                      onChange={(e) => handleDiscountPercentChange(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-orange-700 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Sale Price */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      سعر البيع بالعرض (ج.م) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={formSalePrice || ''}
                      onChange={(e) => handleSalePriceChange(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-mono font-black text-emerald-700 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Quick Discount Percent Pills */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-500 font-bold">نسب سريعة:</span>
                  {[10, 15, 20, 25, 30, 40, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleDiscountPercentChange(pct)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition ${
                        formDiscountPercent === pct
                          ? 'bg-orange-600 text-white'
                          : 'bg-white hover:bg-orange-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Offer Title */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  اسم أو عنوان العرض الترويجي *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: وجبة التوفير العائلية، عرض الغداء السريع"
                  value={formOfferTitle}
                  onChange={(e) => setFormOfferTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Occasion / Seasonal Deal Toggle */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                    <Sparkles size={14} className="text-indigo-600" />
                    <span>هل هذا العرض مرتبط بمناسبة أو موسم خاص؟</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormIsOccasion(!formIsOccasion)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formIsOccasion ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formIsOccasion ? '-translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {formIsOccasion && (
                  <div className="space-y-2 pt-1 border-t border-slate-200/80 animate-in fade-in">
                    <label className="block text-[10px] font-bold text-slate-600">اسم المناسبة أو الموسم:</label>
                    <input
                      type="text"
                      placeholder="مثال: شهر رمضان المبارك، عروض الصيف"
                      value={formOccasionName}
                      onChange={(e) => setFormOccasionName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                    />

                    {/* Occasion Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {OCCASION_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setFormOccasionName(p.label)}
                          className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>{p.icon}</span>
                          <span>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Marketing Badge Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  الشارة التسويقية المميزة (Badge)
                </label>
                <input
                  type="text"
                  value={formBadge}
                  onChange={(e) => setFormBadge(e.target.value)}
                  placeholder="مثال: 🔥 عرض خاص"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-orange-500 mb-1.5"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {BADGE_PRESETS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setFormBadge(b)}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Per Order & Date Range */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    أقصى حد للعميل
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formMaxPerOrder}
                    onChange={(e) => setFormMaxPerOrder(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    تاريخ البداية
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    تاريخ الانتهاء
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* ── Live Customer Preview Card ── */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-black text-slate-400 block mb-1.5 uppercase tracking-wider">
                  معاينة مباشرة لشكل العرض للعميل:
                </span>
                <div className="p-3 bg-slate-100/70 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 relative">
                      {selectedProduct.imageUrl ? (
                        <img src={selectedProduct.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">🍽️</div>
                      )}
                      <span className="absolute top-0 right-0 bg-rose-600 text-white text-[8px] font-black px-1 rounded-bl">
                        -{formDiscountPercent}%
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h5 className="text-xs font-bold text-slate-900 truncate">{selectedProduct.name}</h5>
                        {formIsOccasion && (
                          <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                            🌙 {formOccasionName || 'مناسبة'}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-orange-600 font-bold block truncate">
                        {formOfferTitle || 'عرض خاص'}
                      </span>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <strong className="text-sm font-black text-emerald-700 font-mono block">
                      {formatEGP(formSalePrice)}
                    </strong>
                    <del className="text-[10px] text-slate-400 font-mono block">
                      {formatEGP(formOriginalPrice)}
                    </del>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                >
                  <Check size={14} />
                  <span>{isSubmitting ? 'جارٍ تفعيل العرض…' : 'حفظ وتفعيل العرض'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default OffersManager;
