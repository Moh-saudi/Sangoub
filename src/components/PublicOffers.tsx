import { useEffect, useState } from "react";
import { ArrowLeft, Search, ShoppingBag, Tag } from "lucide-react";
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
    setLoaded({ products: false, stores: false });
    setErrors({ products: false, stores: false });
    let active = true;

    async function loadFromSupabase() {
      try {
        const [spStores, { data: spProds }] = await Promise.all([
          getSupabaseStores().catch(() => [] as Store[]),
          supabase.from("products").select("*, stores(name, status)").gt("original_price", 0)
        ]);
        if (!active) return;
        if (spStores && spStores.length) {
          setStores(spStores);
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
          setProducts(mapped);
          setLoaded(v => ({ ...v, products: true }));
        } else {
          setLoaded(v => ({ ...v, products: true }));
        }
      } catch (e) {
        console.warn("PublicOffers Supabase load error:", e);
        if (active) setErrors({ products: true, stores: true });
      }
    }
    void loadFromSupabase();

    return () => { active = false; };
  }, [retry]);

  useEffect(() => { setPage(1); }, [search, storeId, sort]);
  const offers = availableOffers(products, stores);
  const term = search.trim().toLocaleLowerCase("ar");
  const filtered = offers.filter(product => (!storeId || product.storeId === storeId) && `${product.name} ${stores.find(store => store.id === product.storeId)?.name || product.storeName}`.toLocaleLowerCase("ar").includes(term)).sort((a, b) => sort === "price" ? a.price - b.price : sort === "name" ? a.name.localeCompare(b.name, "ar") : productDiscountPercent(b) - productDiscountPercent(a));
  const failed = errors.products || errors.stores;
  const ready = loaded.products && loaded.stores;

  return (
    <section className="public-offers" aria-labelledby="public-offers-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow"><Tag size={14} /> وفّر أكثر</span>
          <h2 id="public-offers-heading">عروض وتخفيضات اليوم</h2>
        </div>
      </div>
      <div className="public-offers-search-box">
        <Search size={18} />
        <input
          type="text"
          placeholder="ابحث داخل العروض..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="ابحث داخل العروض"
        />
      </div>
      {ready && filtered.length > 0 && (
        <div className="public-offers-grid">
          {filtered.slice(0, 12).map(product => (
            <button
              key={product.id}
              className="public-offer-card"
              onClick={() => onSelect({ id: product.id, storeId: product.storeId, title: product.name, kind: 'product' })}
            >
              <div className="public-offer-image">
                <ShoppingBag size={24} />
                {product.imageUrl && <img src={product.imageUrl} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />}
                <span className="public-offer-badge">خصم {productDiscountPercent(product)}%</span>
              </div>
              <div className="public-offer-details">
                <strong>{product.name}</strong>
                <small>{product.storeName}</small>
                <div className="public-offer-prices">
                  <span className="current-price">{formatEGP(product.price)}</span>
                  {product.originalPrice && <del className="old-price">{formatEGP(product.originalPrice)}</del>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {ready && filtered.length === 0 && (
        <p className="public-offers-empty">لا توجد عروض حالياً مطابقة لبحثك.</p>
      )}
    </section>
  );
}
