import React, { useState } from 'react';
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
} from 'lucide-react';
import type { Order, Product, Profile, Store } from '../types/index.ts';
import { formatEGP } from '../utils/orderCalculations.ts';
import { SmartImage } from './SmartImage.tsx';

interface RestaurantPortalProps {
  currentProfile: Profile;
  stores: Store[];
  products: Product[];
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: Order['orderStatus']) => void;
  onUpdateProductStock: (productId: string, inStock: boolean) => void;
  onUpdateProductPrice: (productId: string, newPrice: number) => void;
  onAddProduct: (product: Product) => void;
  onToggleStoreStatus: (storeId: string) => void;
}

export const RestaurantPortal: React.FC<RestaurantPortalProps> = ({
  currentProfile,
  stores,
  products,
  orders,
  onUpdateOrderStatus,
  onUpdateProductStock,
  onUpdateProductPrice,
  onAddProduct,
  onToggleStoreStatus,
}) => {
  // Determine current active store
  const userStore =
    stores.find((s) => s.id === currentProfile.storeId) ||
    stores.find((s) => s.id === 'store-foul-hind') ||
    stores[0];

  const [activeTab, setActiveTab] = useState<'kitchen' | 'menu'>('kitchen');
  const [kitchenFilter, setKitchenFilter] = useState<'active' | 'ready' | 'all'>('active');

  // New item modal state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(25);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<'فطور' | 'سندوتشات' | 'مشروبات' | 'وجبات خفيفة'>('فطور');
  const [newItemImage, setNewItemImage] = useState('https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80');

  // Filter orders for this store
  const storeOrders = orders.filter((o) =>
    o.items.some((item) => item.product.storeId === userStore.id)
  );

  const activeKitchenOrders = storeOrders.filter(
    (o) => o.orderStatus === 'received' || o.orderStatus === 'preparing'
  );

  const readyForPickupOrders = storeOrders.filter(
    (o) => o.orderStatus === 'with_courier' && !o.courierChecklist?.receivedAndCheckedAtRestaurant
  );

  const storeProducts = products.filter((p) => p.storeId === userStore.id);

  // Financial calculations
  const totalStoreSales = storeOrders.reduce((sum, o) => {
    const storeSubtotal = o.items
      .filter((i) => i.product.storeId === userStore.id)
      .reduce((sub, i) => sub + i.product.price * i.quantity, 0);
    return sum + storeSubtotal;
  }, 0);

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newProd: Product = {
      id: 'prod-' + Date.now(),
      storeId: userStore.id,
      storeName: userStore.name,
      name: newItemName,
      description: newItemDesc || 'صنف جديد طازج ومعد خصيصاً لموظفي الحي الحكومي',
      price: Number(newItemPrice),
      category: newItemCategory,
      imageType: 'foul',
      imageUrl: newItemImage,
      inStock: true,
      badge: 'جديد بالمنيو',
    };

    onAddProduct(newProd);
    setIsAddingItem(false);
    setNewItemName('');
    setNewItemDesc('');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-5" dir="rtl">
      {/* Store Banner & Quick Stats */}
      <div className="bg-gradient-to-r from-amber-700 via-orange-800 to-amber-950 text-white rounded-3xl p-5 shadow-lg border border-amber-600/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl shadow-inner shrink-0">
              {userStore.logo || '🥘'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold border border-amber-400/30">
                  لوحة تحكم شيف ومطعم الفود كورت
                </span>
                <button
                  onClick={() => onToggleStoreStatus(userStore.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      userStore.status === 'open' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                    }`}
                  />
                  <span>{userStore.status === 'open' ? 'المطبخ يستقبل طلبات' : 'المطبخ مشغول مؤقتاً'}</span>
                </button>
              </div>
              <h2 className="text-xl font-black text-white mt-1">{userStore.name}</h2>
              <p className="text-xs text-amber-100/90 mt-0.5">
                {userStore.locationInDistrict} • مسؤول الفرع: {currentProfile.fullName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab('kitchen')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'kitchen'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              طلبات المطبخ والتجهيز ({activeKitchenOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'menu'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              إدارة أصناف المنيو ({storeProducts.length})
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">إجمالي مبيعات اليوم</span>
            <span className="text-xl font-black text-white">{formatEGP(totalStoreSales)}</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">طلبات قيد التجهيز</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-300">{activeKitchenOrders.length}</span>
              <span className="text-[11px] text-amber-200">طلب بالمطبخ</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">أصناف المنيو المتاحة</span>
            <span className="text-xl font-black text-white">{storeProducts.length} صنف</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-amber-200 block">تقييم الموظفين</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-300">★ {userStore.rating}</span>
              <span className="text-[11px] text-amber-200">({userStore.ratingCount} تقييم)</span>
            </div>
          </div>
        </div>
      </div>

      {/* View: Kitchen Orders */}
      {activeTab === 'kitchen' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-black text-slate-900">
                طلبات شاشة المطبخ وتجهيز الوجبات
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {storeOrders.length} إجمالي الطلبات المستلمة
            </span>
          </div>

          {storeOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-2">
              <p className="text-sm font-bold text-slate-700">لا توجد طلبات واردة لمطعمك حتى الآن</p>
              <p className="text-xs text-slate-400">بمجرد قيام موظف بالطلب، ستظهر تذكرة المطبخ هنا تلقائياً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storeOrders.map((order) => {
                const storeItems = order.items.filter((i) => i.product.storeId === userStore.id);
                const isReady =
                  order.orderStatus === 'with_courier' || order.orderStatus === 'delivered';
                const isPreparing = order.orderStatus === 'preparing';

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-3xl border-2 transition-all p-4 sm:p-5 space-y-3.5 shadow-sm ${
                      isPreparing
                        ? 'border-amber-400 ring-2 ring-amber-400/20'
                        : isReady
                        ? 'border-emerald-300'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">
                            {order.orderNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPreparing
                                ? 'bg-amber-100 text-amber-800'
                                : isReady
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isPreparing
                              ? '🔥 جاري التجهيز بالمطبخ'
                              : isReady
                              ? 'جاهز / مع المندوب'
                              : 'طلب جديد معلق'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {order.createdAt} • موجه إلى: <strong>{order.ministry}</strong> ({order.floorNumber})
                        </p>
                      </div>

                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 block font-bold">الحساب</span>
                        <span className="text-sm font-black text-amber-700">
                          {formatEGP(
                            storeItems.reduce((s, i) => s + i.product.price * i.quantity, 0)
                          )}
                        </span>
                      </div>
                    </div>

                    {order.scheduledDeliveryTime && (
                      <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-950 font-bold flex items-center gap-1.5">
                        <span>⏰ موعد التسليم المجدول للموظف:</span>
                        <span>{order.scheduledDeliveryTime}</span>
                      </div>
                    )}

                    {/* Items List */}
                    <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                      <span className="text-[11px] font-black text-slate-700 block">
                        تفاصيل الوجبات والسندوتشات المطلوبة:
                      </span>
                      {storeItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between text-xs py-1 border-b border-slate-200/60 last:border-0"
                        >
                          <div>
                            <span className="font-black text-slate-900 ml-1.5 text-sm text-amber-700">
                              {item.quantity}×
                            </span>
                            <span className="font-bold text-slate-800">{item.product.name}</span>
                            {Object.entries(item.selectedOptions).length > 0 && (
                              <p className="text-[11px] text-slate-500 mt-0.5 pr-4">
                                {Object.entries(item.selectedOptions)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(' | ')}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-[11px] text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded mt-1 font-bold">
                                ملاحظة الموظف: {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Assigned Courier */}
                    <div className="flex items-center justify-between text-xs bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                      <div className="flex items-center gap-2">
                        <Bike className="w-4 h-4 text-emerald-700" />
                        <span className="text-emerald-950 font-bold">
                          المندوب: {order.courierName || 'جاري تعيين مندوب من الإدارة'}
                        </span>
                      </div>
                      {order.courierPhone && (
                        <a
                          href={`tel:${order.courierPhone}`}
                          className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs"
                        >
                          <Phone className="w-3 h-3" />
                          <span>اتصال</span>
                        </a>
                      )}
                    </div>

                    {/* Kitchen Status Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'preparing')}
                        disabled={isPreparing}
                        className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                          isPreparing
                            ? 'bg-amber-100 text-amber-800 cursor-default'
                            : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                        }`}
                      >
                        {isPreparing ? 'قيد التحضير الآن 🔥' : 'بدء التحضير 👨‍🍳'}
                      </button>

                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'with_courier')}
                        disabled={order.orderStatus === 'with_courier' || order.orderStatus === 'delivered'}
                        className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                          order.orderStatus === 'with_courier'
                            ? 'bg-emerald-100 text-emerald-800 cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                      >
                        {order.orderStatus === 'with_courier'
                          ? 'تم تسليم المندوب ✓'
                          : 'جاهز للاستلام 📦'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* View: Menu Manager */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">أصناف منيو {userStore.name}</h3>
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
                  <label className="text-xs font-bold text-slate-700 block mb-1">اسم الوجبة:</label>
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
                  <label className="text-xs font-bold text-slate-700 block mb-1">السعر (ج.م):</label>
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
                  <label className="text-xs font-bold text-slate-700 block mb-1">الفئة:</label>
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
                <label className="text-xs font-bold text-slate-700 block mb-1">الوصف:</label>
                <input
                  type="text"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="مكونات الوجبة وطريقة التحضير..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">رابط صورة الوجبة (Unsplash / Real Photo):</label>
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
                  type="submit"
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
                    <h5 className="text-xs font-black text-slate-900">{prod.name}</h5>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                      {prod.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-bold">السعر:</span>
                    <input
                      type="number"
                      min={1}
                      defaultValue={prod.price}
                      onBlur={(e) => onUpdateProductPrice(prod.id, Number(e.target.value))}
                      className="w-16 px-2 py-0.5 text-xs font-black border border-slate-300 rounded text-amber-700 bg-white"
                    />
                    <span className="text-[11px] text-slate-700 font-bold">ج.م</span>
                  </div>

                  <button
                    onClick={() => onUpdateProductStock(prod.id, !prod.inStock)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      prod.inStock
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    {prod.inStock ? 'متوفر بالمطبخ ✓' : 'نفذت الكمية ✕'}
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
