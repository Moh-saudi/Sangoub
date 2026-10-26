import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { Product, Store, CartItem, Coupon, Profile } from '../../types';
import { INITIAL_PRODUCTS, INITIAL_STORES } from '../../data/seedData';
import { BRAND } from '../../brand';
import { calculateCartSubtotal, calculateOrderTotal, applyCouponDiscount, cleanDisplayAddress } from '../../utils/orderCalculations';
import { watchCollection, auth, db, signOutFromFirebase } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { limit, where, doc, getDoc } from 'firebase/firestore';

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
  searchQuery: string;
  setSearchQuery: (query: string) => void;

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
      name: 'شارع المهندس ابراهيم عثمان، الشروق',
      deliveryTime: '20-30 دقيقة',
      active: true,
    };
  });

  const availableAreas: readonly ServiceArea[] = [];

  const setServiceArea = (area: ServiceArea) => {
    setServiceAreaState(area);
    localStorage.setItem(STORAGE_KEYS.AREA, JSON.stringify(area));
  };

  // 3. Catalog Products & Stores
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [stores, setStores] = useState<Store[]>(INITIAL_STORES);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setIsLoadingCatalog(true);
    let stopProducts = () => {};
    let stopStores = () => {};

    try {
      stopProducts = watchCollection<Product>(
        'products',
        (liveProducts) => {
          if (liveProducts && liveProducts.length > 0) {
            setProducts(liveProducts.filter(p => !p.archived && p.inStock));
          } else {
            setProducts(INITIAL_PRODUCTS);
          }
          setIsLoadingCatalog(false);
        },
        () => {
          setProducts(INITIAL_PRODUCTS);
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
            setStores(INITIAL_STORES);
          }
        },
        () => setStores(INITIAL_STORES),
        [limit(30)]
      );
    } catch {
      setProducts(INITIAL_PRODUCTS);
      setStores(INITIAL_STORES);
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
  const deliveryFee = cartItems.length > 0 ? 15 : 0;
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

  const applyCoupon = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean === 'SANGOUB10' || clean === 'WELCOME10') {
      const coupon: Coupon = {
        code: clean,
        title: 'خصم 10%',
        description: 'خصم 10% بمناسبة انطلاق سنجوب',
        discountType: 'percent',
        value: 10,
        minOrder: 50,
      };
      setAppliedCoupon(coupon);
      return { success: true, message: 'تم تطبيق خصم 10% بنجاح!' };
    }
    return { success: false, message: 'كود الخصم غير صالح أو منتهي الصلاحية' };
  };

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
  const [user, setUser] = useState<Profile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }, [user]);

  // Real-time Firebase Authentication Sync (Matches Flutter App)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const cleanMinistry = cleanDisplayAddress(data.ministry);
            const profile: Profile = {
              id: fbUser.uid,
              fullName: data.fullName || fbUser.displayName || 'عميل سنجوب',
              email: fbUser.email || data.email || '',
              phone: data.phone || fbUser.phoneNumber || '',
              ministry: cleanMinistry,
              floorNumber: data.floorNumber || '',
              roomNumber: data.roomNumber || '',
              walletBalance: typeof data.walletBalance === 'number' ? data.walletBalance : 20,
              role: data.role || 'employee',
              isGuest: false,
              authProvider: fbUser.providerData.some(p => p.providerId === 'google.com') ? 'google' : 'email',
            };
            setUser(profile);
            if (cleanMinistry) {
              setServiceAreaState(prev => ({
                ...prev,
                name: cleanMinistry,
              }));
            }
          }
        } catch {
          // ignore network glitch
        }
      }
    });
    return () => unsub();
  }, []);

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

  const registerSangoubAccount = (name: string, phone: string, address?: string) => {
    const cleanPhone = phone.trim();
    const cleanName = name.trim();
    const cleanAddress = (address || serviceArea.name || '').trim();

    const profile: Profile = {
      id: `usr-sng-${Date.now()}`,
      fullName: cleanName,
      phone: cleanPhone,
      email: `${cleanPhone.replace(/\D/g, '')}@sangoub.delivery`,
      ministry: cleanAddress,
      walletBalance: 20, // Free welcome gift in Sangoub wallet
      role: 'employee',
      isGuest: false, // Fully registered account
    };
    setUser(profile);

    if (cleanAddress) {
      setServiceArea({
        id: `addr_${Date.now()}`,
        name: cleanAddress,
        deliveryTime: '15-25 دقيقة',
        active: true,
      });
      localStorage.setItem('sangoub_location_confirmed', 'true');
    }
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
        searchQuery,
        setSearchQuery,
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
