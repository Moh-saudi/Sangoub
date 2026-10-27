import { cairoDay } from "../utils/orderIntegration";
import { KitchenDisplay } from "./KitchenDisplay";
import React, { useState, useMemo } from "react";
import {
  Store as StoreIcon,
  ChefHat,
  Clock,
  CheckCircle2,
  Phone,
  Flame,
  Plus,
  Edit2,
  DollarSign,
  TrendingUp,
  Package,
  Bike,
  Sparkles,
  ToggleLeft,
  ToggleRight,
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
  Percent,
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
  // Determine current active store
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

  // Inline price editing
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  const [priceSuccessId, setPriceSuccessId] = useState<string | null>(null);

  // Filter orders for this store
  const storeOrders = orders.filter((o) =>
    o.storeIds?.includes(userStore?.id || "") ||
    o.items?.some((i) => i.product.storeId === userStore?.id)
  );

  const activeKitchenOrders = storeOrders.filter(
    (o) => o.orderStatus === "received" || o.orderStatus === "preparing"
  );

  const readyForPickupOrders = storeOrders.filter((o) => o.orderStatus === "ready");

  const storeProducts = products.filter((p) => p.storeId === userStore?.id && !p.archived);

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
        rating: 4.95,
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
        name: "كابتن محمود رجب",
        phone: "01234567890",
        rating: 4.82,
        avgDeliveryMinutes: 18,
        status: "busy" as const,
        coordinates: { latitude: 30.0210, longitude: 31.7410 },
      },
      {
        id: "c-104",
        name: "كابتن عمر الورداني",
        phone: "01555667788",
        rating: 4.90,
        avgDeliveryMinutes: 12,
        status: "available" as const,
        coordinates: { latitude: 30.0120, longitude: 31.7330 },
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
      setTimeout(() => setPriceSuccessId(null), 2000);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userStore) return;
    if (!newItemName.trim()) return;

    if (!newItemImage.startsWith("https://") || !newItemDesc.trim() || newItemPrice <= 0) {
      setMenuError("أدخل وصفًا وسعرًا ورابط صورة HTTPS حقيقيًا للصنف.");
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
      <p className="p-8 text-center text-sm font-bold text-slate-700" dir="rtl">
        لم يُربط حسابك بمتجر تشغيل. اطلب من المدير تعيين المتجر الصحيح.
      </p>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-5" dir="rtl">
      {menuError && (
        <p role="alert" className="p-3 rounded-xl text-red-700 bg-red-50 text-xs font-bold">
          {menuError}
        </p>
      )}

      {/* Store Banner & Quick Stats */}
      <div className="bg-gradient-to-r from-amber-700 via-orange-800 to-amber-950 text-white rounded-3xl p-5 shadow-lg border border-amber-600/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl shadow-inner shrink-0">
              {userStore.logo || "🥘"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold border border-amber-400/30">
                  لوحة تحكم التاجر وشيف المطعم
                </span>
                <button
                  onClick={() => onToggleStoreStatus(userStore.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      userStore.status === "open" ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                    }`}
                  />
                  <span>{userStore.status === "open" ? "المطبخ يستقبل طلبات" : "المطبخ مشغول مؤقتاً"}</span>
                </button>
              </div>
              <h2 className="text-xl font-black text-white mt-1">{userStore.name}</h2>
              <p className="text-xs text-amber-100/90 mt-0.5">
                {userStore.locationInDistrict} • مسؤول الفرع: {currentProfile.fullName}
              </p>
            </div>
          </div>

          {/* تبويبات لوحة التحكم */}
          <div className="flex flex-wrap items-center gap-1.5 bg-black/30 p-1.5 rounded-2xl border border-white/10 text-xs font-bold">
            <button
              onClick={() => setActiveTab("kitchen")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "kitchen" ? "bg-amber-500 text-white shadow-md" : "text-white/80 hover:text-white"
              }`}
            >
              <ChefHat size={14} />
              <span>تذاكر الطلبات ({activeKitchenOrders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("menu")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "menu" ? "bg-amber-500 text-white shadow-md" : "text-white/80 hover:text-white"
              }`}
            >
              <Package size={14} />
              <span>المنتجات والأسعار ({storeProducts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("accounting")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "accounting" ? "bg-amber-500 text-white shadow-md" : "text-white/80 hover:text-white"
              }`}
            >
              <BookOpen size={14} />
              <span>الحسابات والقيود</span>
            </button>
            <button
              onClick={() => setActiveTab("radar")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "radar" ? "bg-amber-500 text-white shadow-md" : "text-white/80 hover:text-white"
              }`}
            >
              <Navigation size={14} />
              <span>رادار المناديب</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">إجمالي مبيعات المتجر</span>
            <span className="text-xl font-black text-white">{formatEGP(accountingSummary.grossSales)}</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">طلبات قيد التحضير</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-300">{activeKitchenOrders.length}</span>
              <span className="text-[11px] text-amber-200">طلب</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">صافي أرباح التاجر</span>
            <span className="text-xl font-black text-emerald-300 font-mono">{formatEGP(accountingSummary.netPayout)}</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">تقييم المتجر</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-300">★ {userStore.rating}</span>
              <span className="text-[11px] text-amber-200">({userStore.ratingCount} تقييم)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          1. تبويب تذاكر المطبخ واستقبال الطلبات
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "kitchen" && (
        <KitchenDisplay
          orders={orders}
          stores={stores}
          fixedStoreId={userStore.id}
          connected={connected}
          onChange={onKitchenChange}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          2. تبويب إدارة أصناف المنيو وتحديث الأسعار
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "menu" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">أصناف وقائمة أسعار {userStore.name}</h3>
              <p className="text-xs text-slate-500">
                يمكنك تحديث سعر بيع أي صنف فورياً، وتفعيل أو إيقاف توفر المنتج بالمطبخ
              </p>
            </div>
            <button
              onClick={() => setIsAddingItem(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة صنف جديد</span>
            </button>
          </div>

          {/* إضافة صنف جديد */}
          {isAddingItem && (
            <form onSubmit={handleCreateProduct} className="bg-amber-50/70 border border-amber-300 rounded-3xl p-5 space-y-3">
              <h4 className="text-sm font-black text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                إضافة وجبة أو صنف جديد للقائمة
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">اسم الصنف:</label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="مثال: سندوتش شاورما مخصوص"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
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
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">سعر التكلفة (ج.م):</label>
                  <input
                    type="number"
                    min={0}
                    value={newItemCost || ""}
                    onChange={(e) => setNewItemCost(Number(e.target.value))}
                    placeholder="التكلفة الداخلية"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">القسم:</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
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
                  placeholder="مكونات الوجبة وطريقة التحضير..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">رابط صورة الوجبة (HTTPS Photo):</label>
                <input
                  type="url"
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingItem(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  disabled={menuBusy}
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-xs"
                >
                  حفظ ونشر بالمنيو
                </button>
              </div>
            </form>
          )}

          {/* شبكة المنتجات وتعديل الأسعار */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {storeProducts.map((prod) => (
              <div
                key={prod.id}
                className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3 shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-100 bg-slate-50">
                    <SmartImage
                      src={prod.imageUrl}
                      alt={prod.name}
                      fallbackType={prod.imageType}
                      aspectRatio="aspect-square"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-black text-slate-900 truncate">{prod.name}</h5>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                      {prod.category}
                    </span>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{prod.description}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  {/* تعديل السعر المباشر */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-bold">سعر البيع:</span>
                    {editingPriceId === prod.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          value={tempPrice}
                          onChange={(e) => setTempPrice(Number(e.target.value))}
                          className="w-20 px-2 py-1 text-xs font-black border-2 border-amber-500 rounded-lg text-slate-900 bg-white"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSavePrice(prod.id)}
                          className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          title="حفظ السعر الجديد"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-sm">
                          {formatEGP(prod.price)}
                        </span>
                        <button
                          onClick={() => {
                            setEditingPriceId(prod.id);
                            setTempPrice(prod.price);
                          }}
                          className="text-slate-400 hover:text-amber-700 p-1"
                          title="تعديل السعر"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {priceSuccessId === prod.id && (
                    <p className="text-[10px] text-emerald-600 font-bold text-center">✓ تم حفظ وتحديث السعر الجديد</p>
                  )}

                  {/* تبديل حالة التوفر */}
                  <button
                    onClick={() => onUpdateProductStock(prod.id, !prod.inStock)}
                    className={`w-full py-1.5 rounded-xl text-xs font-black transition-colors ${
                      prod.inStock
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                    }`}
                  >
                    {prod.inStock ? "الصنف متاح للطلب بالمطبخ ✓" : "الصنف غير متوفر حالياً ✕"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          3. تبويب الحسابات والقيود المحاسبية وأنواع التحصيل وأكثر الأصناف مبيعاً
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "accounting" && (
        <div className="space-y-6">
          {/* كروت التحصيل والمالية */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">إجمالي المبيعات المسلمة</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <DollarSign size={18} />
                </div>
              </div>
              <h4 className="text-xl font-black text-slate-900 font-mono">{formatEGP(accountingSummary.grossSales)}</h4>
              <span className="text-[10px] text-slate-400">{accountingSummary.ordersCount} طلب مكتمل ومسلم</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">تحصيل كاش (عهدة المناديب)</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <DollarSign size={18} />
                </div>
              </div>
              <h4 className="text-xl font-black text-amber-600 font-mono">
                {formatEGP(accountingSummary.byPaymentMethod.cash)}
              </h4>
              <span className="text-[10px] text-slate-400">مبالغ مسددة نقداً مع الكابتن</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">تحصيل إلكتروني (بطاقات / إنستاباي)</span>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <CreditCard size={18} />
                </div>
              </div>
              <h4 className="text-xl font-black text-purple-600 font-mono">
                {formatEGP(accountingSummary.byPaymentMethod.geidea + accountingSummary.byPaymentMethod.instapay)}
              </h4>
              <span className="text-[10px] text-slate-400">Geidea + InstaPay</span>
            </div>

            <div className="bg-gradient-to-br from-emerald-800 to-teal-950 text-white p-4 rounded-3xl shadow-md border border-emerald-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-300">صافي المستحق للتاجر</span>
                <div className="p-2 bg-white/10 rounded-xl">
                  <Wallet size={18} className="text-emerald-300" />
                </div>
              </div>
              <h4 className="text-xl font-black text-white font-mono">{formatEGP(accountingSummary.netPayout)}</h4>
              <span className="text-[10px] text-emerald-300/80">بعد خصم عمولة المنصة 10%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* جدول أكثر الأصناف مبيعاً */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                  <Award className="text-amber-500" size={18} />
                  أكثر الأصناف مبيعاً
                </h4>
                <span className="text-[11px] text-slate-400 font-bold">حسب الحجم</span>
              </div>

              {topSellingItems.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">لا توجد مبيعات مكتملة بعد لحساب الأصناف الأكثر طلباً</p>
              ) : (
                <div className="space-y-3">
                  {topSellingItems.map((item, idx) => (
                    <div key={item.productId} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-black text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-black text-slate-900 leading-tight">{item.name}</p>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {item.soldQuantity} طلب • {item.percentageShare}% من الإيراد
                          </span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-xs text-emerald-700">
                        {formatEGP(item.totalRevenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* دفتر القيود المحاسبية المزدوجة */}
            <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="text-indigo-600" size={18} />
                  دفتر القيود المحاسبية اليومية (Double-Entry Ledger)
                </h4>
                <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2.5 py-0.5 rounded-full">
                  قيود مبيعات آلية
                </span>
              </div>

              {journalEntries.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">تُسجل القيود المحاسبية تلقائياً فور تأكيد تسليم كل طلب</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-black">
                        <th className="p-2.5 rounded-r-xl">رقم القيد</th>
                        <th className="p-2.5">الطلب</th>
                        <th className="p-2.5">مدين (من حـ/)</th>
                        <th className="p-2.5">دائن (إلى حـ/)</th>
                        <th className="p-2.5">المبلغ</th>
                        <th className="p-2.5 rounded-l-xl">البيان وطريقة التحصيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {journalEntries.slice(0, 10).map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50 transition">
                          <td className="p-2.5 font-mono font-bold text-indigo-700">{entry.id}</td>
                          <td className="p-2.5 font-mono text-slate-600">{entry.orderNumber}</td>
                          <td className="p-2.5 text-emerald-700 font-medium">{entry.debitAccount}</td>
                          <td className="p-2.5 text-rose-700 font-medium">{entry.creditAccount}</td>
                          <td className="p-2.5 font-mono font-black text-slate-900">{formatEGP(entry.amount)}</td>
                          <td className="p-2.5 text-slate-500 text-[11px]">{entry.statement}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          4. تبويب رادار المناديب الأقرب والمندوب الأسرع طبقاً للخريطة
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "radar" && (
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-[10px] bg-orange-500/20 text-orange-400 font-bold px-2.5 py-0.5 rounded-full border border-orange-500/30">
                خوارزمية المسافة والسرعة التلقائية
              </span>
              <h3 className="text-xl font-black text-white mt-1.5 flex items-center gap-2">
                <Navigation size={22} className="text-orange-500 animate-pulse" />
                رادار مناديب التوصيل المحيطين بالمتجر
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                يتم حساب المسافة بالكيلومتر من موقع {userStore.name} وتحديد المندوب الأسرع في التوصيل
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700 text-xs">
              <MapPin size={14} className="text-rose-400" />
              <span>موقع المتجر: {userStore.locationInDistrict}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rankedCouriers.map((courier) => (
              <div
                key={courier.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  courier.isFastest
                    ? "bg-slate-800/90 border-amber-500/80 ring-2 ring-amber-500/20 shadow-lg"
                    : "bg-slate-800/40 border-slate-700/80 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-700 flex items-center justify-center text-lg font-black border border-slate-600">
                      <Bike size={20} className="text-orange-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-black text-sm text-white">{courier.name}</h5>
                        {courier.isFastest && (
                          <span className="bg-amber-400/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-black border border-amber-400/30 flex items-center gap-1">
                            <Zap size={11} /> المندوب الأسرع
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <MapPin size={12} /> يبعد {courier.distanceKm} كم
                        </span>
                        <span>★ {courier.rating}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-sm font-mono font-black text-amber-300 block">
                      ~ {courier.avgDeliveryMinutes} دقيقة
                    </span>
                    <span className="text-[10px] text-slate-500">متوسط الوصول</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-700/60">
                  <a
                    href={`tel:${courier.phone}`}
                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Phone size={13} /> اتصال بالكابتن ({courier.phone})
                  </a>
                  <button
                    onClick={() => {
                      alert(`تم إرسال إشعار للطلب للمندوب ${courier.name}`);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 transition"
                  >
                    <ShieldCheck size={14} /> استدعاء للفرع
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
