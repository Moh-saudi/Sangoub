/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import type {
  ApplicationStatus,
  AppNotification,
  CartItem,
  CourierChecklist,
  Coupon,
  JobApplication,
  Order,
  OrderStatus,
  PartnerApplication,
  Product,
  Profile,
  Store,
  UserRole,
} from "./types/index.ts";
import { DEFAULT_USER } from "./data/seedData.ts";
import { RoleSwitcherBar } from "./components/RoleSwitcherBar.tsx";
import { HeaderBar } from "./components/HeaderBar.tsx";
import { BannerSlider } from "./components/BannerSlider.tsx";
import { StoreList } from "./components/StoreList.tsx";
import { ProductCard } from "./components/ProductCard.tsx";
import { ProductDetailModal } from "./components/ProductDetailModal.tsx";
import { FloatingCartBar } from "./components/FloatingCartBar.tsx";
import { CartModal } from "./components/CartModal.tsx";
import { OrdersView } from "./components/OrdersView.tsx";
import {
  AdminDashboard,
  type AdminTabType,
} from "./components/AdminDashboard.tsx";
import { CourierPortal } from "./components/CourierPortal.tsx";
import { RestaurantPortal } from "./components/RestaurantPortal.tsx";
import { ProfileView } from "./components/ProfileView.tsx";
import { BottomNavBar } from "./components/BottomNavBar.tsx";
import { LocationModal } from "./components/LocationModal.tsx";
import { AuthModal } from "./components/AuthModal.tsx";
import {
  NotificationCenter,
  NotificationToast,
} from "./components/NotificationCenter.tsx";
import { CuisineBubbles } from "./components/CuisineBubbles.tsx";
import { OnboardingModal } from "./components/OnboardingModal.tsx";
import { MobileSimulatorFrame } from "./components/MobileSimulatorFrame.tsx";
import { AiAssistantModal } from "./components/AiAssistantModal.tsx";
import { MobileReleaseModal } from "./components/MobileReleaseModal.tsx";
import { AppSplashScreen } from "./components/AppSplashScreen.tsx";
import { AdminSetupPanel } from "./components/AdminSetupPanel.tsx";
import {
  CorporateWebsite,
  type WebsitePage,
} from "./components/CorporateWebsite.tsx";
import { applyCouponDiscount, formatEGP } from "./utils/orderCalculations.ts";
import { useVoiceRecorder } from "./utils/geminiClient.ts";
import { useOnlineStatus } from "./utils/usePWAInstall.ts";
import {
  auth,
  onAuthStateChanged,
  syncUserProfileToFirestore,
  updateUserLocationInFirestore,
  saveOrderToFirestore,
  watchCollection,
  subscribeToOrders,
  saveRecord,
  updateOrderRecord,
  approvePartner,
  isVerifiedIdentity,
  signOutFromFirebase,
} from "./lib/firebase.ts";

export default function App() {
  const [user, setUser] = useState<Profile>(DEFAULT_USER);
  const [cloudError, setCloudError] = useState("");
  const [cloudConnected, setCloudConnected] = useState(false);
  const [staff, setStaff] = useState<
    Array<{
      id: string;
      role: string;
      name: string;
      phone: string;
      storeId?: string;
    }>
  >([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [partnerApplications, setPartnerApplications] = useState<
    PartnerApplication[]
  >([]);
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const reportError = (error: unknown) =>
    setCloudError(
      error instanceof Error ? error.message : "تعذر الاتصال بقاعدة البيانات.",
    );
  const persist = async (operation: Promise<unknown>) => {
    try {
      await operation;
    } catch (error) {
      reportError(error);
    }
  };
  // Official Corporate Website & Landing Page vs Mobile App States
  const [isWebsiteOpen, setIsWebsiteOpen] = useState<boolean>(
    window.location.pathname !== "/admin",
  );
  const [websitePage, setWebsitePage] = useState<WebsitePage>("home");
  const [initialAdminTab, setInitialAdminTab] =
    useState<AdminTabType>("orders");

  // Mobile Simulator, Splash Screen, Onboarding & Release Hub States
  const [isSimulatorActive, setIsSimulatorActive] = useState<boolean>(false);
  const [isSplashOpen, setIsSplashOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isMobileReleaseOpen, setIsMobileReleaseOpen] =
    useState<boolean>(false);
  const [checkoutInterceptNotice, setCheckoutInterceptNotice] = useState<
    string | null
  >(null);
  const isOnline = useOnlineStatus();

  // AI Assistant & Maps Modal State
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState<boolean>(false);
  const [aiAssistantInitialTab, setAiAssistantInitialTab] = useState<
    "chat" | "maps"
  >("chat");

  // Firebase owns the session; browser storage never grants roles.
  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      const current = ++generation;
      setUser(DEFAULT_USER);
      setOrders([]);
      setPartnerApplications([]);
      setJobApplications([]);
      setStaff([]);
      if (!isVerifiedIdentity(fbUser)) return;
      try {
        const profile = await syncUserProfileToFirestore(fbUser!);
        if (current !== generation) return;
        setUser(profile);
        setCloudError("");
        if (window.location.pathname === "/admin") {
          setIsWebsiteOpen(false);
          setIsSimulatorActive(false);
          setActiveTab(profile.role === "admin" ? "admin" : "profile");
        }
      } catch (error) {
        if (current === generation) reportError(error);
      }
    });
    return () => {
      generation++;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    const stops = [
      watchCollection<Store>(
        "stores",
        setStores,
        reportError,
        [],
        setCloudConnected,
      ),
      watchCollection<Product>("products", setProducts, reportError),
      watchCollection<Coupon>("coupons", setAvailableCoupons, reportError),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);
  useEffect(() => {
    if (user.isGuest || auth.currentUser?.uid !== user.id) return;
    let initialized = false;
    const previous = new Map<string, string>();
    const stops = [
      subscribeToOrders(
        user,
        (data) => {
          if (initialized)
            for (const order of data) {
              if (
                !previous.has(order.id) ||
                previous.get(order.id) !== order.orderStatus
              )
                addNotification(
                  "تحديث طلب " + order.orderNumber,
                  "الحالة: " + order.orderStatus,
                  "order_update",
                  order.id,
                );
            }
          previous.clear();
          for (const order of data) previous.set(order.id, order.orderStatus);
          initialized = true;
          setOrders(data);
        },
        reportError,
      ),
    ];
    if (user.role === "admin")
      stops.push(
        watchCollection<PartnerApplication>(
          "partnerApplications",
          setPartnerApplications,
          reportError,
        ),
        watchCollection<JobApplication>(
          "jobApplications",
          setJobApplications,
          reportError,
        ),
        watchCollection("staff", setStaff, reportError),
      );
    return () => stops.forEach((stop) => stop());
  }, [user.id, user.role, user.storeId]);
  // Keep Splash Screen as the primary mobile launch experience
  useEffect(() => {
    if (window.location.pathname === "/admin") setIsAuthModalOpen(true);
  }, []);

  // Navigation
  const [activeTab, setActiveTab] = useState<
    "home" | "orders" | "profile" | "admin" | "courier" | "restaurant"
  >("home");

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("الكل");

  // Modals & Sheets
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] =
    useState<Product | null>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);

  // Push notification helper
  const addNotification = (
    title: string,
    body: string,
    type: AppNotification["type"] = "order_update",
    orderId?: string,
  ) => {
    const newNotif: AppNotification = {
      id: "notif-" + Date.now(),
      title,
      body,
      timestamp: "الآن",
      read: false,
      type,
      orderId,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    setActiveToast(newNotif);
    setTimeout(() => {
      setActiveToast((current) =>
        current?.id === newNotif.id ? null : current,
      );
    }, 4500);
  };

  // Handle Cart item modifications
  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find(
        (item) => item.product.id === product.id && !item.notes,
      );
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          id: "cart-" + Date.now() + "-" + Math.random(),
          product,
          quantity: 1,
          selectedOptions: {},
          extraPrice: 0,
        },
      ];
    });

    addNotification(
      "تمت الإضافة إلى سلتك",
      `أضفت ${product.name} من ${product.storeName} لسلة مشترياتك`,
      "promo",
    );
  };

  const handleAddToCartWithOptions = (
    product: Product,
    quantity: number,
    selectedOptions: Record<string, string>,
    extraPrice = 0,
    notes = "",
  ) => {
    setCartItems((prev) => [
      ...prev,
      {
        id: "cart-" + Date.now() + "-" + Math.random(),
        product,
        quantity,
        selectedOptions,
        notes,
        extraPrice,
      },
    ]);

    addNotification(
      "وجبة مخصصة في السلة",
      `تمت إضافة ${quantity}x ${product.name} بالخيارات المختارة`,
      "promo",
    );
  };

  const handleIncrementItem = (cartItemId: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === cartItemId
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      ),
    );
  };

  const handleDecrementItem = (cartItemId: string) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id === cartItemId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  // Coupon handling
  const handleApplyCoupon = (
    code: string,
  ): { success: boolean; message: string } => {
    const coupon = availableCoupons.find(
      (c) => c.code.toUpperCase() === code.toUpperCase(),
    );
    if (!coupon) {
      return {
        success: false,
        message: "كود القسيمة غير صحيح أو منتهي الصلاحية",
      };
    }
    setAppliedCoupon(coupon);
    addNotification(
      "تم تطبيق الخصم",
      `تم تفعيل قسيمة الخصم: ${coupon.description}`,
      "promo",
    );
    return { success: true, message: `تم تفعيل خصم ${coupon.code} بنجاح!` };
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
  };

  // Intercept checkout if user is guest
  const handleRequireAuthForCheckout = () => {
    setCheckoutInterceptNotice(
      "🔔 لتأكيد طلبك وتحديد مكان التوصيل بمكتبك بدقة، يرجى تسجيل الدخول أو المتابعة بحساب Google.",
    );
    setIsAuthModalOpen(true);
  };

  const handleOrderCreated = async (newOrder: Order) => {
    const saved = await saveOrderToFirestore({
      ...newOrder,
      ...(user.coordinates && newOrder.ministry === user.ministry
        ? { coordinates: user.coordinates }
        : {}),
    });
    setOrders((prev) => [saved, ...prev.filter((o) => o.id !== saved.id)]);
    setCartItems([]);
    setAppliedCoupon(null);
    setIsCartOpen(false);
    setActiveTab("orders");
    addNotification(
      "تم حفظ طلبك بنجاح",
      `رقم الطلب ${saved.orderNumber} — بانتظار تأكيد المتجر.`,
      "order_update",
      saved.id,
    );
  };
  const handleUpdateOrderStatus = (id: string, status: OrderStatus) =>
    persist(
      updateOrderRecord(id, {
        orderStatus: status,
        ...(status === "delivered" &&
        orders.find((o) => o.id === id)?.paymentMethod === "cash"
          ? { paymentStatus: "paid" as const }
          : {}),
      }),
    );
  const handleUpdateOrderChecklist = (
    id: string,
    updates: Partial<CourierChecklist>,
    status?: OrderStatus,
  ) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const checklist = {
      receivedAndCheckedAtRestaurant: false,
      paidRestaurant: false,
      onTheWayToMinistry: false,
      arrivedAtCustomerOffice: false,
      collectedPayment: false,
      ...order.courierChecklist,
      ...updates,
    };
    return persist(
      updateOrderRecord(id, {
        courierChecklist: checklist,
        ...(status ? { orderStatus: status } : {}),
        ...(updates.collectedPayment && order.paymentMethod === "cash"
          ? { paymentStatus: "paid" as const }
          : {}),
      }),
    );
  };
  const handleAssignCourier = (orderId: string, courierId: string) => {
    const courier = staff.find(
      (s) => s.id === courierId && s.role === "courier",
    );
    if (!courier) return;
    return persist(
      updateOrderRecord(orderId, {
        courierId: courier.id,
        courierName: courier.name,
        courierPhone: courier.phone,
        orderStatus: "with_courier",
      }),
    );
  };
  const handleToggleProductStock = (id: string) => {
    const product = products.find((p) => p.id === id);
    if (product)
      return persist(
        saveRecord("products", id, { ...product, inStock: !product.inStock }),
      );
  };
  const handleUpdateProductPrice = (id: string, price: number) => {
    const product = products.find((p) => p.id === id);
    if (product)
      return persist(saveRecord("products", id, { ...product, price }));
  };
  const handleToggleStoreStatus = (id: string) => {
    const store = stores.find((s) => s.id === id);
    if (store)
      return persist(
        saveRecord("stores", id, {
          ...store,
          status: store.status === "open" ? "closed" : "open",
        }),
      );
  };
  const submitApplication = async (name: string, data: object) => {
    if (user.isGuest || !auth.currentUser) {
      setIsAuthModalOpen(true);
      throw new Error("سجّل الدخول أولاً لإرسال الطلب.");
    }
    await saveRecord(name, crypto.randomUUID(), {
      ...data,
      ownerId: user.id,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  };
  const handleAddPartnerApplication = (
    data: Omit<PartnerApplication, "id" | "status" | "createdAt">,
  ) => submitApplication("partnerApplications", data);
  const handleAddJobApplication = (
    data: Omit<JobApplication, "id" | "status" | "createdAt">,
  ) => submitApplication("jobApplications", data);
  const handleUpdatePartnerStatus = (id: string, status: ApplicationStatus) =>
    persist(saveRecord("partnerApplications", id, { status }));
  const handleUpdateJobStatus = (id: string, status: ApplicationStatus) =>
    persist(saveRecord("jobApplications", id, { status }));
  const handleApprovePartnerAsStore = (partner: PartnerApplication) =>
    persist(
      approvePartner(partner.id, {
        id: "partner-" + partner.id,
        name: partner.businessName,
        nameEn: partner.businessName,
        type: partner.partnerType,
        category: "sandwiches",
        logo: "🍽️",
        banner: "from-orange-600 to-slate-900",
        status: "closed",
        rating: 0,
        ratingCount: 0,
        deliveryTime: "يحدده المتجر",
        minOrder: 0,
        deliveryFee: 0,
        locationInDistrict: partner.locationInCapital,
      }),
    );
  // Filtered Products for Home
  const filteredProducts = products.filter((p) => {
    if (selectedStoreId && p.storeId !== selectedStoreId) return false;
    if (selectedCategory !== "الكل" && p.category !== selectedCategory)
      return false;
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
      o.orderStatus === "received" ||
      o.orderStatus === "preparing" ||
      o.orderStatus === "with_courier",
  ).length;

  // Voice recorder for Home Search Bar
  const searchVoiceRecorder = useVoiceRecorder((transcribedText) => {
    setSearchQuery(transcribedText);
    addNotification(
      "تم تحويل صوتك إلى نص بنجاح",
      `تم البحث عن: "${transcribedText}" عبر gemini-3.5-transcribe`,
      "system",
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
        onOpenOnboarding={undefined}
        onOpenMobileRelease={() => setIsMobileReleaseOpen(true)}
      />

      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-1.5 text-center text-xs font-bold">
          لا يوجد اتصال بالإنترنت. لا يمكن تأكيد طلب جديد حتى عودة الاتصال.
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
      {activeTab === "home" && (
        <main
          className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-5 flex-1"
          dir="rtl"
        >
          {/* Search Bar with Microphone Audio Transcription */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchVoiceRecorder.isRecording
                      ? "جاري الاستماع لصوتك... اضغط زر الإيقاف لتحويل الصوت لنص"
                      : searchVoiceRecorder.isTranscribing
                        ? "جارٍ تحويل الصوت إلى نص…"
                        : "ابحث كتابةً أو بالميكروفون عن فول هند، قهوة، شاورما..."
                  }
                  className="w-full py-2.5 sm:py-3 pr-10 pl-12 text-xs sm:text-sm bg-white border border-slate-200/90 rounded-2xl shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600 transition-all text-slate-900 font-medium"
                />
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
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
                    ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                    : searchVoiceRecorder.isTranscribing
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs"
                }`}
                title="البحث الصوتي بالميكروفون"
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
              <p className="text-[11px] text-rose-600 px-1">
                {searchVoiceRecorder.voiceError}
              </p>
            )}

            {/* Quick Bar: Multi-Turn Gemini Chatbot & Google Maps Grounding */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAiAssistantInitialTab("chat");
                  setIsAiAssistantOpen(true);
                }}
                className="p-2.5 sm:p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-between gap-2 transition-colors text-right shadow-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      مساعد الطلبات والاجتماعات
                    </p>
                    <p className="text-[10px] text-slate-300 truncate">
                      محادثة ذكية · طلب صوتي · ترشيح وجبات
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsLocationModalOpen(true);
                }}
                className="p-2.5 sm:p-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 flex items-center justify-between gap-2 transition-colors text-right shadow-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      دليل خرائط جوجل للوزارات
                    </p>
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
          {!products.length && (
            <p className="text-sm text-slate-700 bg-white border rounded-xl p-4">
              لا توجد أصناف متاحة بعد. سيظهر المنيو هنا بعد إضافة المتاجر
              والأصناف من لوحة التحكم.
            </p>
          )}

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
              onSelectStore={(id) =>
                setSelectedStoreId(id === selectedStoreId ? null : id)
              }
            />
          </div>

          {/* Popular Items Showcase */}
          {!selectedStoreId && selectedCategory === "الكل" && !searchQuery && (
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
                      const item = cartItems.find(
                        (i) => i.product.id === product.id,
                      );
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
                    : selectedCategory !== "الكل"
                      ? `أصناف ${selectedCategory}`
                      : "قائمة الوجبات والمنتجات الكاملة"}
                </span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {filteredProducts.length} صنف متاح
              </span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-500 text-sm">
                  لا توجد أصناف مطابقة لبحثك
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedStoreId(null);
                    setSelectedCategory("الكل");
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
                      const item = cartItems.find(
                        (i) => i.product.id === product.id,
                      );
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
      {activeTab === "orders" && (
        <OrdersView
          orders={orders}
          onReorder={(order) => {
            order.items.forEach((item) => handleAddToCart(item.product));
            setIsCartOpen(true);
          }}
        />
      )}

      {/* Tab: Courier Portal (Delivery Runner Workflow) */}
      {activeTab === "courier" && user.role === "courier" && (
        <CourierPortal
          orders={orders}
          courier={user}
          onAdvanceOrderStatus={handleUpdateOrderStatus}
          onUpdateOrderChecklist={handleUpdateOrderChecklist}
        />
      )}

      {/* Tab: Restaurant Portal (Kitchen Ticket Board & Menu Manager) */}
      {activeTab === "restaurant" && user.role === "restaurant" && (
        <RestaurantPortal
          onMarkReady={(id) =>
            persist(
              updateOrderRecord(id, { restaurantStatus: "ready_for_pickup" }),
            )
          }
          orders={orders}
          products={products}
          stores={stores}
          currentProfile={user}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onUpdateProductStock={(id, inStock) => {
            const product = products.find((p) => p.id === id);
            if (product)
              persist(saveRecord("products", id, { ...product, inStock }));
          }}
          onUpdateProductPrice={handleUpdateProductPrice}
          onAddProduct={(product) =>
            persist(saveRecord("products", product.id, product))
          }
          onToggleStoreStatus={handleToggleStoreStatus}
        />
      )}

      {/* Tab: Admin Dashboard */}
      {activeTab === "admin" && user.role === "admin" && (
        <>
          <AdminSetupPanel stores={stores} onError={reportError} />
          <AdminDashboard
            couriers={staff.filter((s) => s.role === "courier")}
            orders={orders}
            stores={stores}
            products={products}
            partnerApplications={partnerApplications}
            jobApplications={jobApplications}
            initialAdminTab={initialAdminTab}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onAssignCourier={handleAssignCourier}
            onToggleProductStock={handleToggleProductStock}
            onUpdateProductPrice={handleUpdateProductPrice}
            onToggleStoreStatus={handleToggleStoreStatus}
            onUpdatePartnerStatus={handleUpdatePartnerStatus}
            onApprovePartnerAsStore={handleApprovePartnerAsStore}
            onUpdateJobStatus={handleUpdateJobStatus}
            onOpenWebsitePage={(page) => {
              setWebsitePage(page);
              setIsWebsiteOpen(true);
            }}
          />
        </>
      )}

      {/* Tab: Profile View */}
      {activeTab === "profile" && (
        <ProfileView
          key={user.id}
          user={user}
          onUpdateProfile={async (u) => {
            await updateUserLocationInFirestore(
              user.id,
              u.ministry || "",
              u.floorNumber || "",
              u.roomNumber || "",
              u.fullName,
              u.phone,
            );
            setUser((prev) => ({
              ...prev,
              fullName: u.fullName,
              phone: u.phone,
              ministry: u.ministry,
              floorNumber: u.floorNumber,
              roomNumber: u.roomNumber,
            }));
          }}
          savedCoupons={availableCoupons}
          onSwitchToAdmin={() => {
            if (user.role === "admin") {
              setInitialAdminTab("orders");
              setActiveTab("admin");
            }
          }}
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
      {/* 1. Global Role & Mode Switcher Bar (Website vs Mobile App + Instant testing of all 4 roles) */}
      {!isWebsiteOpen && (
        <div
          className="bg-slate-950 text-white p-3 flex flex-wrap gap-4 items-center justify-center text-xs"
          dir="rtl"
        >
          <button onClick={() => setIsWebsiteOpen(true)}>الموقع الرئيسي</button>
          <span>{user.isGuest ? "زائر" : user.fullName}</span>
          <button onClick={() => setIsAuthModalOpen(true)}>
            {user.isGuest ? "تسجيل الدخول" : "الحساب والخروج"}
          </button>
          {user.role === "admin" && (
            <button
              onClick={() => {
                setActiveTab("admin");
                setIsSimulatorActive(false);
              }}
            >
              لوحة التحكم
            </button>
          )}
          {user.role === "courier" && (
            <button onClick={() => setActiveTab("courier")}>
              مهام التوصيل
            </button>
          )}
          {user.role === "restaurant" && (
            <button onClick={() => setActiveTab("restaurant")}>
              طلبات المطعم
            </button>
          )}
          <span>
            {cloudConnected
              ? "قاعدة البيانات متصلة"
              : "جارٍ الاتصال بقاعدة البيانات"}
          </span>
        </div>
      )}
      {cloudError && (
        <div
          role="alert"
          className="bg-red-50 text-red-800 p-3 text-sm flex justify-between gap-3"
          dir="rtl"
        >
          <span>تعذر إتمام العملية: {cloudError}</span>
          <button onClick={() => setCloudError("")}>إغلاق</button>
        </div>
      )}
      {/* 2. Official Corporate Website & Landing Page OR Mobile App Simulator */}
      {isWebsiteOpen ? (
        <CorporateWebsite
          stores={stores}
          products={products}
          partnerApplicationsCount={partnerApplications.length}
          jobApplicationsCount={jobApplications.length}
          initialPage={websitePage}
          onOpenMobileApp={() => {
            setIsWebsiteOpen(false);
            setIsSimulatorActive(false);
            setActiveTab("home");
          }}
          onOpenAdminCommittees={(tab) => {
            setIsWebsiteOpen(false);
            setIsSimulatorActive(false);
            if (user.role === "admin") {
              setInitialAdminTab(tab);
              setActiveTab("admin");
            } else {
              setActiveTab("profile");
              setIsAuthModalOpen(true);
            }
          }}
          onSubmitPartnerApplication={handleAddPartnerApplication}
          onSubmitJobApplication={handleAddJobApplication}
        />
      ) : (
        <MobileSimulatorFrame
          isSimulatorActive={isSimulatorActive}
          onToggleSimulator={() => setIsSimulatorActive(!isSimulatorActive)}
          onReplayOnboarding={() => setIsOnboardingOpen(true)}
          onReplaySplash={() => setIsSplashOpen(true)}
          splashScreen={
            isSplashOpen ? (
              <AppSplashScreen isOpen onFinish={() => setIsSplashOpen(false)} />
            ) : null
          }
        >
          {appContent}
        </MobileSimulatorFrame>
      )}

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
        stores={stores}
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
      {selectedProductForDetail && (
        <ProductDetailModal
          key={selectedProductForDetail.id}
          product={selectedProductForDetail}
          onClose={() => setSelectedProductForDetail(null)}
          onAddToCartWithOptions={handleAddToCartWithOptions}
        />
      )}

      {/* Ministry & Floor Location Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        user={user}
        onSaveLocation={async (
          ministry,
          floorNumber,
          roomNumber,
          coordinates,
        ) => {
          if (auth.currentUser)
            await updateUserLocationInFirestore(
              auth.currentUser.uid,
              ministry,
              floorNumber,
              roomNumber,
              undefined,
              undefined,
              coordinates,
            );
          setUser((prev) => ({
            ...prev,
            ministry,
            floorNumber,
            roomNumber,
            ...(coordinates ? { coordinates } : {}),
          }));
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
          if (newProfile.role === "courier") setActiveTab("courier");
          else if (newProfile.role === "restaurant") setActiveTab("restaurant");
          else if (newProfile.role === "admin") setActiveTab("admin");
          else setActiveTab("home");
        }}
        onLogout={() => {
          signOutFromFirebase().catch(() => {});
          setUser(DEFAULT_USER);
          setActiveTab("home");
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
            setActiveTab("orders");
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
            "تم تسجيل الدخول عبر Firebase بنجاح",
            `مرحباً بك ${newProfile.fullName} - تم ربط حسابك بقاعدة بيانات Firestore`,
            "system",
          );
        }}
      />
    </div>
  );
}
