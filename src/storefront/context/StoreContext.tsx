import { authenticatedApi } from '../../lib/authenticatedApi';
import { usableDeliveryAddress, pendingDeliveryAddressKey } from '../../services/deliveryAddress';
import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import type { Product, Store, CartItem, Coupon, Profile } from '../../types';
import { BRAND } from '../../brand';
import { calculateCartSubtotal, calculateOrderTotal, applyCouponDiscount, cleanDisplayAddress } from '../../utils/orderCalculations';
import { LAUNCH_CONFIG } from '../../config/launchConfig';
import { getSupabaseStores, getSupabaseProducts, KNOWN_STORE_ASSETS, subscribeToCatalog, supabase } from '../../lib/supabase';
import { getStoreSlug, matchStoreId } from '../../utils/storeAssets';

import { StoreBanner, DEFAULT_SANGOUB_BANNERS } from '../types/banner';
import { 
  SUPERMARKET_CATEGORY_TEMPLATES, 
  STORE_TYPES, 
  type StoreTypeDefinition 
} from '../../constants/taxonomy';

export interface ServiceArea {
  id: string;
  name: string;
  deliveryTime: string;
  active: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  street?: string;
  details?: string;
}

export interface MartBannerConfig {
  enabled: boolean;
  title: string;
  badge: string;
  areaText: string;
  btnText: string;
  targetCategory: string;
  bgGradient?: string;
}

export const DEFAULT_MART_BANNER: MartBannerConfig = {
  enabled: true,
  title: 'سنجوب ماركت وكل طلبات البيت لحد بابك',
  badge: 'سنجوب بقالة ⚡',
  areaText: 'العاصمة وكافة المناطق',
  btnText: 'تسوق الآن',
  targetCategory: 'سوبرماركت',
  bgGradient: 'from-[#FF5900] via-[#FF6A1A] to-[#FF4500]'
};

export interface PendingStoreSwitch {
  currentStoreName: string;
  newStoreName: string;
  product: Product;
  quantity?: number;
  selectedOptions?: Record<string, string>;
  extraPrice?: number;
}

export interface StoreContextType {
  // Navigation
  currentPath: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;

  // Catalog
  products: Product[];
  stores: Store[];
  categories: string[];
  isLoadingCatalog: boolean;
  catalogError: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Dynamic Banners (App Content / Campaigns from Admin)
  banners: StoreBanner[];
  martBanner: MartBannerConfig;
  disabledStoreTypes: string[];
  disabledCategories: string[];
  categoryOverrides: Record<string, { name_ar?: string; name_en?: string; image?: string; sort_order?: number }>;
  supermarketCategories: Array<{
    code: string;
    name_ar: string;
    name_en?: string;
    image: string;
    sort_order: number;
    type_code?: string;
  }>;
  activeStoreTypes: StoreTypeDefinition[];
  sliderShowArrows: boolean;
  isLoadingBanners: boolean;
  refreshBanners: () => Promise<void>;
  handleBannerClick: (
    banner: StoreBanner,
    callbacks?: {
      onSelectProduct?: (product: Product) => void;
      onSelectCategory?: (category: string) => void;
      onSelectOffers?: () => void;
    }
  ) => void;

  // Service Area
  serviceArea: ServiceArea;
  setServiceArea: (area: ServiceArea) => void;
  saveDeliveryLocation: (area: ServiceArea) => Promise<void>;
  availableAreas: readonly ServiceArea[];

  // Cart
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedOptions?: Record<string, string>, extraPrice?: number) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  appliedCoupon: Coupon | null;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;

  // Multi-Store Switch Confirmation
  pendingStoreSwitch: PendingStoreSwitch | null;
  confirmStoreSwitch: () => void;
  cancelStoreSwitch: () => void;

  // Wishlist
  wishlistIds: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;

  // Previously Ordered Products Tracking
  orderedProductIds: string[];
  isProductOrderedBefore: (productId: string, productName?: string) => boolean;
  markProductAsOrdered: (productId: string, productName?: string) => void;

  // User & Profile
  user: Profile | null;
  setUser: (user: Profile | null) => void;
  loginAsGuest: (name: string, phone: string) => void;
  registerSangoubAccount: (name: string, phone: string, address?: string) => void;
  logout: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

const STORAGE_KEYS = {
  CART: 'sangoub_cart_items_v2',
  WISHLIST: 'sangoub_wishlist_ids',
  ORDERED_PRODUCTS: 'sangoub_ordered_products',
  AREA: 'sangoub_selected_area',
  USER: 'sangoub_user_profile',
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Navigation SPA State
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string, options?: { replace?: boolean }) => {
    if (
      path.startsWith('/my-orders') ||
      path.startsWith('/track') ||
      path.startsWith('/checkout') ||
      path.startsWith('/admin') ||
      path.startsWith('/merchant') ||
      path.startsWith('/courier') ||
      path.startsWith('/kitchen')
    ) {
      window.location.assign(path);
      return;
    }
    if (options?.replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 2. Dynamic Service Area (Selected via Map or User Input)
  const [serviceArea, setServiceAreaState] = useState<ServiceArea>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AREA);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) {
          return {
            ...parsed,
            name: cleanDisplayAddress(parsed.name),
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      id: 'default_map',
      name: LAUNCH_CONFIG.serviceAreaLabel,
      deliveryTime: LAUNCH_CONFIG.showEta ? '20-30 دقيقة' : '',
      active: true,
    };
  });

  const availableAreas: readonly ServiceArea[] = [];

  const setServiceArea = (area: ServiceArea) => {
    setServiceAreaState(area);
    if (user?.id) { try { sessionStorage.removeItem(pendingDeliveryAddressKey); } catch {} }
    try { localStorage.setItem(user?.id ? `${STORAGE_KEYS.AREA}:${user.id}` : STORAGE_KEYS.AREA, JSON.stringify(area)); } catch {}
  };

  const saveDeliveryLocation = async (area: ServiceArea) => {
    if (!usableDeliveryAddress(area.name)) throw new Error('اكتب اسم الشارع والمنطقة وتفاصيل التوصيل.');
    if (user && !user.isGuest) {
      const address = { fullAddress: area.name, city: area.city || '', details: area.details || '',
        ...(area.latitude !== undefined && area.longitude !== undefined ? { coordinates: { latitude: area.latitude, longitude: area.longitude } } : {}) };
      
      try {
        await supabase.from('profiles').update({
          ministry: area.name.slice(0, 120),
        }).eq('id', user.id);
      } catch (err) {
        console.warn('Supabase address update notice:', err);
      }

      setUser(previous => previous ? { ...previous, ministry: area.name.slice(0,120), defaultAddress: address,
        coordinates: address.coordinates } : previous);
    }
    if (!user) { try { sessionStorage.setItem(pendingDeliveryAddressKey, JSON.stringify(area)); } catch {} }
    setServiceArea(area);
  };

  // 3. Dynamic Admin App Content Controls (Synced with Admin App Content / CategoryManager)
  const [disabledStoreTypes, setDisabledStoreTypes] = useState<string[]>(['REST', 'CAFE', 'PHARM']);
  const [disabledCategories, setDisabledCategories] = useState<string[]>([
    'CAT-PHARMACY',
    'pharmacy',
    'صيدلية',
    'أدوية وصيدلية',
    'أدوية',
    'ادوية',
    'مستلزمات طبية',
    'علاج'
  ]);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, { name_ar?: string; name_en?: string; image?: string; sort_order?: number }>>({});
  const [banners, setBanners] = useState<StoreBanner[]>(DEFAULT_SANGOUB_BANNERS);
  const [martBanner, setMartBanner] = useState<MartBannerConfig>(DEFAULT_MART_BANNER);
  const [sliderShowArrows, setSliderShowArrows] = useState(true);
  const [isLoadingBanners, setIsLoadingBanners] = useState(false);

  // 3.1 Raw Catalog Products & Stores from Database (Supabase)
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [rawStores, setRawStores] = useState<Store[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 3.2 Dynamic Active Stores (Filtered 100% dynamically based on disabledStoreTypes)
  const stores = useMemo(() => {
    return rawStores.filter((store) => {
      if (store.status !== 'open') return false;
      const sType = (store.type || '').toLowerCase();
      const sCat = (store.category || '').toLowerCase();
      const sName = (store.name || '').toLowerCase();

      // Check if store matches any disabled store type
      const isStoreTypeDisabled = disabledStoreTypes.some((code) => {
        const c = code.toUpperCase();
        if (c === 'PHARM') {
          return sType.includes('صيدل') || sCat.includes('pharm') || sName.includes('صيدل');
        }
        if (c === 'REST') {
          return sType.includes('مطعم') || sCat.includes('restaurant') || sType.includes('وجبات');
        }
        if (c === 'CAFE') {
          return sType.includes('كافيه') || sCat.includes('cafe');
        }
        return sType.includes(c.toLowerCase()) || sCat.includes(c.toLowerCase());
      });

      return !isStoreTypeDisabled;
    });
  }, [rawStores, disabledStoreTypes]);

  // 3.3 Dynamic Active Products (Filtered 100% dynamically based on disabledCategories & disabledStoreTypes & active stores)
  const products = useMemo(() => {
    const activeStoreIds = new Set(stores.map((s) => s.id));
    const activeStoreNames = new Set(stores.map((s) => s.name));

    return rawProducts.filter((p) => {
      if (p.archived || !p.inStock) return false;

      // 1. Must belong to an active, enabled store (or Sangoub)
      const isSangoub = p.storeId === 'a0000000-0000-0000-0000-000000000001' || !p.storeId || p.storeName?.includes('سنجوب');
      if (!isSangoub) {
        const storeMatch = (p.storeId && activeStoreIds.has(p.storeId)) || (p.storeName && activeStoreNames.has(p.storeName));
        if (!storeMatch) return false;
      }

      const pCat = (p.category || '').toLowerCase();
      const pCatId = (p.categoryId || '').toLowerCase();
      const pStoreName = (p.storeName || '').toLowerCase();

      // 2. Filter out products from disabled categories (with full Arabic hamza normalization)
      const isCategoryDisabled = disabledCategories.some((term) => {
        const t = term.toLowerCase().replace(/[أإآ]/g, 'ا');
        const pCatNorm = pCat.replace(/[أإآ]/g, 'ا');
        const pCatIdNorm = pCatId.replace(/[أإآ]/g, 'ا');

        return (
          pCatNorm === t ||
          pCatNorm.includes(t) ||
          t.includes(pCatNorm) ||
          pCatIdNorm.includes(t)
        );
      });
      if (isCategoryDisabled) return false;

      // 3. Fallback: If PHARM is in disabledStoreTypes or pharmacy is in disabledCategories, block all pharmacy products
      if (
        disabledStoreTypes.includes('PHARM') ||
        disabledCategories.some((c) => {
          const norm = c.toLowerCase().replace(/[أإآ]/g, 'ا');
          return norm.includes('صيدل') || norm.includes('pharm') || norm.includes('ادوي');
        })
      ) {
        const pharmTerms = ['صيدل', 'دواء', 'ادوي', 'أدوي', 'علاج', 'طبي', 'pharm'];
        const isPharm = pharmTerms.some((term) => {
          const termNorm = term.replace(/[أإآ]/g, 'ا');
          const catNorm = pCat.replace(/[أإآ]/g, 'ا');
          const storeNorm = pStoreName.replace(/[أإآ]/g, 'ا');
          return catNorm.includes(termNorm) || storeNorm.includes(termNorm);
        });
        if (isPharm) return false;
      }

      return true;
    });
  }, [rawProducts, stores, disabledCategories, disabledStoreTypes]);

  useEffect(() => {
    setIsLoadingCatalog(true);
    setCatalogError('');

    // Load from Supabase (Sole Database Source of Truth)
    const loadRealCatalog = async () => {
      try {
        const [sbStores, sbProducts] = await Promise.all([
          getSupabaseStores().catch(() => [] as Store[]),
          getSupabaseProducts().catch(() => [] as Product[]),
        ]);

        if (sbProducts && sbProducts.length > 0) {
          setRawProducts(sbProducts);
        }

        if (sbStores && sbStores.length > 0) {
          // Ensure "سنجوب ماركت" is always present with official logo & banner
          const sangoubStore: Store = {
            id: 'a0000000-0000-0000-0000-000000000001',
            name: 'سنجوب ماركت',
            nameEn: 'Sangoub Market',
            type: 'سوبرماركت ومستلزمات البيت اليومية',
            category: 'supermarket',
            logo: '/brand/sangoub-market-logo.jpg',
            logoUrl: '/brand/sangoub-market-logo.jpg',
            banner: '/brand/sangoub-market-logo.jpg',
            bannerUrl: '/brand/sangoub-market-logo.jpg',
            status: 'open',
            rating: 5,
            ratingCount: 1250,
            deliveryTime: '15-25 دقيقة',
            minOrder: 20,
            deliveryFee: 10,
            locationInDistrict: 'المركز الرئيسي - سنجوب',
          };

          const enrichedStores: Store[] = sbStores.map((store) => {
            if (store.id === sangoubStore.id || store.name?.includes('سنجوب')) {
              return {
                ...sangoubStore,
                ...store,
                logo: store.logo || sangoubStore.logo,
                logoUrl: store.logoUrl || store.logo || sangoubStore.logoUrl,
                banner: store.banner || sangoubStore.banner,
                bannerUrl: store.bannerUrl || store.banner || sangoubStore.bannerUrl,
              } as Store;
            }
            const known =
              KNOWN_STORE_ASSETS[store.id] ||
              Object.values(KNOWN_STORE_ASSETS).find(
                (k) =>
                  k.name &&
                  (store.name.includes(k.name) || k.name.includes(store.name))
              );
            const logoUrl =
              store.logoUrl ||
              (store.logo && store.logo.startsWith('http') ? store.logo : undefined) ||
              known?.logoUrl;
            const bannerUrl =
              store.bannerUrl ||
              (store.banner && store.banner.startsWith('http') ? store.banner : undefined) ||
              known?.bannerUrl;

            return {
              ...store,
              logoUrl,
              bannerUrl,
            } as Store;
          });

          if (!enrichedStores.some((s) => s.id === sangoubStore.id)) {
            enrichedStores.unshift(sangoubStore);
          }

          const otherStores = enrichedStores.filter((s) => s.id !== sangoubStore.id);
          setRawStores([sangoubStore, ...otherStores]);
        }
      } catch (err) {
        console.warn('[Supabase Catalog] Fetch error:', err);
      } finally {
        setIsLoadingCatalog(false);
      }
    };

    loadRealCatalog();

    // Supabase Realtime Subscription (PostgreSQL live updates, zero Firebase)
    const unsubscribe = subscribeToCatalog(
      () => { void loadRealCatalog(); },
      () => { void loadRealCatalog(); }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Dynamic Supermarket Categories (Driven 100% by Admin Dashboard / CategoryManager)
  const supermarketCategories = useMemo(() => {
    return SUPERMARKET_CATEGORY_TEMPLATES
      .filter((cat) => !disabledCategories.includes(cat.code) && !disabledCategories.includes(cat.name_ar))
      .map((cat) => {
        const override = categoryOverrides[cat.code];
        return {
          code: cat.code,
          name_ar: override?.name_ar || cat.name_ar,
          name_en: override?.name_en || cat.name_en,
          image: override?.image || cat.image,
          sort_order: override?.sort_order ?? cat.sort_order ?? 99,
          type_code: cat.type_code
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [categoryOverrides, disabledCategories]);

  // Dynamic Active Store Types (Driven by Admin toggles)
  const activeStoreTypes = useMemo(() => {
    return STORE_TYPES.filter((st) => !disabledStoreTypes.includes(st.code));
  }, [disabledStoreTypes]);

  const refreshBanners = async () => {
    setIsLoadingBanners(true);
    try {
      // 1. Try public server endpoint /api/app-content (official app content & campaign manager)
      const res = await fetch('/api/app-content', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.martBanner) {
          setMartBanner(data.martBanner);
        }
        if (data && Array.isArray(data.disabledStoreTypes)) {
          setDisabledStoreTypes(data.disabledStoreTypes);
        }
        if (data && Array.isArray(data.disabledCategories)) {
          setDisabledCategories(data.disabledCategories);
        }
        if (data && data.categoryOverrides && typeof data.categoryOverrides === 'object') {
          setCategoryOverrides(data.categoryOverrides);
        }
        if (data && data.config && typeof data.config.showArrows === 'boolean') { setSliderShowArrows(data.config.showArrows); }
        if (data && Array.isArray(data.slides) && data.slides.length > 0) {
          const mapped: StoreBanner[] = data.slides.map((s: any, idx: number) => ({
            id: s.id || `campaign-${idx}`,
            title: s.title || '',
            subtitle: s.subtitle || '',
            desc: s.subtitle || '',
            imageUrl: s.imageUrl || '',
            image: s.imageUrl || '',
            hideOverlay: Boolean(s.hideOverlay || (!s.title && !s.subtitle)),
            tag: (s.hideOverlay || (!s.title && !s.subtitle)) ? '' : (s.targetType === 'offers' ? 'أقوى العروض 🎁' : s.targetType === 'product' ? 'خصم وتوفير 🏷️' : s.targetType === 'store' ? 'متجر مميز 🏪' : 'عرض خاص'),
            btnText: (s.hideOverlay || (!s.title && !s.subtitle)) ? '' : (s.btnText !== undefined ? s.btnText : (s.targetType === 'offers' ? 'تصفح العروض' : s.targetType === 'product' ? 'اطلب الآن' : 'عرض المزيد')),
            targetType: s.targetType || 'offers',
            targetId: s.targetId || '',
            targetPath: s.targetType === 'offers' ? '/offers' : s.targetType === 'product' ? `/product/${s.targetId}` : s.targetType === 'store' ? `/stores/${getStoreSlug(s.targetId)}` : '',
            badgeColor: idx % 3 === 0 ? '#FF5900' : idx % 3 === 1 ? '#059669' : '#2563EB',
            bgGradient: idx % 3 === 0 
              ? 'linear-gradient(135deg, #131921 0%, #1F2937 100%)' 
              : idx % 3 === 1 
              ? 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)' 
              : 'linear-gradient(135deg, #1E1B4B 0%, #2E1065 100%)',
            mascotImg: idx % 2 === 0 ? '/assets/sangoub/mascot-cheerful.png' : '/assets/sangoub/mascot-delivery.png'
          }));
          setBanners(mapped);
          setIsLoadingBanners(false);
          return;
        }
      }
      // Fallback to default Sangoub banners if no slides returned
      setBanners(DEFAULT_SANGOUB_BANNERS);
    } catch (err) {
      console.warn('Could not load dynamic banners, using defaults:', err);
      setBanners(DEFAULT_SANGOUB_BANNERS);
    } finally {
      setIsLoadingBanners(false);
    }
  };

  useEffect(() => {
    refreshBanners();
    // Refresh when user returns to tab
    const onFocus = () => {
      refreshBanners();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleBannerClick = (
    banner: StoreBanner,
    callbacks?: {
      onSelectProduct?: (product: Product) => void;
      onSelectCategory?: (category: string) => void;
      onSelectOffers?: () => void;
    }
  ) => {
    if (banner.targetType === 'offers') {
      if (callbacks?.onSelectOffers) {
        callbacks.onSelectOffers();
      } else {
        navigate('/offers');
      }
      const grid = document.getElementById('products-grid') || document.getElementById('mobile-products-grid');
      if (grid) grid.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (banner.targetType === 'product' && banner.targetId) {
      const product = products.find(p => p.id === banner.targetId);
      if (product && callbacks?.onSelectProduct) {
        callbacks.onSelectProduct(product);
        return;
      }
      navigate(`/?product=${encodeURIComponent(banner.targetId)}`);
      return;
    }

    if (banner.targetType === 'store') {
      navigate(banner.targetId ? `/stores/${getStoreSlug(banner.targetId)}` : '/stores');
      return;
    }

    if (banner.targetType === 'category' && banner.targetId && callbacks?.onSelectCategory) {
      callbacks.onSelectCategory(banner.targetId);
      const grid = document.getElementById('products-grid') || document.getElementById('mobile-products-grid');
      if (grid) grid.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (banner.targetPath) {
      navigate(banner.targetPath);
      return;
    }
  };

  // 4. Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CART);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cartItems));
  }, [cartItems]);

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [pendingStoreSwitch, setPendingStoreSwitch] = useState<PendingStoreSwitch | null>(null);

  const subtotal = useMemo(() => calculateCartSubtotal(cartItems), [cartItems]);
  const deliveryFee = cartItems.length > 0 ? LAUNCH_CONFIG.deliveryFee : 0;
  const couponResult = useMemo(() => applyCouponDiscount(subtotal, appliedCoupon), [subtotal, appliedCoupon]);
  const discount = couponResult.discount;
  const total = useMemo(() => calculateOrderTotal(subtotal, deliveryFee, discount, 0), [subtotal, deliveryFee, discount]);

  const addToCart = (
    product: Product,
    quantity = 1,
    selectedOptions: Record<string, string> = {},
    extraPrice = 0
  ) => {
    // Check if cart already has items from another store
    const currentStoreId = cartItems.length > 0 ? cartItems[0]?.product?.storeId : null;
    if (currentStoreId && !matchStoreId(currentStoreId, product.storeId)) {
      const currentStore = stores.find(s => matchStoreId(s.id, currentStoreId) || s.id === currentStoreId);
      const newStore = stores.find(s => matchStoreId(s.id, product.storeId) || s.id === product.storeId);
      const currentStoreName = currentStore?.name || (currentStoreId.includes('pharmacy') ? 'صيدلية العاصمة المركزية' : currentStoreId.includes('falafel') ? 'فول وفلافل العاصمة' : 'سنجوب ماركت');
      const newStoreName = newStore?.name || (product.storeId.includes('pharmacy') ? 'صيدلية العاصمة المركزية' : product.storeId.includes('falafel') ? 'فول وفلافل العاصمة' : 'سنجوب ماركت');

      setPendingStoreSwitch({
        currentStoreName,
        newStoreName,
        product,
        quantity,
        selectedOptions,
        extraPrice,
      });
      return;
    }

    setCartItems(prev => {
      const existingIndex = prev.findIndex(
        item => item.product.id === product.id && JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions)
      );

      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
        };
        return next;
      }

      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product,
        quantity,
        selectedOptions,
        extraPrice,
      };
      return [...prev, newItem];
    });
  };

  const confirmStoreSwitch = () => {
    if (!pendingStoreSwitch) return;
    const { product, quantity = 1, selectedOptions = {}, extraPrice = 0 } = pendingStoreSwitch;
    const newItem: CartItem = {
      id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product,
      quantity,
      selectedOptions,
      extraPrice,
    };
    setCartItems([newItem]);
    setPendingStoreSwitch(null);
  };

  const cancelStoreSwitch = () => {
    setPendingStoreSwitch(null);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCartItems(prev => {
      return prev
        .map(item => {
          if (item.id === itemId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  const removeFromCart = (itemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    setCartItems([]);
    setAppliedCoupon(null);
  };

  const applyCoupon = (_code:string) => ({success:false,message:'راجع كود الخصم في صفحة إتمام الطلب للتحقق منه من الخادم.'});

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  // 5. Wishlist
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WISHLIST);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(wishlistIds));
  }, [wishlistIds]);

  const toggleWishlist = (productId: string) => {
    setWishlistIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      }
      return [...prev, productId];
    });
  };

  const isWishlisted = (productId: string) => wishlistIds.includes(productId);

  // 5.5 Previously Ordered Products
  const [orderedProductIds, setOrderedProductIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERED_PRODUCTS);
      if (saved) return JSON.parse(saved);

      const collected = new Set<string>();
      // Scan last placed order
      const last = localStorage.getItem('sangoub_last_order');
      if (last) {
        const parsed = JSON.parse(last);
        (parsed.items || []).forEach((it: any) => {
          if (it.id) collected.add(it.id);
          if (it.productId) collected.add(it.productId);
          if (it.name) collected.add(it.name.trim());
        });
      }
      // Scan orders history
      const historyStr = localStorage.getItem('sangoub_orders_history');
      if (historyStr) {
        const history = JSON.parse(historyStr);
        (history || []).forEach((ord: any) => {
          (ord.items || []).forEach((it: any) => {
            if (it.id) collected.add(it.id);
            if (it.productId) collected.add(it.productId);
            if (it.name) collected.add(it.name.trim());
          });
        });
      }
      return Array.from(collected);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERED_PRODUCTS, JSON.stringify(orderedProductIds));
    } catch {}
  }, [orderedProductIds]);

  const markProductAsOrdered = (productId: string, productName?: string) => {
    setOrderedProductIds(prev => {
      const next = new Set(prev);
      if (productId) next.add(productId);
      if (productName) next.add(productName.trim());
      return Array.from(next);
    });
  };

  const isProductOrderedBefore = (productId: string, productName?: string) => {
    if (!productId && !productName) return false;
    return orderedProductIds.some(
      id => (productId && id === productId) || (productName && id === productName.trim())
    );
  };

  // 6. User Profile via Supabase Authentication (Sole Source of Truth)
  const [user, setUser] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;

    const syncUser = async (sbUser: any) => {
      if (!sbUser) {
        if (active) setUser(null);
        return;
      }

      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sbUser.id)
          .maybeSingle();

        if (prof) {
          if (active) {
            setUser({
              id: sbUser.id,
              fullName: prof.full_name || sbUser.user_metadata?.full_name || 'عميل سنجوب',
              email: prof.email || sbUser.email || '',
              phone: prof.phone || sbUser.phone || sbUser.user_metadata?.phone || '',
              ministry: prof.ministry || '',
              floorNumber: prof.floor_number || '',
              roomNumber: prof.room_number || '',
              walletBalance: Number(prof.wallet_balance) || 0,
              role: 'employee',
              avatarUrl: prof.avatar_url || sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.picture || '',
              isGuest: false,
            } as Profile);
          }
        } else {
          // If profile row doesn't exist yet, insert into public.profiles
          const newProfile = {
            id: sbUser.id,
            full_name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'عميل سنجوب',
            email: sbUser.email || '',
            phone: sbUser.phone || sbUser.user_metadata?.phone || '',
            role: 'employee',
            wallet_balance: 0,
          };
          await supabase.from('profiles').upsert(newProfile);
          if (active) {
            setUser({
              id: sbUser.id,
              fullName: newProfile.full_name,
              email: newProfile.email,
              phone: newProfile.phone,
              ministry: '',
              floorNumber: '',
              roomNumber: '',
              walletBalance: 0,
              role: newProfile.role,
              avatarUrl: sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.picture || '',
              isGuest: false,
            } as Profile);
          }
        }
      } catch (err) {
        console.warn('Supabase auth sync error:', err);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) syncUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) syncUser(session?.user || null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const locationAccount = useRef<string | null>(null);
  useEffect(() => {
    if (!user && locationAccount.current === null) return;
    locationAccount.current = user?.id || null;
    const address = user?.defaultAddress;
    setServiceAreaState(user && (address?.fullAddress || user.ministry) ? {
      id: `account_${user.id}`, name: address?.fullAddress || user.ministry || '',
      active: true, deliveryTime: '', city: address?.city || '', details: address?.details || '',
      latitude: (address?.coordinates || user.coordinates)?.latitude,
      longitude: (address?.coordinates || user.coordinates)?.longitude,
    } : { id: 'default_map', name: LAUNCH_CONFIG.serviceAreaLabel, active: true, deliveryTime: '' });
  }, [user?.id, user?.ministry, user?.defaultAddress, user?.coordinates]);

  const loginAsGuest = (name: string, phone: string) => {
    const profile: Profile = {
      id: `usr-${Date.now()}`,
      fullName: name,
      phone,
      email: '',
      walletBalance: 0,
      role: 'employee',
      isGuest: true,
    };
    setUser(profile);
  };

  const registerSangoubAccount = (_name: string, _phone: string, _address?: string) => {
    throw new Error('إنشاء الحساب يتطلب التسجيل بالبريد أو Google وتأكيد الهوية.');
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
  };

  return (
    <StoreContext.Provider
      value={{
        currentPath,
        navigate,
        products,
        stores,
        categories,
        isLoadingCatalog,
        catalogError,
        searchQuery,
        setSearchQuery,
        banners,
        martBanner,
        disabledStoreTypes,
        disabledCategories,
        categoryOverrides,
        supermarketCategories,
        activeStoreTypes,
        sliderShowArrows,
        isLoadingBanners,
        refreshBanners,
        handleBannerClick,
        serviceArea,
        setServiceArea,
        saveDeliveryLocation,
        availableAreas,
        cartItems,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        subtotal,
        deliveryFee,
        discount,
        total,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        pendingStoreSwitch,
        confirmStoreSwitch,
        cancelStoreSwitch,
        wishlistIds,
        toggleWishlist,
        isWishlisted,
        orderedProductIds,
        isProductOrderedBefore,
        markProductAsOrdered,
        user,
        setUser,
        loginAsGuest,
        registerSangoubAccount,
        logout,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
