import { useEffect, useState } from "react";
import { where } from "firebase/firestore";
import { ArrowLeft, Search, ShoppingBag, Tag } from "lucide-react";
import { watchCollection } from "../lib/firebase";
import type { Product, Store } from "../types";
import type { AppSelection } from "./AppPromotionDialog";
import { availableOffers, productDiscountPercent } from "../utils/productOffers";
import { formatEGP } from "../utils/orderCalculations";
import { supabase, getSupabaseStores } from "../lib/supabase";

export default function PublicOffers({ onSelect }: { onSelect: (item: AppSelection) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loaded, setLoaded] = useState({ products: false, stores: false });
  const [errors, setErrors] = useState({ products: false, stores: false });
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState("");
  const [sort, setSort] = useState("discount");
  const [page, setPage] = useState(1);
  useEffect(() => {
    setLoaded({ products: false, stores: false }); setErrors({ products: false, stores: false });
    let active = true;

    async function loadFromSupabase() {
      try {
        const [spStores, { data: spProds }] = await Promise.all([
          getSupabaseStores().catch(() => [] as Store[]),
          supabase.from("products").select("*, stores(name, status)").gt("original_price", 0)
        ]);
        if (!active) return;
        if (spStores && spStores.length) {
          setStores(prev => {
            const map = new Map(prev.map(s => [s.id, s]));
            spStores.forEach(s => map.set(s.id, s));
            return Array.from(map.values());
          });
          setLoaded(v => ({ ...v, stores: true }));
        }
        if (spProds && spProds.length) {
          const mapped: Product[] = spProds.map((r: any) => ({
            id: r.id,
            storeId: r.store_id,
            storeName: r.stores?.name || "متجر سنجوب",
            name: r.name,
            nameEn: r.name_en || undefined,
            description: r.description || "",
            price: Number(r.price) || 0,
            originalPrice: Number(r.original_price) || undefined,
            category: r.category || "عام",
            categoryId: r.category_id || undefined,
            barcode: r.barcode || "",
            merchantPosSku: r.merchant_pos_sku || "",
            inStock: Boolean(r.is_available),
            isPopular: Boolean(r.is_popular),
            imageUrl: r.image_url || "",
            archived: Boolean(r.archived),
            imageType: "croissant",
          }));
          setProducts(prev => {
            const map = new Map(prev.map(p => [p.id, p]));
            mapped.forEach(p => map.set(p.id, p));
            return Array.from(map.values());
          });
          setLoaded(v => ({ ...v, products: true }));
        }
      } catch (e) {
        console.warn("PublicOffers Supabase load error:", e);
      }
    }
    void loadFromSupabase();

    const stopProducts = watchCollection<Product>("products", data => {
      setProducts(prev => {
        const map = new Map(prev.map(p => [p.id, p]));
        data.forEach(p => map.set(p.id, p));
        return Array.from(map.values());
      });
      setLoaded(value => ({ ...value, products: true }));
      setErrors(value => ({ ...value, products: false }));
    }, () => setErrors(value => ({ ...value, products: true })), [where("inStock", "==", true)]);

    const stopStores = watchCollection<Store>("stores", data => {
      setStores(prev => {
        const map = new Map(prev.map(s => [s.id, s]));
        data.forEach(s => map.set(s.id, s));
        return Array.from(map.values());
      });
      setLoaded(value => ({ ...value, stores: true }));
      setErrors(value => ({ ...value, stores: false }));
    }, () => setErrors(value => ({ ...value, stores: true })), [where("status", "==", "open")]);

    return () => { active = false; stopProducts(); stopStores(); };
  }, [retry]);
  useEffect(() => { setPage(1); }, [search, storeId, sort]);
  const offers = availableOffers(products, stores);
  const term = search.trim().toLocaleLowerCase("ar");
  const filtered = offers.filter(product => (!storeId || product.storeId === storeId) && `${product.name} ${stores.find(store => store.id === product.storeId)?.name || product.storeName}`.toLocaleLowerCase("ar").includes(term)).sort((a, b) => sort === "price" ? a.price - b.price : sort === "name" ? a.name.localeCompare(b.name, "ar") : productDiscountPercent(b) - productDiscountPercent(a));
  const failed = errors.products || errors.stores;
  const ready = loaded.products && loaded.stores;
  return <section className="offers-page" aria-labelledby="offers-title">
    <header className="offers-hero"><div><a className="offers-back" href="/">الرئيسية <ArrowLeft size={15} /></a><span className="eyebrow">عروض من متاجر العاصمة</span><h1 id="offers-title">اختياراتك المفضلة،<br /><em>بسعر أحلى.</em></h1><p>تصفح المنتجات المخفّضة المتاحة من المتاجر المفتوحة، وكمّل طلبك في التطبيق.</p></div><span className="offers-hero-icon" aria-hidden="true"><Tag size={64} /><b>%</b></span></header>
    <div className="offers-filters"><label className="offers-search"><Search size={18} /><input className="form-control" aria-label="البحث في العروض" placeholder="اسم المنتج أو المتجر" value={search} onChange={event => setSearch(event.target.value)} /></label><label>المتجر<select className="form-select" value={storeId} onChange={event => setStoreId(event.target.value)}><option value="">كل المتاجر</option>{stores.filter(store => offers.some(product => product.storeId === store.id)).map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label><label>الترتيب<select className="form-select" value={sort} onChange={event => setSort(event.target.value)}><option value="discount">أكبر خصم</option><option value="price">السعر الأقل</option><option value="name">اسم المنتج</option></select></label></div>
    {failed ? <div className="offers-state" role="alert"><h2>تعذر تحميل العروض</h2><p>راجع اتصالك بالإنترنت وحاول مرة أخرى.</p><button className="site-button site-button-orange btn btn-primary" onClick={() => setRetry(value => value + 1)}>إعادة المحاولة</button></div> : !ready ? <div className="offers-state" role="status"><span className="spinner-border" aria-hidden="true" />جارٍ تحميل العروض المتاحة…</div> : <>
      <div className="offers-results"><h2>العروض المتاحة <span>({filtered.length})</span></h2><span>الأسعار بالجنيه المصري</span></div>
      {filtered.length ? <><div className="offers-grid">{filtered.slice(0, page * 12).map(product => <button className="offer-card" key={product.id} onClick={() => onSelect({ id:product.id,storeId:product.storeId,title: product.name, kind: "product" })}><div className="offer-image"><ShoppingBag size={42} aria-hidden="true" />{product.imageUrl && <img src={product.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = "hidden"; }} />}<span className="offer-badge badge">خصم {productDiscountPercent(product)}٪</span></div><div className="offer-copy"><small>{stores.find(store => store.id === product.storeId)?.name || product.storeName}</small><h3>{product.name}</h3><p>{product.description}</p><div className="offer-prices"><strong>{formatEGP(product.price)}</strong><del>{formatEGP(product.originalPrice!)}</del></div><span className="offer-action">شوف المنتج في التطبيق <ArrowLeft size={17} /></span></div></button>)}</div>{filtered.length > page * 12 && <button className="site-button offers-more" onClick={() => setPage(value => value + 1)}>عرض المزيد من العروض</button>}</> : <div className="offers-state"><Tag size={34} /><h2>{offers.length ? "لا توجد عروض مطابقة" : "العروض الحلوة جاية قريب"}</h2><p>{offers.length ? "جرّب اسمًا آخر أو اختار متجرًا مختلفًا." : "تابعنا لمعرفة المنتجات المخفّضة فور توافرها."}</p>{(search || storeId) && <button className="site-button site-button-orange btn btn-primary" onClick={() => { setSearch(""); setStoreId(""); }}>عرض كل العروض</button>}</div>}
    </>}
  </section>;
}
