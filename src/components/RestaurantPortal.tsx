import { cairoDay } from "../utils/orderIntegration";
import { KitchenDisplay } from "./KitchenDisplay";
import React, { useState } from "react";
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
} from "lucide-react";
import type { Order, Product, Profile, Store } from "../types/index.ts";
import { formatEGP } from "../utils/orderCalculations.ts";
import { SmartImage } from "./SmartImage.tsx";

interface RestaurantPortalProps {
  connected: boolean;
  onKitchenChange: (id: string, storeId: string, stage: "preparing" | "ready") => Promise<void>;
  currentProfile: Profile;
  stores: Store[];
  products: Product[];
  orders: Order[];
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
  connected,
  onKitchenChange,
  onUpdateOrderStatus,
  onUpdateProductStock,
  onUpdateProductPrice,
  onAddProduct,
  onToggleStoreStatus,
}) => {
  // Determine current active store
  const userStore =
    stores.find((s) => s.id === currentProfile.storeId);

  const [activeTab, setActiveTab] = useState<"kitchen" | "menu">("kitchen");
  const [kitchenFilter, setKitchenFilter] = useState<
    "active" | "ready" | "all"
  >("active");

  // New item modal state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState(0);
  const [menuError, setMenuError] = useState("");
  const [menuBusy, setMenuBusy] = useState(false);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<
    "فطور" | "سندوتشات" | "مشروبات" | "وجبات خفيفة"
  >("فطور");
  const [newItemImage, setNewItemImage] = useState(
    "",
  );

  // Filter orders for this store
  const storeOrders = orders.filter((o) =>
    o.storeIds?.includes(currentProfile.storeId || ""),
  );

  const activeKitchenOrders = storeOrders.filter(
    (o) => o.orderStatus === "received" || o.orderStatus === "preparing",
  );

  const readyForPickupOrders = storeOrders.filter(
    (o) =>
      o.orderStatus === "ready",
  );

  const storeProducts = products.filter((p) => p.storeId === userStore?.id);

  // Financial calculations
  const totalStoreSales = storeOrders.filter((order) => order.orderStatus === "delivered" && cairoDay(order.deliveredAt || "") === cairoDay(new Date())).reduce((sum, o) => {
    const storeSubtotal = o.items
      .filter((i) => i.product.storeId === userStore?.id)
      .reduce((sub, i) => sub + (i.product.price + i.extraPrice) * i.quantity, 0);
    return sum + storeSubtotal;
  }, 0);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userStore) return;
    if (!newItemName.trim()) return;

    if (!newItemImage.startsWith("https://") || !newItemDesc.trim() || newItemPrice <= 0) { setMenuError("أدخل وصفًا وسعرًا ورابط صورة HTTPS حقيقيًا للصنف."); return; }
    const newProd: Product = {
      id: crypto.randomUUID(),
      storeId: userStore.id,
      storeName: userStore.name,
      name: newItemName,
      description:
        newItemDesc,
      price: Number(newItemPrice),
      category: newItemCategory,
      imageType: "foul",
      imageUrl: newItemImage,
      inStock: true,
      badge: "جديد بالمنيو",
    };

    setMenuBusy(true); setMenuError("");
    try { await onAddProduct(newProd); }
    catch (error) { setMenuError((error as Error).message); return; }
    finally { setMenuBusy(false); }
    setIsAddingItem(false);
    setNewItemName("");
    setNewItemDesc("");
  };

  if (!userStore) return <p className="p-8 text-center">لم يُربط حسابك بمتجر تشغيل. اطلب من المدير تعيين المتجر الصحيح.</p>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-5" dir="rtl">
      {menuError && <p role="alert" className="p-3 rounded-xl text-red-700 bg-red-50">{menuError}</p>}
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
                  لوحة تحكم شيف ومطعم الفود كورت
                </span>
                <button
                  onClick={() => onToggleStoreStatus(userStore?.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      userStore.status === "open"
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-red-400"
                    }`}
                  />
                  <span>
                    {userStore.status === "open"
                      ? "المطبخ يستقبل طلبات"
                      : "المطبخ مشغول مؤقتاً"}
                  </span>
                </button>
              </div>
              <h2 className="text-xl font-black text-white mt-1">
                {userStore.name}
              </h2>
              <p className="text-xs text-amber-100/90 mt-0.5">
                {userStore.locationInDistrict} • مسؤول الفرع:{" "}
                {currentProfile.fullName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab("kitchen")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "kitchen"
                  ? "bg-amber-500 text-white shadow-md"
                  : "text-white/80 hover:text-white"
              }`}
            >
              طلبات المطبخ والتجهيز ({activeKitchenOrders.length})
            </button>
            <button
              onClick={() => setActiveTab("menu")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "menu"
                  ? "bg-amber-500 text-white shadow-md"
                  : "text-white/80 hover:text-white"
              }`}
            >
              إدارة أصناف المنيو ({storeProducts.length})
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">
              إجمالي مبيعات اليوم
            </span>
            <span className="text-xl font-black text-white">
              {formatEGP(totalStoreSales)}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">
              طلبات قيد التجهيز
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-300">
                {activeKitchenOrders.length}
              </span>
              <span className="text-[11px] text-amber-200">طلب بالمطبخ</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">
              أصناف المنيو المتاحة
            </span>
            <span className="text-xl font-black text-white">
              {storeProducts.length} صنف
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">
              تقييم الموظفين
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-300">
                ★ {userStore.rating}
              </span>
              <span className="text-[11px] text-amber-200">
                ({userStore.ratingCount} تقييم)
              </span>
            </div>
          </div>
        </div>
      </div>

      {activeTab === "kitchen" && <KitchenDisplay orders={orders} stores={stores} fixedStoreId={currentProfile.storeId} connected={connected} onChange={onKitchenChange} />}

      {/* View: Menu Manager */}
      {activeTab === "menu" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">
                أصناف منيو {userStore.name}
              </h3>
              <p className="text-xs text-slate-500">
                يمكنك تفعيل أو إيقاف أي صنف وتحديث أسعار البيع لموظفي الوزارات
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

          {/* Add Product Modal */}
          {isAddingItem && (
            <form
              onSubmit={handleCreateProduct}
              className="bg-amber-50/70 border border-amber-300 rounded-3xl p-5 space-y-3"
            >
              <h4 className="text-sm font-black text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                إضافة وجبة أو صنف جديد للمنيو
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    اسم الوجبة:
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="مثال: سندوتش بيض بالبسطرمة"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    السعر (ج.م):
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    الفئة:
                  </label>
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
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  الوصف:
                </label>
                <input
                  type="text"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="مكونات الوجبة وطريقة التحضير..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  رابط صورة الوجبة (Unsplash / Real Photo):
                </label>
                <input
                  type="url"
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
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
                  disabled={menuBusy} type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-xs"
                >
                  حفظ ونشر بالمنيو
                </button>
              </div>
            </form>
          )}

          {/* Product Items Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {storeProducts.map((prod) => (
              <div
                key={prod.id}
                className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3 shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                    <SmartImage
                      src={prod.imageUrl}
                      alt={prod.name}
                      fallbackType={prod.imageType}
                      aspectRatio="aspect-square"
                    />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-xs font-black text-slate-900">
                      {prod.name}
                    </h5>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                      {prod.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-bold">
                      السعر:
                    </span>
                    <input
                      type="number"
                      min={1}
                      defaultValue={prod.price}
                      onBlur={(e) =>
                        onUpdateProductPrice(prod.id, Number(e.target.value))
                      }
                      className="w-16 px-2 py-0.5 text-xs font-black border border-slate-300 rounded text-amber-700 bg-white"
                    />
                    <span className="text-[11px] text-slate-700 font-bold">
                      ج.م
                    </span>
                  </div>

                  <button
                    onClick={() => onUpdateProductStock(prod.id, !prod.inStock)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      prod.inStock
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-red-100 text-red-800 hover:bg-red-200"
                    }`}
                  >
                    {prod.inStock ? "متوفر بالمطبخ ✓" : "نفذت الكمية ✕"}
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
