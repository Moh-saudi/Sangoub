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
} from "lucide-react";
import type { Order, Product, Store, Category } from "../types";
import { saveRecord, deleteRecord } from "../lib/firebase";
import { saveCatalogWithImages } from "../lib/catalogImages";
import { catalogPerformance, productCategories, productFormData, storeCategories } from "../utils/catalogManagement";
import { formatEGP } from "../utils/orderCalculations";
import { availableOffers, hasProductOffer } from "../utils/productOffers";
import { ImageFileField } from "./ImageFileField";
import { EnterpriseProductModal } from "./EnterpriseProductModal";
import { BulkProductImportModal } from "./BulkProductImportModal";
import { supabase } from "../lib/supabase";

const input = "form-control w-full border border-slate-300 rounded-xl p-3 bg-white text-sm text-slate-900";
const button = "rounded-xl px-4 py-2 text-sm font-bold border border-slate-200 disabled:opacity-40";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 space-y-2 text-xs font-bold text-slate-700"><span>{label}</span>{children}</label>;
}
function Editor({ title, busy, onClose, children, compact = false }: { title: string; busy: boolean; onClose: () => void; children: ReactNode; compact?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-label={title} className={`catalog-editor ${compact ? "catalog-editor-compact" : ""}`} dir="rtl">
    <header className="catalog-editor-heading flex justify-between items-center gap-3"><h2 className="font-black text-xl">{title}</h2><button type="button" aria-label="إغلاق المحرر" disabled={busy} onClick={onClose} className="p-2 rounded-xl border"><X size={18} /></button></header>{children}
  </dialog>;
}

export function CatalogManager({ products, stores, orders, searchRequest, mode }: { products: Product[]; stores: Store[]; orders: Order[]; mode?: "products" | "stores" | "offers"; searchRequest?:{term:string;kind:"products"|"stores";key:number} }) {
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
  const active = products.filter((item) => !item.archived);
  const discounted = active.filter(hasProductOffer);
  const metrics: [string, number][] = mode === "stores"
    ? [["متاجر مسجلة", stores.length], ["مفتوحة", stores.filter(store => store.status === "open").length], ["مشغولة", stores.filter(store => store.status === "busy").length], ["مغلقة", stores.filter(store => store.status === "closed").length]]
    : mode === "offers"
      ? [["عروض على المنتجات", discounted.length], ["ظاهرة للزوار", availableOffers(products, stores).length], ["منتجات العرض غير المتاحة", discounted.filter(product => !product.inStock).length], ["متاجر لديها عروض", new Set(discounted.map(product => product.storeId)).size]]
      : [["منتجات نشطة", active.length], ["متاحة بالمنيو", active.filter(item => item.inStock).length], ["غير متاحة", active.filter(item => !item.inStock).length], ["مؤرشفة", products.filter(item => item.archived).length]];
  const filtered = products.filter((item) => {
    const text = `${item.name} ${item.storeName} ${item.description}`.toLocaleLowerCase("ar");
    return (mode !== "offers" || hasProductOffer(item)) && text.includes(search.trim().toLocaleLowerCase("ar")) && (!storeFilter || item.storeId === storeFilter) && (!category || item.category === category) &&
      (availability === "archived" ? item.archived : !item.archived && (availability === "available" ? item.inStock : availability === "unavailable" ? !item.inStock : true));
  }).sort((a,b) => sort === "price" ? a.price - b.price : sort === "sales" ? (performance.get(b.id)?.sold || 0) - (performance.get(a.id)?.sold || 0) : a.name.localeCompare(b.name, "ar"));
  const visibleStores = stores.filter((store) => `${store.name} ${store.locationInDistrict}`.includes(search.trim()));
  useEffect(() => { setPage(0); }, [search, storeFilter, category, availability, sort, tab]);
  const resultCount = tab === "products" ? filtered.length : visibleStores.length;
  const lastPage = Math.max(0, Math.ceil(resultCount / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const visibleProducts = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const pagedStores = visibleStores.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const hasFilters = Boolean(search || (tab === "products" && (storeFilter || category || availability !== "active" || sort !== "name")));
  function clearFilters() { setSearch(""); setStoreFilter(""); setCategory(""); setAvailability("active"); setSort("name"); }
  const selectedProduct = editor?.kind === "products" ? products.find((item) => item.id === editor.id) : undefined;
  const selectedStore = editor?.kind === "stores" ? stores.find((item) => item.id === editor.id) : undefined;

  async function perform(operation: () => Promise<void>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); setMessage(success); return true; }
    catch (e) { setError(customerMessage(e, "تعذر الحفظ. أعد المحاولة.")); return false; }
    finally { setBusy(false); }
  }
  function open(kind: "products" | "stores", id?: string, enableOnSave = false) { setError(""); setMessage(""); setEditor({ kind, id, enableOnSave }); }
  function changeAvailability(product: Product) {
    if (!stores.some(store => store.id === product.storeId)) {
      open("products", product.id, !product.inStock);
      return;
    }
    void perform(() => saveRecord("products", product.id, { inStock: !product.inStock }), "تم تحديث توافر الصنف.");
  }
  async function handleDeleteProduct(product: Product) {
    if (window.confirm(`هل أنت متأكد من حذف الصنف "${product.name}" نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      await perform(async () => {
        await deleteRecord("products", product.id);
        try {
          await supabase.from("products").delete().eq("id", product.id);
        } catch (err) {
          console.error("Error deleting product from Supabase:", err);
        }
      }, "تم حذف الصنف نهائياً من النظام.");
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor || busy) return;
    const data = new FormData(event.currentTarget);
    const success = await perform(async () => {
      const id = editor.id || crypto.randomUUID();
      if (editor.kind === "products") {
        const previous = selectedProduct;
        if (editor.id && !previous) throw new Error("الصنف لم يعد موجودًا. حدّث القائمة.");
        if (mode === "offers" || previous?.catalogProductId) {
          if (!previous) throw new Error("اختر منتجًا موجودًا لإضافة العرض.");
          const price = Number(data.get("price"));
          const original = String(data.get("originalPrice") || "").trim();
          const originalPrice = original ? Number(original) : price;
          if (!Number.isFinite(price) || price < 0 || price > 100000 || !Number.isFinite(originalPrice) || originalPrice < price || originalPrice > 100000) throw new Error("راجع السعر؛ السعر قبل الخصم يجب ألا يقل عن سعر البيع.");
          const store = stores.find(item => item.id === (previous.storeId || data.get("storeId")));
          if (!store) throw new Error("اختر المتجر المسؤول عن المنتج قبل إتاحته.");
          await saveRecord("products", id, {
            price, originalPrice, inStock: !previous.archived && data.get("inStock") === "on",
            ...(!previous.storeId ? { storeId: store.id, storeName: store.name } : {}),
          });
          return;
        }
        const store = stores.find((item) => item.id === (previous?.storeId || data.get("storeId")));
        if (!store) throw new Error("اختر المتجر المسؤول عن الصنف.");
        const patch = productFormData(data, previous);
        const file = data.get("imageFile") as File | null;
        if (!patch.imageUrl && !file?.size) throw new Error("اختر صورة حقيقية للصنف أو أدخل رابطها.");
        await saveCatalogWithImages("products", id, {
          ...(previous ? {} : { id, imageType: "croissant", archived: false }),
          ...patch, storeId: store.id, storeName: store.name,
        }, [{ field: "imageUrl", file }]);
      } else {
        if (editor.id && !selectedStore) throw new Error("المتجر لم يعد موجودًا.");
        const commissionText=String(data.get('commissionRate')||'').trim();const commissionRate=commissionText===''?undefined:Number(commissionText);if(commissionRate!==undefined&&(!Number.isFinite(commissionRate)||commissionRate<0||commissionRate>100))throw new Error('راجع نسبة التعاقد.');
        const taxRate=Number(data.get("taxRate")||0);const taxRegistrationNumber=String(data.get("taxRegistrationNumber")||'').trim();if(!Number.isFinite(taxRate)||taxRate<0||taxRate>100||(taxRate>0&&!taxRegistrationNumber))throw new Error('راجع نسبة الضريبة ورقم التسجيل الضريبي.');
        const minOrder = Number(data.get("minOrder")); const deliveryFee = Number(data.get("deliveryFee"));
        if (!Number.isFinite(minOrder) || minOrder < 0 || minOrder > 100000 || !Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > 1000) throw new Error("راجع الحد الأدنى ورسوم التوصيل.");
        const name = String(data.get("name") || "").trim();
        const address = String(data.get("address") || "").trim();
        if (!name || !address) throw new Error("أدخل اسم المتجر وعنوانه الفعلي.");
        const imageUrl = String(data.get("imageUrl") || "").trim();
        const logoUrl = String(data.get("logoUrl") || "").trim();
        for (const url of [imageUrl, logoUrl]) if (url && new URL(url).protocol !== "https:") throw new Error("روابط الصور يجب أن تستخدم HTTPS.");
        await saveCatalogWithImages("stores", id, {
          ...(selectedStore ? {} : { id, logo: "🍽️", banner: "from-orange-600 to-slate-900", rating: 0, ratingCount: 0 }),
          name, nameEn: String(data.get("nameEn") || name).trim(), locationInDistrict: address,
          type: String(data.get("type")), category: String(data.get("category")), status: String(data.get("status")),
          deliveryTime: String(data.get("deliveryTime") || "لم يحدد بعد"), minOrder, deliveryFee,
          imageUrl, bannerUrl: imageUrl, logoUrl,...(commissionRate!==undefined?{commissionRate}:{}), taxRate,taxRegistrationNumber,pricesIncludeTax:data.get('pricesIncludeTax')==='on',
        }, [{ field: "bannerUrl", file: data.get("coverFile") as File | null }, { field: "logoUrl", file: data.get("logoFile") as File | null }]);
      }
    }, editor.id ? "تم حفظ التعديلات." : "تمت الإضافة إلى الكتالوج.");
    if (success) setEditor(null);
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
          onClick={() => mode === "offers" ? setOfferPicker(true) : open(tab)}
          className="admin-primary btn btn-primary flex items-center gap-1.5"
        >
          <Plus size={18} />
          {mode === "offers" ? "إضافة عرض على منتج" : tab === "products" ? "إضافة منتج" : "إضافة متجر"}
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
      {tab === "products" && <><select aria-label="تصفية حسب المتجر" className={input} value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}><option value="">كل المتاجر</option>{stores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="تصفية حسب التصنيف" className={input} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">كل التصنيفات</option>{productCategories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="تصفية حسب التوافر" className={input} value={availability} onChange={(e) => setAvailability(e.target.value)}><option value="active">كل المنتجات النشطة</option><option value="available">متاحة بالمنيو</option><option value="unavailable">غير متاحة</option><option value="archived">الأرشيف والمؤرشفة 📦</option></select><select aria-label="ترتيب المنتجات" value={sort} onChange={(e) => setSort(e.target.value)} className={input}><option value="name">الاسم</option><option value="price">السعر الأقل</option><option value="sales">الأكثر مبيعًا</option></select></>}
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
          onArchive={product => {
            if (product.archived) {
              setError("");
              setMessage("");
              const defaultStore = stores.find(s => s.id === product.storeId) || stores.find(s => s.id === 'a0000000-0000-0000-0000-000000000001') || stores.find(s => s.name.includes("سنجوب")) || stores[0];
              setAssignStoreModal({ product, selectedStoreId: defaultStore?.id || "" });
              return;
            }
            void perform(async () => {
              await saveRecord("products", product.id, { archived: true, inStock: false });
              try {
                await supabase.from("products").update({ archived: true, is_available: false }).eq("id", product.id);
              } catch {}
            }, "تم نقل الصنف إلى الأرشيف بنجاح.");
          }}
          onDelete={handleDeleteProduct}
        />
      ) : (
        <CatalogStoreTable
          stores={pagedStores}
          products={products}
          busy={busy}
          onEdit={id => open("stores", id)}
          onStatus={store => perform(() => saveRecord("stores", store.id, {status: store.status === "open" ? "closed" : "open"}), "تم تحديث حالة المتجر.")}
          onDelete={store => { if (window.confirm(`هل أنت متأكد من حذف متجر "${store.name}" نهائياً من النظام؟`)) { perform(() => deleteRecord("stores", store.id), "تم حذف المتجر نهائياً من النظام."); } }}
        />
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
          {!product.archived && <button disabled={busy} onClick={() => changeAvailability(product)} className={`${button} ${product.inStock ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>{product.inStock ? "متاح — إيقاف" : "غير متاح — تفعيل"}</button>}
          {product.archived ? (
            <button
              disabled={busy}
              onClick={() => {
                setError("");
                setMessage("");
                const defaultStore = stores.find(s => s.id === product.storeId) || stores.find(s => s.id === 'a0000000-0000-0000-0000-000000000001') || stores.find(s => s.name.includes("سنجوب")) || stores[0];
                setAssignStoreModal({ product, selectedStoreId: defaultStore?.id || "" });
              }}
              className={`${button} bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs`}
            >
              <RotateCcw size={14} className="inline ml-1" />
              استعادة الصنف
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => perform(async () => {
                await saveRecord("products", product.id, { archived: true, inStock: false });
                try { await supabase.from("products").update({ archived: true, is_available: false }).eq("id", product.id); } catch {}
              }, "أُرشف الصنف مع الاحتفاظ بسجل الطلبات.")}
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
    })}</div>{!filtered.length && <div className="p-10 text-center rounded-2xl border bg-white space-y-3"><Package className="mx-auto text-slate-300" /><p>{mode === "offers" ? "لا توجد عروض في هذا العرض. اختر منتجًا من زر إضافة عرض، أو راجع التصفية." : products.length ? "لا توجد منتجات تطابق البحث." : "لم تُضف منتجات بعد. أضف متجرًا ثم أول منتج حقيقي."}</p><button className={button} onClick={() => { setSearch(""); setCategory(""); setStoreFilter(""); setAvailability("active"); }}>مسح التصفية</button></div>}</> : <div className="grid md:grid-cols-2 gap-4">{pagedStores.map((store) => <article key={store.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">{(store.imageUrl || store.bannerUrl) && <img src={store.imageUrl || store.bannerUrl} alt={store.name} className="h-36 w-full object-cover" />}<div className="p-5 space-y-3"><div className="flex gap-3 items-center">{store.logoUrl && <img src={store.logoUrl} alt={`شعار ${store.name}`} className="w-12 h-12 rounded-xl object-contain border" />}<div><h2 className="font-bold">{store.name}</h2><p className="text-xs text-slate-500">{store.type}</p></div></div><p className="text-sm text-slate-600">{store.locationInDistrict}</p><p className="text-xs">{active.filter((item) => item.storeId === store.id).length} منتج · الحد الأدنى {formatEGP(store.minOrder)} · التوصيل {formatEGP(store.deliveryFee)}</p><div className="flex gap-2 flex-wrap"><button disabled={busy} onClick={() => open("stores", store.id)} className={button}>تعديل المتجر والصور</button><button disabled={busy} onClick={() => perform(() => saveRecord("stores", store.id, { status: store.status === "open" ? "closed" : "open" }), "تم تحديث حالة المتجر.")} className={`${button} ${store.status === "open" ? "text-emerald-700" : "text-amber-700"}`}>{store.status === "open" ? "مفتوح — إغلاق مؤقت" : "مغلق أو مشغول — فتح"}</button><button disabled={busy} onClick={() => { if (window.confirm(`هل أنت متأكد من حذف متجر "${store.name}" نهائياً من النظام؟`)) { perform(() => deleteRecord("stores", store.id), "تم حذف المتجر نهائياً من النظام."); } }} className={`${button} text-red-600 hover:bg-red-50 border-red-200`}>حذف المتجر</button></div></div></article>)}{!visibleStores.length && <p className="p-8 bg-white border rounded-xl">لا توجد متاجر تطابق البحث. يمكنك إضافة متجر من الزر أعلاه.</p>}</div>}
    </>}
    {tab === "products" && view === "table" && resultCount > 0 && <p className="catalog-data-note">المبيعات من الأصناف المسلّمة. التوافر يحدد إمكانية الطلب ولا يمثل كمية المخزون.</p>}
    {resultCount > pageSize && <nav className="admin-pagination catalog-pagination" aria-label="صفحات الكتالوج"><span>صفحة {currentPage + 1} من {lastPage + 1}</span><div><button className="compact-row-action btn btn-outline-secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronRight size={15} />السابق</button><button className="compact-row-action btn btn-outline-secondary" disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}>التالي<ChevronLeft size={15} /></button></div></nav>}
    {mode === "offers" && <p className="catalog-data-note">لتفعيل عرض، اختر منتجًا وحدد سعر البيع والسعر قبل الخصم. لإلغاء العرض، امسح السعر قبل الخصم. المنتجات المؤرشفة أو غير المتاحة والمتاجر المغلقة لا تظهر في صفحة العروض.</p>}
    {offerPicker && <Editor compact title="اختيار منتج للعرض" busy={busy} onClose={() => setOfferPicker(false)}><form className="catalog-editor-form" onSubmit={event => { event.preventDefault(); const id = String(new FormData(event.currentTarget).get("productId") || ""); if (active.some(product => product.id === id)) { setOfferPicker(false); open("products", id); } }}><Field label="المنتج"><select name="productId" aria-label="المنتج" required defaultValue="" className={input}><option value="" disabled>اختر منتجًا من الكتالوج</option>{active.map(product => <option key={product.id} value={product.id}>{product.name} · {stores.find(store => store.id === product.storeId)?.name || product.storeName}</option>)}</select></Field><p className="text-sm text-slate-500">سيُحفظ الخصم على المنتج نفسه وتُحدّث صفحة العروض تلقائيًا.</p><button className="admin-primary btn btn-primary">تحديد سعر العرض</button></form></Editor>}
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

    {editor && (mode === "offers" || editor.kind === "stores") && <Editor key={`${editor.kind}-${editor.id || "new"}`} compact={mode === "offers"} title={mode === "offers" ? "تعديل عرض المنتج" : editor.id ? "تعديل المتجر" : "إضافة متجر"} busy={busy} onClose={() => { setEditor(null); setError(""); }}>
      <form onSubmit={submit} className="catalog-editor-form"><fieldset disabled={busy} className="catalog-editor-fields min-w-0">
        {selectedProduct && !selectedProduct.storeId && <p className="ops-warning alert alert-warning">هذا المنتج غير مرتبط بمتجر. اختر المتجر المسؤول عنه ليتمكن العملاء من طلبه.</p>}
        {(mode === "offers" || selectedProduct?.catalogProductId) ? <>
          <div className="catalog-offer-summary"><strong>{selectedProduct?.name}</strong><p>{stores.find(store => store.id === selectedProduct?.storeId)?.name || selectedProduct?.storeName}</p></div>
          {!selectedProduct?.storeId && <Field label="المتجر المسؤول عن العرض"><select name="storeId" aria-label="متجر العرض" required defaultValue="" className={input}><option value="" disabled>اختر المتجر</option>{stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>}
          <div className="offer-price-fields"><Field label="سعر العرض بالجنيه"><input type="number" name="price" aria-label="سعر المنتج" min="0" max="100000" step="0.01" defaultValue={selectedProduct?.price} required className={input} /></Field>
          <Field label="السعر قبل الخصم"><input type="number" name="originalPrice" aria-label="السعر قبل الخصم" min="0" max="100000" step="0.01" defaultValue={selectedProduct && hasProductOffer(selectedProduct) ? selectedProduct.originalPrice : ""} className={input} /></Field></div>
          <p className="text-sm text-slate-500">اترك السعر قبل الخصم فارغًا لإلغاء العرض. تغيير سعر العرض يحدّث سعر المنتج نفسه.</p>
          <label className="catalog-editor-check"><input type="checkbox" name="inStock" defaultChecked={editor.enableOnSave || selectedProduct?.inStock} disabled={selectedProduct?.archived} />متاح للطلب</label>
        </> : <>
          <Field label="اسم المتجر"><input name="name" aria-label="اسم المتجر" defaultValue={selectedStore?.name} required maxLength={120} className={input} /></Field><Field label="الاسم بالإنجليزية — اختياري"><input name="nameEn" defaultValue={selectedStore?.nameEn} className={input} /></Field><Field label="عنوان المتجر"><textarea name="address" aria-label="عنوان المتجر" defaultValue={selectedStore?.locationInDistrict} required maxLength={500} className={input} /></Field>
          <Field label="نوع النشاط"><input name="type" aria-label="نوع النشاط" defaultValue={selectedStore?.type} required className={input} /></Field><Field label="التصنيف"><select name="category" defaultValue={selectedStore?.category} className={input}>{storeCategories.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="حالة المتجر"><select name="status" defaultValue={selectedStore?.status || "closed"} className={input}><option value="closed">مغلق</option><option value="open">مفتوح</option><option value="busy">مشغول</option></select></Field>
          <div className="grid sm:grid-cols-2 gap-3"><Field label="الحد الأدنى للطلب"><input name="minOrder" type="number" min="0" max="100000" step="0.01" defaultValue={selectedStore?.minOrder ?? 0} required className={input} /></Field><Field label="رسوم التوصيل"><input name="deliveryFee" type="number" min="0" max="1000" step="0.01" defaultValue={selectedStore?.deliveryFee ?? 0} required className={input} /></Field></div>
          <Field label="نسبة التعاقد المتفق عليها % — تترك فارغة حتى التعاقد"><input name="commissionRate" type="number" min="0" max="100" step="0.01" defaultValue={selectedStore?.commissionRate??''} className={input}/></Field><Field label="نسبة الضريبة % — حسب تسجيل المتجر"><input name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={selectedStore?.taxRate||0} className={input}/></Field><Field label="رقم التسجيل الضريبي"><input name="taxRegistrationNumber" maxLength={60} defaultValue={selectedStore?.taxRegistrationNumber||''} className={input}/></Field><label className="flex gap-2 text-sm"><input name="pricesIncludeTax" type="checkbox" defaultChecked={selectedStore?.pricesIncludeTax!==false}/>أسعار المنتجات تشمل الضريبة</label><p className="text-xs text-slate-500">أدخل النسبة الفعلية المسجلة للتاجر فقط. النسبة الافتراضية صفر؛ تُحفظ بيانات الضريبة في الطلب والفاتورة وقت التأكيد.</p>
          <Field label="مدة التجهيز المتوقعة — اختياري"><input name="deliveryTime" defaultValue={selectedStore?.deliveryTime} className={input} /></Field>
          <ImageFileField name="coverFile" label="رفع صورة المتجر" disabled={busy} /><Field label="أو رابط صورة المتجر"><input name="imageUrl" type="url" pattern="https://.*" defaultValue={selectedStore?.imageUrl || selectedStore?.bannerUrl} className={input} /></Field><ImageFileField name="logoFile" label="رفع شعار المتجر" disabled={busy} /><Field label="أو رابط الشعار"><input name="logoUrl" type="url" pattern="https://.*" defaultValue={selectedStore?.logoUrl} className={input} /></Field>
        </>}
      </fieldset>
      {error && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl">{error}</p>}
      <div className="catalog-editor-actions"><button type="submit" disabled={busy} className={`${button} bg-orange-600 text-white`}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button><button type="button" disabled={busy} onClick={() => { setEditor(null); setError(""); }} className={button}>إلغاء</button></div>
      </form>
    </Editor>}

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
                    متجر سنجوب إكسبريس المركزي ⭐ (منتجات سنجوب الرسمية)
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
                await perform(async () => {
                  const updatedData = {
                    id: prod.id,
                    name: prod.name,
                    nameEn: prod.nameEn || "",
                    description: prod.description || "",
                    price: Number(prod.price) || 0,
                    category: prod.category || "عام",
                    storeId: assignStoreModal.selectedStoreId,
                    storeName: targetStore?.name || "متجر سنجوب إكسبريس المركزي",
                    archived: false,
                    inStock: true,
                    imageUrl: prod.imageUrl || "",
                    imageType: prod.imageType || "croissant",
                  };
                  await saveRecord("products", prod.id, updatedData);
                  try {
                    await supabase.from("products").update({
                      store_id: assignStoreModal.selectedStoreId,
                      archived: false,
                      is_available: true,
                    }).eq("id", prod.id);
                  } catch (e) {
                    console.error("Supabase update error:", e);
                  }
                  setAssignStoreModal(null);
                }, `🎉 تمت استعادة الصنف ونقله إلى (${targetStore?.name || "متجر سنجوب إكسبريس المركزي"}) بنجاح!`);
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
