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
  Info,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Clock3,
  LayoutGrid,
  Table2,
} from 'lucide-react';
import type { Product, Store, Order } from '../types';
import { formatEGP } from '../utils/orderCalculations';
import { matchStoreId } from '../utils/storeAssets';
import { getStoreSlug } from '../utils/storeAssets';
import { saveRecord } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { adminApi } from '../lib/adminApi';

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
  
  // Store status filter: open_only by default to prevent showing products from closed stores
  const [storeStatusFilter, setStoreStatusFilter] = useState<'open_only' | 'all'>('open_only');

  // Helper to check if a product is in stock and available
  const isProductAvailable = (p: Product) => {
    return p.inStock !== false && (p as any).is_available !== false && (p as any).isAvailable !== false;
  };

  // Helper to find store for product
  const getProductStore = (p: Product) => {
    return stores.find((s) => matchStoreId(s.id, p.storeId) || s.id === p.storeId || (s.name && p.storeName === s.name));
  };

  // Filter products scoped strictly to store if fixedStoreId is provided (Merchant Store Isolation)
  // Strips all fake, test, and duplicate items
  // When storeStatusFilter === 'open_only' (default), strictly excludes products from closed stores
  const scopedProducts = useMemo(() => {
    let list = products.filter((p) => {
      if (p.archived) return false;
      if (p.id?.startsWith('00000000-')) return false;
      const n = (p.name || '').trim().toLowerCase();
      if (n.includes('تجريب') || n.includes('اختبار') || n.includes('test') || n.includes('dummy')) return false;

      // Closed store exclusion if storeStatusFilter is 'open_only' (Default)
      if (storeStatusFilter === 'open_only') {
        const store = stores.find((s) => matchStoreId(s.id, p.storeId) || s.id === p.storeId || (s.name && p.storeName === s.name));
        if (store) {
          if (store.status === 'closed' || (store as any).stopped_at || (store as any).is_archived) return false;
        } else if (!p.storeId) {
          const central = stores.find((st) => st.id === 'a0000000-0000-0000-0000-000000000001' || st.name?.includes('سنجوب'));
          if (central?.status === 'closed') return false;
        }
      }

      return true;
    });

    // Deduplicate identical items in same store to avoid mock/duplicate clutter
    const seen = new Set<string>();
    list = list.filter((p) => {
      const key = `${p.storeId || ''}::${(p.name || '').trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!fixedStoreId) return list;
    return list.filter((p) => matchStoreId(p.storeId, fixedStoreId) || p.storeId === fixedStoreId);
  }, [products, stores, fixedStoreId, storeStatusFilter]);

  // Current store object (if fixedStoreId)
  const currentStore = useMemo(() => {
    if (!fixedStoreId) return undefined;
    return stores.find((s) => matchStoreId(s.id, fixedStoreId) || s.id === fixedStoreId);
  }, [stores, fixedStoreId]);

  // View Mode: Cards vs Table
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    try {
      return (localStorage.getItem('admin_offers_view_mode') as 'cards' | 'table') || 'cards';
    } catch {
      return 'cards';
    }
  });

  const handleSetViewMode = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('admin_offers_view_mode', mode);
    } catch {}
  };

  // Offer Scope Filter: All Discounted Catalog vs Featured Promotional Deals
  const [offerScope, setOfferScope] = useState<'all' | 'promotional'>('all');

  // All offers: items with valid originalPrice > price OR with offer status (pending approval, approved, rejected)
  const allOffers = useMemo(() => {
    return scopedProducts.filter((p) => {
      const hasClassicOffer = typeof p.originalPrice === 'number' && p.originalPrice > p.price;
      const hasOfferStatus = Boolean(p.offerStatus) || Boolean(p.offerProposedPrice) || Boolean(p.offerTitle);
      if (!hasClassicOffer && !hasOfferStatus) return false;

      if (offerScope === 'promotional') {
        const orig = p.originalPrice || p.price;
        const sale = p.offerProposedPrice || p.price;
        const disc = orig > 0 ? Math.round((1 - sale / orig) * 100) : 0;
        const hasPromoBadge = Boolean(p.badge && (p.badge.includes('عرض') || p.badge.includes('توفير') || p.badge.includes('خصم')));
        return disc >= 12 || hasPromoBadge || Boolean(p.offerTitle) || Boolean(p.isOccasion) || Boolean(p.offerStatus);
      }

      return true;
    });
  }, [scopedProducts, offerScope]);

  // ── Filters & Search State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'occasion' | 'hot' | 'out_of_stock'>('all');
  const [discountTier, setDiscountTier] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'discount_desc' | 'price_asc' | 'price_desc' | 'savings_desc' | 'store' | 'name'>('discount_desc');

  // Filtered stores list for the store dropdown
  const filteredStoresList = useMemo(() => {
    if (storeStatusFilter === 'open_only') {
      return stores.filter((s) => s.status === 'open' && !s.name?.includes('اختبار') && !s.name?.includes('تجريب'));
    }
    return stores.filter((s) => !s.name?.includes('اختبار') && !s.name?.includes('تجريب'));
  }, [stores, storeStatusFilter]);

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
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // ── Metrics Calculation ──
  const metrics = useMemo(() => {
    const totalOffers = allOffers.length;
    const pendingOffers = allOffers.filter((o) => o.offerStatus === 'pending_approval').length;
    const approvedOffers = allOffers.filter(
      (o) => o.offerStatus === 'approved' || (!o.offerStatus && typeof o.originalPrice === 'number' && o.originalPrice > o.price)
    ).length;
    const rejectedOffers = allOffers.filter((o) => o.offerStatus === 'rejected').length;
    const inStockOffers = allOffers.filter((o) => o.inStock !== false).length;
    const occasionOffers = allOffers.filter((o) => Boolean(o.isOccasion)).length;
    const hotDeals = allOffers.filter((o) => {
      const orig = o.originalPrice || o.price;
      const sale = o.offerProposedPrice || o.price;
      const disc = orig > 0 ? Math.round((1 - sale / orig) * 100) : 0;
      return disc >= 30;
    }).length;

    const validSavingsItems = allOffers.filter((o) => o.offerStatus !== 'rejected');
    const avgDiscount = validSavingsItems.length > 0
      ? Math.round(
          validSavingsItems.reduce((acc, o) => {
            const orig = o.originalPrice || o.price;
            const sale = o.offerProposedPrice || o.price;
            return acc + (orig > 0 ? (1 - sale / orig) : 0);
          }, 0) / validSavingsItems.length * 100
        )
      : 0;

    const totalSavings = validSavingsItems.reduce((acc, o) => {
      const orig = o.originalPrice || o.price;
      const sale = o.offerProposedPrice || o.price;
      return acc + Math.max(0, orig - sale);
    }, 0);

    return { totalOffers, pendingOffers, approvedOffers, rejectedOffers, inStockOffers, occasionOffers, hotDeals, avgDiscount, totalSavings };
  }, [allOffers]);

  // Unique categories in scoped products
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    allOffers.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [allOffers]);

  // Filtered & Sorted Offers List
  const filteredOffers = useMemo(() => {
    return allOffers.filter((product) => {
      // 0. Approval Workflow Filter
      if (approvalFilter === 'pending' && product.offerStatus !== 'pending_approval') return false;
      if (approvalFilter === 'approved' && product.offerStatus !== 'approved' && (product.offerStatus === 'pending_approval' || product.offerStatus === 'rejected')) return false;
      if (approvalFilter === 'rejected' && product.offerStatus !== 'rejected') return false;

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
      if (statusFilter === 'in_stock' && product.inStock === false) return false;
      if (statusFilter === 'out_of_stock' && product.inStock !== false) return false;
      if (statusFilter === 'occasion' && !product.isOccasion) return false;
      if (statusFilter === 'hot') {
        const orig = product.originalPrice || product.price;
        const sale = product.offerProposedPrice || product.price;
        const disc = orig > 0 ? Math.round((1 - sale / orig) * 100) : 0;
        if (disc < 30) return false;
      }

      // 3. Discount Tier
      if (discountTier !== 'all') {
        const orig = product.originalPrice || product.price;
        const sale = product.offerProposedPrice || product.price;
        const disc = orig > 0 ? Math.round((1 - sale / orig) * 100) : 0;
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

      // 6. Store Status Filter: Open only by default
      if (storeStatusFilter === 'open_only') {
        const store = stores.find((s) => s.id === product.storeId || matchStoreId(s.id, product.storeId) || (s.name && product.storeName === s.name));
        if (store) {
          if (store.status === 'closed' || (store as any).stopped_at || (store as any).is_archived) return false;
        } else if (!product.storeId) {
          const central = stores.find((st) => st.id === 'a0000000-0000-0000-0000-000000000001' || st.name?.includes('سنجوب'));
          if (central?.status === 'closed') return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const availA = isProductAvailable(a) ? 1 : 0;
      const availB = isProductAvailable(b) ? 1 : 0;

      // In-stock / available products always prioritized over paused/out-of-stock items
      if (availA !== availB) {
        return availB - availA;
      }

      const origA = a.originalPrice || a.price;
      const saleA = a.offerProposedPrice && a.offerProposedPrice > 0 ? a.offerProposedPrice : a.price;
      const origB = b.originalPrice || b.price;
      const saleB = b.offerProposedPrice && b.offerProposedPrice > 0 ? b.offerProposedPrice : b.price;

      const discA = origA > 0 ? Math.round((1 - saleA / origA) * 100) : 0;
      const discB = origB > 0 ? Math.round((1 - saleB / origB) * 100) : 0;
      const savingsA = Math.max(0, origA - saleA);
      const savingsB = Math.max(0, origB - saleB);

      if (sortBy === 'discount_desc') {
        if (discB !== discA) return discB - discA;
        if (savingsB !== savingsA) return savingsB - savingsA;
        if (saleA !== saleB) return saleA - saleB;
        return a.name.localeCompare(b.name, 'ar');
      }

      if (sortBy === 'savings_desc') {
        if (savingsB !== savingsA) return savingsB - savingsA;
        if (discB !== discA) return discB - discA;
        if (saleA !== saleB) return saleA - saleB;
        return a.name.localeCompare(b.name, 'ar');
      }

      if (sortBy === 'price_asc') {
        if (saleA !== saleB) return saleA - saleB;
        if (discB !== discA) return discB - discA;
        return a.name.localeCompare(b.name, 'ar');
      }

      if (sortBy === 'price_desc') {
        if (saleB !== saleA) return saleB - saleA;
        if (discB !== discA) return discB - discA;
        return a.name.localeCompare(b.name, 'ar');
      }

      if (sortBy === 'store') {
        const storeA = a.storeName || '';
        const storeB = b.storeName || '';
        const cmp = storeA.localeCompare(storeB, 'ar');
        if (cmp !== 0) return cmp;
        if (discB !== discA) return discB - discA;
        return savingsB - savingsA;
      }

      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      return 0;
    });
  }, [allOffers, approvalFilter, searchQuery, statusFilter, discountTier, categoryFilter, storeFilter, storeStatusFilter, sortBy, fixedStoreId, stores]);

  // Open modal for editing an existing offer
  const handleEditOffer = (product: Product) => {
    setSelectedProduct(product);
    const orig = product.originalPrice || product.price;
    const sale = product.offerProposedPrice && product.offerProposedPrice > 0 ? product.offerProposedPrice : product.price;
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

  // Admin Approval: Approve & activate merchant's offer on public storefront
  const handleApproveOffer = async (product: Product) => {
    try {
      setIsSubmitting(true);
      const targetSalePrice = product.offerProposedPrice && product.offerProposedPrice > 0
        ? product.offerProposedPrice
        : product.price;
      const targetOrigPrice = product.originalPrice || product.price;

      const payload = {
        storeId: product.storeId,
        name: product.name,
        price: Number(targetSalePrice),
        originalPrice: Number(targetOrigPrice),
        offerStatus: 'approved' as const,
        offerProposedPrice: null,
        offerRejectionReason: null,
        badge: product.badge || '🔥 عرض خاص',
        inStock: true,
      };

      await saveRecord('products', product.id, payload);

      await adminApi('data', {
        action: 'save',
        collection: 'products',
        id: product.id,
        data: payload,
      }).catch((err) => console.warn('adminApi offer approve notice:', err));

      product.price = Number(targetSalePrice);
      product.originalPrice = Number(targetOrigPrice);
      product.offerStatus = 'approved';
      product.offerProposedPrice = undefined;
      product.offerRejectionReason = undefined;

      showFeedback(`✓ تم اعتماد وتفعيل العرض الترويجي بنجاح على "${product.name}" ونشره لعملاء المتجر!`);
    } catch (err: any) {
      showFeedback(err?.message || 'تعذر اعتماد العرض. يرجى المحاولة مجدداً.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin Rejection: Reject merchant's offer with reason
  const handleRejectOffer = async (product: Product) => {
    const reason = window.prompt(
      `أدخل سبب رفض العرض لـ "${product.name}" ليظهر للتاجر في لوحة التحكم الخاصة به:`,
      'نسبة الخصم أو السعر المقترح غير متوافق مع معايير التسعير المعتمدة'
    );
    if (!reason || !reason.trim()) return;

    try {
      setIsSubmitting(true);
      const restorePrice = product.originalPrice || product.price;

      const payload = {
        storeId: product.storeId,
        name: product.name,
        price: Number(restorePrice),
        originalPrice: null,
        offerStatus: 'rejected' as const,
        offerProposedPrice: null,
        offerRejectionReason: reason.trim(),
      };

      await saveRecord('products', product.id, payload);

      await adminApi('data', {
        action: 'save',
        collection: 'products',
        id: product.id,
        data: payload,
      }).catch((err) => console.warn('adminApi offer reject notice:', err));

      product.price = Number(restorePrice);
      product.originalPrice = undefined;
      product.offerStatus = 'rejected';
      product.offerProposedPrice = undefined;
      product.offerRejectionReason = reason.trim();

      showFeedback(`تم رفض العرض لـ "${product.name}" وتوضيح السبب للتاجر.`);
    } catch (err: any) {
      showFeedback(err?.message || 'تعذر تسجيل الرفض. يرجى المحاولة مجدداً.', 'error');
    } finally {
      setIsSubmitting(false);
    }
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

  // Cancel / Delete Offer or withdraw pending approval
  const handleCancelOffer = async (product: Product) => {
    const isPending = product.offerStatus === 'pending_approval';
    const orig = product.originalPrice || product.price;
    const confirmPrompt = isPending
      ? `هل أنت متأكد من سحب وإلغاء طلب العرض الترويجي المعلق لـ "${product.name}"؟`
      : `هل أنت متأكد من إلغاء العرض عن "${product.name}" واستعادة السعر الأصلي الطبيعي (${formatEGP(orig)})؟`;

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        storeId: product.storeId,
        name: product.name,
        price: Number(orig),
        originalPrice: null,
        offerTitle: null,
        isOccasion: false,
        occasionName: null,
        badge: null,
        offerStatus: null,
        offerProposedPrice: null,
        offerRejectionReason: null,
        inStock: product.inStock !== false,
      };

      await saveRecord('products', product.id, payload);

      await adminApi('data', {
        action: 'save',
        collection: 'products',
        id: product.id,
        data: payload,
      }).catch((err) => console.warn('adminApi offer cancel notice:', err));

      try {
        await supabase
          .from('products')
          .update({
            price: Number(orig),
            original_price: null,
            badge: null,
            offer_title: null,
            offer_status: null,
            offer_proposed_price: null,
            offer_rejection_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);
      } catch (err) {
        console.warn('Supabase offer cancel notice:', err);
      }

      product.price = Number(orig);
      product.originalPrice = undefined;
      product.offerTitle = undefined;
      product.isOccasion = false;
      product.occasionName = undefined;
      product.badge = undefined;
      product.offerStatus = undefined;
      product.offerProposedPrice = undefined;
      product.offerRejectionReason = undefined;

      showFeedback(
        isPending
          ? `تم سحب طلب العرض بنجاح للصنف "${product.name}".`
          : `تم إلغاء العرض واستعادة السعر الأساسي لـ "${product.name}".`
      );
    } catch (err: any) {
      showFeedback(err?.message || 'تعذر إلغاء العرض. يرجى المحاولة مجدداً.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save new / updated offer (Supports Central Admin Approval Workflow)
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

    const isMerchantMode = Boolean(fixedStoreId);
    const targetStatus = isMerchantMode ? 'pending_approval' : 'approved';
    const activePrice = isMerchantMode ? Number(formOriginalPrice) : Number(formSalePrice);

    try {
      setIsSubmitting(true);
      const payload = {
        storeId: selectedProduct.storeId,
        name: selectedProduct.name,
        description: selectedProduct.description || '',
        category: selectedProduct.category || 'عام',
        price: activePrice,
        originalPrice: Number(formOriginalPrice),
        offerTitle: formOfferTitle.trim() || `${selectedProduct.name} - عرض خاص`,
        isOccasion: Boolean(formIsOccasion),
        occasionName: formIsOccasion && formOccasionName.trim() ? formOccasionName.trim() : undefined,
        badge: formBadge.trim() || (formIsOccasion ? formOccasionName.trim() : '🔥 عرض خاص'),
        offerStartDate: formStartDate || undefined,
        offerEndDate: formEndDate || undefined,
        maxPerOrder: Number(formMaxPerOrder) > 0 ? Number(formMaxPerOrder) : undefined,
        offerStatus: targetStatus as any,
        offerProposedPrice: isMerchantMode ? Number(formSalePrice) : undefined,
        offerRejectionReason: undefined,
        inStock: true,
      };

      await saveRecord('products', selectedProduct.id, payload);

      await adminApi('data', {
        action: 'save',
        collection: 'products',
        id: selectedProduct.id,
        data: payload,
      }).catch((err) => console.warn('adminApi offer save notice:', err));

      try {
        await supabase
          .from('products')
          .update({
            price: activePrice,
            original_price: Number(formOriginalPrice),
            is_available: true,
            badge: payload.badge,
            offer_title: payload.offerTitle,
            offer_status: targetStatus,
            offer_proposed_price: isMerchantMode ? Number(formSalePrice) : null,
            offer_rejection_reason: null,
            offer_start_date: payload.offerStartDate || null,
            offer_end_date: payload.offerEndDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedProduct.id);
      } catch (err) {
        console.warn('Supabase offer save warning:', err);
      }

      Object.assign(selectedProduct, payload);
      setIsModalOpen(false);

      if (isMerchantMode) {
        showFeedback(`🟡 تم إرسال طلب العرض للإدارة المركزية بنجاح! سيتم مراجعته واعتماده قبل ظهوره لعملاء المتجر.`);
      } else {
        showFeedback(`🟢 تم تفعيل واعتماد العرض الترويجي بنجاح على "${selectedProduct.name}"!`);
      }
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
          1.1 STANDARDIZED OFFERS ROADMAP & GUIDELINES BANNER
          ════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-teal-500/10 rounded-3xl p-5 border border-amber-200/80 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck size={22} className="text-amber-700" />
          </div>
          <div className="space-y-1 text-xs">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <span>خريطة ومعايير العروض الترويجية والاعتماد المركزي</span>
              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                ضوابط موحدة
              </span>
            </h3>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              <strong>1. خصوصية وعزل المتجر:</strong> يقتصر ظهور وإدارة المنتجات حصرياً على أصناف المتجر التابع للشريك، ولا تظهر أصناف المتاجر الأخرى.
              <br />
              <strong>2. معايير التسعير:</strong> تتراوح نسبة الخصم بين 5% و 85% ويُشترط أن يكون السعر الأساسي أعلى من سعر التخفيض لحماية حقوق العميل والتاجر.
              <br />
              <strong>3. دورة الاعتماد المركزية:</strong> عند إضافة التاجر لأي عرض جديد، يُسجل كـ <span className="font-bold text-amber-800">"قيد مراجعة واعتماد الإدارة المركزية"</span> لحماية واجهة المتجر من أي تسعير خاطئ، ويتم تفعيله مباشرة على المتجر فور مراجعة واعتماد الإدارة.
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          2. METRIC CARDS (INTERACTIVE APPROVAL & CAMPAIGN COUNTERS)
          ════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Offers */}
        <button
          type="button"
          onClick={() => {
            setApprovalFilter('all');
            setStatusFilter('all');
          }}
          className={`bg-white rounded-2xl p-4 border text-right transition-all cursor-pointer ${
            approvalFilter === 'all' && statusFilter === 'all'
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
          <span className="text-[10px] text-slate-400 font-bold block mt-0.5">صنف بالمنظومة</span>
        </button>

        {/* Card 2: Pending Approval 🟡 */}
        <button
          type="button"
          onClick={() => {
            setApprovalFilter('pending');
            setStatusFilter('all');
          }}
          className={`bg-white rounded-2xl p-4 border text-right transition-all cursor-pointer relative ${
            approvalFilter === 'pending'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30 shadow-xs'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          {metrics.pendingOffers > 0 && (
            <span className="absolute -top-1 -left-1 w-3 h-3 bg-amber-500 rounded-full animate-ping" />
          )}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700">بانتظار الاعتماد</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock3 size={16} />
            </div>
          </div>
          <span className="text-2xl font-black text-amber-700 font-mono mt-1 block">
            {metrics.pendingOffers}
          </span>
          <span className="text-[10px] text-amber-600 font-bold block mt-0.5">مراجعة الإدارة المركزية</span>
        </button>

        {/* Card 3: Approved & Live 🟢 */}
        <button
          type="button"
          onClick={() => {
            setApprovalFilter('approved');
            setStatusFilter('all');
          }}
          className={`bg-white rounded-2xl p-4 border text-right transition-all cursor-pointer ${
            approvalFilter === 'approved'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-xs'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700">معتمدة ونشطة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle size={16} />
            </div>
          </div>
          <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
            {metrics.approvedOffers}
          </span>
          <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">مفعّلة على المتجر للعملاء</span>
        </button>

        {/* Card 4: Rejected 🔴 */}
        <button
          type="button"
          onClick={() => {
            setApprovalFilter('rejected');
            setStatusFilter('all');
          }}
          className={`bg-white rounded-2xl p-4 border text-right transition-all cursor-pointer ${
            approvalFilter === 'rejected'
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20 shadow-xs'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700">مرفوضة من الإدارة</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle size={16} />
            </div>
          </div>
          <span className="text-2xl font-black text-rose-700 font-mono mt-1 block">
            {metrics.rejectedOffers}
          </span>
          <span className="text-[10px] text-rose-500 font-bold block mt-0.5">تتطلب تعديل السعر/الشروط</span>
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

          {/* Primary Approval Workflow Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 text-xs font-bold scrollbar-none">
            {[
              { id: 'all', label: 'الكل', count: metrics.totalOffers },
              { id: 'pending', label: 'بانتظار الاعتماد 🟡', count: metrics.pendingOffers },
              { id: 'approved', label: 'معتمدة ونشطة 🟢', count: metrics.approvedOffers },
              { id: 'rejected', label: 'مرفوضة 🔴', count: metrics.rejectedOffers },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setApprovalFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                  approvalFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                    approvalFilter === tab.id ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Quick Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 text-xs font-bold scrollbar-none border-t border-slate-100 pt-2.5">
          <span className="text-[10px] text-slate-400 font-bold ml-1 shrink-0">حالة التوفر:</span>
          {[
            { id: 'all', label: 'كل الحالات' },
            { id: 'in_stock', label: '🟢 متاح للطلب الفوري' },
            { id: 'occasion', label: '🌙 مناسبات ومواسم' },
            { id: 'hot', label: '🔥 خصم 30%+ وفر' },
            { id: 'out_of_stock', label: '⏸️ موقوف مؤقتاً' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-lg shrink-0 text-[11px] font-bold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-orange-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
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

          {/* Store Status Toggle Filter (Only in Admin view) */}
          {!fixedStoreId && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500">حالة المتاجر:</span>
              <select
                value={storeStatusFilter}
                onChange={(e) => setStoreStatusFilter(e.target.value as any)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="open_only">🟢 المتاجر المفتوحة فقط</option>
                <option value="all">🏪 كل المتاجر (بما فيها المغلقة)</option>
              </select>
            </div>
          )}

          {/* Store Filter (Only in Admin view) */}
          {!fixedStoreId && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500">المتجر:</span>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="">
                  {storeStatusFilter === 'open_only'
                    ? `المتاجر المفتوحة (${filteredStoresList.length})`
                    : `جميع المتاجر (${filteredStoresList.length})`}
                </option>
                {filteredStoresList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.status === 'open' ? '🟢 ' : '🔴 '} {s.name}
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
              <option value="discount_desc">الأعلى نسبة خصم % (مع أولوية التوفر)</option>
              <option value="savings_desc">الأكبر توفيراً (ج.م)</option>
              <option value="price_asc">الأقل سعراً بعد الخصم</option>
              <option value="price_desc">الأعلى سعراً بعد الخصم</option>
              <option value="store">حسب المتجر</option>
              <option value="name">الاسم أبجدياً</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(searchQuery || statusFilter !== 'all' || discountTier !== 'all' || categoryFilter !== 'all' || storeFilter || storeStatusFilter !== 'open_only') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setDiscountTier('all');
                setCategoryFilter('all');
                setStoreFilter('');
                setStoreStatusFilter('open_only');
              }}
              className="text-[11px] text-orange-600 hover:text-orange-700 font-bold px-2 py-1 cursor-pointer"
            >
              مسح التصفية
            </button>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          3.5 VIEW MODE & SCOPE TOGGLE BAR (CARDS VS TABLE)
          ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope Toggle: All Discounted Catalog vs Featured Promotional Deals */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shadow-2xs text-xs font-bold">
            <button
              type="button"
              onClick={() => setOfferScope('all')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                offerScope === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag size={13} className={offerScope === 'all' ? 'text-orange-500' : ''} />
              <span>جميع العروض والخصومات ({scopedProducts.filter(p => typeof p.originalPrice === 'number' && p.originalPrice > p.price).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setOfferScope('promotional')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                offerScope === 'promotional'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles size={13} className={offerScope === 'promotional' ? 'text-amber-500' : ''} />
              <span>الصفقات الترويجية الكبرى ⭐</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-bold hidden md:inline">
            معروض {filteredOffers.length} من أصل {allOffers.length}
          </span>
        </div>

        {/* View Toggle: Cards vs Table */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shadow-2xs text-xs font-bold self-end sm:self-auto">
          <button
            type="button"
            onClick={() => handleSetViewMode('cards')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="عرض الكروت"
          >
            <LayoutGrid size={14} className={viewMode === 'cards' ? 'text-orange-500' : ''} />
            <span>عرض كروت 🎴</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetViewMode('table')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="عرض الجدول"
          >
            <Table2 size={14} className={viewMode === 'table' ? 'text-orange-500' : ''} />
            <span>عرض جدول 📊</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          4. OFFERS VIEW (CARDS OR INTERACTIVE TABLE)
          ════════════════════════════════════════════════════════════ */}
      {filteredOffers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-2xs space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
            <Tag size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900">
              {allOffers.length === 0 ? 'لا توجد عروض ترويجية نشطة حالياً' : 'لا توجد عروض تطابق نتائج البحث والتصفية'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {allOffers.length === 0
                ? 'ابدأ بتنشيط المبيعات الآن عبر إضافة خصم على أصنافك المميزة وتحديد نسبة التوفير ليراها عملاء الحي فوراً.'
                : 'جرب تغيير خيارات التصفية أو البحث لإظهار بقية العروض المسجلة.'}
            </p>
          </div>
          {allOffers.length === 0 ? (
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
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden animate-in fade-in duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold select-none">
                <tr>
                  <th
                    onClick={() => setSortBy('name')}
                    className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    title="ترتيب أبجدي حسب اسم الصنف"
                  >
                    <span className="flex items-center gap-1">
                      <span>الصنف</span>
                      {sortBy === 'name' && <span className="text-orange-600 text-[10px]">▼</span>}
                    </span>
                  </th>
                  {!fixedStoreId && (
                    <th
                      onClick={() => setSortBy('store')}
                      className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors"
                      title="ترتيب وتجميع حسب المتجر"
                    >
                      <span className="flex items-center gap-1">
                        <span>المتجر</span>
                        {sortBy === 'store' && <span className="text-orange-600 text-[10px]">▼</span>}
                      </span>
                    </th>
                  )}
                  <th className="p-3.5">القسم</th>
                  <th
                    onClick={() => setSortBy(sortBy === 'price_asc' ? 'price_desc' : 'price_asc')}
                    className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    title="ترتيب حسب السعر المخفض"
                  >
                    <span className="flex items-center gap-1">
                      <span>السعر المخفض</span>
                      {sortBy === 'price_asc' ? (
                        <span className="text-orange-600 text-[10px]">▲</span>
                      ) : sortBy === 'price_desc' ? (
                        <span className="text-orange-600 text-[10px]">▼</span>
                      ) : null}
                    </span>
                  </th>
                  <th
                    onClick={() => setSortBy(sortBy === 'price_desc' ? 'price_asc' : 'price_desc')}
                    className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    title="ترتيب حسب السعر الأصلي"
                  >
                    <span>السعر الأصلي</span>
                  </th>
                  <th
                    onClick={() => setSortBy(sortBy === 'discount_desc' ? 'savings_desc' : 'discount_desc')}
                    className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    title="ترتيب حسب أعلى نسبة خصم أو أكبر توفير"
                  >
                    <span className="flex items-center gap-1">
                      <span>نسبة الخصم والتوفير</span>
                      {sortBy === 'discount_desc' ? (
                        <span className="text-rose-600 text-[10px]">▼ %</span>
                      ) : sortBy === 'savings_desc' ? (
                        <span className="text-emerald-600 text-[10px]">▼ ج.م</span>
                      ) : null}
                    </span>
                  </th>
                  <th className="p-3.5">الشارة / المناسبة</th>
                  <th
                    onClick={() => setStatusFilter(statusFilter === 'in_stock' ? 'all' : 'in_stock')}
                    className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    title="تصفية الأصناف المتاحة للطلب فقط"
                  >
                    <span className="flex items-center gap-1">
                      <span>التوفر</span>
                      {statusFilter === 'in_stock' && <span className="text-emerald-600 text-[10px]">🟢</span>}
                    </span>
                  </th>
                  <th className="p-3.5">الاعتماد</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOffers.map((product) => {
                  const orig = product.originalPrice || product.price;
                  const sale = product.offerProposedPrice && product.offerProposedPrice > 0 ? product.offerProposedPrice : product.price;
                  const discountPercent = orig > 0 ? Math.round((1 - sale / orig) * 100) : 0;
                  const savingsAmount = Math.max(0, orig - sale);
                  const store = stores.find((s) => s.id === product.storeId || matchStoreId(s.id, product.storeId));
                  const isPending = product.offerStatus === 'pending_approval';
                  const isRejected = product.offerStatus === 'rejected';
                  const isApproved = product.offerStatus === 'approved' || (!product.offerStatus && typeof product.originalPrice === 'number' && product.originalPrice > product.price);

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Product Name & Image */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-2xs">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-sm">🛍️</div>
                            )}
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <strong className="block font-black text-slate-900 truncate" title={product.name}>
                              {product.name}
                            </strong>
                            {product.offerTitle && (
                              <span className="text-[10px] text-orange-600 font-bold block truncate">
                                {product.offerTitle}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Store Name (Admin only) */}
                      {!fixedStoreId && (
                        <td className="p-3.5 font-bold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                store?.status === 'open' ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                              title={store?.status === 'open' ? 'متجر مفتوح ونشط' : 'متجر مغلق'}
                            />
                            <span className="truncate max-w-[150px]">{store?.name || product.storeName || 'متجر سنجوب إكسبريس'}</span>
                          </div>
                        </td>
                      )}

                      {/* Category */}
                      <td className="p-3.5 text-slate-600 font-medium">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          {product.category || 'عام'}
                        </span>
                      </td>

                      {/* Sale Price */}
                      <td className="p-3.5">
                        <span className="font-mono font-black text-orange-600 text-sm">
                          {formatEGP(sale)}
                        </span>
                      </td>

                      {/* Original Price */}
                      <td className="p-3.5">
                        <del className="font-mono font-bold text-slate-400 text-xs">
                          {formatEGP(orig)}
                        </del>
                      </td>

                      {/* Discount % & Savings */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 font-mono font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md text-[11px] w-fit">
                            <span>خصم {discountPercent}%</span>
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold">
                            وفر {formatEGP(savingsAmount)}
                          </span>
                        </div>
                      </td>

                      {/* Badge or Occasion */}
                      <td className="p-3.5">
                        {product.isOccasion ? (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10.5px] font-bold inline-flex items-center gap-1">
                            <span>🌙</span>
                            <span>{product.occasionName || 'مناسبة'}</span>
                          </span>
                        ) : product.badge ? (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md text-[10.5px] font-bold">
                            {product.badge}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* In-Stock Status Toggle */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(product)}
                          className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                            product.inStock !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {product.inStock !== false ? '🟢 متاح' : '⏸️ موقوف'}
                        </button>
                      </td>

                      {/* Approval Status */}
                      <td className="p-3.5">
                        {isPending ? (
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-[10px] font-black border border-amber-300 inline-flex items-center gap-1">
                            <Clock3 size={11} />
                            <span>قيد الاعتماد</span>
                          </span>
                        ) : isRejected ? (
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md text-[10px] font-black border border-rose-300 inline-flex items-center gap-1">
                            <XCircle size={11} />
                            <span>مرفوض</span>
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md text-[10px] font-black border border-emerald-300 inline-flex items-center gap-1">
                            <CheckCircle size={11} />
                            <span>معتمد ونشط</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {!fixedStoreId && isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveOffer(product)}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                                title="اعتماد وتفعيل العرض"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectOffer(product)}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                                title="رفض العرض"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => handleEditOffer(product)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title="تعديل بيانات العرض"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleCancelOffer(product)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                            title="إلغاء الخصم واستعادة السعر الأصلي"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200">
          {filteredOffers.map((product) => {
            const orig = product.originalPrice || product.price;
            const sale = product.offerProposedPrice && product.offerProposedPrice > 0 ? product.offerProposedPrice : product.price;
            const discountPercent = orig > 0 ? Math.round((1 - sale / orig) * 100) : 0;
            const savingsAmount = Math.max(0, orig - sale);
            const store = stores.find((s) => s.id === product.storeId);
            const isPending = product.offerStatus === 'pending_approval';
            const isRejected = product.offerStatus === 'rejected';
            const isApproved = product.offerStatus === 'approved' || (!product.offerStatus && typeof product.originalPrice === 'number' && product.originalPrice > product.price);

            return (
              <div
                key={product.id}
                className={`bg-white rounded-3xl border overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group ${
                  isPending
                    ? 'border-amber-300 ring-2 ring-amber-400/20'
                    : isRejected
                    ? 'border-rose-300 ring-2 ring-rose-400/20'
                    : 'border-slate-200/90'
                }`}
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

                    {/* Top Left: Occasion, Approval Status, or Custom Badge */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                      {isPending && (
                        <span className="bg-amber-500/95 backdrop-blur-xs text-white px-2.5 py-0.5 rounded-lg text-[10px] font-black shadow-xs flex items-center gap-1">
                          <Clock3 size={11} />
                          <span>بانتظار اعتماد الإدارة</span>
                        </span>
                      )}

                      {isRejected && (
                        <span className="bg-rose-600/95 backdrop-blur-xs text-white px-2.5 py-0.5 rounded-lg text-[10px] font-black shadow-xs flex items-center gap-1">
                          <XCircle size={11} />
                          <span>مرفوض من الإدارة</span>
                        </span>
                      )}

                      {isApproved && (
                        <span className="bg-emerald-600/95 backdrop-blur-xs text-white px-2.5 py-0.5 rounded-lg text-[10px] font-black shadow-xs flex items-center gap-1">
                          <CheckCircle size={11} />
                          <span>معتمد ونشط بالمتجر</span>
                        </span>
                      )}

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
                          product.inStock !== false
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {product.inStock !== false ? '🟢 متاح للطلب' : '⏸️ موقوف مؤقتاً'}
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

                    {/* Approval Notice Box */}
                    {isPending && (
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                        <div className="flex items-center gap-1 font-bold">
                          <Clock3 size={13} className="text-amber-700 shrink-0" />
                          <span>طلب عرض ترويجي قيد المراجعة المركزية:</span>
                        </div>
                        <p className="text-[10px] text-amber-800 leading-relaxed">
                          السعر الأساسي الحالي: <strong>{formatEGP(orig)}</strong> · السعر المخفض المطلوب اعتماده: <strong>{formatEGP(sale)}</strong>
                        </p>
                      </div>
                    )}

                    {isRejected && (
                      <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-900 space-y-1">
                        <div className="flex items-center gap-1 font-bold">
                          <XCircle size={13} className="text-rose-700 shrink-0" />
                          <span>سبب رفض العرض من الإدارة:</span>
                        </div>
                        <p className="text-[10px] text-rose-800 leading-relaxed">
                          {product.offerRejectionReason || 'لم يستوفِ الشروط والضوابط التسعيرية المعتمدة.'}
                        </p>
                      </div>
                    )}

                    {/* Pricing & Real Savings Box */}
                    <div className="p-3 bg-gradient-to-r from-orange-50/70 to-amber-50/60 rounded-2xl border border-orange-200/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">
                          {isPending ? 'السعر المقترح للتخفيض:' : 'السعر بعد الخصم:'}
                        </span>
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
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  {/* Admin Direct Approval / Rejection Controls for Pending Offers */}
                  {!fixedStoreId && isPending ? (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleApproveOffer(product)}
                        className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        <Check size={14} />
                        <span>اعتماد وتفعيل</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleRejectOffer(product)}
                        className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <X size={14} />
                        <span>رفض مع سبب</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(product)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                          product.inStock !== false
                            ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                        title="تغيير حالة التوافر الفوري للطلب"
                      >
                        {product.inStock !== false ? 'إيقاف مؤقت' : 'تفعيل للطلب'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditOffer(product)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-orange-50 text-orange-700 border border-slate-200 hover:border-orange-200 text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                        >
                          <Edit2 size={12} />
                          <span>{isRejected ? 'إعادة تقديم' : 'تعديل'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleCancelOffer(product)}
                          className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                          title={isPending ? 'سحب طلب العرض' : 'إلغاء الخصم واستعادة السعر الأصلي'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          5. MODAL: STEP 1 - PRODUCT PICKER (STRICT STORE ISOLATION)
          ════════════════════════════════════════════════════════════ */}
      {isPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[82vh]">
            <header className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center shadow-2xs">
                  <Tag size={14} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">اختر الصنف المراد تطبيق العرض عليه</h3>
                  <p className="text-[10px] text-slate-500">
                    {currentStore ? `أصناف منيو متجر ${currentStore.name}` : 'جميع أصناف الكتالوج'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer transition"
              >
                <X size={14} />
              </button>
            </header>

            {/* Picker Search */}
            <div className="p-2.5 sm:p-3 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو التصنيف أو السعر…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full pr-8 pl-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Products List (Scoped strictly to store) */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100">
              {scopedProducts.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <Package size={24} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">
                    لم يتم العثور على أي أصناف مسجلة لهذا المتجر
                  </h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                    {currentStore ? `أصناف منيو متجر "${currentStore.name}" لم تُضف بعد.` : 'لا توجد منتجات مسجلة.'}
                    <br />
                    يرجى أولاً إدراج منتجات المنيو من تبويب "المنيو والأصناف" ثم العودة لتفعيل العروض والتخفيضات عليها.
                  </p>
                </div>
              ) : (
                scopedProducts
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
                        className={`w-full py-2 px-2.5 rounded-xl flex items-center justify-between gap-2.5 text-right transition ${
                          isStoreClosed ? 'opacity-60 bg-slate-50 cursor-not-allowed' : 'hover:bg-orange-50/70 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200/80">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm">
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
                            <span className="text-[8px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded inline-block mt-0.5">
                              متجر مغلق 🚫
                            </span>
                          ) : hasOffer ? (
                            <span className="text-[8px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded inline-block mt-0.5">
                              عرض نشط حالياً 🔥
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
              )}
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
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <header className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center shadow-2xs">
                  <Tag size={14} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">إدارة وتفعيل العرض</h3>
                  <p className="text-[10px] text-slate-500">تحديد نسبة الخصم وسعر البيع وشروط ظهور العرض</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer transition"
              >
                <X size={14} />
              </button>
            </header>

            <form onSubmit={handleSaveOffer} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-3.5 sm:p-4 overflow-y-auto max-h-[68vh] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* ── العمود الأيمن: بيانات التسعير والخصم والشروط ── */}
                <div className="space-y-2.5">
                  {/* ملخص الصنف مع إمكانية التغيير */}
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0">
                        {selectedProduct.imageUrl ? (
                          <img src={selectedProduct.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">🍽️</div>
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
                      className="px-2 py-0.5 text-[10px] font-bold text-orange-600 hover:bg-orange-50 rounded-md cursor-pointer shrink-0 transition"
                    >
                      تغيير
                    </button>
                  </div>

                  {/* صندوق الأسعار والخصومات */}
                  <div className="p-2.5 bg-orange-50/50 rounded-xl border border-orange-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-black text-orange-950">
                      <span className="flex items-center gap-1">
                        <Percent size={13} className="text-orange-600" />
                        <span className="text-[11px]">التسعير والخصم</span>
                      </span>
                      <span className="text-[10px] text-emerald-800 font-bold bg-white px-1.5 py-0.5 rounded border border-orange-200">
                        توفير {formatEGP(Math.max(0, formOriginalPrice - formSalePrice))} ({formDiscountPercent}%)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 mb-0.5">
                          السعر الأصلي *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          step="1"
                          value={formOriginalPrice || ''}
                          onChange={(e) => handleOriginalPriceChange(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 mb-0.5">
                          نسبة الخصم *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="1"
                            max="90"
                            step="1"
                            value={formDiscountPercent || ''}
                            onChange={(e) => handleDiscountPercentChange(Number(e.target.value))}
                            className="w-full pl-5 pr-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs text-orange-700 focus:outline-none focus:border-orange-500"
                          />
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[9px] font-bold">%</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 mb-0.5">
                          سعر العرض *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          step="1"
                          value={formSalePrice || ''}
                          onChange={(e) => handleSalePriceChange(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-black text-xs text-emerald-700 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    {/* خيارات سريعة للخصم */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      <span className="text-[9px] text-slate-500 font-bold ml-1">نسب سريعة:</span>
                      {[15, 20, 25, 30, 40, 50].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => handleDiscountPercentChange(pct)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition ${
                            formDiscountPercent === pct
                              ? 'bg-orange-600 text-white shadow-2xs'
                              : 'bg-white hover:bg-orange-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* الشروط والتواريخ في صف متناسق */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">
                        أقصى حد/عميل
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={formMaxPerOrder}
                        onChange={(e) => setFormMaxPerOrder(Number(e.target.value))}
                        className="w-full px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">
                        تاريخ البدء
                      </label>
                      <input
                        type="date"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">
                        تاريخ الانتهاء
                      </label>
                      <input
                        type="date"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>

                {/* ── العمود الأيسر: هوية العرض والشارة والمعاينة ── */}
                <div className="space-y-2.5">
                  {/* عنوان العرض الترويجي */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-0.5">
                      عنوان العرض الترويجي *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: وجبة التوفير العائلية"
                      value={formOfferTitle}
                      onChange={(e) => setFormOfferTitle(e.target.value)}
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* شارة العرض */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-0.5">شارة العرض (Badge)</label>
                    <input
                      type="text"
                      value={formBadge}
                      onChange={(e) => setFormBadge(e.target.value)}
                      placeholder="مثال: 🔥 عرض خاص"
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-900 focus:outline-none focus:border-orange-500 mb-1"
                    />

                    {/* خيارات الشارات السريعة المباشرة */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {['🔥 عرض خاص', '⚡ صفقة سريعة', '🌟 الأكثر طلباً', '💥 خصم خاص'].map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setFormBadge(b)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition ${
                            formBadge === b
                              ? 'bg-orange-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* معاينة مباشرة ومضغوطة لشكل العرض */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <span className="text-[9px] font-bold text-slate-400 block">
                      معاينة شكل العرض بالمتجر:
                    </span>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0 relative border border-slate-200">
                          {selectedProduct.imageUrl ? (
                            <img src={selectedProduct.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">🍽️</div>
                          )}
                          <span className="absolute top-0 right-0 bg-rose-600 text-white text-[7px] font-black px-1 rounded-bl">
                            -{formDiscountPercent}%
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-[11px] font-bold text-slate-900 truncate">{selectedProduct.name}</h5>
                          <span className="text-[9px] text-orange-600 font-bold block truncate">
                            {formBadge || formOfferTitle || '🔥 عرض خاص'}
                          </span>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <strong className="text-xs font-black text-emerald-700 font-mono block">
                          {formatEGP(formSalePrice)}
                        </strong>
                        <del className="text-[9px] text-slate-400 font-mono block">
                          {formatEGP(formOriginalPrice)}
                        </del>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── شريط الإجراءات السفلي (سطر واحد متناسق بدون كسر إطلاقاً) ── */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                <span className="text-[10px] font-bold text-slate-500 truncate">
                  {fixedStoreId ? '💡 يخضع العرض لمراجعة الإدارة قبل ظهوره' : '✓ تفعيل فوري ومباشر على المتجر'}
                </span>

                <div className="flex items-center gap-2 mr-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-8 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-8 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                  >
                    <Check size={13} />
                    <span>
                      {isSubmitting
                        ? 'جارٍ الحفظ…'
                        : (fixedStoreId ? 'إرسال للاعتماد' : 'تفعيل العرض')}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default OffersManager;
