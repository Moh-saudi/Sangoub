import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { Product, Store, CartItem, Coupon, Profile } from '../../types';
import { BRAND } from '../../brand';
import { calculateCartSubtotal, calculateOrderTotal, applyCouponDiscount, cleanDisplayAddress } from '../../utils/orderCalculations';
import { LAUNCH_CONFIG } from '../../config/launchConfig';
import { watchCollection, auth, db, signOutFromFirebase, syncUserProfileToFirestore, isVerifiedIdentity } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { limit, where, doc, getDoc } from 'firebase/firestore';

import { StoreBanner, DEFAULT_SANGOUB_BANNERS } from '../types/banner';

export interface ServiceArea {
  id: string;
  name: string;
  deliveryTime: string;
  active: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  street?: string;
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

  // Wishlist
  wishlistIds: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;

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
    if (options?.replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
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
    localStorage.setItem(STORAGE_KEYS.AREA, JSON.stringify(area));
  };

  // 3. Catalog Products & Stores
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogError,setCatalogError]=useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setIsLoadingCatalog(true);setCatalogError('');
    let stopProducts = () => {};
    let stopStores = () => {};

    try {
      stopProducts = watchCollection<Product>(
        'products',
        (liveProducts) => {
          if (liveProducts && liveProducts.length > 0) {
            setProducts(liveProducts.filter(p => !p.archived && p.inStock));
          } else {
            setProducts([]);
          }
          setIsLoadingCatalog(false);
        },
        () => {
          setProducts([]);setCatalogError('تعذر تحميل المنتجات. تحقق من الاتصال وأعد المحاولة.');
          setIsLoadingCatalog(false);
        },
        [where('inStock', '==', true), limit(60)]
      );

      stopStores = watchCollection<Store>(
        'stores',
        (liveStores) => {
          if (liveStores && liveStores.length > 0) {
            setStores(liveStores.filter(s => s.status === 'open'));
          } else {
            setStores([]);
          }
        },
        () => {setStores([]);setCatalogError('تعذر تحميل المتاجر. تحقق من الاتصال.');},
        [limit(30)]
      );
    } catch {
      setProducts([]);
      setStores([]);
      setIsLoadingCatalog(false);
    }

    return () => {
      stopProducts();
      stopStores();
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // 3.5 Dynamic Banners (Synced with Admin App Content / Campaigns)
  const [banners, setBanners] = useState<StoreBanner[]>(DEFAULT_SANGOUB_BANNERS);
  const [isLoadingBanners, setIsLoadingBanners] = useState(false);

  const refreshBanners = async () => {
    setIsLoadingBanners(true);
    try {
      // 1. Try public server endpoint /api/app-content (official app content & campaign manager)
      const res = await fetch('/api/app-content', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.slides) && data.slides.length > 0) {
          const mapped: StoreBanner[] = data.slides.map((s: any, idx: number) => ({
            id: s.id || `campaign-${idx}`,
            title: s.title || '',
            subtitle: s.subtitle || '',
            desc: s.subtitle || '',
            imageUrl: s.imageUrl || '',
            image: s.imageUrl || '',
            tag: s.targetType === 'offers' ? 'أقوى العروض 🎁' : s.targetType === 'product' ? 'خصم وتوفير 🏷️' : s.targetType === 'store' ? 'متجر مميز 🏪' : 'عرض خاص',
            btnText: s.targetType === 'offers' ? 'تصفح العروض' : s.targetType === 'product' ? 'اطلب الآن' : 'عرض المزيد',
            targetType: s.targetType || 'offers',
            targetId: s.targetId || '',
            targetPath: s.targetType === 'offers' ? '/offers' : s.targetType === 'product' ? `/product/${s.targetId}` : s.targetType === 'store' ? `/store/${s.targetId}` : '',
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

      // 2. Fallback check for mobile app_config/home_sections if rules allow
      try {
        const cfgDoc = await getDoc(doc(db, 'app_config', 'home_sections'));
        if (cfgDoc.exists()) {
          const cfgData = cfgDoc.data();
          if (cfgData?.offersBanners && Array.isArray(cfgData.offersBanners) && cfgData.offersBanners.length > 0) {
            const mappedMobile: StoreBanner[] = cfgData.offersBanners.map((b: any, idx: number) => ({
              id: b.id || `mobile-banner-${idx}`,
              title: b.title || '',
              subtitle: b.subtitle || '',
              desc: b.subtitle || '',
              imageUrl: b.imageUrl || (b.image && b.image.startsWith('http') ? b.image : ''),
              image: b.image || '',
              tag: b.tag || 'عرض حصري',
              btnText: b.btnText || 'اطلب الآن',
              targetType: b.targetType || 'offers',
              targetId: b.targetId || '',
              targetPath: b.targetPath || (b.targetType === 'offers' ? '/offers' : ''),
              badgeColor: '#FF5900',
              bgGradient: 'linear-gradient(135deg, #131921 0%, #1F2937 100%)',
              mascotImg: '/assets/sangoub/mascot-cheerful.png'
            }));
            setBanners(mappedMobile);
            setIsLoadingBanners(false);
            return;
          }
        }
      } catch {
        // Ignore firestore permission check error if rules block direct read
      }

      // 3. Fallback to default Sangoub soft launch banners
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

    if (banner.targetType === 'store' && banner.targetId) {
      const store = stores.find(s => s.id === banner.targetId);
      if (store && callbacks?.onSelectCategory) {
        callbacks.onSelectCategory(store.type || store.name);
        const grid = document.getElementById('products-grid') || document.getElementById('mobile-products-grid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      navigate(`/stores/${encodeURIComponent(banner.targetId)}`);
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

  // 6. User Profile
  const [user, setUser] = useState<Profile | null>(null);
  useEffect(() => {
    let generation=0;
    const unsub=onAuthStateChanged(auth, async fbUser=>{
      const current=++generation;setUser(null);
      if(!fbUser||!isVerifiedIdentity(fbUser))return;
      try{const profile=await syncUserProfileToFirestore(fbUser);if(current===generation)setUser(profile);}catch{if(current===generation)setUser(null);}
    });return()=>{generation++;unsub();};
  },[]);

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

  const logout = () => {
    signOutFromFirebase();
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
        isLoadingBanners,
        refreshBanners,
        handleBannerClick,
        serviceArea,
        setServiceArea,
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
        wishlistIds,
        toggleWishlist,
        isWishlisted,
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
