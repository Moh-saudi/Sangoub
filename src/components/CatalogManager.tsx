import { adminApi } from '../lib/adminApi';
import { CatalogProductTable, CatalogStoreTable } from "./CatalogTables";
import { customerMessage } from "../utils/customerMessage";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Search,
  Plus,
  Pencil,
  Package,
  Store as StoreIcon,
  X,
  Archive,
  Image as ImageIcon,
  List,
  LayoutGrid,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  RotateCcw,
  Trash2,
  Clock,
  Tag,
  Check,
} from "lucide-react";
import type { Order, Product, Store, Category } from "../types";
import { saveRecord, deleteRecord } from "../lib/firebase";
import { catalogPerformance, productCategories, productFormData, storeCategories } from "../utils/catalogManagement";
import { formatEGP } from "../utils/orderCalculations";
import { matchStoreId } from "../utils/storeAssets";
import { availableOffers, hasProductOffer } from "../utils/productOffers";
import { EnterpriseProductModal } from "./EnterpriseProductModal";
import { BulkProductImportModal } from "./BulkProductImportModal";
import { StoreEditorModal } from "./StoreEditorModal";
import { supabase } from "../lib/supabase";
import { operationsApi } from "../lib/operationsApi";
import { getMerchantPaymentSettings, updateMerchantPaymentSettings } from "../utils/merchantPaymentSettings";

const input = "form-control w-full border border-slate-300 rounded-xl p-3 bg-white text-sm text-slate-900";
const button = "rounded-xl px-4 py-2 text-sm font-bold border border-slate-200 disabled:opacity-40";

export function CatalogManager({ products, stores, orders, searchRequest, mode, fixedStoreId, onProductUpdate, onProductDelete, onStoreUpdate, onProductsRefresh }: {
  products: Product[];
  stores: Store[];
  orders: Order[];
  mode?: "products" | "stores" | "offers";
  searchRequest?: { term: string; kind: "products" | "stores"; key: number };
  fixedStoreId?: string;
  onProductUpdate?: (updated: Product) => void;
  onProductDelete?: (id: string) => void;
  onStoreUpdate?: (updated: Store) => void;
  onProductsRefresh?: () => void;
}) {
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  const [localStores, setLocalStores] = useState<Store[]>(stores);
  useEffect(() => {
    setLocalStores(stores);
  }, [stores]);
  const [offerPicker, setOfferPicker] = useState(false);
  const [assignStoreModal, setAssignStoreModal] = useState<{ product: Product; selectedStoreId: string } | null>(null);
  const [view, setView] = useState<"table" | "cards">("table");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [taxonomyCategories, setTaxonomyCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<"products" | "stores">(mode === "stores" ? "stores" : "products");
  const [search, setSearch] = useState("");
  useEffect(()=>{if(searchRequest){setTab(searchRequest.kind);setSearch(searchRequest.term);setStoreFilter("");setCategory("");setAvailability("active");}},[searchRequest?.key]);
  const [storeFilter, setStoreFilter] = useState("");
  const [category, setCategory] = useState("");
  const [availability, setAvailability] = useState("active");
  const [sort, setSort] = useState("name");
  const [editor, setEditor] = useState<{ kind: "products" | "stores"; id?: string; enableOnSave?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showStoppageLogs, setShowStoppageLogs] = useState(false);
  const [adminStoppageLogs, setAdminStoppageLogs] = useState<any[]>([]);
  const [offerModalProduct, setOfferModalProduct] = useState<Product | null>(null);
  const [isNewOfferPickerOpen, setIsNewOfferPickerOpen] = useState(false);
  const [offerPickerSearch, setOfferPickerSearch] = useState("");
  const [offerOrigPrice, setOfferOrigPrice] = useState<number | string>("");
  const [offerPrice, setOfferPrice] = useState<number | string>("");
  const [offerTitle, setOfferTitle] = useState("");
  const [isOccasion, setIsOccasion] = useState(false);
  const [occasionName, setOccasionName] = useState("");
  const [offerBadge, setOfferBadge] = useState("");
  const [offerStartDate, setOfferStartDate] = useState("");
  const [offerEndDate, setOfferEndDate] = useState("");
  const [offerMaxPerOrder, setOfferMaxPerOrder] = useState<number | string>(3);

  useEffect(() => {
    try {
      const logs = localStorage.getItem('sangoub_all_stores_stoppages_log');
      if (logs) setAdminStoppageLogs(JSON.parse(logs));
    } catch {}
  }, [showStoppageLogs, stores]);
  const performance = useMemo(() => catalogPerformance(orders), [orders]);

  // Load hierarchical categories from Supabase for Bulk Importer
  useEffect(() => {
    async function loadCats() {
      try {
        const { data } = await supabase.from('categories').select('*').order('display_order', { ascending: true });
        if (data) setTaxonomyCategories(data as Category[]);
      } catch (e) {
        console.warn('Failed to load taxonomy:', e);
      }
    }
    void loadCats();
  }, []);
  const scopedProducts = fixedStoreId ? localProducts.filter((item) => matchStoreId(item.storeId, fixedStoreId)) : localProducts;
  const active = scopedProducts.filter((item) => !item.archived);
  const discounted = active.filter(hasProductOffer);
  const metrics: [string, number][] = mode === "stores"
    ? [["متاجر مسجلة", localStores.length], ["مفتوحة", localStores.filter(store => store.status === "open").length], ["مشغولة", localStores.filter(store => store.status === "busy").length], ["مغلقة", localStores.filter(store => store.status === "closed").length]]
    : mode === "offers"
      ? (fixedStoreId 
          ? [["عروض المتجر النشطة", discounted.length], ["ظاهرة لعملاء الحي", availableOffers(scopedProducts, localStores).length], ["أصناف العرض غير المتاحة", discounted.filter(product => !product.inStock).length], ["إجمالي أصناف المتجر", active.length]]
          : [["عروض على المنتجات", discounted.length], ["ظاهرة للزوار", availableOffers(products, localStores).length], ["منتجات العرض غير المتاحة", discounted.filter(product => !product.inStock).length], ["متاجر لديها عروض", new Set(discounted.map(product => product.storeId)).size]])
      : [["منتجات نشطة", active.length], ["متاحة بالمنيو", active.filter(item => item.inStock).length], ["غير متاحة", active.filter(item => !item.inStock).length], ["مؤرشفة", scopedProducts.filter(item => item.archived).length]];
  const filtered = scopedProducts.filter((item) => {
    const text = `${item.name} ${item.storeName} ${item.description}`.toLocaleLowerCase("ar");
    return (mode !== "offers" || hasProductOffer(item)) && text.includes(search.trim().toLocaleLowerCase("ar")) && (!storeFilter || matchStoreId(item.storeId, storeFilter)) && (!category || item.category === category) &&
      (availability === "archived" ? item.archived : !item.archived && (availability === "available" ? item.inStock : availability === "unavailable" ? !item.inStock : true));
  }).sort((a,b) => sort === "price" ? a.price - b.price : sort === "sales" ? (performance.get(b.id)?.sold || 0) - (performance.get(a.id)?.sold || 0) : a.name.localeCompare(b.name, "ar"));
  const visibleStores = localStores.filter((store) => `${store.name} ${store.locationInDistrict}`.includes(search.trim()));
  useEffect(() => { setPage(0); }, [search, storeFilter, category, availability, sort, tab]);
  const resultCount = tab === "products" ? filtered.length : visibleStores.length;
  const lastPage = Math.max(0, Math.ceil(resultCount / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const visibleProducts = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const pagedStores = visibleStores.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const hasFilters = Boolean(search || (tab === "products" && (storeFilter || category || availability !== "active" || sort !== "name")));
  function clearFilters() { setSearch(""); setStoreFilter(""); setCategory(""); setAvailability("active"); setSort("name"); }
  const selectedProduct = editor?.kind === "products" ? products.find((item) => item.id === editor.id) : undefined;
  const selectedStore = editor?.kind === "stores" ? localStores.find((item) => item.id === editor.id) : undefined;

  async function perform(operation: () => Promise<void>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); setMessage(success); return true; }
    catch (e) { setError(customerMessage(e, "تعذر الحفظ. أعد المحاولة.")); return false; }
    finally { setBusy(false); }
  }
  function open(kind: "products" | "stores", id?: string, enableOnSave = false) { setError(""); setMessage(""); setEditor({ kind, id, enableOnSave }); }
  async function changeAvailability(product: Product) {
    const newInStock = !product.inStock;
    setLocalProducts(prev => prev.map(p => p.id === product.id ? { ...p, inStock: newInStock } : p));
    await perform(async () => {
      const { error } = await supabase.from('products').update({ is_available: newInStock }).eq('id', product.id);
      if (error) throw error;
      onProductUpdate?.({ ...product, inStock: newInStock });
    }, newInStock ? "تمت إتاحة الصنف للطلب بالمنيو." : "تم إيقاف توافر الصنف مؤقتاً.");
  }
  async function handleArchive(product: Product) {
    if (product.archived) {
      setError("");
      setMessage("");
      const defaultStore = stores.find(s => matchStoreId(s.id, product.storeId)) || stores.find(s => s.id === 'a0000000-0000-0000-0000-000000000001') || stores[0];
      setAssignStoreModal({ product, selectedStoreId: defaultStore?.id || "" });
      return;
    }
    setLocalProducts(prev => prev.map(p => p.id === product.id ? { ...p, archived: true, inStock: false } : p));
    await perform(async () => {
      const { error } = await supabase.from("products").update({ archived: true, is_available: false }).eq("id", product.id);
      if (error) throw error;
      onProductUpdate?.({ ...product, archived: true, inStock: false });
    }, "تم نقل الصنف إلى الأرشيف بنجاح.");
  }

  async function handleDeleteProduct(product: Product) {
    if (window.confirm(`هل أنت متأكد من حذف الصنف "${product.name}" نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      setLocalProducts(prev => prev.filter(p => p.id !== product.id));
      await perform(async () => {
        const { error } = await supabase.from("products").delete().eq("id", product.id);
        if (error) throw error;
        onProductDelete?.(product.id);
      }, "تم حذف الصنف نهائياً من قاعدة البيانات.");
    }
  }

  return <section dir="rtl" className="catalog-workspace space-y-3" aria-label="إدارة الكتالوج">
    <header className="ops-heading catalog-heading">
      <div>
        <p className="admin-eyebrow">الكتالوج والتشغيل</p>
        <h1 className="text-2xl font-black">
          {mode === "offers" ? "عروض المنتجات" : mode === "stores" ? "المتاجر" : mode === "products" ? "المنتجات" : "المنتجات والمتاجر"}
        </h1>
        <p className="catalog-subtitle">
          {mode === "offers"
            ? "المنتجات المخفّضة تظهر تلقائيًا في صفحة العروض عندما تكون متاحة ومتاجرها مفتوحة."
            : mode === "stores"
            ? "بيانات المتاجر ورسوم التوصيل ومواعيد التوافر."
            : "المنيو والأسعار والصور والتوافر والرفع الجماعي في مكان واحد."}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {tab === "products" && mode !== "offers" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setExcelModalOpen(true)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            title="رفع وتحديث الأصناف بملف إكسيل"
          >
            <FileSpreadsheet size={17} />
            <span>استيراد إكسيل (Excel)</span>
          </button>
        )}
        <button
          disabled={busy || (tab === "products" && !stores.length) || (mode === "offers" && !active.length)}
          onClick={() => mode === "offers" ? setIsNewOfferPickerOpen(true) : open(tab)}
          className="admin-primary btn btn-primary flex items-center gap-1.5"
        >
          <Plus size={18} />
          {mode === "offers" ? "+ إضافة وتفعيل عرض جديد" : tab === "products" ? "إضافة منتج" : "إضافة متجر"}
        </button>
      </div>
    </header>

    {mode === "offers" && <a className="admin-text-button btn btn-link" href="/offers" target="_blank" rel="noopener noreferrer">معاينة صفحة العروض ↗</a>}

    {/* ── Interactive Metric Cards (Clickable Filters) ── */}
    <div className="catalog-metrics grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map(([label, value]) => {
        let targetAvail = '';
        if (label === 'منتجات نشطة') targetAvail = 'active';
        else if (label === 'متاحة بالمنيو') targetAvail = 'available';
        else if (label === 'غير متاحة') targetAvail = 'unavailable';
        else if (label === 'مؤرشفة') targetAvail = 'archived';

        const isSelected = tab === 'products' && availability === targetAvail;

        return (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (targetAvail && tab === 'products') {
                setAvailability(targetAvail);
              }
            }}
            className={`bg-white border rounded-2xl p-4 text-right transition-all cursor-pointer ${
              isSelected
                ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/40'
                : 'border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <strong className="block text-2xl text-slate-900">{value}</strong>
            <span className="text-xs font-bold text-slate-500 flex items-center justify-between mt-1">
              <span>{label}</span>
              {targetAvail === 'archived' && <Archive size={14} className="text-amber-600" />}
            </span>
          </button>
        );
      })}
    </div>

    {!mode && <div className="catalog-tabs"><button aria-pressed={tab === "products"} className={`${button} ${tab === "products" ? "bg-orange-50 border-orange-400" : "bg-white"}`} onClick={() => { setTab("products"); setSearch(""); }}><Package className="inline ml-2" size={16} />المنتجات</button><button aria-pressed={tab === "stores"} className={`${button} ${tab === "stores" ? "bg-orange-50 border-orange-400" : "bg-white"}`} onClick={() => { setTab("stores"); setSearch(""); }}><StoreIcon className="inline ml-2" size={16} />المتاجر</button></div>}
    {error && !editor && <p role="alert" className="bg-red-50 text-red-700 rounded-xl p-3">{error}</p>}{message && <p role="status" className="bg-emerald-50 text-emerald-800 rounded-xl p-3">{message}</p>}

    <div className="catalog-filters"><label className="relative min-w-0"><Search className="absolute right-3 top-3.5 text-slate-400" size={16} /><input aria-label="بحث الكتالوج" className={`${input} pr-9`} placeholder="ابحث بالاسم أو المتجر" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      {tab === "products" && <>{!fixedStoreId && (
        <select aria-label="تصفية حسب المتجر" className={input} value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="">جميع المتاجر ({scopedProducts.length} صنف مسجل)</option>
          {stores.map((item) => {
            const count = scopedProducts.filter(p => matchStoreId(p.storeId, item.id)).length;
            return (
              <option key={item.id} value={item.id}>
                {item.name} ({count} صنف)
              </option>
            );
          })}
        </select>
      )}<select aria-label="تصفية حسب التصنيف" className={input} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">كل التصنيفات</option>{productCategories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="تصفية حسب التوافر" className={input} value={availability} onChange={(e) => setAvailability(e.target.value)}><option value="active">كل المنتجات النشطة</option><option value="available">متاحة بالمنيو</option><option value="unavailable">غير متاحة</option><option value="archived">الأرشيف والمؤرشفة 📦</option></select><select aria-label="ترتيب المنتجات" value={sort} onChange={(e) => setSort(e.target.value)} className={input}><option value="name">الاسم</option><option value="price">السعر الأقل</option><option value="sales">الأكثر مبيعًا</option></select></>}
    </div>

    {/* ── Toolbar with Rows-Per-Page Selector ── */}
    <div className="catalog-results-toolbar flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-2xl">
      <div className="flex items-center gap-3">
        <p role="status" className="text-xs font-bold text-slate-700">
          {availability === 'archived' ? (
            <span className="text-amber-800 flex items-center gap-1.5">
              <Archive size={15} />
              أصناف الأرشيف: {resultCount} صنف
            </span>
          ) : (
            <span>{resultCount} {tab === "products" ? "منتج" : "متجر"}</span>
          )}
          {resultCount > 0 && ` · عرض ${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, resultCount)}`}
        </p>

        {tab === "products" && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-2 border-r pr-3">
            <span className="font-bold">صفوف الصفحة:</span>
            <select
              aria-label="عدد الصفوف المعروضة"
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="p-1 border border-slate-300 rounded-lg bg-slate-50 text-xs font-bold focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value={15}>15 صنف</option>
              <option value={25}>25 صنف</option>
              <option value={50}>50 صنف</option>
              <option value={100}>100 صنف</option>
              <option value={250}>250 صنف</option>
              <option value={1000}>عرض الكل</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {hasFilters && <button onClick={clearFilters} className="compact-row-action btn btn-outline-secondary">مسح التصفية</button>}
        <div className="catalog-view-switch" role="group" aria-label="طريقة عرض الكتالوج">
          <button aria-label="عرض كجدول" aria-pressed={view === "table"} onClick={() => setView("table")}><List size={16} />جدول</button>
          <button aria-label="عرض كبطاقات" aria-pressed={view === "cards"} onClick={() => setView("cards")}><LayoutGrid size={16} />بطاقات</button>
        </div>
      </div>
    </div>

    {tab === "products" && !stores.length && <div className="catalog-first-store"><StoreIcon size={21} /><div><strong>ابدأ بإضافة متجرك</strong><p>بعد حفظ بيانات المتجر، أضف أصنافه وأسعاره وصوره.</p></div><button className="admin-primary btn btn-primary" onClick={() => open("stores")}>إضافة أول متجر</button></div>}
    {view === "table" && resultCount > 0 && <p className="catalog-scroll-hint">اسحب الجدول أفقيًا لعرض بقية الأعمدة.</p>}
{view === "table" && resultCount > 0 ? (
      tab === "products" ? (
        <CatalogProductTable
          onPublish={product => {
            if (window.confirm(`اعتماد تعريف «${product.name}» في الكتالوج العام ليختاره التجار؟ سيصبح تعريفه ثابتًا مع بقاء أسعار المتاجر مستقلة.`)) {
              void perform(async () => {
                await adminApi("data", { action: "catalog-publish", id: product.id });
              }, "اعتمد المنتج في الكتالوج العام دون إنشاء عرض جديد.");
            }
          }}
          products={visibleProducts}
          stores={stores}
          performance={performance}
          busy={busy}
          onEdit={id => open("products", id)}
          onAvailability={changeAvailability}
          onArchive={handleArchive}
          onDelete={handleDeleteProduct}
        />
      ) : (
        <>
          {/* Stoppages Monitor Header for Stores */}
          {tab === "stores" && (
            <div className="mb-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`w-3 h-3 rounded-full ${localStores.some(s => s.status === 'closed') ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <div>
                    <h3 className="text-xs font-black text-slate-900">مراقبة توقف وتشغيل المتاجر (Store Stoppage Monitor)</h3>
                    <p className="text-[11px] text-slate-500">
                      {localStores.filter(s => s.status === 'closed').length > 0
                        ? `يوجد ${localStores.filter(s => s.status === 'closed').length} متجر متوقف حالياً عن استقبال الطلبات.`
                        : 'جميع المتاجر الشريكة تعمل وتستقبل الطلبات بشكل طبيعي.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowStoppageLogs(v => !v)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Clock size={14} />
                  <span>{showStoppageLogs ? 'إخفاء سجل التوقفات' : 'عرض سجل توقفات المتاجر'}</span>
                </button>
              </div>

              {/* Expandable Stoppages History Log */}
              {showStoppageLogs && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-700">سجل فترات التوقف السابقة المسجلة من لوحة التاجر والإدارة:</h4>
                  {adminStoppageLogs.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-xs">
                      لا توجد فترات توقف مسجلة بعد في النظام.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 text-[10px]">
                            <th className="py-2 font-bold">المتجر</th>
                            <th className="py-2 font-bold">بداية التوقف</th>
                            <th className="py-2 font-bold">الاستئناف</th>
                            <th className="py-2 font-bold">المدة الإجمالية</th>
                            <th className="py-2 font-bold">المسؤول</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {adminStoppageLogs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-slate-50">
                              <td className="py-2 font-sans font-bold text-slate-800">{log.storeName || log.storeId}</td>
                              <td className="py-2 text-slate-600">
                                {new Date(log.stoppedAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td className="py-2 text-slate-600">
                                {log.resumedAt ? new Date(log.resumedAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : <span className="text-rose-600 font-bold font-sans">قيد التوقف</span>}
                              </td>
                              <td className="py-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.status === 'closed' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                                  {log.durationLabel || (log.durationMinutes ? `${log.durationMinutes} دقيقة` : 'جاري الحساب')}
                                </span>
                              </td>
                              <td className="py-2 font-sans text-slate-500">{log.stoppedBy || 'مدير المتجر'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <CatalogStoreTable
            stores={pagedStores}
            products={products}
            busy={busy}
            onEdit={id => open("stores", id)}
            onStatus={store => perform(async () => {
              const nextStatus = store.status === "open" ? "closed" : "open";
              const now = Date.now();

              // 1. Optimistic UI update immediately
              setLocalStores(prev => prev.map(s => s.id === store.id ? { ...s, status: nextStatus } : s));
              onStoreUpdate?.({ ...store, status: nextStatus });

              // 2. Direct Supabase update (authorized admin)
              let directSucceeded = false;
              try {
                const { error: supaErr } = await supabase
                  .from("stores")
                  .update({ 
                    status: nextStatus, 
                    updated_at: new Date().toISOString(),
                    stopped_at: nextStatus === 'closed' ? new Date().toISOString() : null
                  })
                  .eq("id", store.id);
                if (!supaErr) {
                  directSucceeded = true;
                } else {
                  console.warn("Direct Supabase status update warning:", supaErr);
                }
              } catch (e) {
                console.warn("Direct Supabase status update exception:", e);
              }

              // 3. Authenticated server API update
              try {
                await operationsApi('operations', { action: 'set-store-status', storeId: store.id, status: nextStatus });
              } catch (apiErr) {
                try {
                  await saveRecord("stores", store.id, { status: nextStatus });
                } catch (saveErr) {
                  console.warn("saveRecord fallback warning:", saveErr);
                  if (!directSucceeded) throw saveErr;
                }
              }

              // 4. Stoppage audit logs in localStorage
              const stoppageKey = 'sangoub_store_stoppage_' + store.id;
              const globalLogKey = 'sangoub_all_stores_stoppages_log';
              if (nextStatus === 'closed') {
                const rec = { storeId: store.id, storeName: store.name, stoppedAt: now, stoppedBy: 'إدارة المنصة', status: 'closed' };
                localStorage.setItem(stoppageKey, JSON.stringify(rec));
                const logs = JSON.parse(localStorage.getItem(globalLogKey) || '[]');
                logs.unshift({ ...rec, id: 'stop_' + now });
                localStorage.setItem(globalLogKey, JSON.stringify(logs.slice(0, 50)));
                setAdminStoppageLogs(logs.slice(0, 50));
              } else {
                localStorage.removeItem(stoppageKey);
              }

              // 5. Notify parent catalog refresh
              if (onProductsRefresh) {
                onProductsRefresh();
              }
            }, nextStatus === "closed" ? "تم إيقاف المتجر مؤقتاً بنجاح." : "تم فتح المتجر واستئناف استقبال الطلبات بنجاح.")}
            onDelete={store => { if (window.confirm(`هل أنت متأكد من حذف متجر "${store.name}" نهائياً من النظام؟`)) { perform(() => deleteRecord("stores", store.id), "تم حذف المتجر نهائياً من النظام."); } }}
          />
        </>
      )
    ) : <>
    {tab === "products" ? <><p className="text-xs text-slate-500">{filtered.length} منتج · المبيعات من الأصناف المسلّمة في السجلات المتاحة، قبل خصم القسائم ورسوم التوصيل. التوافر يدوي؛ لا يمثل عدد القطع في المخزن.</p><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{visibleProducts.map((product) => {
      const stats = performance.get(product.id);
      return <article key={product.id} className={`bg-white rounded-2xl border overflow-hidden ${product.archived ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'}`}><div className="flex gap-3 p-4"><div className="relative w-20 h-20 shrink-0 bg-slate-100 rounded-xl overflow-hidden"><ImageIcon className="absolute m-6 text-slate-300" />{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="relative w-full h-full object-cover" onLoad={(e) => { e.currentTarget.style.visibility = "visible"; }} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : null}</div><div className="min-w-0"><h2 className={`font-bold break-words ${product.archived ? 'line-through text-slate-500' : ''}`}>{product.name}</h2><p className="text-xs text-slate-500 mt-1">{stores.find((store) => store.id === product.storeId)?.name || product.storeName} · {product.category}</p><strong className="block text-orange-700 mt-2">{formatEGP(product.price)}</strong></div></div>
        <p className="px-4 text-xs text-slate-500 line-clamp-2 min-h-8">{product.description}</p><div className="grid grid-cols-3 text-center text-xs m-4 p-3 rounded-xl bg-slate-50 gap-2"><span><strong className="block">{stats?.sold || 0}</strong>قطعة مسلّمة</span><span><strong className="block">{stats?.pending || 0}</strong>قيد التنفيذ</span><span><strong className="block">{formatEGP(stats?.revenue || 0)}</strong>قيمة الأصناف</span></div>
<div className="flex flex-wrap gap-2 border-t p-3">
          {!product.archived && (
            <button
              disabled={busy || Boolean(product.catalogProductId)}
              onClick={() => {
                if (window.confirm(`اعتماد «${product.name}» بالكتالوج العام؟`)) {
                  void perform(async () => {
                    await adminApi("data", { action: "catalog-publish", id: product.id });
                  }, "اعتمد المنتج بالكتالوج العام.");
                }
              }}
              className={button}
            >
              {product.catalogProductId ? "معتمد بالكتالوج العام" : "اعتماد بالكتالوج العام"}
            </button>
          )}
          <button disabled={busy} onClick={() => open("products", product.id)} className={button}><Pencil size={14} className="inline ml-1" />تعديل</button>
          {mode === "offers" && (
            <button
              disabled={busy}
              onClick={() => {
                setOfferModalProduct(product);
                setOfferOrigPrice(product.originalPrice || product.price);
                setOfferPrice(product.price);
                setOfferTitle((product as any).offerTitle || `${product.name} - عرض خاص`);
                setIsOccasion(Boolean((product as any).isOccasion));
                setOccasionName((product as any).occasionName || "");
                setOfferBadge(product.badge || "عرض خاص 🔥");
                setOfferStartDate((product as any).offerStartDate || new Date().toISOString().split('T')[0]);
                setOfferEndDate((product as any).offerEndDate || "");
                setOfferMaxPerOrder(product.maxPerOrder || 3);
              }}
              className={`${button} bg-orange-50 hover:bg-orange-100 text-orange-800 border-orange-200 font-bold`}
              title="تعديل نسبة وسعر العرض"
            >
              <Tag size={14} className="inline ml-1" />
              تعديل العرض
            </button>
          )}
          {mode === "offers" && Boolean(product.originalPrice && product.originalPrice > product.price) && (
            <button
              disabled={busy}
              onClick={async () => {
                const orig = product.originalPrice || product.price;
                if (window.confirm(`هل أنت متأكد من إلغاء العرض عن "${product.name}" واستعادة السعر الأصلي (${orig} ج.م)؟`)) {
                  await perform(async () => {
                    await saveRecord("products", product.id, { price: orig, originalPrice: null });
                    try {
                      await supabase.from("products").update({ price: orig, original_price: null }).eq("id", product.id);
                    } catch (err) {
                      console.warn("Failed to cancel offer in Supabase:", err);
                    }
                  }, "تم إلغاء العرض بنجاح واستعادة السعر الأصلي.");
                }
              }}
              className={`${button} text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 font-bold`}
              title="إلغاء الخصم واستعادة السعر الطبيعي"
            >
              إلغاء العرض
            </button>
          )}
          {!product.archived && <button disabled={busy} onClick={() => changeAvailability(product)} className={`${button} ${product.inStock ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>{product.inStock ? "متاح — إيقاف" : "غير متاح — تفعيل"}</button>}
          {product.archived ? (
            <button
              disabled={busy}
              onClick={() => handleArchive(product)}
              className={`${button} bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs`}
            >
              <RotateCcw size={14} className="inline ml-1" />
              استعادة الصنف
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => handleArchive(product)}
              className={`${button} text-slate-600`}
            >
              <Archive size={14} className="inline ml-1" />
              أرشفة
            </button>
          )}
          {product.archived && (
            <button
              disabled={busy}
              onClick={() => handleDeleteProduct(product)}
              className={`${button} text-red-600 hover:bg-red-50 border-red-200 font-bold`}
              title="حذف الصنف نهائياً"
            >
              <Trash2 size={14} className="inline ml-1" />
              حذف نهائي
            </button>
          )}
        </div>
      </article>;
    })}</div>{!filtered.length && <div className="p-10 text-center rounded-2xl border bg-white space-y-3"><Package className="mx-auto text-slate-300" /><p>{mode === "offers" ? "لا توجد عروض في هذا العرض. اختر منتجًا من زر إضافة عرض، أو راجع التصفية." : products.length ? "لا توجد منتجات تطابق البحث." : "لم تُضف منتجات بعد. أضف متجرًا ثم أول منتج حقيقي."}</p><button className={button} onClick={() => { setSearch(""); setCategory(""); setStoreFilter(""); setAvailability("active"); }}>مسح التصفية</button></div>}</> : <div className="grid md:grid-cols-2 gap-4">{pagedStores.map((store) => <article key={store.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">{(store.banner || store.bannerUrl || store.imageUrl) && <img src={store.banner || store.bannerUrl || store.imageUrl} alt={store.name} className="h-36 w-full object-cover" />}<div className="p-5 space-y-3"><div className="flex gap-3 items-center">{(store.logo || store.logoUrl) && <img src={store.logo || store.logoUrl} alt={`شعار ${store.name}`} className="w-12 h-12 rounded-xl object-contain border" />}<div><h2 className="font-bold">{store.name}</h2><p className="text-xs text-slate-500">{store.type}</p></div></div><p className="text-sm text-slate-600">{store.locationInDistrict}</p><p className="text-xs">{active.filter((item) => item.storeId === store.id).length} منتج · الحد الأدنى {formatEGP(store.minOrder)} · التوصيل {formatEGP(store.deliveryFee)}</p><div className="flex gap-2 flex-wrap"><button disabled={busy} onClick={() => open("stores", store.id)} className={button}>تعديل المتجر والصور</button><button disabled={busy} onClick={() => perform(async () => {
  const nextStatus = store.status === "open" ? "closed" : "open";
  const now = Date.now();
  setLocalStores(prev => prev.map(s => s.id === store.id ? { ...s, status: nextStatus } : s));
  onStoreUpdate?.({ ...store, status: nextStatus });
  let directSucceeded = false;
  try {
    const { error: supaErr } = await supabase.from("stores").update({ 
      status: nextStatus, 
      updated_at: new Date().toISOString(),
      stopped_at: nextStatus === 'closed' ? new Date().toISOString() : null
    }).eq("id", store.id);
    if (!supaErr) directSucceeded = true;
  } catch {}
  try {
    await operationsApi('operations', { action: 'set-store-status', storeId: store.id, status: nextStatus });
  } catch {
    try { await saveRecord("stores", store.id, { status: nextStatus }); } catch (e) {
      if (!directSucceeded) throw e;
    }
  }
  const stoppageKey = 'sangoub_store_stoppage_' + store.id;
  const globalLogKey = 'sangoub_all_stores_stoppages_log';
  if (nextStatus === 'closed') {
    const rec = { storeId: store.id, storeName: store.name, stoppedAt: now, stoppedBy: 'إدارة المنصة', status: 'closed' };
    localStorage.setItem(stoppageKey, JSON.stringify(rec));
    const logs = JSON.parse(localStorage.getItem(globalLogKey) || '[]');
    logs.unshift({ ...rec, id: 'stop_' + now });
    localStorage.setItem(globalLogKey, JSON.stringify(logs.slice(0, 50)));
    setAdminStoppageLogs(logs.slice(0, 50));
  } else {
    localStorage.removeItem(stoppageKey);
  }
  if (onProductsRefresh) onProductsRefresh();
}, store.status === "open" ? "تم إيقاف المتجر مؤقتاً بنجاح." : "تم فتح المتجر واستئناف استقبال الطلبات بنجاح.")} className={`${button} ${store.status === "open" ? "text-emerald-700" : "text-amber-700"}`}>{store.status === "open" ? "مفتوح — إغلاق مؤقت" : "مغلق أو مشغول — فتح"}</button><button disabled={busy} onClick={() => { if (window.confirm(`هل أنت متأكد من حذف متجر "${store.name}" نهائياً من النظام؟`)) { perform(() => deleteRecord("stores", store.id), "تم حذف المتجر نهائياً من النظام."); } }} className={`${button} text-red-600 hover:bg-red-50 border-red-200`}>حذف المتجر</button></div></div></article>)}{!visibleStores.length && <p className="p-8 bg-white border rounded-xl">لا توجد متاجر تطابق البحث. يمكنك إضافة متجر من الزر أعلاه.</p>}</div>}
    </>}
    {tab === "products" && view === "table" && resultCount > 0 && <p className="catalog-data-note">المبيعات من الأصناف المسلّمة. التوافر يحدد إمكانية الطلب ولا يمثل كمية المخزون.</p>}
    {resultCount > pageSize && <nav className="admin-pagination catalog-pagination" aria-label="صفحات الكتالوج"><span>صفحة {currentPage + 1} من {lastPage + 1}</span><div><button className="compact-row-action btn btn-outline-secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronRight size={15} />السابق</button><button className="compact-row-action btn btn-outline-secondary" disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}>التالي<ChevronLeft size={15} /></button></div></nav>}
    {mode === "offers" && <p className="catalog-data-note">لتفعيل عرض، اختر منتجًا وحدد سعر البيع والسعر قبل الخصم. لإلغاء العرض، امسح السعر قبل الخصم. المنتجات المؤرشفة أو غير المتاحة والمتاجر المغلقة لا تظهر في صفحة العروض.</p>}
    {/* 1. Modal: Pick Product for New Offer */}
    {isNewOfferPickerOpen && (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
        <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          <header className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                <Tag size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">اختيار منتج لتفعيل عرض تخفيض</h3>
                <p className="text-[11px] text-slate-500">اختر المنتج الذي ترغب في إنشاء خصم ترويجي عليه ليظهر في المتجر وصفحة العروض</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setIsNewOfferPickerOpen(false); setOfferPickerSearch(""); }}
              className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
            >
              <X size={15} />
            </button>
          </header>

          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="search"
                placeholder="ابحث بالاسم أو المتجر أو التصنيف…"
                value={offerPickerSearch}
                onChange={(e) => setOfferPickerSearch(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100">
            {active
              .filter(p => !offerPickerSearch.trim() || `${p.name} ${p.storeName} ${p.category}`.toLowerCase().includes(offerPickerSearch.trim().toLowerCase()))
              .slice(0, 50)
              .map(p => {
                const store = localStores.find(s => matchStoreId(s.id, p.storeId) || s.id === p.storeId);
                const isStoreClosed = store?.status === 'closed';
                const hasOffer = Boolean(p.originalPrice && p.originalPrice > p.price);

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (isStoreClosed) {
                        alert(`لا يمكن تفعيل أو إضافة عرض لمنتج تابع لمتجر مغلق (${store?.name || 'المتجر'}). يرجى فتح المتجر أولاً لاستقبال العروض والطلبات.`);
                        return;
                      }
                      setIsNewOfferPickerOpen(false);
                      setOfferPickerSearch("");
                      setOfferModalProduct(p);
                      setOfferOrigPrice(p.originalPrice || p.price);
                      setOfferPrice(hasOffer ? p.price : Math.round(p.price * 0.8));
                      setOfferTitle((p as any).offerTitle || `${p.name} - عرض ترويجي`);
                      setIsOccasion(Boolean((p as any).isOccasion));
                      setOccasionName((p as any).occasionName || "");
                      setOfferBadge(p.badge || "عرض خاص 🔥");
                      setOfferStartDate((p as any).offerStartDate || new Date().toISOString().split('T')[0]);
                      setOfferEndDate((p as any).offerEndDate || "");
                      setOfferMaxPerOrder(p.maxPerOrder || 3);
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-between gap-3 text-right transition ${
                      isStoreClosed ? 'opacity-60 bg-slate-50 cursor-not-allowed' : 'hover:bg-orange-50/70 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300">📦</div>}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{p.name}</h4>
                        <span className="text-[10px] text-slate-500 block truncate">{store?.name || p.storeName} · {p.category}</span>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <strong className="text-xs font-black font-mono text-orange-700 block">{formatEGP(p.price)}</strong>
                      {isStoreClosed ? (
                        <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded inline-block">متجر مغلق 🚫</span>
                      ) : hasOffer ? (
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded inline-block">عرض نشط 🔥</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    )}

    {/* 2. Modal: Create / Edit Offer on Selected Product */}
    {offerModalProduct && (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
          <header className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                <Tag size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">إدارة وتفعيل عرض ترويجي</h3>
                <p className="text-[11px] text-slate-500">تحديد السعر قبل وبعد الخصم ليظهر في شريط العروض بالمتجر</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOfferModalProduct(null)}
              className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
            >
              <X size={15} />
            </button>
          </header>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const store = localStores.find(s => matchStoreId(s.id, offerModalProduct.storeId) || s.id === offerModalProduct.storeId);
              if (store && store.status === 'closed') {
                setError(`لا يمكن تفعيل أو حفظ عرض لمتجر مغلق حالياً (${store.name}). يرجى فتح المتجر أولاً لاستقبال العروض والطلبات.`);
                return;
              }

              const orig = Number(offerOrigPrice);
              const p = Number(offerPrice);
              if (!Number.isFinite(orig) || !Number.isFinite(p) || p <= 0 || orig <= p) {
                setError("السعر قبل الخصم يجب أن يكون أكبر من سعر البيع المخفض.");
                return;
              }
              const offerPayload = {
                price: p,
                originalPrice: orig,
                offerTitle: offerTitle.trim() || undefined,
                isOccasion: Boolean(isOccasion),
                occasionName: isOccasion && occasionName.trim() ? occasionName.trim() : undefined,
                badge: offerBadge.trim() || (isOccasion ? occasionName.trim() : "عرض خاص 🔥"),
                offerStartDate: offerStartDate || undefined,
                offerEndDate: offerEndDate || undefined,
                maxPerOrder: Number(offerMaxPerOrder) > 0 ? Number(offerMaxPerOrder) : undefined,
                inStock: true
              };

              await perform(async () => {
                await saveRecord("products", offerModalProduct.id, offerPayload);
                try {
                  await supabase.from("products").update({
                    price: p,
                    original_price: orig,
                    is_available: true
                  }).eq("id", offerModalProduct.id);
                } catch (err) {
                  console.warn("Failed to sync offer to Supabase:", err);
                }
                setLocalProducts(prev => prev.map(item => item.id === offerModalProduct.id ? { ...item, ...offerPayload } : item));
                if (onProductUpdate) {
                  onProductUpdate({ ...offerModalProduct, ...offerPayload });
                }
              }, `تم تفعيل وحفظ تفاصيل العرض بنجاح على "${offerModalProduct.name}"!`);
              setOfferModalProduct(null);
            }}
            className="p-5 space-y-3.5 text-xs overflow-y-auto max-h-[75vh]"
          >
            {/* Product summary tile */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white overflow-hidden shrink-0 border border-slate-200">
                {offerModalProduct.imageUrl ? <img src={offerModalProduct.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300">📦</div>}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">{offerModalProduct.name}</h4>
                <span className="text-[10px] text-slate-500 block">{stores.find(s => s.id === offerModalProduct.storeId)?.name || offerModalProduct.storeName}</span>
                <span className="text-[10px] font-mono text-slate-600 block mt-0.5">السعر الأساسي الحالي: {formatEGP(offerModalProduct.originalPrice || offerModalProduct.price)}</span>
              </div>
            </div>

            {/* Offer Campaign Title */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم العرض / عنوان الحملة الترويجية *</label>
              <input
                type="text"
                required
                value={offerTitle}
                onChange={(e) => setOfferTitle(e.target.value)}
                placeholder="مثال: فطار الصباح بالحي الحكومي، وجبة التوفير العائلية..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Occasion / Season Section */}
            <div className="bg-orange-50/50 p-3 rounded-2xl border border-orange-200/60 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isOccasion}
                  onChange={(e) => setIsOccasion(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500"
                />
                <span className="text-[11px] font-black text-orange-950">هل هذا العرض مرتبط بمناسبة خاصة أو موسم معين؟</span>
              </label>

              {isOccasion && (
                <div className="pt-1.5 space-y-2 animate-in fade-in">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">اختر أو اكتب اسم المناسبة:</label>
                    <div className="flex gap-1.5 flex-wrap mb-1.5">
                      {["فطار الوزارات والعمل الصباحي", "عروض نهاية الأسبوع", "الجمعة البيضاء", "العودة للعمل والمدارس", "شهر رمضان المبارك"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setOccasionName(preset)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                            occasionName === preset
                              ? "bg-orange-600 text-white border-orange-600"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-orange-50"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={occasionName}
                      onChange={(e) => setOccasionName(e.target.value)}
                      placeholder="اسم المناسبة..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Pricing Section */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">السعر الأصلي (قبل الخصم) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={offerOrigPrice}
                  onChange={(e) => setOfferOrigPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر العرض المخفض (للزبون) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  required
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-orange-300 rounded-xl font-mono text-xs font-black text-emerald-800 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Quick discount chips */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-1.5">اختيار نسبة خصم سريعة:</span>
              <div className="flex gap-1.5 flex-wrap">
                {[10, 15, 20, 25, 30, 50].map((pct) => {
                  const orig = Number(offerOrigPrice) || offerModalProduct.price;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setOfferPrice(Math.round(orig * (1 - pct / 100)));
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-800 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      خصم {pct}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Badge & Max per order */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الشارة الترويجية (Badge)</label>
                <input
                  type="text"
                  value={offerBadge}
                  onChange={(e) => setOfferBadge(e.target.value)}
                  placeholder="مثال: عرض خاص 🔥، وفر أكثر..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الحد الأقصى للطلب الواحد</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={offerMaxPerOrder}
                  onChange={(e) => setOfferMaxPerOrder(e.target.value)}
                  placeholder="الافتراضي: 3 قطع"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">تاريخ بدء العرض</label>
                <input
                  type="date"
                  value={offerStartDate}
                  onChange={(e) => setOfferStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">تاريخ انتهاء العرض (اختياري)</label>
                <input
                  type="date"
                  value={offerEndDate}
                  onChange={(e) => setOfferEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            {/* Live Preview Badge */}
            {Number(offerOrigPrice) > Number(offerPrice) && Number(offerPrice) > 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 font-bold">
                <span className="flex items-center gap-1.5">
                  <span>🔥</span>
                  <span>نسبة الخصم: {Math.round((1 - Number(offerPrice) / Number(offerOrigPrice)) * 100)}%</span>
                </span>
                <span className="font-mono text-xs">وفرت للعميل {formatEGP(Number(offerOrigPrice) - Number(offerPrice))}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
              {Boolean(offerModalProduct.originalPrice && offerModalProduct.originalPrice > offerModalProduct.price) && (
                <button
                  type="button"
                  onClick={async () => {
                    const orig = offerModalProduct.originalPrice || offerModalProduct.price;
                    if (window.confirm(`هل ترغب في إلغاء العرض والعودة للسعر الأصلي (${orig} ج.م)؟`)) {
                      await perform(async () => {
                        await saveRecord("products", offerModalProduct.id, { price: orig, originalPrice: null });
                        try {
                          await supabase.from("products").update({ price: orig, original_price: null }).eq("id", offerModalProduct.id);
                        } catch (err) {
                          console.warn("Failed to reset offer in Supabase:", err);
                        }
                      }, "تم إلغاء العرض بنجاح واستعادة السعر الأصلي.");
                      setOfferModalProduct(null);
                    }
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold cursor-pointer transition text-xs"
                >
                  إلغاء الخصم
                </button>
              )}

              <div className="flex items-center gap-2 mr-auto">
                <button
                  type="button"
                  onClick={() => setOfferModalProduct(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={14} />
                  <span>تفعيل وحفظ العرض</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    )}
    {editor?.kind === "products" && mode !== "offers" && (
      <EnterpriseProductModal
        product={selectedProduct}
        stores={stores}
        preselectedStoreId={storeFilter}
        busy={busy}
        onClose={() => { setEditor(null); setError(""); }}
        onSave={async (payload) => {
          const id = editor.id || crypto.randomUUID();
          await perform(async () => {
            const productDoc = {
              ...(selectedProduct ? {} : { id, archived: false, imageType: "croissant" }),
              ...payload,
            };
            await saveRecord("products", id, productDoc);

            // Synchronize directly with Supabase products table
            try {
              await supabase.from("products").upsert({
                id,
                store_id: payload.storeId,
                name: payload.name,
                name_en: payload.nameEn || null,
                description: payload.description,
                price: payload.price,
                original_price: payload.originalPrice || null,
                category: payload.category,
                category_id: payload.categoryId || null,
                barcode: payload.barcode || null,
                merchant_pos_sku: payload.merchantPosSku || null,
                is_available: payload.inStock,
                image_url: payload.imageUrl || null,
              });
            } catch (err) {
              console.error("Error syncing product to Supabase:", err);
            }
          }, selectedProduct ? "تم تحديث الصنف بنجاح!" : "تمت إضافة الصنف بنجاح إلى الكتالوج!");
        }}
      />
    )}

    {excelModalOpen && (
      <BulkProductImportModal
        stores={stores}
        categories={taxonomyCategories}
        onClose={() => setExcelModalOpen(false)}
        onSuccess={(count) => {
          setMessage(`🎉 تم استيراد ${count} صنف بنجاح وإضافتها إلى الكتالوج!`);
        }}
      />
    )}

    {editor?.kind === "stores" && (
      <StoreEditorModal
        store={selectedStore}
        busy={busy}
        onClose={() => {
          setEditor(null);
        }}
        onSave={async (payload) => {
          const storeId = payload.id;
          const ok = await perform(async () => {
            // 1. Direct Sync to Supabase `stores` table
            let directSupabaseSucceeded = false;
            try {
              const { error: supaErr } = await supabase.from("stores").upsert({
                id: storeId,
                name: payload.name,
                name_en: payload.nameEn || null,
                type: payload.type,
                category: payload.category,
                status: payload.status,
                delivery_time: payload.deliveryTime,
                min_order: payload.minOrder,
                delivery_fee: payload.deliveryFee,
                location_in_district: payload.address,
                precise_address: payload.preciseAddress || payload.address || null,
                latitude: payload.latitude ?? null,
                longitude: payload.longitude ?? null,
                commission_rate: payload.commissionRate ?? null,
                tax_rate: payload.taxRate,
                tax_number: payload.taxRegistrationNumber || null,
                tax_registration_number: payload.taxRegistrationNumber || null,
                banner: payload.bannerUrl || null,
                banner_url: payload.bannerUrl || null,
                logo: payload.logoUrl || null,
                logo_url: payload.logoUrl || null,
                prices_include_tax: payload.pricesIncludeTax,
                updated_at: new Date().toISOString(),
              });
              if (!supaErr) {
                directSupabaseSucceeded = true;
              } else {
                console.warn("Direct Supabase store upsert warning:", supaErr);
              }
            } catch (supaErr) {
              console.warn("Direct Supabase store upsert exception:", supaErr);
            }

            // 2. Save via authenticated server API (service_role)
            const storeDoc = {
              id: storeId,
              name: payload.name,
              nameEn: payload.nameEn,
              type: payload.type,
              category: payload.category,
              status: payload.status,
              deliveryTime: payload.deliveryTime,
              minOrder: payload.minOrder,
              deliveryFee: payload.deliveryFee,
              locationInDistrict: payload.address,
              preciseAddress: payload.preciseAddress || payload.address,
              latitude: payload.latitude,
              longitude: payload.longitude,
              coordinates: payload.latitude != null && payload.longitude != null ? { latitude: payload.latitude, longitude: payload.longitude } : undefined,
              imageUrl: payload.bannerUrl,
              bannerUrl: payload.bannerUrl,
              banner: payload.bannerUrl,
              logoUrl: payload.logoUrl,
              logo: payload.logoUrl,
              commissionRate: payload.commissionRate,
              taxRate: payload.taxRate,
              taxRegistrationNumber: payload.taxRegistrationNumber,
              pricesIncludeTax: payload.pricesIncludeTax,
              rating: selectedStore?.rating ?? 5,
              ratingCount: selectedStore?.ratingCount ?? 120,
              updatedAt: new Date().toISOString(),
            };
            try {
              await saveRecord("stores", storeId, storeDoc);
            } catch (apiErr: any) {
              console.warn("API saveRecord warning:", apiErr);
              if (!directSupabaseSucceeded) {
                throw apiErr;
              }
            }

            // Update local stores state immediately
            const updatedStoreObj: Store = {
              id: storeId,
              name: payload.name,
              nameEn: payload.nameEn,
              type: payload.type,
              category: payload.category,
              status: payload.status,
              deliveryTime: payload.deliveryTime,
              minOrder: payload.minOrder,
              deliveryFee: payload.deliveryFee,
              locationInDistrict: payload.address,
              preciseAddress: payload.preciseAddress || payload.address,
              latitude: payload.latitude,
              longitude: payload.longitude,
              coordinates: payload.latitude != null && payload.longitude != null ? { latitude: payload.latitude, longitude: payload.longitude } : undefined,
              imageUrl: payload.bannerUrl,
              bannerUrl: payload.bannerUrl,
              banner: payload.bannerUrl,
              logoUrl: payload.logoUrl,
              logo: payload.logoUrl,
              commissionRate: payload.commissionRate,
              taxRate: payload.taxRate,
              taxRegistrationNumber: payload.taxRegistrationNumber,
              pricesIncludeTax: payload.pricesIncludeTax,
              rating: selectedStore?.rating ?? 5,
              ratingCount: selectedStore?.ratingCount ?? 120,
            };
            setLocalStores(prev => {
              const idx = prev.findIndex(s => s.id === storeId);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...updatedStoreObj };
                return next;
              }
              return [...prev, updatedStoreObj];
            });
            onStoreUpdate?.(updatedStoreObj);

            // 3. Update InstaPay / Vodafone Cash payment settings
            updateMerchantPaymentSettings(storeId, payload.paymentSettings);

            // 4. Refresh parent if callback exists
            if (onProductsRefresh) {
              onProductsRefresh();
            }
          }, selectedStore ? "🎉 تم تحديث بيانات وشعار وغلاف المتجر بنجاح!" : "🎉 تمت إضافة المتجر الجديد إلى الكتالوج بنجاح!");

          if (!ok) {
            throw new Error("تعذر حفظ بيانات المتجر. يرجى مراجعة الحقول والاتصال والمحاولة مجددًا.");
          }
        }}
      />
    )}

    {/* نافذة اختيار المتجر السريعة عند استعادة صنف يتيم */}
    {assignStoreModal && (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn space-y-5">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-lg text-slate-800">استعادة الصنف واختيار المتجر المسؤول</h3>
            <button
              type="button"
              onClick={() => setAssignStoreModal(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <span className="text-xs text-orange-700 font-bold block mb-1">الصنف المراد استعادته:</span>
              <strong className="text-slate-800 text-sm">{assignStoreModal.product.name}</strong>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                اختر المتجر لنقل واستعادة الصنف إليه:
              </label>
              <select
                value={assignStoreModal.selectedStoreId}
                onChange={e => setAssignStoreModal({ ...assignStoreModal, selectedStoreId: e.target.value })}
                className="w-full p-3 border border-slate-300 rounded-xl text-sm bg-white font-medium focus:outline-none focus:border-orange-500"
              >
                {!stores.some(s => s.id === 'a0000000-0000-0000-0000-000000000001') && (
                  <option value="a0000000-0000-0000-0000-000000000001">
                    سنجوب ماركت ⭐ (متجر سنجوب الرسمي)
                  </option>
                )}
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name} {store.name.includes("سنجوب") ? "⭐ (متجر سنجوب الرسمي)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              سيتم ربط الصنف بالمتجر المختار فوراً وتفعيله في المنيو ليتمكن العملاء من طلبه.
            </p>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <button
              type="button"
              disabled={busy || !assignStoreModal.selectedStoreId}
              onClick={async () => {
                const targetStore = stores.find(s => s.id === assignStoreModal.selectedStoreId);
                const prod = assignStoreModal.product;
                const updatedProd = {
                  ...prod,
                  archived: false,
                  inStock: true,
                  storeId: assignStoreModal.selectedStoreId,
                  storeName: targetStore?.name || prod.storeName || "سنجوب ماركت",
                };
                setLocalProducts(prev => prev.map(p => p.id === prod.id ? updatedProd : p));
                await perform(async () => {
                  const { error } = await supabase.from("products").update({
                    store_id: assignStoreModal.selectedStoreId,
                    archived: false,
                    is_available: true,
                  }).eq("id", prod.id);
                  if (error) throw error;
                  onProductUpdate?.(updatedProd);
                  setAssignStoreModal(null);
                }, `🎉 تمت استعادة الصنف وتفعيله في (${targetStore?.name || "سنجوب ماركت"}) بنجاح!`);
              }}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors"
            >
              {busy ? "جارٍ الاستعادة…" : "تأكيد واستعادة الصنف"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAssignStoreModal(null)}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    )}
  </section>;
}
