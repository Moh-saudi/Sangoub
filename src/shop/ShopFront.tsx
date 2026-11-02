import { pendingDeliveryAddressKey, readPendingDeliveryAddress } from '../services/deliveryAddress';
import { BRAND } from "../brand";
import { OrderReceiptCode } from "../components/OrderReceiptCode";
import { OrderInvoice } from "./OrderInvoice";
import { OrderMap } from "../components/OrderMap";
import { goShop } from "./navigation";
import { supabase, getSupabaseStores, getSupabaseStore, getSupabaseProducts, signOutFromSupabase } from "../lib/supabase";
import { useEffect, useRef, useState } from "react";
import { authenticatedApi } from "../lib/authenticatedApi";
import type { Order, Product, Store } from "../types";
import { formatEGP, calculateCartSubtotal } from "../utils/orderCalculations";
import { normalizeRequestPhone } from "../utils/breakfastOrder";
import { customerMessage } from "../utils/customerMessage";
import { adminOrderStatus } from "../utils/adminPresentation";
import { useShop } from "./ShopContext";
import { CustomerLogin } from "./CustomerLogin";
import { ProductPicker } from "./ProductPicker";
import { openGeideaPayment } from "./geideaCheckout";
import "./shop.css";

function ItemImage({ src, name }: { src?: string; name: string }) {
  return (
    <div className="shop-item-image">
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span aria-hidden="true">🛍️</span>
      )}
    </div>
  );
}
function Stores() {
  const [stores, setStores] = useState<Store[]>([]),
    [cursor, setCursor] = useState<any>(
      null,
    ),
    [more, setMore] = useState(true),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  async function load(next = false) {
    setBusy(true);
    setError("");
    try {
      const values = await getSupabaseStores();
      setStores(values);
      setMore(false);
    } catch {
      setError("تعذر تحميل المتاجر. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const filtered = stores.filter(
    (store) =>
      store.name && `${store.name} ${store.type || ""}`.includes(search.trim()),
  );
  return (
    <>
      <header className="shop-page-heading">
        <span>أسرع توصيل ذكي إلى بابك</span>
        <h1>تسوق مع سنجوب</h1>
        <p>اختار متجرًا، أضف منتجاتك، وأكمل الطلب من الموقع.</p>
      </header>
      <label className="shop-search">
        ابحث في المتاجر المحمّلة
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="اسم المطعم أو السوبرماركت"
        />
      </label>
      {error && (
        <p role="alert" className="shop-error">
          {error}
          <button onClick={() => void load()}>إعادة المحاولة</button>
        </p>
      )}

      {/* Offers Entry Banner on Shopfront */}
      <a
        href="/offers"
        className="mb-6 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition active:scale-[0.99] text-decoration-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-xl shrink-0">
            🏷️
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-100 block">عروض حصرية مميزة</span>
            <h3 className="text-sm sm:text-base font-black text-white">تصفح أقوى عروض وتخفيضات متاجر الحي الحكومي</h3>
          </div>
        </div>
        <span className="px-3 py-1.5 bg-white text-orange-700 rounded-xl text-xs font-black shrink-0 flex items-center gap-1 shadow-2xs">
          <span>عرض التخفيضات</span>
          <span>←</span>
        </span>
      </a>

      <div className="shop-store-grid">
        {filtered.map((store) => (
          <a
            className="shop-store-card"
            href={"/stores/" + encodeURIComponent(store.id)}
            key={store.id}
          >
            <ItemImage
              src={store.bannerUrl || store.imageUrl || store.logoUrl}
              name={store.name}
            />
            <div>
              <span
                className={
                  "shop-store-status " +
                  (store.status === "open" ? "is-open" : "")
                }
              >
                {store.status === "open"
                  ? "مفتوح الآن"
                  : store.status === "busy"
                    ? "مشغول حاليًا"
                    : "مغلق حاليًا"}
              </span>
              <h2>{store.name}</h2>
              <p>{store.type}</p>
              <small>
                التوصيل {formatEGP(store.deliveryFee || 0)} · الحد الأدنى{" "}
                {formatEGP(store.minOrder || 0)}
              </small>
              <strong>عرض المنتجات ←</strong>
            </div>
          </a>
        ))}
      </div>
      {busy && <p role="status">جارٍ تحميل المتاجر…</p>}
      {!busy && !filtered.length && (
        <p className="shop-empty">لا توجد متاجر مطابقة حاليًا.</p>
      )}
      {more && (
        <button
          className="shop-secondary"
          disabled={busy}
          onClick={() => void load(true)}
        >
          تحميل متاجر أكثر
        </button>
      )}
    </>
  );
}
function StorePage({ id }: { id: string }) {
  const shop = useShop();
  const [store, setStore] = useState<Store | null>(null),
    [products, setProducts] = useState<Product[]>([]),
    [cursor, setCursor] = useState<any>(
      null,
    ),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Product | null>(null),
    [notice, setNotice] = useState("");
  async function load(next = false) {
    setBusy(true);
    setError("");
    try {
      const [currentStore, values] = await Promise.all([
        getSupabaseStore(id),
        getSupabaseProducts(id),
      ]);
      if (!currentStore) throw new Error("المتجر غير موجود.");
      setStore(currentStore);
      shop.cacheStores([currentStore]);
      setProducts(values);
      shop.cacheProducts(values);
      setMore(false);
      if (!next) {
        const target = new URLSearchParams(location.search).get("product");
        if (target && /^[\w-]{1,128}$/.test(target)) {
          let product = values.find((value) => value.id === target);
          if (!product) {
            const { data: spProd } = await supabase.from('products').select('*').eq('id', target).maybeSingle();
            if (spProd) {
              product = {
                id: spProd.id,
                storeId: spProd.store_id,
                name: spProd.name,
                price: Number(spProd.price) || 0,
                description: spProd.description || "",
                category: spProd.category || "عام",
                inStock: Boolean(spProd.is_available),
                archived: Boolean(spProd.archived),
                imageUrl: spProd.image_url || "",
                optionGroups: spProd.options || [],
              } as any;
            }
          }
          if (
            product &&
            product.storeId === id &&
            !product.archived &&
            product.inStock &&
            currentStore.status === "open"
          )
            setSelected(product);
          else setNotice("هذا المنتج غير متاح حاليًا. اختار من منتجات المتجر.");
        }
      }
    } catch (e) {
      setError(customerMessage(e, "تعذر تحميل منتجات المتجر. أعد المحاولة."));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  const visible = products.filter(
    (product) =>
      !product.archived &&
      Number.isFinite(product.price) &&
      product.price >= 0 &&
      product.name?.includes(search.trim()),
  );
  const storeOffers = visible.filter(
    (product) =>
      typeof product.originalPrice === "number" &&
      product.originalPrice > product.price
  );
  return (
    <>
      <a href="/stores" className="shop-back">
        ← كل المتاجر
      </a>
      {store && (
        <header className="shop-store-heading">
          <ItemImage src={store.logoUrl || store.imageUrl} name={store.name} />
          <div>
            <h1>{store.name}</h1>
            <p>
              {store.type} ·{" "}
              {store.status === "open"
                ? "مفتوح الآن"
                : "غير متاح لاستقبال الطلبات الآن"}
            </p>
            <small>
              رسوم التوصيل {formatEGP(store.deliveryFee || 0)} · الحد الأدنى
              للمنتجات {formatEGP(store.minOrder || 0)}
            </small>
            {(store.taxRate || 0) > 0 && (
              <p>
                الأسعار {store.pricesIncludeTax !== false ? "تشمل" : "لا تشمل"}{" "}
                ضريبة التاجر بنسبة {store.taxRate}٪.
              </p>
            )}
          </div>
        </header>
      )}
      <label className="shop-search">
        ابحث في المنتجات المحمّلة
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="اسم المنتج"
        />
      </label>
      {notice && (
        <p role="status" className="shop-notice">
          {notice} <a href="/cart">افتح السلة</a>
        </p>
      )}
      {error && (
        <p role="alert" className="shop-error">
          {error}
          <button onClick={() => void load()}>إعادة المحاولة</button>
        </p>
      )}
      {/* Featured Store Offers Section */}
      {storeOffers.length > 0 && !search.trim() && (
        <section className="shop-featured-offers mb-6 bg-gradient-to-r from-orange-50/80 via-amber-50/60 to-orange-50/80 border border-orange-200/90 rounded-2xl p-4 shadow-2xs" aria-label="عروض وتخفيضات المتجر">
          <div className="flex items-center justify-between mb-3 border-b border-orange-200/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <h3 className="text-sm font-black text-slate-900">عروض وتخفيضات المتجر الخاصة</h3>
            </div>
            <span className="text-[11px] font-bold text-orange-800 bg-orange-100/90 px-2 py-0.5 rounded-md border border-orange-200">
              {storeOffers.length} عرض متاح الآن
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {storeOffers.map((offer) => {
              const discount = Math.round((1 - offer.price / offer.originalPrice!) * 100);
              return (
                <div key={offer.id} className="bg-white rounded-xl border border-orange-200/80 p-3 flex gap-3 items-center justify-between shadow-2xs hover:shadow-xs transition">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-slate-100 bg-slate-50 relative">
                      <ItemImage src={offer.imageUrl} name={offer.name} />
                      <span className="absolute top-0 right-0 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl">
                        خصم {discount}%
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{offer.name}</h4>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{offer.description || offer.category}</p>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <strong className="text-xs font-black text-emerald-700 font-mono">{formatEGP(offer.price)}</strong>
                        <del className="text-[10px] text-slate-400 font-mono">{formatEGP(offer.originalPrice!)}</del>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={store?.status !== "open" || !offer.inStock}
                    onClick={() => setSelected(offer)}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shrink-0 transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    أضف +
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="shop-products">
        {visible.map((product) => {
          const hasOffer = typeof product.originalPrice === "number" && product.originalPrice > product.price;
          const discount = hasOffer ? Math.round((1 - product.price / product.originalPrice!) * 100) : 0;

          return (
            <article className="shop-product" key={product.id}>
              <div className="relative">
                <ItemImage src={product.imageUrl} name={product.name} />
                {hasOffer && (
                  <span className="absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                    خصم {discount}%
                  </span>
                )}
              </div>
              <div>
                <small>{product.category}</small>
                <h2>{product.name}</h2>
                <p>{product.description}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <strong>{formatEGP(product.price)}</strong>
                  {hasOffer && (
                    <del className="text-xs text-slate-400 font-mono">{formatEGP(product.originalPrice!)}</del>
                  )}
                </div>
                <button
                  className="shop-primary"
                  disabled={store?.status !== "open" || !product.inStock}
                  onClick={() => setSelected(product)}
                  aria-label={"اختيار " + product.name}
                >
                  {product.inStock ? "اختيار وإضافة" : "غير متاح حاليًا"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {busy && <p role="status">جارٍ تحميل المنتجات…</p>}
      {!busy && !visible.length && (
        <p className="shop-empty">لا توجد منتجات مطابقة الآن.</p>
      )}
      {more && (
        <button
          className="shop-secondary"
          disabled={busy}
          onClick={() => void load(true)}
        >
          تحميل منتجات أكثر
        </button>
      )}
      {selected && (
        <ProductPicker
          key={selected.id}
          product={selected}
          onClose={() => setSelected(null)}
          onAdded={() => setNotice("أضيف المنتج للسلة بنجاح.")}
        />
      )}
    </>
  );
}
function Cart() {
  const shop = useShop();
  const subtotal = calculateCartSubtotal(shop.items);
  const storeIds = [...new Set(shop.items.map((item) => item.product.storeId))];
  const fee = storeIds.reduce(
    (sum, id) => sum + (shop.stores[id]?.deliveryFee || 0),
    0,
  );
  const belowMinimum = storeIds.some(
    (id) =>
      shop.items
        .filter((item) => item.product.storeId === id)
        .reduce(
          (sum, item) =>
            sum + (item.product.price + item.extraPrice) * item.quantity,
          0,
        ) < (shop.stores[id]?.minOrder || 0),
  );
  return (
    <>
      <header className="shop-page-heading">
        <h1>سلة مشترياتك</h1>
        <p>راجع الأصناف والكميات قبل بيانات التوصيل والدفع.</p>
      </header>
      {!shop.lines.length ? (
        <div className="shop-empty">
          <h2>سلتك لسه فاضية</h2>
          <a className="shop-primary" href="/stores">
            اكتشف المتاجر
          </a>
        </div>
      ) : (
        <>
          <div className="shop-cart-layout">
            <section className="shop-cart-items" aria-label="أصناف السلة">
              {shop.lines.map((line) => {
                const item = shop.items.find((item) => item.id === line.id);
                return (
                  <article className="shop-cart-item" key={line.id}>
                    <div>
                      <h2>{item?.product.name || "منتج غير متاح"}</h2>
                      <small>{item?.product.storeName}</small>
                      {Object.entries(line.selectedOptions).map(
                        ([title, value]) => (
                          <p key={title}>
                            {title}: {value}
                          </p>
                        ),
                      )}
                      {line.notes && <p>{line.notes}</p>}
                      <strong>
                        {item
                          ? formatEGP(
                              (item.product.price + item.extraPrice) *
                                line.quantity,
                            )
                          : "راجع التوفر"}
                      </strong>
                    </div>
                    <div className="shop-quantity">
                      <button
                        aria-label={"تقليل " + (item?.product.name || "الصنف")}
                        onClick={() =>
                          shop.quantity(line.id, line.quantity - 1)
                        }
                      >
                        −
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        disabled={line.quantity >= 50}
                        aria-label={"زيادة " + (item?.product.name || "الصنف")}
                        onClick={() =>
                          shop.quantity(line.id, line.quantity + 1)
                        }
                      >
                        +
                      </button>
                      <button
                        className="shop-remove"
                        onClick={() => shop.quantity(line.id, 0)}
                      >
                        حذف
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
            <aside className="shop-panel shop-cart-summary">
              <h2>ملخص السلة</h2>
              <dl>
                <dt>المنتجات</dt>
                <dd>{formatEGP(subtotal)}</dd>
                <dt>التوصيل</dt>
                <dd>{formatEGP(fee)}</dd>
                <dt>إجمالي مبدئي</dt>
                <dd>{formatEGP(subtotal + fee)}</dd>
              </dl>
              <p>
                السلة لطلب من متجر واحد، والتوصيل يُحسب مرة واحدة. تظهر قيمة
                الخصم والضريبة والإجمالي النهائي في الخطوة التالية.
              </p>
              {shop.catalogBusy && <p role="status">جارٍ تحديث السلة…</p>}
              {shop.catalogError && (
                <p role="alert" className="shop-error">
                  {shop.catalogError}
                </p>
              )}
              {shop.unavailable && !shop.catalogBusy && (
                <p role="alert" className="shop-error">
                  بعض الأصناف أو المتاجر غير متاحة، أو تغيرت إضافاتها. احذفها
                  وأعد اختيارها.
                </p>
              )}
              {belowMinimum && (
                <p className="shop-error">
                  لم تصل إلى الحد الأدنى لأحد المتاجر.
                </p>
              )}
              <button
                className="shop-secondary"
                onClick={shop.refreshCart}
                disabled={shop.catalogBusy}
              >
                تحديث السلة
              </button>
              <a
                className="shop-primary"
                href="/checkout"
                aria-disabled={
                  shop.unavailable ||
                  shop.catalogBusy ||
                  !!shop.catalogError ||
                  belowMinimum
                }
                onClick={(e) => {
                  if (
                    shop.unavailable ||
                    shop.catalogBusy ||
                    shop.catalogError ||
                    belowMinimum
                  )
                    e.preventDefault();
                }}
              >
                متابعة بيانات التوصيل والدفع
              </a>
              <button className="shop-secondary" onClick={shop.clear}>
                تفريغ السلة
              </button>
              <a href="/stores">إضافة منتجات أخرى</a>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
function CheckoutForm() {
  const shop = useShop(),
    profile = shop.profile!;
  const [pendingAddress] = useState(() => readPendingDeliveryAddress(sessionStorage));
  const [fields, setFields] = useState({
    profileName: profile.fullName || "",
    phone: profile.phone || "",
    ministry: pendingAddress?.name.slice(0,120) || profile.ministry || "",
    floorNumber: profile.floorNumber || "",
    roomNumber: profile.roomNumber || "",
    notes: pendingAddress && pendingAddress.name.length > 120 ? pendingAddress.name : "",
    couponCode: "",
    paymentMethod: "",
  });
  const [geidea, setGeidea] = useState(false),
    [configReady, setConfigReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState<{
      quote: Order;
      quoteHash: string;
      payload: any;
      snapshot: string;
    } | null>(null);
  const [coordinates, setCoordinates] = useState<
    import("../types").Coordinates | undefined
  >(pendingAddress ? (pendingAddress.latitude !== undefined && pendingAddress.longitude !== undefined ? {latitude:pendingAddress.latitude,longitude:pendingAddress.longitude} : undefined) : profile.coordinates);
  const attemptMemory = useRef<{
    uid: string;
    fingerprint: string;
    id: string;
  } | null>(null);
  const snapshot = JSON.stringify({ lines: shop.lines, fields, coordinates });
  const current = review?.snapshot === snapshot ? review : null;
  useEffect(() => {
    let active = true;
    fetch("/api/app-content?view=checkout")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((value) => {
        if (active) setGeidea(value.geideaAvailable === true);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setConfigReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function quote() {
    setBusy(true);
    setError("");
    try {
      if (!fields.paymentMethod) throw new Error("اختر طريقة الدفع.");
      const phone = normalizeRequestPhone(fields.phone);
      const fingerprint = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(snapshot),
          ),
        ),
      )
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
      let attempt: any = attemptMemory.current;
      try {
        const stored = JSON.parse(
          sessionStorage.getItem("sangoub-checkout-attempt") || "null",
        );
        if (
          stored?.uid === profile.id &&
          stored?.fingerprint === fingerprint &&
          typeof stored.id === "string" &&
          /^ord-[a-f0-9-]{36}$/.test(stored.id)
        )
          attempt = stored;
      } catch {
        /* Session-only fallback. */
      }
      if (attempt?.uid !== profile.id || attempt?.fingerprint !== fingerprint)
        attempt = {
          uid: profile.id,
          fingerprint,
          id: "ord-" + crypto.randomUUID(),
        };
      attemptMemory.current = attempt;
      try {
        sessionStorage.setItem(
          "sangoub-checkout-attempt",
          JSON.stringify(attempt),
        );
      } catch {
        /* The review keeps the retry ID in memory. */
      }
      const payload = {
        ...fields,
        phone,
        id: attempt.id,
        tip: 0,
        ...(coordinates ? { coordinates } : {}),
        items: shop.lines.map((line) => ({
          product: { id: line.productId },
          quantity: line.quantity,
          selectedOptions: line.selectedOptions,
          notes: line.notes,
        })),
        ...(fields.couponCode.trim()
          ? { couponCode: fields.couponCode.trim() }
          : { couponCode: undefined }),
      };
      const result = await authenticatedApi("/api/orders", {
        ...payload,
        action: "quote",
      });
      if (pendingAddress && readPendingDeliveryAddress(sessionStorage)) {
        await authenticatedApi('/api/orders', { action:'profile-address', makeDefault:true,
          address:{fullAddress:fields.ministry === pendingAddress.name.slice(0,120) ? pendingAddress.name : fields.ministry,
            city:pendingAddress.city || '', details:pendingAddress.details || '', ...(coordinates ? {coordinates} : {})} });
        try { sessionStorage.removeItem(pendingDeliveryAddressKey); } catch {}
      }
      setReview({
        quote: result.quote,
        quoteHash: result.quoteHash,
        payload,
        snapshot,
      });
    } catch (e) {
      setError(
        customerMessage(
          e,
          "تعذر مراجعة الأسعار. تحقق من الاتصال وأعد المحاولة.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function place() {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const result = await authenticatedApi("/api/orders", {
        ...current.payload,
        quoteHash: current.quoteHash,
      });
      const target =
        "/checkout/success?orderId=" + encodeURIComponent(result.order.id);
      shop.consume(shop.lines);
      if (
        result.order.paymentMethod !== "geidea" ||
        result.order.paymentStatus === "paid"
      ) {
        goShop(target);
        return;
      }
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      if (result.sessionId) {
        goShop(target + "&startPayment=1");
        return;
      }
      goShop(target + "&flow=failed");
    } catch (e) {
      setError(
        customerMessage(e, "تعذر تأكيد الطلب. أعد المحاولة بنفس الطلب."),
      );
      setReview(null);
      shop.refreshCart();
    } finally {
      setBusy(false);
    }
  }
  const change = (key: keyof typeof fields, value: string) =>
    setFields((old) => ({ ...old, [key]: value }));
  return (
    <>
      <header className="shop-page-heading">
        <h1>التوصيل والدفع</h1>
        <p>راجع بياناتك، ثم راجع السعر النهائي قبل إرسال الطلب.</p>
      </header>
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
      <div className="shop-checkout-layout">
        <form
          className="shop-panel shop-checkout-form"
          onSubmit={(e) => {
            e.preventDefault();
            void quote();
          }}
        >
          <fieldset disabled={busy || !!current}>
            <legend>بيانات التوصيل</legend>
            <label>
              اسم المستلم
              <input
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={fields.profileName}
                onChange={(e) => change("profileName", e.target.value)}
              />
            </label>
            <label>
              رقم موبايل المستلم
              <input
                required
                type="tel"
                maxLength={25}
                autoComplete="tel"
                value={fields.phone}
                onChange={(e) => change("phone", e.target.value)}
              />
            </label>
            <label>
              عنوان التوصيل (المنطقة / الشارع / المبنى أو الجهة)
              <input
                required
                maxLength={120}
                value={fields.ministry}
                onChange={(e) => change("ministry", e.target.value)}
              />
            </label>
            <div className="shop-fields-row">
              <label>
                رقم العقار / الدور
                <input
                  required
                  maxLength={60}
                  value={fields.floorNumber}
                  onChange={(e) => change("floorNumber", e.target.value)}
                />
              </label>
              <label>
                رقم الشقة / المكتب / تفاصيل الوصول
                <input
                  required
                  maxLength={80}
                  value={fields.roomNumber}
                  onChange={(e) => change("roomNumber", e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="shop-secondary"
              onClick={() => {
                if (!navigator.geolocation) {
                  setError("تحديد الموقع غير متاح على هذا الجهاز.");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (position) =>
                    setCoordinates({
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                    }),
                  () =>
                    setError(
                      "تعذر تحديد الموقع. يمكنك المتابعة بعنوانك المكتوب.",
                    ),
                  {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 60000,
                  },
                );
              }}
            >
              تحديد موقعي للتوصيل (اختياري)
            </button>
            {coordinates && (
              <p>
                تم تحديد موقع التوصيل.{" "}
                <button type="button" onClick={() => setCoordinates(undefined)}>
                  حذف الموقع
                </button>
              </p>
            )}
            <label>
              ملاحظات التوصيل (اختياري)
              <textarea
                maxLength={1000}
                value={fields.notes}
                onChange={(e) => change("notes", e.target.value)}
              />
            </label>
            <label>
              كود خصم (اختياري)
              <input
                maxLength={40}
                value={fields.couponCode}
                onChange={(e) => change("couponCode", e.target.value)}
              />
            </label>
          </fieldset>
          <fieldset disabled={busy || !!current}>
            <legend>طريقة الدفع</legend>
            <label className="shop-option">
              <input
                type="radio"
                name="web-payment"
                value="geidea"
                required
                checked={fields.paymentMethod === "geidea"}
                disabled={!geidea}
                onChange={() => change("paymentMethod", "geidea")}
              />
              <span>بطاقة أو محفظة محمول عبر جيديا</span>
            </label>
            <p>
              وسائل الدفع والمحافظ المتاحة تظهر داخل جيديا حسب تفعيل حساب
              التاجر. لا تدخل بيانات بطاقتك على موقع سنجوب.
            </p>
            {configReady && !geidea && (
              <p>
                الدفع الإلكتروني غير متاح حاليًا. يمكنك الدفع كاش عند الاستلام.
              </p>
            )}
            <label className="shop-option">
              <input
                type="radio"
                name="web-payment"
                value="cash"
                required
                checked={fields.paymentMethod === "cash"}
                onChange={() => change("paymentMethod", "cash")}
              />
              كاش عند الاستلام
            </label>
          </fieldset>
          {!current && (
            <button
              className="shop-primary"
              disabled={
                busy ||
                shop.catalogBusy ||
                shop.unavailable ||
                !!shop.catalogError
              }
            >
              {busy ? "جارٍ مراجعة الطلب…" : "مراجعة السعر النهائي"}
            </button>
          )}
        </form>
        <aside className="shop-panel shop-final-review">
          <h2>مراجعة الطلب</h2>
          {current ? (
            <>
              <ul>
                {current.quote.items.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.product.name} × {item.quantity}
                    </span>
                    <b>
                      {formatEGP(
                        (item.product.price + item.extraPrice) * item.quantity,
                      )}
                    </b>
                  </li>
                ))}
              </ul>
              <dl>
                <dt>المنتجات</dt>
                <dd>{formatEGP(current.quote.subtotal)}</dd>
                <dt>التوصيل</dt>
                <dd>{formatEGP(current.quote.deliveryFee)}</dd>
                <dt>الخصم</dt>
                <dd>{formatEGP(current.quote.discount)}</dd>
                <dt>ضريبة إضافية</dt>
                <dd>{formatEGP(current.quote.additionalTax || 0)}</dd>
                <dt>منها ضريبة ضمن الأسعار</dt>
                <dd>{formatEGP(current.quote.includedTax || 0)}</dd>
                <dt>الإجمالي النهائي</dt>
                <dd>
                  <strong>{formatEGP(current.quote.total)}</strong>
                </dd>
              </dl>
              <p>
                سيظهر الطلب في حسابك ولوحة الإدارة بعد التأكيد. الدفع الإلكتروني
                لا يتأكد بمجرد العودة من بوابة الدفع.
              </p>
              <button
                className="shop-primary"
                disabled={busy}
                onClick={() => void place()}
              >
                {busy
                  ? "جارٍ تأكيد الطلب…"
                  : fields.paymentMethod === "geidea"
                    ? "تأكيد الطلب والدفع عبر جيديا"
                    : "تأكيد الطلب كاش عند الاستلام"}
              </button>
              <button
                className="shop-secondary"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                تعديل البيانات قبل التأكيد
              </button>
            </>
          ) : (
            <p>
              أكمل البيانات واضغط مراجعة السعر النهائي لعرض إجمالي طلبك قبل
              التأكيد.
            </p>
          )}
          <a href="/cart">العودة للسلة</a>
        </aside>
      </div>
    </>
  );
}
function Checkout() {
  const shop = useShop();
  if (!shop.lines.length)
    return (
      <div className="shop-empty">
        <h1>لا توجد منتجات في السلة</h1>
        <a className="shop-primary" href="/stores">
          تصفح المتاجر
        </a>
      </div>
    );
  if (shop.authBusy) return <p role="status">جارٍ تحميل الحساب…</p>;
  if (!shop.profile) return <CustomerLogin />;
  return <CheckoutForm key={shop.profile.id} />;
}
function OrderReceipt({trackingId}: {trackingId?: string} = {}) {
  const shop = useShop();
  const id = trackingId || new URLSearchParams(location.search).get("orderId") || "";
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const working = useRef(false);
  useEffect(() => {
    if (!shop.profile || !id) return;
    let active = true,
      done = false;
    working.current = false;
    async function load() {
      if (!active || working.current || document.hidden) return;
      working.current = true;
      try {
        const result = await authenticatedApi("/api/orders", {
          action: "order-status",
          orderId: id,
        });
        if (active) {
          setOrder(result.order);

          setError("");
        }
        if (
          ["delivered", "cancelled"].includes(result.order.orderStatus) &&
          (result.order.paymentStatus === "paid" ||
            result.order.paymentMethod === "cash")
        )
          done = true;
      } catch (e) {
        if (active) setError(customerMessage(e, "تعذر تحميل حالة الطلب."));
      } finally {
        working.current = false;
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!done) void load();
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [shop.profile?.id, id, revision]);
  const startedPayment = useRef(false);
  useEffect(() => {
    if (
      shop.profile &&
      id &&
      !startedPayment.current &&
      new URLSearchParams(location.search).get("startPayment") === "1"
    ) {
      startedPayment.current = true;
      void resume();
    }
  }, [shop.profile?.id, id]);
  async function resume() {
    setBusy(true);
    setError("");
    try {
      const result = await authenticatedApi("/api/orders", {
        action: "payment-session",
        orderId: id,
      });
      if (result.alreadyPaid) {
        setRevision((value) => value + 1);
        return;
      }
      if (result.redirectUrl) {
        location.assign(result.redirectUrl);
        return;
      }
      if (result.sessionId) {
        await openGeideaPayment(result.sessionId, () => {
          goShop("/checkout/success?orderId=" + encodeURIComponent(id));
          setRevision((value) => value + 1);
        });
        return;
      }
      throw new Error(
        result.paymentError ||
          "جلسة الدفع غير متاحة حاليًا. احتفظ برقم الطلب وتواصل مع الدعم.",
      );
    } catch (e) {
      setError(customerMessage(e, "تعذر فتح الدفع. احتفظ برقم طلبك."));
    } finally {
      setBusy(false);
    }
  }
  if (shop.authBusy) return <p role="status">جارٍ تحميل الحساب…</p>;
  if (!shop.profile) return <CustomerLogin />;
  return (
    <section className="shop-panel shop-receipt">
      <h1>
        {order?.paymentStatus === "paid"
          ? "تم تأكيد الدفع"
          : order?.paymentMethod === "cash"
            ? "تم استلام طلبك"
            : "متابعة الطلب والدفع"}
      </h1>
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
      {!order && !error && <p role="status">جارٍ التحقق من حالة الطلب…</p>}
      {order && (
        <>
          <p>
            رقم الطلب <strong>{order.orderNumber}</strong>
          </p>
          <p>
            الحالة: {adminOrderStatus[order.orderStatus] || order.orderStatus}
          </p>
          {order.orderStatus !== "cancelled" && (
            <ol className="shop-progress" aria-label="مراحل طلبك">
              {(
                [
                  "received",
                  "preparing",
                  "ready",
                  "with_courier",
                  "delivered",
                ] as const
              ).map((stage, index) => {
                const current = [
                  "received",
                  "preparing",
                  "ready",
                  "with_courier",
                  "delivered",
                ].indexOf(order.orderStatus);
                return (
                  <li
                    key={stage}
                    className={
                      index < current
                        ? "is-complete"
                        : index === current
                          ? "is-current"
                          : ""
                    }
                    aria-current={index === current ? "step" : undefined}
                  >
                    {
                      [
                        "استلام الطلب",
                        "جارٍ التحضير",
                        "جاهز للمندوب",
                        "في التوصيل",
                        "تم التسليم",
                      ][index]
                    }
                  </li>
                );
              })}
            </ol>
          )}
          <p>
            الإجمالي: <strong>{formatEGP(order.total)}</strong>
          </p>
          <p role="status">
            {order.paymentStatus === "paid"
              ? "تم تأكيد السداد من بوابة الدفع."
              : order.paymentMethod === "cash"
                ? "الدفع كاش عند الاستلام."
                : "بانتظار تأكيد الدفع من جيديا. لا ترسل مبلغًا إضافيًا قبل مراجعة حالة الطلب."}
          </p>
          {order.paymentMethod === "geidea" &&
            order.paymentStatus !== "paid" && (
              <>
                <button
                  className="shop-primary"
                  disabled={busy}
                  onClick={() => void resume()}
                >
                  متابعة الدفع عبر جيديا
                </button>
                <p>
                  إذا توقفت الجلسة أو أغلقتها، يمكنك المتابعة بنفس الطلب. إذا
                  تعذر ذلك تواصل مع الدعم برقم الطلب.
                </p>
              </>
            )}
          {order.orderStatus === "with_courier" && (
            <>
              <OrderReceiptCode orderId={order.id} />
              {order.courierName && (
                <p>
                  مندوبك: {order.courierName}{" "}
                  {order.courierPhone && (
                    <a href={"tel:" + order.courierPhone}>اتصال بالمندوب</a>
                  )}
                </p>
              )}
            </>
          )}
          {order.orderStatus === "with_courier" && (
            <section className="shop-tracking">
              <h2>طلبك في الطريق إليك</h2>
              <OrderMap order={order}/>
            </section>
          )}
          <dl>
            <dt>التوصيل</dt>
            <dd>
              {order.ministry} · الدور {order.floorNumber} · المكتب{" "}
              {order.roomNumber}
            </dd>
          </dl>
          <ul>
            {order.items.map((item) => (
              <li key={item.id}>
                {item.product.name} × {item.quantity}
              </li>
            ))}
          </ul>
          <OrderInvoice order={order} />
        </>
      )}
      <button
        className="shop-secondary"
        disabled={busy}
        onClick={() => setRevision((value) => value + 1)}
      >
        تحديث حالة الطلب
      </button>
      {order && (
        <a
          href={
            BRAND.supportUrl +
            "?text=" +
            encodeURIComponent(
              "مرحبًا، أحتاج مساعدة بخصوص طلب سنجوب " +
                order.orderNumber +
                " — المرجع: " +
                order.id,
            )
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          التواصل مع الدعم بشأن الطلب
        </a>
      )}
      <a href="/my-orders">طلباتي</a> · <a href="/stores">متابعة التسوق</a>
    </section>
  );
}
function MyOrders() {
  const shop = useShop();
  const [orders, setOrders] = useState<Order[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    if (!shop.profile) return;
    authenticatedApi("/api/orders", { action: "customer-orders" })
      .then((value) => {
        if (active) setOrders(value.orders);
      })
      .catch((e) => {
        if (active) setError(customerMessage(e, "تعذر تحميل الطلبات."));
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [shop.profile?.id]);
  if (shop.authBusy) return <p role="status">جارٍ تحميل الحساب…</p>;
  if (!shop.profile) return <CustomerLogin />;
  return (
    <>
      <header className="shop-page-heading">
        <h1>طلباتي</h1>
        <p>آخر ٣٠ طلبًا من حسابك.</p>
      </header>
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
      {!loaded && <p role="status">جارٍ تحميل الطلبات…</p>}
      {loaded && !orders.length && (
        <p className="shop-empty">
          ليس لديك طلبات بعد. <a href="/stores">ابدأ التسوق</a>
        </p>
      )}
      <div className="shop-order-list">
        {orders.map((order) => (
          <a
            className="shop-panel"
            key={order.id}
            href={"/checkout/success?orderId=" + encodeURIComponent(order.id)}
          >
            <strong>{order.orderNumber}</strong>
            <span>
              {new Date(order.createdAt).toLocaleString("ar-EG", {
                timeZone: "Africa/Cairo",
              })}
            </span>
            <span>
              {adminOrderStatus[order.orderStatus] || order.orderStatus} ·{" "}
              {formatEGP(order.total)}
            </span>
            <span>
              {order.paymentStatus === "paid"
                ? "مدفوع"
                : order.paymentMethod === "cash"
                  ? "كاش عند الاستلام"
                  : "بانتظار الدفع"}
            </span>
          </a>
        ))}
      </div>
    </>
  );
}
export default function ShopFront() {
  const shop = useShop();
  const path = location.pathname;
  const match = path.match(/^\/stores\/([^/]+)\/?$/);
  let storeId = "";
  try {
    storeId = match ? decodeURIComponent(match[1]) : "";
  } catch {
    /* Invalid store links render an empty state. */
  }
  return (
    <div className="shop-page">
      <nav className="shop-subnav" aria-label="التسوق والحساب">
        <a
          href="/stores"
          aria-current={path.startsWith("/stores") ? "page" : undefined}
        >
          المتاجر
        </a>
        <a href="/cart" aria-current={path === "/cart" ? "page" : undefined}>
          السلة ({shop.count})
        </a>
        <a
          href="/my-orders"
          aria-current={path === "/my-orders" ? "page" : undefined}
        >
          طلباتي
        </a>
        {shop.profile && (
          <button
            onClick={() => {
              try {
                sessionStorage.removeItem("sangoub-checkout-attempt");
              } catch {}
              void signOutFromSupabase();
            }}
          >
            خروج من حساب العميل
          </button>
        )}
      </nav>
      {shop.authError && (
        <p role="alert" className="shop-error">
          {shop.authError}
          <button onClick={shop.refreshAccount}>إعادة تحميل الحساب</button>
        </p>
      )}
      {match ? (
        storeId && /^[\w.@+-]{1,128}$/.test(storeId) ? (
          <StorePage id={storeId} />
        ) : (
          <p className="shop-empty">رابط المتجر غير صالح.</p>
        )
      ) : path === "/cart" ? (
        <Cart />
      ) : path === "/checkout" ? (
        <Checkout />
      ) : path === "/track" || path === "/order-tracking" || path.startsWith("/order-tracking/") ? (
        (new URLSearchParams(location.search).get("orderId") || path.startsWith("/order-tracking/")) ? <OrderReceipt trackingId={path.startsWith("/order-tracking/") ? path.split("/")[2] : undefined}/> : <MyOrders />
      ) : path === "/my-orders" ? (
        <MyOrders />
      ) : path === "/checkout/success" ? (
        <OrderReceipt />
      ) : (
        <Stores />
      )}
    </div>
  );
}
