import {MerchantRecords} from './MerchantRecords';
import {BRAND} from '../brand';
import { MerchantCatalogPicker } from './MerchantCatalogPicker';
import { productCategories } from '../utils/catalogManagement';
import {OrderMap} from './OrderMap';
import { EmptyState } from './ui/DataStates';
import { cairoDay } from "../utils/orderIntegration";
import { KitchenDisplay } from "./KitchenDisplay";
import React, { useState, useMemo, useEffect } from "react";
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
} from "../utils/orderCalculations.ts";
import { SmartImage } from "./SmartImage.tsx";

interface RestaurantPortalProps {
  preparationContent?: React.ReactNode;
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
  onUpdateProductPrice: (productId: string, newPrice: number) => Promise<void>;
  onLinkProduct: (catalogId: string, price: number, existingProductId?:string) => Promise<void>;
  onArchiveProduct: (id: string, archived: boolean) => Promise<void>;
  productsNextCursor?: string | null;
  onLoadMoreProducts?: () => void;
  productsLoading?: boolean;
  onToggleStoreStatus: (storeId: string) => void;
}

export const RestaurantPortal: React.FC<RestaurantPortalProps> = ({
  preparationContent,
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
  onLinkProduct, onArchiveProduct, productsNextCursor, onLoadMoreProducts, productsLoading,
  onToggleStoreStatus,
}) => {
  const userStore = stores.find((s) => s.id === currentProfile.storeId);

  const [trackingOrderId,setTrackingOrderId] = useState("");
  const sections=[['dashboard','الرئيسية'],['kitchen','الطلبات'],['menu','المنتجات والأسعار'],['inventory','المخزون'],['customers','العملاء'],['accounting','التقارير'],['payments','المدفوعات'],['settings','الإعدادات'],['support','الدعم والمساعدة']] as const;
  const slugs:Record<string,string>={dashboard:'dashboard',kitchen:'orders',menu:'products',inventory:'inventory',customers:'customers',accounting:'reports',payments:'payments',settings:'settings',support:'support',radar:'tracking'};
  const sectionFromPath=()=>Object.keys(slugs).find(key=>slugs[key]===location.pathname.split('/')[2])||'dashboard';
  const [activeTab,setActiveTab]=useState(sectionFromPath);
  function navigateSection(key:string){setActiveTab(key);window.history.pushState({},'', '/merchant/'+slugs[key]+location.search);}
  useEffect(()=>{const changed=()=>setActiveTab(sectionFromPath());window.addEventListener('popstate',changed);return()=>window.removeEventListener('popstate',changed);},[]);

  // New item modal state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [menuError, setMenuError] = useState('');
  const [inventoryView, setInventoryView] = useState('active');
  const canManage=(currentProfile.duty || 'manager')==='manager';
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

  const storeProducts = products.filter((p) => p.storeId === userStore?.id );

  const filteredProducts = useMemo(() => {
    return storeProducts.filter((p) => {
      const matchCat = selectedCategory === "all" || p.category === selectedCategory;
      const matchQuery =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.toLowerCase().trim()) ||
        p.description?.toLowerCase().includes(productSearch.toLowerCase().trim());
      return matchCat && matchQuery && (inventoryView === "archived" ? p.archived : !p.archived);
    });
  }, [storeProducts, selectedCategory, productSearch, inventoryView]);

  // Accounting and Financial Computations
  const accountingSummary = useMemo(() => {
    return calculateMerchantAccountingSummary(orders, userStore?.id || "", (userStore?.commissionRate||0)/100);
  }, [orders, userStore?.id, userStore?.commissionRate]);

  const journalEntries = useMemo(() => {
    return generateMerchantJournalEntries(orders, userStore?.id || "", (userStore?.commissionRate||0)/100);
  }, [orders, userStore?.id, userStore?.commissionRate]);

  const topSellingItems = useMemo(() => {
    return calculateTopSellingProducts(orders, userStore?.id || "", 6);
  }, [orders, userStore?.id, userStore?.commissionRate]);

  const handleSavePrice = async (productId: string) => {
    if (Number.isFinite(tempPrice) && tempPrice >= 0) {
      try { await onUpdateProductPrice(productId, tempPrice); } catch (error) { setMenuError((error as Error).message); return; }
      setPriceSuccessId(productId);
      setEditingPriceId(null);
      setTimeout(() => setPriceSuccessId(null), 2500);
    }
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
                  disabled={!canManage || !connected}
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

          <nav aria-label="أقسام لوحة التحكم" className="flex flex-wrap gap-2 rounded-xl border p-2 bg-slate-50">
            {sections.map(([key,label])=><button key={key} aria-current={activeTab===key?'page':undefined} onClick={()=>navigateSection(key)} className={`px-3 py-2 rounded-lg text-sm font-bold ${activeTab===key?'bg-slate-900 text-white':'text-slate-700 bg-white'}`}>{label}</button>)}
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
              <span className="text-[11px] font-bold text-slate-500 block">صافي تقديري للطلبات المحملة</span>
              <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                {userStore.commissionRate === undefined ? 'نسبة التعاقد غير متاحة' : formatEGP(accountingSummary.netPayout)}
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

      {activeTab==='dashboard'&&<section aria-label="الرئيسية" className="p-5 border rounded-2xl bg-white space-y-3"><h2 className="text-xl font-bold">ملخص المتجر</h2><p>المؤشرات من الطلبات المحملة حاليًا؛ حمّل السجل لعرض مزيد من الطلبات.</p><h3>أحدث الطلبات المحملة</h3>{[...storeOrders].sort((a,b)=>Date.parse(b.createdAt||'')-Date.parse(a.createdAt||'')).slice(0,10).map(o=><button key={o.id} onClick={()=>navigateSection('kitchen')} className="block p-2 border rounded-xl w-full text-right">{o.orderNumber||o.id} · {o.orderStatus}</button>)}{!storeOrders.length&&<p>لا توجد طلبات محملة بعد.</p>}<button onClick={()=>navigateSection('menu')} className="p-3 border rounded-xl">إدارة منتجات المتجر</button></section>}
      {(activeTab==='customers'||activeTab==='payments')&&(canManage?<MerchantRecords key={activeTab+userStore.id} kind={activeTab} storeId={userStore.id}/>:<p role="alert">هذه الصفحة لمدير المتجر فقط.</p>)}
      {activeTab==='settings'&&<section aria-label="إعدادات المتجر" className="p-5 border rounded-2xl bg-white space-y-3"><h2 className="text-xl font-bold">بيانات النشاط والإعدادات</h2><dl><dt>اسم المتجر</dt><dd>{userStore.name}</dd><dt>العنوان</dt><dd>{userStore.locationInDistrict||'غير مسجل'}</dd><dt>الحد الأدنى للطلب</dt><dd>{formatEGP(userStore.minOrder)}</dd><dt>رسوم التوصيل المسجلة</dt><dd>{formatEGP(userStore.deliveryFee)}</dd></dl><button disabled={!canManage||!connected} onClick={()=>onToggleStoreStatus(userStore.id)} className="p-3 border rounded-xl">{userStore.status==='open'?'إغلاق المتجر مؤقتًا':'فتح المتجر'}</button><p>لتعديل العنوان والرسوم وساعات العمل أو صلاحيات الحساب، تواصل مع الإدارة عبر الدعم.</p><a href={BRAND.supportUrl} target="_blank" rel="noreferrer">التواصل مع دعم سنجوب</a></section>}
      {activeTab==='support'&&<section aria-label="الدعم والمساعدة" className="p-5 border rounded-2xl bg-white space-y-4"><h2 className="text-xl font-bold">دليل التاجر والمساعدة</h2><details><summary>كيف أضيف منتجات متجري؟</summary><p>من المنتجات اختر من كتالوج سنجوب. إذا كان الصنف موجودًا عندك اختر ربط بسجل قائم؛ سيحتفظ بمعرّفه وسعره. العرض الجديد يبدأ غير متاح حتى تفعّله.</p></details><details><summary>كيف أجهز طلبًا؟</summary><p>افتح الطلبات وابدأ التحضير ثم أكد جاهزية أصناف متجرك. الاستلام والتوصيل من صلاحيات المندوب.</p></details><details><summary>هل أرقام التقارير رصيد جاهز للتحويل؟</summary><p>لا، التقارير تقديرات للطلبات المحملة. المدفوعات تعرض التسويات المسجلة، والمراجعة المالية لدى الإدارة.</p></details><a href={BRAND.supportUrl} target="_blank" rel="noreferrer">التواصل مع دعم سنجوب</a><p>متابعة تذاكر الدعم داخل اللوحة غير متاحة حاليًا.</p></section>}
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
        <section aria-label="شاشة تذاكر المطبخ الحية"><button onClick={()=>navigateSection('radar')} className="p-2 border rounded-xl mb-3">تتبع طلبات المتجر</button>
          {preparationContent}
          {(!preparationContent||orders.some(o=>o.fulfillmentVersion!==2&&["received","preparing"].includes(o.orderStatus)))&&<KitchenDisplay
            orders={orders.filter(o=>o.fulfillmentVersion!==2)}
            stores={stores}
            fixedStoreId={userStore.id}
            connected={connected}
            onChange={onKitchenChange}
          />}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          2. تبويب إدارة أصناف المنيو وتحديث الأسعار (APPLE TABLE + MATERIAL YOU)
          ════════════════════════════════════════════════════════════════════════ */}
      {(activeTab === "menu" || activeTab === "inventory") && (
        <section className="space-y-5" aria-label="إدارة أصناف المنيو وتحديث الأسعار">
          {/* Header Controls */}
          <div className="bg-white/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">{activeTab==='inventory'?'المخزون والتوفر':'منتجات وأسعار'} {userStore.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديث فوري لأسعار البيع، تفعيل أو إيقاف توفر المنتجات بالمطبخ فوراً لموظفي العاصمة.
              </p>
            </div>

            <button
              hidden={activeTab==='inventory'}
              disabled={!canManage || !connected}
              onClick={() => setIsAddingItem(true)}
              className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Plus size={16} />
              <span>اختيار من الكتالوج العام</span>
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
              {["all", ...productCategories].map((cat) => (
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

          <div className="flex flex-wrap gap-3 text-sm">
            <button onClick={()=>setInventoryView('active')} aria-pressed={inventoryView==='active'}>المنتجات الحالية</button>
            <button onClick={()=>setInventoryView('archived')} aria-pressed={inventoryView==='archived'}>المؤرشفة</button>
            {productsNextCursor&&<button disabled={productsLoading} onClick={onLoadMoreProducts}>{productsLoading?'جارٍ التحميل…':'تحميل المزيد من منتجات المتجر'}</button>}
          </div>
          {menuError&&<p role="alert" className="text-red-700">{menuError}</p>}
          {activeTab==='menu'&&isAddingItem&&canManage&&<MerchantCatalogPicker products={storeProducts} onLink={onLinkProduct} onClose={()=>setIsAddingItem(false)}/>}
          {filteredProducts.length===0&&<EmptyState message={productSearch?"لا توجد أصناف تطابق البحث؛ جرّب اسمًا آخر.":"لا توجد أصناف في هذه القائمة. اختر منتجات موجودة من الكتالوج العام."}/>}
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
                          disabled={!canManage || !connected || prod.archived}
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

                  {prod.catalogProductId&&<p className="text-xs text-slate-500">مرتبط بمنتج من كتالوج سنجوب العام</p>}
                  <button disabled={!canManage||!connected} className="text-sm underline" onClick={async()=>{setMenuError('');try{await onArchiveProduct(prod.id,!prod.archived)}catch(e){setMenuError((e as Error).message)}}}>{prod.archived?'استعادة بحالة غير متاح':'أرشفة عرض المتجر'}</button>
                  {/* Stock Availability Toggle (iOS Switch Style) */}
                  <button
                    disabled={!canManage || !connected || prod.archived}
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
                  ملخص مبيعات تقديري
                </span>
                <p className="text-xs text-slate-400 mt-3">تقدير للطلبات المحملة؛ لا يمثل رصيدًا جاهزًا للتحويل</p>
                <h3 className="text-3xl sm:text-4xl font-black text-white font-mono mt-1 tracking-tight">
                  {userStore.commissionRate === undefined ? 'نسبة التعاقد غير متاحة' : formatEGP(accountingSummary.netPayout)}
                </h3>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  ليس كشف تسويات أو إثبات دفع؛ المستحق النهائي يعتمد على السجلات المالية المعتمدة
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
                    - {userStore.commissionRate === undefined ? 'غير متاحة' : formatEGP(accountingSummary.platformCommission)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Collection Channels (Google Material 3 Tonal Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 block">طلبات مسجلة بالدفع النقدي</span>
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
                <span className="text-xs font-bold text-slate-400 block">طلبات مسجلة بالدفع الإلكتروني</span>
                <h4 className="text-xl font-black text-purple-600 font-mono mt-1">
                  {formatEGP(accountingSummary.byPaymentMethod.geidea)}
                </h4>
                <span className="text-[10px] text-slate-400">حسب طريقة الدفع المسجلة، دون إثبات تحويل</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <CreditCard size={22} />
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 block">طلبات تاريخية مسجلة كتحويل</span>
                <h4 className="text-xl font-black text-blue-600 font-mono mt-1">
                  {formatEGP(accountingSummary.byPaymentMethod.instapay)}
                </h4>
                <span className="text-[10px] text-slate-400">لا يثبت هذا العرض تنفيذ تحويلات مالية</span>
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
                  تفصيل حسابي تقديري للطلبات المحملة
                </h4>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full">
                  حساب تقديري — غير معتمد محاسبيًا
                </span>
              </div>

              {journalEntries.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10">لا توجد طلبات مسلّمة محملة لحساب التقدير</p>
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
        <section className="rounded-2xl border bg-white p-4 space-y-4" aria-label="تتبع طلبات المتجر">
          <h3 className="text-lg font-bold">تتبع توصيل طلبات متجرك</h3>
          <p className="text-sm text-slate-600">موقع المندوب الذي يوصّل طلبًا من متجرك فقط. تُراجع البيانات كل 10 ثوانٍ أثناء فتح الخريطة؛ لا نعرض مواقع مناديب غير مرتبطين بطلباتك أو عنوان العميل.</p>
          {orders.filter(order=>order.storeIds?.includes(userStore.id)&&order.orderStatus==='with_courier').length===0&&<p>لا توجد طلبات من متجرك قيد التوصيل الآن.</p>}
          {orders.filter(order=>order.storeIds?.includes(userStore.id)&&order.orderStatus==='with_courier').slice(0,50).map(order=><MerchantOrderTracking key={order.id} order={order} open={trackingOrderId===order.id} onToggle={open=>setTrackingOrderId(current=>open?order.id:current===order.id?"":current)}/>)}
        </section>
      )}
    </div>
  );
};


function MerchantOrderTracking({order,open,onToggle}:{order:Order;open:boolean;onToggle:(open:boolean)=>void}){return <details open={open} className="rounded-xl border p-3" onToggle={e=>onToggle(e.currentTarget.open)}><summary>طلب {order.orderNumber} · {order.courierName||'المندوب المسند'}</summary>{open&&<OrderMap merchant order={{id:order.id,orderStatus:order.orderStatus,coordinates:undefined}}/>}</details>;}
