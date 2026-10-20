/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  Flame,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  CheckCircle2,
  Mic,
  Square,
  Loader2,
  Bot,
  MapPin,
} from 'lucide-react';
import type {
  AppNotification,
  CartItem,
  CourierChecklist,
  Coupon,
  Order,
  OrderStatus,
  Product,
  Profile,
  Store,
  UserRole,
} from './types/index.ts';
import {
  DEFAULT_USER,
  DEMO_PROFILES,
  INITIAL_COUPONS,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_STORES,
} from './data/seedData.ts';
import { RoleSwitcherBar } from './components/RoleSwitcherBar.tsx';
import { HeaderBar } from './components/HeaderBar.tsx';
import { BannerSlider } from './components/BannerSlider.tsx';
import { StoreList } from './components/StoreList.tsx';
import { ProductCard } from './components/ProductCard.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { FloatingCartBar } from './components/FloatingCartBar.tsx';
import { CartModal } from './components/CartModal.tsx';
import { OrdersView } from './components/OrdersView.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { CourierPortal } from './components/CourierPortal.tsx';
import { RestaurantPortal } from './components/RestaurantPortal.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { BottomNavBar } from './components/BottomNavBar.tsx';
import { LocationModal } from './components/LocationModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { NotificationCenter, NotificationToast } from './components/NotificationCenter.tsx';
import { CuisineBubbles } from './components/CuisineBubbles.tsx';
import { OnboardingModal } from './components/OnboardingModal.tsx';
import { MobileSimulatorFrame } from './components/MobileSimulatorFrame.tsx';
import { AiAssistantModal } from './components/AiAssistantModal.tsx';
import { MobileReleaseModal } from './components/MobileReleaseModal.tsx';
import { AppSplashScreen } from './components/AppSplashScreen.tsx';
import { applyCouponDiscount, formatEGP } from './utils/orderCalculations.ts';
import { useVoiceRecorder } from './utils/geminiClient.ts';
import { useOnlineStatus } from './utils/usePWAInstall.ts';
import {
  auth,
  onAuthStateChanged,
  syncUserProfileToFirestore,
  updateUserLocationInFirestore,
  saveOrderToFirestore,
  signOutFromFirebase,
} from './lib/firebase.ts';

export default function App() {
  // Main state with localStorage support where safe
  const [user, setUser] = useState<Profile>(() => {
    try {
      const saved = localStorage.getItem('gov_user_profile');
      return saved ? JSON.parse(saved) : DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });

  const [stores, setStores] = useState<Store[]>(INITIAL_STORES);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  // Mobile Simulator, Splash Screen, Onboarding & Release Hub States
  const [isSimulatorActive, setIsSimulatorActive] = useState<boolean>(true);
  const [isSplashOpen, setIsSplashOpen] = useState<boolean>(true);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isMobileReleaseOpen, setIsMobileReleaseOpen] = useState<boolean>(false);
  const [checkoutInterceptNotice, setCheckoutInterceptNotice] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  // AI Assistant & Maps Modal State
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState<boolean>(false);
  const [aiAssistantInitialTab, setAiAssistantInitialTab] = useState<'chat' | 'maps'>('chat');

  // Listen to real Firebase Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const syncedProfile = await syncUserProfileToFirestore(fbUser, {
            ministry: user.ministry,
            floorNumber: user.floorNumber,
            roomNumber: user.roomNumber,
          });
          setUser(syncedProfile);
        } catch (err) {
          console.error('Firebase profile sync error:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Keep Splash Screen as the primary mobile launch experience
  useEffect(() => {
    setIsSplashOpen(true);
  }, []);

  // Navigation
  const [activeTab, setActiveTab] = useState<
    'home' | 'orders' | 'profile' | 'admin' | 'courier' | 'restaurant'
  >('home');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');

  // Modals & Sheets
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);

  // Notifications (FCM simulation)
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif-1',
      title: 'مندوب الحي الحكومي في الطريق',
      body: 'خرج المندوب أحمد رجب ومعه طلبك متجهاً إلى وزارة المالية الدور الرابع',
      timestamp: 'منذ 10 دقائق',
      read: false,
      type: 'courier_assigned',
      orderId: 'ord-8491',
    },
    {
      id: 'notif-2',
      title: 'قسيمة خصم جديدة لموظفي العاصمة',
      body: 'استخدم كود GOV100 للحصول على 100 جنيه خصم فوري على وجبات الفود كورت',
      timestamp: 'اليوم 09:00 ص',
      read: true,
      type: 'promo',
    },
  ]);

  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);

  // Push notification helper
  const addNotification = (
    title: string,
    body: string,
    type: AppNotification['type'] = 'order_update',
    orderId?: string
  ) => {
    const newNotif: AppNotification = {
      id: 'notif-' + Date.now(),
      title,
      body,
      timestamp: 'الآن',
      read: false,
      type,
      orderId,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    setActiveToast(newNotif);
    setTimeout(() => {
      setActiveToast((current) => (current?.id === newNotif.id ? null : current));
    }, 4500);
  };

  // Sync user state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gov_user_profile', JSON.stringify(user));
    } catch {
      // Storage unavailable or disabled
    }
  }, [user]);

  // Handle Cart item modifications
  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && !item.notes);
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: 'cart-' + Date.now() + '-' + Math.random(),
          product,
          quantity: 1,
          selectedOptions: {},
          extraPrice: 0,
        },
      ];
    });

    addNotification(
      'تمت الإضافة إلى سلتك',
      `أضفت ${product.name} من ${product.storeName} لسلة مشترياتك`,
      'promo'
    );
  };

  const handleAddToCartWithOptions = (
    product: Product,
    quantity: number,
    selectedOptions: Record<string, string>,
    extraPrice = 0,
    notes = ''
  ) => {
    setCartItems((prev) => [
      ...prev,
      {
        id: 'cart-' + Date.now() + '-' + Math.random(),
        product,
        quantity,
        selectedOptions,
        notes,
        extraPrice,
      },
    ]);

    addNotification(
      'وجبة مخصصة في السلة',
      `تمت إضافة ${quantity}x ${product.name} بالخيارات المختارة`,
      'promo'
    );
  };

  const handleIncrementItem = (cartItemId: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const handleDecrementItem = (cartItemId: string) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id === cartItemId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  // Coupon handling
  const handleApplyCoupon = (code: string): { success: boolean; message: string } => {
    const coupon = availableCoupons.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (!coupon) {
      return { success: false, message: 'كود القسيمة غير صحيح أو منتهي الصلاحية' };
    }
    setAppliedCoupon(coupon);
    addNotification('تم تطبيق الخصم', `تم تفعيل قسيمة الخصم: ${coupon.description}`, 'promo');
    return { success: true, message: `تم تفعيل خصم ${coupon.code} بنجاح!` };
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
  };

  // Intercept checkout if user is guest
  const handleRequireAuthForCheckout = () => {
    setCheckoutInterceptNotice(
      '🔔 لتأكيد طلبك وتحديد مكان التوصيل بمكتبك بدقة، يرجى تسجيل الدخول أو المتابعة بحساب Google.'
    );
    setIsAuthModalOpen(true);
  };

  // Order Submission (Persists to Firestore when authenticated)
  const handleOrderCreated = (newOrder: Order) => {
    setOrders((prev) => [newOrder, ...prev]);
    setCartItems([]);
    setAppliedCoupon(null);
    setIsCartOpen(false);
    setActiveTab('orders');

    if (auth.currentUser) {
      saveOrderToFirestore(newOrder).catch((err) =>
        console.error('Failed to persist order to Firestore:', err)
      );
    }

    addNotification(
      newOrder.isScheduled ? 'تمت جدولة طلبك بنجاح!' : 'تم تأكيد طلبك بنجاح!',
      newOrder.scheduledDeliveryTime
        ? `رقم الأوردر ${newOrder.orderNumber} — مجدول للتسليم في: ${newOrder.scheduledDeliveryTime}`
        : `رقم الأوردر ${newOrder.orderNumber} - تم الإرسال لمطبخ المطعم للتحضير الفوري.`,
      'order_update',
      newOrder.id
    );
  };

  // Status updates from Admin or Restaurant
  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            orderStatus: status,
            estimatedDelivery:
              status === 'delivered'
                ? 'تم التسليم بنجاح'
                : status === 'with_courier'
                ? 'المندوب في المصعد / الدور'
                : status === 'preparing'
                ? 'جاري التحضير بالمطعم'
                : ord.estimatedDelivery,
          };
        }
        return ord;
      })
    );

    const targetOrder = orders.find((o) => o.id === orderId);
    if (targetOrder) {
      let statusText = 'تحديث على طلبك';
      if (status === 'preparing') statusText = 'بدأ الشيف في تحضير وجبتك الساخنة';
      if (status === 'with_courier') statusText = 'كابتن التوصيل في طريقه لمبنى الوزارة';
      if (status === 'delivered') statusText = 'تم تسليم الأوردر بمكتبك بالهناء والشفاء!';

      addNotification(
        `أوردر ${targetOrder.orderNumber}: ${statusText}`,
        `مقر التوصيل: ${targetOrder.ministry} - ${targetOrder.floorNumber}`,
        'order_update',
        orderId
      );
    }
  };

  // Courier Live Checklist Progress Updates
  const handleUpdateOrderChecklist = (
    orderId: string,
    updates: Partial<CourierChecklist>,
    updatedStatus?: OrderStatus
  ) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const currentChecklist = ord.courierChecklist || {
            receivedAndCheckedAtRestaurant: false,
            paidRestaurant: false,
            onTheWayToMinistry: false,
            arrivedAtCustomerOffice: false,
            collectedPayment: false,
          };

          return {
            ...ord,
            orderStatus: updatedStatus || ord.orderStatus,
            courierChecklist: {
              ...currentChecklist,
              ...updates,
            },
          };
        }
        return ord;
      })
    );

    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    if (updates.receivedAndCheckedAtRestaurant) {
      addNotification(
        `المندوب استلم طلبك ${targetOrder.orderNumber}`,
        'فحص المندوب وجبتك وتأكد من مطابقة الأصناف مع شيف المطعم.',
        'courier_assigned',
        orderId
      );
    } else if (updates.paidRestaurant) {
      addNotification(
        `تمت تسوية الحساب مع المطعم`,
        `سدد المندوب المبالغ لكاشير المطعم وبدأ التحرك لمجمع الوزارات.`,
        'courier_assigned',
        orderId
      );
    } else if (updates.onTheWayToMinistry) {
      addNotification(
        `المندوب متوجه لـ ${targetOrder.ministry}`,
        `الطلب في الطريق إليك الآن. جهز استلام وجبتك.`,
        'courier_assigned',
        orderId
      );
    } else if (updates.arrivedAtCustomerOffice) {
      addNotification(
        `المندوب وصل لدورك ومكتبك (${targetOrder.floorNumber})`,
        `المندوب الآن أمام مكتبك لتسليم الوجبة باليد.`,
        'order_update',
        orderId
      );
    } else if (updates.collectedPayment) {
      addNotification(
        `تم تسليم أوردر ${targetOrder.orderNumber} بالكامل`,
        `شكراً لطلبك من منصة طلبات العاصمة! تم استلام المبلغ وتسليم الوجبات بنجاح.`,
        'order_update',
        orderId
      );
    }
  };

  // Courier Assignment
  const handleAssignCourier = (orderId: string, courierName: string) => {
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId
          ? {
              ...ord,
              courierName,
              courierPhone: '01099887766',
              orderStatus: 'with_courier',
              estimatedDelivery: 'خلال 10-15 دقيقة للدور',
            }
          : ord
      )
    );

    addNotification(
      'تم تعيين مندوب التوصيل',
      `المندوب ${courierName} استلم مهمة توصيل طلبك إلى الوزارة والدور المطلوب`,
      'courier_assigned',
      orderId
    );
  };

  // Product Inventory Controls
  const handleToggleProductStock = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, inStock: !p.inStock } : p))
    );
  };

  const handleUpdateProductPrice = (productId: string, newPrice: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, price: newPrice } : p))
    );
  };

  const handleToggleStoreStatus = (storeId: string) => {
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, status: s.status === 'open' ? 'closed' : 'open' } : s))
    );
  };

  // Instant Persona Switcher
  const handleSwitchPersona = (role: UserRole) => {
    const targetProfile = DEMO_PROFILES[role];
    if (targetProfile) {
      setUser(targetProfile);
      if (role === 'courier') setActiveTab('courier');
      else if (role === 'restaurant') setActiveTab('restaurant');
      else if (role === 'admin') setActiveTab('admin');
      else setActiveTab('home');

      addNotification(
        `تم التحويل إلى دور: ${targetProfile.fullName}`,
        `تعمل الآن بصلاحيات ${role === 'courier' ? 'مندوب الدليفري' : role === 'restaurant' ? 'شيف المطعم' : role === 'admin' ? 'إدارة الحي' : 'الموظف العميل'}`,
        'order_update'
      );
    }
  };

  // Filtered Products for Home
  const filteredProducts = products.filter((p) => {
    if (selectedStoreId && p.storeId !== selectedStoreId) return false;
    if (selectedCategory !== 'الكل' && p.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      const matchStore = p.storeName.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchStore) return false;
    }
    return true;
  });

  const popularProducts = products.filter((p) => p.isPopular);

  const getProductQuantityInCart = (productId: string) => {
    return cartItems
      .filter((i) => i.product.id === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;
  const activeOrdersCount = orders.filter(
    (o) =>
      o.orderStatus === 'received' ||
      o.orderStatus === 'preparing' ||
      o.orderStatus === 'with_courier'
  ).length;

  // Voice recorder for Home Search Bar (gemini-3.5-transcribe)
  const searchVoiceRecorder = useVoiceRecorder((transcribedText) => {
    setSearchQuery(transcribedText);
    addNotification(
      'تم تحويل صوتك إلى نص بنجاح',
      `تم البحث عن: "${transcribedText}" عبر gemini-3.5-transcribe`,
      'system'
    );
  });

  // The Core Application Content
  const appContent = (
    <div className="min-h-full bg-slate-50 text-slate-900 pb-28 sm:pb-24 select-none flex flex-col flex-1">
      {/* 2. Top Header Bar */}
      <HeaderBar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        notifications={notifications}
        onOpenNotifications={() => setIsNotificationOpen(true)}
        onOpenAuthModal={() => {
          setCheckoutInterceptNotice(null);
          setIsAuthModalOpen(true);
        }}
        unreadCount={unreadNotificationsCount}
        isSimulatorActive={isSimulatorActive}
        onToggleSimulator={() => setIsSimulatorActive(!isSimulatorActive)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenMobileRelease={() => setIsMobileReleaseOpen(true)}
      />

      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-1.5 text-center text-xs font-bold">
          وضع عدم الاتصال بالإنترنت (Offline PWA Mode) — يتم استخدام البيانات المخزنة محلياً
        </div>
      )}

      {/* 3. Floating Push Notification Toast */}
      <NotificationToast
        notification={activeToast}
        onDismiss={() => setActiveToast(null)}
        onOpenCenter={() => setIsNotificationOpen(true)}
      />

      {/* 4. MAIN VIEW ROUTING */}

      {/* Tab: Home (Client Store View) */}
      {activeTab === 'home' && (
        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-5 flex-1" dir="rtl">
          {/* Search Bar with Microphone Audio Transcription (gemini-3.5-transcribe) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchVoiceRecorder.isRecording
                      ? 'جاري الاستماع لصوتك... اضغط زر الإيقاف لتحويل الصوت لنص'
                      : searchVoiceRecorder.isTranscribing
                      ? 'جاري نسخ الصوت عبر gemini-3.5-transcribe...'
                      : 'ابحث كتابةً أو بالميكروفون عن فول هند، قهوة، شاورما...'
                  }
                  className="w-full py-2.5 sm:py-3 pr-10 pl-12 text-xs sm:text-sm bg-white border border-slate-200/90 rounded-2xl shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600 transition-all text-slate-900 font-medium"
                />
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    مسح
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={searchVoiceRecorder.toggleRecording}
                disabled={searchVoiceRecorder.isTranscribing}
                className={`min-w-[44px] min-h-[44px] px-3 rounded-2xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all shrink-0 ${
                  searchVoiceRecorder.isRecording
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : searchVoiceRecorder.isTranscribing
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
                }`}
                title="البحث الصوتي بالميكروفون (gemini-3.5-transcribe)"
                aria-label="البحث الصوتي بالميكروفون"
              >
                {searchVoiceRecorder.isTranscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                ) : searchVoiceRecorder.isRecording ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden sm:inline">إيقاف</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-emerald-600" />
                    <span className="hidden sm:inline">بحث صوتي</span>
                  </>
                )}
              </button>
            </div>

            {searchVoiceRecorder.voiceError && (
              <p className="text-[11px] text-rose-600 px-1">{searchVoiceRecorder.voiceError}</p>
            )}

            {/* Quick Bar: Multi-Turn Gemini Chatbot & Google Maps Grounding */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAiAssistantInitialTab('chat');
                  setIsAiAssistantOpen(true);
                }}
                className="p-2.5 sm:p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-between gap-2 transition-colors text-right shadow-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">مساعد الطلبات والاجتماعات</p>
                    <p className="text-[10px] text-slate-300 truncate">
                      محادثة ذكية · طلب صوتي · ترشيح وجبات
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAiAssistantInitialTab('maps');
                  setIsAiAssistantOpen(true);
                }}
                className="p-2.5 sm:p-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 flex items-center justify-between gap-2 transition-colors text-right shadow-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">دليل خرائط جوجل للوزارات</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      بوابات الـ 34 وزارة · البنوك · محطة LRT
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick Cuisine / Department Bubbles */}
          <CuisineBubbles
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setSelectedStoreId(null);
            }}
          />

          {/* Promotional Banner Carousel with Official Food Photos */}
          <BannerSlider onApplyCoupon={handleApplyCoupon} />

          {/* Food Court & Supermarket Stores */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StoreIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  مطاعم الفود كورت وسوبر ماركت الحي الحكومي
                </h2>
              </div>
              {selectedStoreId && (
                <button
                  onClick={() => setSelectedStoreId(null)}
                  className="text-xs font-semibold text-orange-600 hover:underline"
                >
                  عرض جميع المتاجر
                </button>
              )}
            </div>

            <StoreList
              stores={stores}
              selectedStoreId={selectedStoreId}
              onSelectStore={(id) => setSelectedStoreId(id === selectedStoreId ? null : id)}
            />
          </div>

          {/* Popular Items Showcase */}
          {!selectedStoreId && selectedCategory === 'الكل' && !searchQuery && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  الأكثر طلباً بين موظفي الوزارات هذا الصباح
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                {popularProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantityInCart={getProductQuantityInCart(product.id)}
                    onAddToCart={() => handleAddToCart(product)}
                    onIncrement={() => handleAddToCart(product)}
                    onDecrement={() => {
                      const item = cartItems.find((i) => i.product.id === product.id);
                      if (item) handleDecrementItem(item.id);
                    }}
                    onOpenDetails={() => setSelectedProductForDetail(product)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Main Menu Items Grid */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                <span>
                  {selectedStoreId
                    ? `قائمة ${stores.find((s) => s.id === selectedStoreId)?.name}`
                    : selectedCategory !== 'الكل'
                    ? `أصناف ${selectedCategory}`
                    : 'قائمة الوجبات والمنتجات الكاملة'}
                </span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {filteredProducts.length} صنف متاح
              </span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-500 text-sm">لا توجد أصناف مطابقة لبحثك</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedStoreId(null);
                    setSelectedCategory('الكل');
                  }}
                  className="mt-2 text-xs font-bold text-orange-600 hover:underline"
                >
                  إعادة ضبط خيارات البحث
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantityInCart={getProductQuantityInCart(product.id)}
                    onAddToCart={() => handleAddToCart(product)}
                    onIncrement={() => handleAddToCart(product)}
                    onDecrement={() => {
                      const item = cartItems.find((i) => i.product.id === product.id);
                      if (item) handleDecrementItem(item.id);
                    }}
                    onOpenDetails={() => setSelectedProductForDetail(product)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* Tab: Orders Tracking & Delivery View */}
      {activeTab === 'orders' && (
        <OrdersView
          orders={orders}
          onReorder={(order) => {
            order.items.forEach((item) => handleAddToCart(item.product));
            setIsCartOpen(true);
          }}
        />
      )}

      {/* Tab: Courier Portal (Delivery Runner Workflow) */}
      {activeTab === 'courier' && (
        <CourierPortal
          orders={orders}
          courier={user}
          onAdvanceOrderStatus={handleUpdateOrderStatus}
          onUpdateOrderChecklist={handleUpdateOrderChecklist}
        />
      )}

      {/* Tab: Restaurant Portal (Kitchen Ticket Board & Menu Manager) */}
      {activeTab === 'restaurant' && (
        <RestaurantPortal
          orders={orders}
          products={products}
          stores={stores}
          currentProfile={user}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onUpdateProductStock={(productId, inStock) => {
            setProducts((prev) =>
              prev.map((p) => (p.id === productId ? { ...p, inStock } : p))
            );
          }}
          onUpdateProductPrice={handleUpdateProductPrice}
          onAddProduct={(newProd) => setProducts((prev) => [...prev, newProd])}
          onToggleStoreStatus={handleToggleStoreStatus}
        />
      )}

      {/* Tab: Admin Dashboard */}
      {activeTab === 'admin' && (
        <AdminDashboard
          orders={orders}
          stores={stores}
          products={products}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onAssignCourier={handleAssignCourier}
          onToggleProductStock={handleToggleProductStock}
          onUpdateProductPrice={handleUpdateProductPrice}
          onToggleStoreStatus={handleToggleStoreStatus}
        />
      )}

      {/* Tab: Profile View */}
      {activeTab === 'profile' && (
        <ProfileView
          user={user}
          onUpdateProfile={(u) => setUser(u)}
          savedCoupons={availableCoupons}
          onSwitchToAdmin={() => setActiveTab('admin')}
          onOpenAuthModal={() => {
            setCheckoutInterceptNotice(null);
            setIsAuthModalOpen(true);
          }}
        />
      )}

      {/* Floating Cart Bar (when cart has items) */}
      <FloatingCartBar
        items={cartItems}
        onOpenCart={() => setIsCartOpen(true)}
        isSimulator={isSimulatorActive}
      />

      {/* Role-Aware Bottom Nav Bar */}
      <BottomNavBar
        userRole={user.role}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeOrdersCount={activeOrdersCount}
        isSimulator={isSimulatorActive}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* 1. Global Role & Persona Switcher Bar (Instant testing of all 4 roles) */}
      <RoleSwitcherBar
        currentUser={user}
        onSwitchPersona={handleSwitchPersona}
        onOpenAuthModal={() => {
          setCheckoutInterceptNotice(null);
          setIsAuthModalOpen(true);
        }}
        onLogout={() => {
          setUser(DEFAULT_USER);
          setActiveTab('home');
        }}
      />

      {/* Mobile Simulator Frame (when active) OR Full-width standard web app */}
      <MobileSimulatorFrame
        isSimulatorActive={isSimulatorActive}
        onToggleSimulator={() => setIsSimulatorActive(!isSimulatorActive)}
        onReplayOnboarding={() => setIsOnboardingOpen(true)}
        onReplaySplash={() => setIsSplashOpen(true)}
        splashScreen={
          <AppSplashScreen isOpen={isSplashOpen} onFinish={() => setIsSplashOpen(false)} />
        }
      >
        {appContent}
      </MobileSimulatorFrame>

      {/* Onboarding Presentation Modal with 4 Official Screens */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onOpenGoogleAuth={() => {
          setCheckoutInterceptNotice(null);
          setIsAuthModalOpen(true);
        }}
      />

      {/* Cart & Checkout Sheet (Includes guest auth interception) */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        user={user}
        availableCoupons={availableCoupons}
        appliedCoupon={appliedCoupon}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={handleRemoveCoupon}
        onIncrementItem={(item) => handleIncrementItem(item.id)}
        onDecrementItem={(item) => handleDecrementItem(item.id)}
        onRemoveItem={handleRemoveItem}
        onOrderCreated={handleOrderCreated}
        onRequireAuth={handleRequireAuthForCheckout}
      />

      {/* Product Detail Customizer Modal */}
      <ProductDetailModal
        product={selectedProductForDetail}
        onClose={() => setSelectedProductForDetail(null)}
        onAddToCartWithOptions={handleAddToCartWithOptions}
      />

      {/* Ministry & Floor Location Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        user={user}
        onSaveLocation={(ministry, floorNumber, roomNumber) => {
          setUser((prev) => ({
            ...prev,
            ministry,
            floorNumber,
            roomNumber,
          }));
          if (auth.currentUser) {
            updateUserLocationInFirestore(
              auth.currentUser.uid,
              ministry,
              floorNumber,
              roomNumber
            ).catch((err) => console.error('Failed to update Firestore location:', err));
          }
        }}
      />

      {/* Unified Auth & Registration Modal with Google Sign-In */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setCheckoutInterceptNotice(null);
        }}
        currentUser={user}
        stores={stores}
        checkoutInterceptNotice={checkoutInterceptNotice}
        onLoginSuccess={(newProfile) => {
          setUser(newProfile);
          setCheckoutInterceptNotice(null);
          if (newProfile.role === 'courier') setActiveTab('courier');
          else if (newProfile.role === 'restaurant') setActiveTab('restaurant');
          else if (newProfile.role === 'admin') setActiveTab('admin');
          else setActiveTab('home');
        }}
        onLogout={() => {
          signOutFromFirebase().catch(() => {});
          setUser(DEFAULT_USER);
          setActiveTab('home');
        }}
      />

      {/* Notification Center Drawer */}
      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }}
        onSelectNotification={(notif) => {
          if (notif.orderId) {
            setActiveTab('orders');
            setIsNotificationOpen(false);
          }
        }}
      />

      {/* AI Assistant & Google Maps Grounding Modal */}
      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        user={user}
        products={products}
        stores={stores}
        onAddToCart={handleAddToCart}
        initialTab={aiAssistantInitialTab}
      />

      {/* Mobile App Release, Google Play & Firebase Credentials Hub */}
      <MobileReleaseModal
        isOpen={isMobileReleaseOpen}
        onClose={() => setIsMobileReleaseOpen(false)}
        user={user}
        onLoginSuccess={(newProfile) => {
          setUser(newProfile);
          addNotification(
            'تم تسجيل الدخول عبر Firebase بنجاح',
            `مرحباً بك ${newProfile.fullName} - تم ربط حسابك بقاعدة بيانات Firestore`,
            'system'
          );
        }}
      />
    </div>
  );
}
