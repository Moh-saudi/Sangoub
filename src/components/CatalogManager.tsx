import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, Plus, Pencil, Package, Store as StoreIcon, X, Archive, Image as ImageIcon } from "lucide-react";
import type { Order, Product, Store } from "../types";
import { saveRecord } from "../lib/firebase";
import { saveCatalogWithImages } from "../lib/catalogImages";
import { catalogPerformance, productCategories, productFormData, storeCategories } from "../utils/catalogManagement";
import { formatEGP } from "../utils/orderCalculations";
import { ImageFileField } from "./ImageFileField";

const input = "w-full border border-slate-300 rounded-xl p-3 bg-white text-sm text-slate-900";
const button = "rounded-xl px-4 py-2 text-sm font-bold border border-slate-200 disabled:opacity-40";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 space-y-2 text-xs font-bold text-slate-700"><span>{label}</span>{children}</label>;
}
function Editor({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-label={title} className="w-[min(680px,94vw)] max-h-[90dvh] overflow-y-auto rounded-3xl p-5 sm:p-7 backdrop:bg-slate-950/60" dir="rtl">
    <header className="flex justify-between items-center gap-3 mb-5"><h2 className="font-black text-xl">{title}</h2><button type="button" aria-label="إغلاق المحرر" disabled={busy} onClick={onClose} className="p-2 rounded-xl border"><X size={18} /></button></header>{children}
  </dialog>;
}

export function CatalogManager({ products, stores, orders }: { products: Product[]; stores: Store[]; orders: Order[] }) {
  const [tab, setTab] = useState<"products" | "stores">("products");
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [category, setCategory] = useState("");
  const [availability, setAvailability] = useState("active");
  const [sort, setSort] = useState("name");
  const [editor, setEditor] = useState<{ kind: "products" | "stores"; id?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const performance = useMemo(() => catalogPerformance(orders), [orders]);
  const active = products.filter((item) => !item.archived);
  const filtered = products.filter((item) => {
    const text = `${item.name} ${item.storeName} ${item.description}`.toLocaleLowerCase("ar");
    return text.includes(search.trim().toLocaleLowerCase("ar")) && (!storeFilter || item.storeId === storeFilter) && (!category || item.category === category) &&
      (availability === "archived" ? item.archived : !item.archived && (availability === "available" ? item.inStock : availability === "unavailable" ? !item.inStock : true));
  }).sort((a,b) => sort === "price" ? a.price - b.price : sort === "sales" ? (performance.get(b.id)?.sold || 0) - (performance.get(a.id)?.sold || 0) : a.name.localeCompare(b.name, "ar"));
  const visibleStores = stores.filter((store) => `${store.name} ${store.locationInDistrict}`.includes(search.trim()));
  const selectedProduct = editor?.kind === "products" ? products.find((item) => item.id === editor.id) : undefined;
  const selectedStore = editor?.kind === "stores" ? stores.find((item) => item.id === editor.id) : undefined;

  async function perform(operation: () => Promise<void>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); setMessage(success); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر الحفظ. أعد المحاولة."); return false; }
    finally { setBusy(false); }
  }
  function open(kind: "products" | "stores", id?: string) { setError(""); setMessage(""); setEditor({ kind, id }); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor || busy) return;
    const data = new FormData(event.currentTarget);
    const success = await perform(async () => {
      const id = editor.id || crypto.randomUUID();
      if (editor.kind === "products") {
        const previous = selectedProduct;
        if (editor.id && !previous) throw new Error("الصنف لم يعد موجودًا. حدّث القائمة.");
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
          imageUrl, bannerUrl: imageUrl, logoUrl,
        }, [{ field: "bannerUrl", file: data.get("coverFile") as File | null }, { field: "logoUrl", file: data.get("logoFile") as File | null }]);
      }
    }, editor.id ? "تم حفظ التعديلات." : "تمت الإضافة إلى الكتالوج.");
    if (success) setEditor(null);
  }
  return <section dir="rtl" className="space-y-5" aria-label="إدارة الكتالوج">
    <header className="rounded-3xl bg-slate-900 p-6 text-white flex flex-wrap justify-between items-center gap-4"><div><p className="text-orange-300 text-xs mb-2">CAPITAL TALABAT · CATALOG</p><h1 className="text-2xl font-black">منتجاتك ومتاجرك، تحت إدارتك.</h1><p className="text-slate-300 text-sm mt-2">المنيو والأسعار والصور والتوافر في مكان واحد.</p></div><button disabled={busy || (tab === "products" && !stores.length)} onClick={() => open(tab)} className="px-4 py-3 rounded-xl bg-orange-600 text-sm font-bold flex gap-2 items-center disabled:opacity-40"><Plus size={18} />{tab === "products" ? "إضافة منتج" : "إضافة متجر"}</button></header>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[["متاجر مسجلة", stores.length], ["منتجات نشطة", active.length], ["متاحة بالمنيو", active.filter((item) => item.inStock).length], ["غير متاحة", active.filter((item) => !item.inStock).length]].map(([label,value]) => <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4"><strong className="block text-2xl text-slate-900">{value}</strong><span className="text-xs text-slate-500">{label}</span></div>)}</div>
    <div className="flex gap-2"><button className={`${button} ${tab === "products" ? "bg-orange-50 border-orange-400" : "bg-white"}`} onClick={() => { setTab("products"); setSearch(""); }}><Package className="inline ml-2" size={16} />المنتجات</button><button className={`${button} ${tab === "stores" ? "bg-orange-50 border-orange-400" : "bg-white"}`} onClick={() => { setTab("stores"); setSearch(""); }}><StoreIcon className="inline ml-2" size={16} />المتاجر</button></div>
    {error && !editor && <p role="alert" className="bg-red-50 text-red-700 rounded-xl p-3">{error}</p>}{message && <p role="status" className="bg-emerald-50 text-emerald-800 rounded-xl p-3">{message}</p>}
    <div className="bg-white border border-slate-200 rounded-2xl p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3"><label className="relative min-w-0"><Search className="absolute right-3 top-3.5 text-slate-400" size={16} /><input aria-label="بحث الكتالوج" className={`${input} pr-9`} placeholder="ابحث بالاسم أو المتجر" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      {tab === "products" && <><select aria-label="تصفية حسب المتجر" className={input} value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}><option value="">كل المتاجر</option>{stores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="تصفية حسب التصنيف" className={input} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">كل التصنيفات</option>{productCategories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="تصفية حسب التوافر" className={input} value={availability} onChange={(e) => setAvailability(e.target.value)}><option value="active">كل المنتجات النشطة</option><option value="available">متاحة</option><option value="unavailable">غير متاحة</option><option value="archived">الأرشيف</option></select><select aria-label="ترتيب المنتجات" value={sort} onChange={(e) => setSort(e.target.value)} className={input}><option value="name">الاسم</option><option value="price">السعر الأقل</option><option value="sales">الأكثر مبيعًا</option></select></>}
    </div>
    {tab === "products" ? <><p className="text-xs text-slate-500">{filtered.length} منتج · المبيعات من الأصناف المسلّمة في السجلات المتاحة، قبل خصم القسائم ورسوم التوصيل. التوافر يدوي؛ لا يمثل عدد القطع في المخزن.</p><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map((product) => {
      const stats = performance.get(product.id);
      return <article key={product.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="flex gap-3 p-4"><div className="relative w-20 h-20 shrink-0 bg-slate-100 rounded-xl overflow-hidden"><ImageIcon className="absolute m-6 text-slate-300" />{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="relative w-full h-full object-cover" onLoad={(e) => { e.currentTarget.style.visibility = "visible"; }} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : null}</div><div className="min-w-0"><h2 className="font-bold break-words">{product.name}</h2><p className="text-xs text-slate-500 mt-1">{stores.find((store) => store.id === product.storeId)?.name || product.storeName} · {product.category}</p><strong className="block text-orange-700 mt-2">{formatEGP(product.price)}</strong></div></div>
        <p className="px-4 text-xs text-slate-500 line-clamp-2 min-h-8">{product.description}</p><div className="grid grid-cols-3 text-center text-xs m-4 p-3 rounded-xl bg-slate-50 gap-2"><span><strong className="block">{stats?.sold || 0}</strong>قطعة مسلّمة</span><span><strong className="block">{stats?.pending || 0}</strong>قيد التنفيذ</span><span><strong className="block">{formatEGP(stats?.revenue || 0)}</strong>قيمة الأصناف</span></div>
        <div className="flex flex-wrap gap-2 border-t p-3"><button disabled={busy} onClick={() => open("products", product.id)} className={button}><Pencil size={14} className="inline ml-1" />تعديل</button>
          {!product.archived && <button disabled={busy} onClick={() => perform(() => saveRecord("products", product.id, { inStock: !product.inStock }), "تم تحديث توافر الصنف.")} className={`${button} ${product.inStock ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>{product.inStock ? "متاح — إيقاف" : "غير متاح — تفعيل"}</button>}
          <button disabled={busy} onClick={() => perform(() => saveRecord("products", product.id, { archived: !product.archived, inStock: false }), product.archived ? "استُعيد الصنف بحالة غير متاح؛ فعّله عند الجاهزية." : "أُرشف الصنف مع الاحتفاظ بسجل الطلبات.")} className={`${button} text-slate-600`}><Archive size={14} className="inline ml-1" />{product.archived ? "استعادة" : "أرشفة"}</button></div>
      </article>;
    })}</div>{!filtered.length && <div className="p-10 text-center rounded-2xl border bg-white space-y-3"><Package className="mx-auto text-slate-300" /><p>{products.length ? "لا توجد منتجات تطابق البحث." : "لم تُضف منتجات بعد. أضف متجرًا ثم أول منتج حقيقي."}</p><button className={button} onClick={() => { setSearch(""); setCategory(""); setStoreFilter(""); setAvailability("active"); }}>مسح التصفية</button></div>}</> : <div className="grid md:grid-cols-2 gap-4">{visibleStores.map((store) => <article key={store.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">{(store.imageUrl || store.bannerUrl) && <img src={store.imageUrl || store.bannerUrl} alt={store.name} className="h-36 w-full object-cover" />}<div className="p-5 space-y-3"><div className="flex gap-3 items-center">{store.logoUrl && <img src={store.logoUrl} alt={`شعار ${store.name}`} className="w-12 h-12 rounded-xl object-contain border" />}<div><h2 className="font-bold">{store.name}</h2><p className="text-xs text-slate-500">{store.type}</p></div></div><p className="text-sm text-slate-600">{store.locationInDistrict}</p><p className="text-xs">{active.filter((item) => item.storeId === store.id).length} منتج · الحد الأدنى {formatEGP(store.minOrder)} · التوصيل {formatEGP(store.deliveryFee)}</p><div className="flex gap-2 flex-wrap"><button disabled={busy} onClick={() => open("stores", store.id)} className={button}>تعديل المتجر والصور</button><button disabled={busy} onClick={() => perform(() => saveRecord("stores", store.id, { status: store.status === "open" ? "closed" : "open" }), "تم تحديث حالة المتجر.")} className={`${button} ${store.status === "open" ? "text-emerald-700" : "text-amber-700"}`}>{store.status === "open" ? "مفتوح — إغلاق مؤقت" : "مغلق أو مشغول — فتح"}</button></div></div></article>)}{!visibleStores.length && <p className="p-8 bg-white border rounded-xl">لا توجد متاجر تطابق البحث. يمكنك إضافة متجر من الزر أعلاه.</p>}</div>}
    {editor && <Editor key={`${editor.kind}-${editor.id || "new"}`} title={editor.kind === "products" ? editor.id ? "تعديل المنتج" : "إضافة منتج" : editor.id ? "تعديل المتجر" : "إضافة متجر"} busy={busy} onClose={() => { setEditor(null); setError(""); }}>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4 min-w-0">
        {editor.kind === "products" ? <>
          <Field label="المتجر"><select name="storeId" aria-label="متجر المنتج" className={input} required disabled={Boolean(selectedProduct)} defaultValue={selectedProduct?.storeId || storeFilter || ""}><option value="">اختر المتجر</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>
          <Field label="اسم المنتج"><input name="name" aria-label="اسم المنتج" defaultValue={selectedProduct?.name} required maxLength={120} className={input} /></Field>
          <Field label="الوصف الحقيقي"><textarea name="description" aria-label="وصف المنتج" defaultValue={selectedProduct?.description} required maxLength={1000} rows={3} className={input} /></Field>
          <div className="grid sm:grid-cols-2 gap-3"><Field label="سعر البيع بالجنيه"><input type="number" name="price" aria-label="سعر المنتج" min="0" max="100000" step="0.01" defaultValue={selectedProduct?.price} required className={input} /></Field><Field label="السعر قبل الخصم — اختياري"><input type="number" name="originalPrice" aria-label="السعر قبل الخصم" min="0" max="100000" step="0.01" defaultValue={selectedProduct && (selectedProduct.originalPrice || 0) > selectedProduct.price ? selectedProduct.originalPrice : ""} className={input} /></Field></div>
          <Field label="التصنيف"><select name="category" aria-label="تصنيف المنتج" defaultValue={selectedProduct?.category} className={input}>{productCategories.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="شارة قصيرة — اختياري"><input name="badge" defaultValue={selectedProduct?.badge} maxLength={80} className={input} /></Field>
          <ImageFileField name="imageFile" label="رفع صورة المنتج" disabled={busy} />
          <Field label="أو رابط HTTPS للصورة"><input type="url" name="imageUrl" defaultValue={selectedProduct?.imageUrl} pattern="https://.*" className={input} /></Field>
          {selectedProduct?.imageUrl && <img src={selectedProduct.imageUrl} alt="الصورة الحالية للمنتج" className="h-24 rounded-xl" />}
          <label className="flex gap-2 text-sm"><input type="checkbox" name="inStock" defaultChecked={selectedProduct ? selectedProduct.inStock : true} disabled={selectedProduct?.archived} />متاح للطلب</label><label className="flex gap-2 text-sm"><input type="checkbox" name="isPopular" defaultChecked={selectedProduct?.isPopular} />عرض ضمن المنتجات المميزة</label>
        </> : <>
          <Field label="اسم المتجر"><input name="name" aria-label="اسم المتجر" defaultValue={selectedStore?.name} required maxLength={120} className={input} /></Field><Field label="الاسم بالإنجليزية — اختياري"><input name="nameEn" defaultValue={selectedStore?.nameEn} className={input} /></Field><Field label="عنوان المتجر"><textarea name="address" aria-label="عنوان المتجر" defaultValue={selectedStore?.locationInDistrict} required maxLength={500} className={input} /></Field>
          <Field label="نوع النشاط"><input name="type" aria-label="نوع النشاط" defaultValue={selectedStore?.type} required className={input} /></Field><Field label="التصنيف"><select name="category" defaultValue={selectedStore?.category} className={input}>{storeCategories.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="حالة المتجر"><select name="status" defaultValue={selectedStore?.status || "closed"} className={input}><option value="closed">مغلق</option><option value="open">مفتوح</option><option value="busy">مشغول</option></select></Field>
          <div className="grid sm:grid-cols-2 gap-3"><Field label="الحد الأدنى للطلب"><input name="minOrder" type="number" min="0" max="100000" step="0.01" defaultValue={selectedStore?.minOrder ?? 0} required className={input} /></Field><Field label="رسوم التوصيل"><input name="deliveryFee" type="number" min="0" max="1000" step="0.01" defaultValue={selectedStore?.deliveryFee ?? 0} required className={input} /></Field></div>
          <Field label="مدة التجهيز المتوقعة — اختياري"><input name="deliveryTime" defaultValue={selectedStore?.deliveryTime} className={input} /></Field>
          <ImageFileField name="coverFile" label="رفع صورة المتجر" disabled={busy} /><Field label="أو رابط صورة المتجر"><input name="imageUrl" type="url" pattern="https://.*" defaultValue={selectedStore?.imageUrl || selectedStore?.bannerUrl} className={input} /></Field><ImageFileField name="logoFile" label="رفع شعار المتجر" disabled={busy} /><Field label="أو رابط الشعار"><input name="logoUrl" type="url" pattern="https://.*" defaultValue={selectedStore?.logoUrl} className={input} /></Field>
        </>}
      </fieldset>
      {error && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl">{error}</p>}
      <p className="text-xs text-slate-500">الملف المرفوع يحل محل رابط الصورة عند إدخال الاثنين. لا تظهر رسالة نجاح قبل اكتمال الحفظ.</p><div className="flex gap-2"><button type="submit" disabled={busy} className={`${button} bg-orange-600 text-white`}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button><button type="button" disabled={busy} onClick={() => { setEditor(null); setError(""); }} className={button}>إلغاء</button></div>
      </form>
    </Editor>}
  </section>;
}
