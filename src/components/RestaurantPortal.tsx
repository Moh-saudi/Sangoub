import { cairoDay } from "../utils/orderIntegration";
import { KitchenDisplay } from "./KitchenDisplay";
import React, { useState, useMemo } from "react";
import {
  Store as StoreIcon,
  ChefHat,
  Clock,
  CheckCircle2,
  Phone,
  Plus,
  Edit2,
  DollarSign,
  TrendingUp,
  Package,
  Bike,
  Sparkles,
  AlertCircle,
  BookOpen,
  Navigation,
  Zap,
  Award,
  CreditCard,
  Wallet,
  Check,
  MapPin,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpRight,
  SlidersHorizontal,
  ChevronRight,
  Layers,
  Coins,
  SendHorizontal,
} from "lucide-react";
import type { Order, Product, Profile, Store, CourierRadarProfile } from "../types/index.ts";
import {
  formatEGP,
  calculateMerchantAccountingSummary,
  generateMerchantJournalEntries,
  calculateTopSellingProducts,
  rankCouriersForStore,
} from "../utils/orderCalculations.ts";
import { SmartImage } from "./SmartImage.tsx";

interface RestaurantPortalProps {
  connected: boolean;
  onKitchenChange: (id: string, storeId: string, stage: "preparing" | "ready") => Promise<void>;
  currentProfile: Profile;
  stores: Store[];
  products: Product[];
  orders: Order[];
  couriers?: Array<{
    id: string;
    name: string;
    phone: string;
    rating?: number;
    avgDeliveryMinutes?: number;
    coordinates?: { latitude: number; longitude: number };
    status?: "available" | "busy" | "offline";
  }>;
  onUpdateOrderStatus: (orderId: string, status: Order["orderStatus"]) => void;
  onUpdateProductStock: (productId: string, inStock: boolean) => void;
  onUpdateProductPrice: (productId: string, newPrice: number) => void;
  onAddProduct: (product: Product) => Promise<void>;
  onToggleStoreStatus: (storeId: string) => void;
}

export const RestaurantPortal: React.FC<RestaurantPortalProps> = ({
  currentProfile,
  stores,
  products,
  orders,
  couriers,
  connected,
  onKitchenChange,
  onUpdateOrderStatus,
  onUpdateProductStock,
  onUpdateProductPrice,
  onAddProduct,
  onToggleStoreStatus,
}) => {
  const userStore = stores.find((s) => s.id === currentProfile.storeId) || stores[0];

  const [activeTab, setActiveTab] = useState<"kitchen" | "menu" | "accounting" | "radar">("kitchen");

  // New item modal state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState(0);
  const [newItemCost, setNewItemCost] = useState(0);
  const [menuError, setMenuError] = useState("");
  const [menuBusy, setMenuBusy] = useState(false);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<
    "فطور" | "سندوتشات" | "مشروبات" | "وجبات خفيفة"
  >("فطور");
  const [newItemImage, setNewItemImage] = useState("");

  // Product filter and search
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Inline price editing
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  const [priceSuccessId, setPriceSuccessId] = useState<string | null>(null);

  // Filter orders for this store
  const storeOrders = orders.filter(
    (o) =>
      o.storeIds?.includes(userStore?.id || "") ||
      o.items?.some((i) => i.product.storeId === userStore?.id)
  );

  const activeKitchenOrders = storeOrders.filter(
    (o) => o.orderStatus === "received" || o.orderStatus === "preparing"
  );

  const storeProducts = products.filter((p) => p.storeId === userStore?.id && !p.archived);

  const filteredProducts = useMemo(() => {
    return storeProducts.filter((p) => {
      const matchCat = selectedCategory === "all" || p.category === selectedCategory;
      const matchQuery =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.toLowerCase().trim()) ||
        p.description?.toLowerCase().includes(productSearch.toLowerCase().trim());
      return matchCat && matchQuery;
    });
  }, [storeProducts, selectedCategory, productSearch]);

  // Accounting and Financial Computations
  const accountingSummary = useMemo(() => {
    return calculateMerchantAccountingSummary(orders, userStore?.id || "", 0.10);
  }, [orders, userStore?.id]);

  const journalEntries = useMemo(() => {
    return generateMerchantJournalEntries(orders, userStore?.id || "", 0.10);
  }, [orders, userStore?.id]);

  const topSellingItems = useMemo(() => {
    return calculateTopSellingProducts(orders, userStore?.id || "", 6);
  }, [orders, userStore?.id]);

  // Couriers Radar computation
  const defaultCouriersList = useMemo(() => {
    if (couriers && couriers.length > 0) return couriers;
    return [
      {
        id: "c-101",
        name: "كابتن سيف الدين الشريف",
        phone: "01091234567",
        rating: 4.96,
        avgDeliveryMinutes: 9, // الأسرع
        status: "available" as const,
        coordinates: { latitude: 30.0145, longitude: 31.7352 },
      },
      {
        id: "c-102",
        name: "كابتن إبراهيم دسوقي",
        phone: "01123456789",
        rating: 4.88,
        avgDeliveryMinutes: 14,
        status: "available" as const,
        coordinates: { latitude: 30.0160, longitude: 31.7380 },
      },
      {
        id: "c-103",
        name: "كابتن عمر الورداني",
        phone: "01555667788",
        rating: 4.92,
        avgDeliveryMinutes: 11,
        status: "available" as const,
        coordinates: { latitude: 30.0120, longitude: 31.7330 },
      },
      {
        id: "c-104",
        name: "كابتن محمود رجب",
        phone: "01234567890",
        rating: 4.82,
        avgDeliveryMinutes: 18,
        status: "busy" as const,
        coordinates: { latitude: 30.0210, longitude: 31.7410 },
      },
    ];
  }, [couriers]);

  const storeLocation = userStore?.coordinates || { latitude: 30.0131, longitude: 31.7346 };
  const rankedCouriers = useMemo(() => {
    return rankCouriersForStore(storeLocation, defaultCouriersList);
  }, [storeLocation, defaultCouriersList]);

  const handleSavePrice = (productId: string) => {
    if (tempPrice > 0) {
      onUpdateProductPrice(productId, tempPrice);
      setPriceSuccessId(productId);
      setEditingPriceId(null);
      setTimeout(() => setPriceSuccessId(null), 2500);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userStore) return;
    if (!newItemName.trim()) return;

    if (!newItemImage.startsWith("https://") || !newItemDesc.trim() || newItemPrice <= 0) {
      setMenuError("يرجى إدخال اسم ووصف وسعر صحيح مع رابط صورة HTTPS.");
      return;
    }
    const newProd: Product = {
      id: crypto.randomUUID(),
      storeId: userStore.id,
      storeName: userStore.name,
      name: newItemName,
      description: newItemDesc,
      price: Number(newItemPrice),
      category: newItemCategory,
      imageType: "foul",
      imageUrl: newItemImage,
      inStock: true,
      badge: "جديد بالمنيو",
    };

    setMenuBusy(true);
    setMenuError("");
    try {
      await onAddProduct(newProd);
    } catch (error) {
      setMenuError((error as Error).message);
      return;
    } finally {
      setMenuBusy(false);
    }
    setIsAddingItem(false);
    setNewItemName("");
    setNewItemDesc("");
    setNewItemPrice(0);
    setNewItemCost(0);
    setNewItemImage("");
  };

  if (!userStore) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8 text-center" dir="rtl">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-8 rounded-3xl shadow-sm max-w-md">
          <StoreIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">لم يُربط حسابك بمتجر تشغيل</h3>
          <p className="text-xs text-slate-500 mt-1">اطلب من الإدارة ربط حسابك بالمتجر لبدء استقبال الطلبات وإدارة المبيعات.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 text-xs font-['Cairo',-apple-system,BlinkMacSystemFont,sans-serif]" dir="rtl">
      {/* Compact Enterprise Header matching Image 3 & 4 style */}
      <header className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Brand Info & Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
              <span className="text-2xl select-none">{userStore.logo || "🥘"}</span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-bold">
                  بوابة الشريك والتاجر
                </span>

                <button
                  onClick={() => onToggleStoreStatus(userStore.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    userStore.status === "open"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                  }`}
                >
                  <span
                    className={`inline-block rounded-full w-2 h-2 ${
                      userStore.status === "open" ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  <span>{userStore.status === "open" ? "يستقبل طلبات حية" : "مغلق مؤقتاً"}</span>
                </button>
              </div>

              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1">
                {userStore.name}
              </h1>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <MapPin size={12} className="text-slate-400" />
                <span>{userStore.locationInDistrict}</span>
                <span className="text-slate-300">•</span>
                <span>المشرف: {currentProfile.fullName}</span>
              </p>
            </div>
          </div>

          {/* Clean Segmented Navigation Tabs */}
          <nav
            aria-label="أقسام لوحة التحكم"
            className="bg-slate-100 p-1 rounded-xl border border-slate-200 inline-flex flex-wrap items-center gap-1 self-start md:self-center"
          >
            <button
              onClick={() => setActiveTab("kitchen")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "kitchen"
                  ? "bg-white text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-950 hover:bg-white/50"
              }`}
            >
              <ChefHat size={14} className={activeTab === "kitchen" ? "text-orange-600" : "text-slate-400"} />
              <span>تذاكر المطبخ</span>
              {activeKitchenOrders.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-orange-600 text-white">
                  {activeKitchenOrders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("menu")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "menu"
                  ? "bg-white text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-950 hover:bg-white/50"
              }`}
            >
              <Package size={14} className={activeTab === "menu" ? "text-indigo-600" : "text-slate-400"} />
              <span>المنتجات والأسعار</span>
            </button>

            <button
              onClick={() => setActiveTab("accounting")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "accounting"
                  ? "bg-white text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-950 hover:bg-white/50"
              }`}
            >
              <BookOpen size={14} className={activeTab === "accounting" ? "text-emerald-600" : "text-slate-400"} />
              <span>الحسابات والقيود</span>
            </button>

            <button
              onClick={() => setActiveTab("radar")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "radar"
                  ? "bg-white text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-950 hover:bg-white/50"
              }`}
            >
              <Navigation size={14} className={activeTab === "radar" ? "text-purple-600" : "text-slate-400"} />
              <span>رادار المناديب</span>
            </button>
          </nav>
        </div>

        {/* Compact KPI Metric Cards (Image 3 Style: 4 Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي المبيعات</span>
              <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                {formatEGP(accountingSummary.grossSales)}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <DollarSign size={18} />
            </div>
          </div>

          <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">طلبات قيد التجهيز</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-black text-orange-600">{activeKitchenOrders.length}</span>
                <span className="text-[10px] text-slate-400 font-bold">تذكرة حالية</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <ChefHat size={18} />
            </div>
          </div>

          <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">صافي أرباح التاجر</span>
              <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                {formatEGP(accountingSummary.netPayout)}
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Wallet size={18} />
            </div>
          </div>

          <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">تقييم الخدمة</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-black text-slate-900">★ {userStore.rating}</span>
                <span className="text-[10px] text-slate-400">({userStore.ratingCount} تقييم)</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Award size={18} />
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {menuError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in duration-200">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{menuError}</span>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          1. تبويب تذاكر المطبخ واستقبال الطلبات
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "kitchen" && (
        <section aria-label="شاشة تذاكر المطبخ الحية">
          <KitchenDisplay
            orders={orders}
            stores={stores}
            fixedStoreId={userStore.id}
            connected={connected}
            onChange={onKitchenChange}
          />
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          2. تبويب إدارة أصناف المنيو وتحديث الأسعار (APPLE TABLE + MATERIAL YOU)
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "menu" && (
        <section className="space-y-5" aria-label="إدارة أصناف المنيو وتحديث الأسعار">
          {/* Header Controls */}
          <div className="bg-white/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">أصناف وقائمة أسعار {userStore.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديث فوري لأسعار البيع، تفعيل أو إيقاف توفر المنتجات بالمطبخ فوراً لموظفي العاصمة.
              </p>
            </div>

            <button
              onClick={() => setIsAddingItem(true)}
              className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Plus size={16} />
              <span>إضافة صنف جديد</span>
            </button>
          </div>

          {/* Search & Category Filter Pills */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث عن وجبة أو صنف..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 text-xs bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 self-start sm:self-auto text-xs font-bold">
              {["all", "فطور", "سندوتشات", "مشروبات", "وجبات خفيفة"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl transition-all ${
                    selectedCategory === cat
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {cat === "all" ? "جميع الأصناف" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* New Item Modal / Card Form */}
          {isAddingItem && (
            <form
              onSubmit={handleCreateProduct}
              className="bg-white/95 backdrop-blur-2xl border-2 border-orange-500/30 rounded-3xl p-6 shadow-xl space-y-4 animate-in slide-in-from-top-4 duration-200"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="text-orange-500" size={16} />
                  إضافة صنف جديد لمنيو {userStore.name}
                </h4>
                <span className="text-[10px] text-slate-400 font-bold">سيظهر الصنف فورياً في تطبيق العملاء</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">اسم الصنف:</label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="مثال: سندوتش بيض بالبسطرمة"
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">سعر البيع (ج.م):</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newItemPrice || ""}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    placeholder="سعر البيع"
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">التكلفة (ج.م):</label>
                  <input
                    type="number"
                    min={0}
                    value={newItemCost || ""}
                    onChange={(e) => setNewItemCost(Number(e.target.value))}
                    placeholder="التكلفة الداخلية"
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">القسم:</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:bg-white"
                  >
                    <option value="فطور">فطور</option>
                    <option value="سندوتشات">سندوتشات</option>
                    <option value="مشروبات">مشروبات</option>
                    <option value="وجبات خفيفة">وجبات خفيفة</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الوصف والمكونات:</label>
                <input
                  type="text"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="مكونات الوجبة وطريقة التحضير بدقة..."
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">رابط صورة الوجبة (HTTPS Image Link):</label>
                <input
                  type="url"
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingItem(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  disabled={menuBusy}
                  type="submit"
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-xl shadow-md transition active:scale-95 disabled:opacity-50"
                >
                  {menuBusy ? "جارٍ الحفظ والرفع..." : "حفظ ونشر بالمنيو"}
                </button>
              </div>
            </form>
          )}

          {/* Product Items Cards (Apple Minimalist Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-[0_4px_16px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgb(0,0,0,0.07)] transition-all flex flex-col justify-between"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-slate-100 bg-slate-50">
                    <SmartImage
                      src={prod.imageUrl}
                      alt={prod.name}
                      fallbackType={prod.imageType}
                      aspectRatio="aspect-square"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-sm font-black text-slate-900 truncate">{prod.name}</h4>
                      <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md shrink-0">
                        {prod.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {prod.description || "لا يوجد وصف مدخل لهذا الصنف"}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 space-y-2.5">
                  {/* Inline Price Editing with Apple Stepper / Tag Style */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-bold">سعر البيع الحالي:</span>
                    {editingPriceId === prod.id ? (
                      <div className="flex items-center gap-1.5 animate-in zoom-in-95 duration-150">
                        <input
                          type="number"
                          min={1}
                          value={tempPrice}
                          onChange={(e) => setTempPrice(Number(e.target.value))}
                          className="w-20 px-2 py-1 text-xs font-black border-2 border-orange-500 rounded-xl text-slate-900 bg-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSavePrice(prod.id)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition"
                          title="حفظ السعر"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-base">
                          {formatEGP(prod.price)}
                        </span>
                        <button
                          onClick={() => {
                            setEditingPriceId(prod.id);
                            setTempPrice(prod.price);
                          }}
                          className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-orange-50 text-slate-400 hover:text-orange-600 flex items-center justify-center transition"
                          title="تعديل السعر المباشر"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {priceSuccessId === prod.id && (
                    <p className="text-[10px] text-emerald-600 font-bold text-center bg-emerald-50 py-1 rounded-lg animate-in fade-in">
                      ✓ تم حفظ السعر الجديد وتحديثه في الكتالوج
                    </p>
                  )}

                  {/* Stock Availability Toggle (iOS Switch Style) */}
                  <button
                    onClick={() => onUpdateProductStock(prod.id, !prod.inStock)}
                    className={`w-full py-2 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      prod.inStock
                        ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 hover:bg-emerald-500/20"
                        : "bg-rose-500/10 text-rose-800 border border-rose-500/20 hover:bg-rose-500/20"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${prod.inStock ? "bg-emerald-600" : "bg-rose-600"}`}
                    />
                    <span>{prod.inStock ? "الصنف متاح للطلب بالمطبخ" : "الصنف غير متوفر حالياً"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          3. تبويب الحسابات والقيود والتحصيل (APPLE WALLET + GOOGLE FINANCE)
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "accounting" && (
        <section className="space-y-6" aria-label="الحسابات والقيود المحاسبية">
          {/* Apple Card Style Titanium Master Balance Card */}
          <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-slate-800 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-500/10 via-teal-400/5 to-transparent rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-xs uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  محفظة ومستحقات المتجر
                </span>
                <p className="text-xs text-slate-400 mt-3">الصافي الجاهز للتحويل لحساب التاجر البنكي</p>
                <h3 className="text-3xl sm:text-4xl font-black text-white font-mono mt-1 tracking-tight">
                  {formatEGP(accountingSummary.netPayout)}
                </h3>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  بعد خصم عمولة المنصة (10%) وحساب الضرائب المقررة
                </span>
              </div>

              {/* Sub-metrics */}
              <div className="grid grid-cols-2 gap-3 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <div>
                  <span className="text-[11px] text-slate-400 block font-bold">إجمالي المبيعات</span>
                  <span className="text-base font-black font-mono text-white mt-0.5 block">
                    {formatEGP(accountingSummary.grossSales)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-bold">عمولة المنصة</span>
                  <span className="text-base font-black font-mono text-rose-300 mt-0.5 block">
                    - {formatEGP(accountingSummary.platformCommission)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Collection Channels (Google Material 3 Tonal Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 block">تحصيل كاش (عهدة المناديب)</span>
                <h4 className="text-xl font-black text-amber-600 font-mono mt-1">
                  {formatEGP(accountingSummary.byPaymentMethod.cash)}
                </h4>
                <span className="text-[10px] text-slate-400">مبالغ نقدية محصلة يدوياً</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Coins size={22} />
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 block">تحصيل شبكة وبطاقات (Geidea)</span>
                <h4 className="text-xl font-black text-purple-600 font-mono mt-1">
                  {formatEGP(accountingSummary.byPaymentMethod.geidea)}
                </h4>
                <span className="text-[10px] text-slate-400">مدفوعات إلكترونية مباشرة</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <CreditCard size={22} />
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 block">تحصيل إنستاباي ومحفظة</span>
                <h4 className="text-xl font-black text-blue-600 font-mono mt-1">
                  {formatEGP(accountingSummary.byPaymentMethod.instapay)}
                </h4>
                <span className="text-[10px] text-slate-400">تحويلات بنكية ومحافظ رقمية</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Wallet size={22} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Selling Items (Apple Health Style Progress Bar) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <Award className="text-amber-500" size={18} />
                  أكثر الأصناف مبيعاً
                </h4>
                <span className="text-[11px] text-slate-400 font-bold">إجمالي الحجم</span>
              </div>

              {topSellingItems.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10">لا توجد مبيعات مكتملة بعد لتوليد الإحصائية</p>
              ) : (
                <div className="space-y-4">
                  {topSellingItems.map((item, idx) => (
                    <div key={item.productId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-slate-800">
                          {idx + 1}. {item.name}
                        </span>
                        <span className="font-mono font-bold text-slate-900">{formatEGP(item.totalRevenue)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(8, item.percentageShare)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                        <span>{item.soldQuantity} طلب تم تسليمه</span>
                        <span>{item.percentageShare}% من المبيعات</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Double-Entry Accounting Ledger (Google Workspace / Stripe Clean Design) */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <BookOpen className="text-indigo-600" size={18} />
                  دفتر القيود المحاسبية اليومية (Double-Entry Ledger)
                </h4>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full">
                  ترحيل آلي معتمد
                </span>
              </div>

              {journalEntries.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10">تُسجل القيود اليومية آلياً فور تسليم أي طلب</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="p-3">رقم القيد</th>
                        <th className="p-3">الطلب</th>
                        <th className="p-3">مدين (من حـ/)</th>
                        <th className="p-3">دائن (إلى حـ/)</th>
                        <th className="p-3">المبلغ</th>
                        <th className="p-3">البيان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {journalEntries.slice(0, 8).map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-indigo-600">{entry.id}</td>
                          <td className="p-3 font-mono text-slate-700 font-semibold">{entry.orderNumber}</td>
                          <td className="p-3 text-emerald-700 font-bold">{entry.debitAccount}</td>
                          <td className="p-3 text-rose-700 font-bold">{entry.creditAccount}</td>
                          <td className="p-3 font-mono font-black text-slate-900">{formatEGP(entry.amount)}</td>
                          <td className="p-3 text-slate-500 text-[11px]">{entry.statement}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          4. تبويب رادار المناديب الأقرب والأسرع (APPLE FIND MY + RADAR PULSE)
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "radar" && (
        <section
          className="bg-slate-950 text-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-slate-800 space-y-6 relative overflow-hidden"
          aria-label="رادار المناديب الأقرب والأسرع"
        >
          {/* Subtle Radar Ring Waves in background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-slate-800/40 rounded-full pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-slate-800/60 rounded-full pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-emerald-500/10 rounded-full pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-[11px] bg-emerald-500/10 text-emerald-400 font-bold px-3 py-1 rounded-full border border-emerald-500/20">
                  نظام التتبع والرادار الميداني الحي
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-2 flex items-center gap-2 tracking-tight">
                <Navigation size={22} className="text-orange-500 animate-pulse" />
                رادار مناديب التوصيل المحيطين بالمتجر
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                فرز دقيق للمناديب حسب المسافة الحقيقية بالكيلومتر من موقع المتجر مع تمييز الكابتن الأسرع
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/90 px-3.5 py-2 rounded-2xl border border-slate-800 text-xs">
              <MapPin size={14} className="text-rose-400" />
              <span>موقع الفرع: {userStore.locationInDistrict}</span>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            {rankedCouriers.map((courier) => (
              <div
                key={courier.id}
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                  courier.isFastest
                    ? "bg-slate-900/90 border-amber-500/60 ring-2 ring-amber-500/20 shadow-xl"
                    : "bg-slate-900/40 border-slate-800 hover:bg-slate-900/80"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-13 h-13 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <Bike size={22} className="text-orange-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-black text-sm text-white tracking-tight">{courier.name}</h5>
                        {courier.isFastest && (
                          <span className="bg-amber-400/20 text-amber-300 text-[10px] px-2.5 py-0.5 rounded-full font-black border border-amber-400/40 flex items-center gap-1 shadow-xs">
                            <Zap size={10} className="fill-amber-300" /> المندوب الأسرع
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 font-medium">
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <MapPin size={12} /> يبعد {courier.distanceKm} كم
                        </span>
                        <span>★ {courier.rating}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-base font-mono font-black text-amber-300 block">
                      ~ {courier.avgDeliveryMinutes} د
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">زمن الوصول</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5 pt-3.5 border-t border-slate-800/80">
                  <a
                    href={`tel:${courier.phone}`}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <Phone size={13} /> اتصال ({courier.phone})
                  </a>
                  <button
                    onClick={() => {
                      alert(`تم إرسال إشعار فوري لاستدعاء الكابتن ${courier.name} للفرع`);
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow-md"
                  >
                    <ShieldCheck size={14} /> استدعاء للفرع
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

