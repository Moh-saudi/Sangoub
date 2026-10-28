import {consumeStorefrontCart} from './storefrontCartBridge';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  auth,
  db,
  onAuthStateChanged,
  isVerifiedIdentity,
  syncUserProfileToFirestore,
  type FirebaseUser,
} from "../lib/firebase";
import type { CartItem, Product, Store, Profile } from "../types";
import { customerMessage } from "../utils/customerMessage";
import { flushSync } from "react-dom";
import { remainingCart, type CartLine } from "./cartState";
const CART_KEY = "sangoub-web-cart-v1";
function readCart(): CartLine[] {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (line) =>
          line &&
          typeof line.id === "string" &&
          typeof line.productId === "string" &&
          /^[\w-]{1,128}$/.test(line.productId) &&
          Number.isInteger(line.quantity) &&
          line.quantity > 0 &&
          line.quantity <= 50 &&
          line.selectedOptions &&
          typeof line.selectedOptions === "object" &&
          !Array.isArray(line.selectedOptions) &&
          Object.entries(line.selectedOptions).length <= 20 &&
          Object.entries(line.selectedOptions).every(
            ([key, val]) =>
              key.length <= 120 && typeof val === "string" && val.length <= 120,
          ) &&
          typeof line.notes === "string" &&
          line.notes.length <= 500,
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}
async function documents<T>(name: string, ids: string[]): Promise<T[]> {
  const result: T[] = [];
  for (let i = 0; i < ids.length; i += 30) {
    const snapshot = await getDocs(
      query(
        collection(db, name),
        where(documentId(), "in", ids.slice(i, i + 30)),
      ),
    );
    result.push(
      ...snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as T),
    );
  }
  return result;
}
function useShopState() {
  const [lines, setLines] = useState<CartLine[]>(readCart),
    [products, setProducts] = useState<Record<string, Product>>({}),
    [stores, setStores] = useState<Record<string, Store>>({}),
    [catalogBusy, setCatalogBusy] = useState(false),
    [catalogError, setCatalogError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const productCache = useRef<Record<string, Product>>({}),
    storeCache = useRef<Record<string, Store>>({});
  const [identity, setIdentity] = useState<FirebaseUser | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [authBusy, setAuthBusy] = useState(true),
    [authError, setAuthError] = useState(""),
    [authRevision, setAuthRevision] = useState(0);
  const key = [...new Set(lines.map((line) => line.productId))]
    .sort()
    .join("|");
  function cacheProducts(values: Product[]) {
    for (const value of values) productCache.current[value.id] = value;
    setProducts({ ...productCache.current });
  }
  function cacheStores(values: Store[]) {
    for (const value of values) storeCache.current[value.id] = value;
    setStores({ ...storeCache.current });
  }
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      /* The SPA cart stays available in memory when storage is blocked. */
    }
  }, [lines]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === CART_KEY) setLines(readCart());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    let active = true,
      generation = 0;
    const stop = onAuthStateChanged(auth, async (user) => {
      const current = ++generation;
      setIdentity(user);
      setProfile(null);
      setAuthError("");
      setAuthBusy(true);
      try {
        if (user && isVerifiedIdentity(user)) {
          const value = await syncUserProfileToFirestore(user);
          if (active && current === generation) setProfile(value);
        }
      } catch (e) {
        if (active && current === generation)
          setAuthError(
            customerMessage(e, "تعذر تحميل حسابك. أعد تسجيل الدخول."),
          );
      } finally {
        if (active && current === generation) setAuthBusy(false);
      }
    });
    return () => {
      active = false;
      stop();
    };
  }, [authRevision]);
  useEffect(() => {
    let active = true;
    setCatalogError("");
    if (!key) {
      setCatalogBusy(false);
      return;
    }
    setCatalogBusy(true);
    void (async () => {
      try {
        const ids = key.split("|");
        const needed = refresh
          ? ids
          : ids.filter((id) => !productCache.current[id]);
        if (needed.length) {
          const values = await documents<Product>("products", needed);
          if (!active) return;
          for (const id of needed) delete productCache.current[id];
          cacheProducts(values);
        }
        const storeIds = [
          ...new Set(
            ids.map((id) => productCache.current[id]?.storeId).filter(Boolean),
          ),
        ];
        const missing = refresh
          ? storeIds
          : storeIds.filter((id) => !storeCache.current[id]);
        if (missing.length) {
          const values = await documents<Store>("stores", missing);
          if (active) {
            for (const id of missing) delete storeCache.current[id];
            cacheStores(values);
          }
        }
      } catch {
        if (active)
          setCatalogError(
            "تعذر تحديث بيانات السلة. أعد المحاولة قبل إتمام الطلب.",
          );
      } finally {
        if (active) setCatalogBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [key, refresh]);
  function add(
    product: Product,
    quantity: number,
    selectedOptions: Record<string, string>,
    notes: string,
  ) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50)
      throw new Error("اختر كمية من 1 إلى 50.");
    if (
      lines.some(
        (line) =>
          productCache.current[line.productId]?.storeId !== product.storeId,
      )
    )
      throw new Error(
        "السلة لطلب من متجر واحد. أكمل طلبك الحالي أو أفرغ السلة قبل اختيار متجر آخر.",
      );
    const normalized = Object.fromEntries(
      Object.entries(selectedOptions)
        .filter(([, value]) => value)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    const match = lines.find(
      (line) =>
        line.productId === product.id &&
        JSON.stringify(line.selectedOptions) === JSON.stringify(normalized) &&
        line.notes === notes,
    );
    if (match && match.quantity + quantity > 50)
      throw new Error("الحد الأقصى للصنف الواحد 50.");
    if (!match && lines.length >= 50)
      throw new Error("الحد الأقصى للسلة 50 صنفًا.");
    cacheProducts([product]);
    setLines((old) =>
      match
        ? old.map((line) =>
            line.id === match.id
              ? { ...line, quantity: line.quantity + quantity }
              : line,
          )
        : [
            ...old,
            {
              id: crypto.randomUUID(),
              productId: product.id,
              quantity,
              selectedOptions: normalized,
              notes,
            },
          ],
    );
  }
  function consume(purchased: CartLine[]) {
    consumeStorefrontCart(purchased);
    let next: CartLine[] = [];
    flushSync(() =>
      setLines((current) => {
        next = remainingCart(current, purchased);
        return next;
      }),
    );
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      /* The acknowledged cart remains correct in memory. */
    }
  }
  function quantity(id: string, value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 50) return;
    setLines((old) =>
      value
        ? old.map((line) =>
            line.id === id ? { ...line, quantity: value } : line,
          )
        : old.filter((line) => line.id !== id),
    );
  }
  const items: CartItem[] = lines.flatMap((line) => {
    const product = products[line.productId];
    if (!product || !Number.isFinite(product.price) || product.price < 0)
      return [];
    const extraPrice = (product.optionGroups || []).reduce(
      (sum, group) =>
        sum +
        (group.options.find(
          (option) => option.name === line.selectedOptions[group.title],
        )?.price || 0),
      0,
    );
    return [{ ...line, product, extraPrice }];
  });
  const unavailable = lines.some((line) => {
    const p = products[line.productId],
      store = p && stores[p.storeId];
    return (
      !p ||
      !Number.isFinite(p.price) ||
      p.price < 0 ||
      p.archived ||
      !p.inStock ||
      !store ||
      store.status !== "open" ||
      Object.entries(line.selectedOptions).some(
        ([title, value]) =>
          !p.optionGroups?.some(
            (group) =>
              group.title === title &&
              group.options.some((option) => option.name === value),
          ),
      ) ||
      p.optionGroups?.some(
        (group) => group.required && !line.selectedOptions[group.title],
      )
    );
  });
  return {
    lines,
    items,
    products,
    stores,
    add,
    quantity,
    consume,
    clear: () => {
      setLines([]);
      try {
        localStorage.setItem(CART_KEY, "[]");
      } catch {
        /* Memory cart remains cleared. */
      }
    },
    cacheProducts,
    cacheStores,
    catalogBusy,
    catalogError,
    unavailable,
    refreshCart: () => setRefresh((value) => value + 1),
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    identity,
    profile,
    authBusy,
    authError,
    refreshAccount: () => setAuthRevision((value) => value + 1),
  };
}
type ShopState = ReturnType<typeof useShopState>;
const ShopContext = createContext<ShopState | null>(null);
export function ShopProvider({ children }: { children: ReactNode }) {
  const value = useShopState();
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
export function useShop() {
  const value = useContext(ShopContext);
  if (!value) throw new Error("ShopProvider required");
  return value;
}
