import { supabase, signInWithSupabaseGoogle, signOutFromSupabase, getSupabaseStores, getSupabaseProducts, resolveSupabaseStoreUuid } from './lib/supabase';
import { useActivePortalOrders } from './lib/useActivePortalOrders';
import { normalizeOrder } from './utils/orderIntegration';
import { PreparationTasks } from './components/PreparationTasks';
import { LoadingState, ErrorState, EmptyState, ConnectionState } from './components/ui/DataStates';
import {operationsApi} from './lib/operationsApi';
import { BRAND } from './brand';
import { MerchantLoginLayout } from './components/MerchantLoginLayout';
import React, { useEffect, useState, useRef } from "react";
import {
  Store as StoreIcon,
  ChefHat,
  Lock,
  Mail,
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageSquare,
  HelpCircle,
  X,
  LogOut,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Flame,
  ArrowRight,
  ChevronDown,
  Check,
  Search,
} from "lucide-react";
import type { Order, Product, Profile, Store } from "./types";
import { RestaurantPortal } from "./components/RestaurantPortal";
import { customerMessage } from "./utils/customerMessage";


const SANGOUB_MASCOT = "/assets/sangoub/mascot-cheerful.png";
const SANGOUB_LOGO = "/brand/sangoub-mark-white-128.png";
const SANGOUB_WINK = "/assets/sangoub/mascot-wink.png";

export default function MerchantApp() {
  const [identity, setIdentity] = useState<{ uid: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [access, setAccess] = useState<"checking" | "login" | "denied" | "merchant">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision,setRevision]=useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Data for Restaurant Portal
  const [stores, setStores] = useState<Store[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsNextCursor,setProductsNextCursor]=useState<string|null>(null);
  const catalogPages=useRef(1);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [connected, setConnected] = useState(true);

  // Help & Support Modal State
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Store Switcher Custom Dropdown State
  const [isStoreSwitcherOpen, setIsStoreSwitcherOpen] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState("");

  const feed=useActivePortalOrders(access==='merchant'?identity?.uid:undefined,profile?.storeId);
  const [catalogLoading,setCatalogLoading]=useState(true);
  const [history,setHistory]=useState<Order[]>([]);
  const [historyCursor,setHistoryCursor]=useState<string|null>(null);
  const [historyBusy,setHistoryBusy]=useState(false);
  const [historyLoaded,setHistoryLoaded]=useState(false);
  const historyGeneration=useRef(0);
  useEffect(()=>{historyGeneration.current++;setHistory([]);setHistoryCursor(null);setHistoryBusy(false);setHistoryLoaded(false)},[identity?.uid,profile?.storeId,access]);
  async function loadHistory(){if(historyBusy)return;const generation=historyGeneration.current;setHistoryBusy(true);try{const result=await operationsApi('operations',{action:'portal-history',...(historyCursor?{cursor:historyCursor}:{})});if(generation!==historyGeneration.current)return;setHistory(prev=>[...new Map([...prev,...result.items.map(normalizeOrder)].map(o=>[o.id,o])).values()]);setHistoryCursor(result.nextCursor);setHistoryLoaded(true)}catch{if(generation===historyGeneration.current)setError('تعذر تحميل السجل؛ أعد المحاولة.')}finally{if(generation===historyGeneration.current)setHistoryBusy(false)}}
  const refreshMerchant=useRef<()=>Promise<void>>(async()=>{});
    useEffect(() => {
    let active = true;

    async function checkMerchant(user: any) {
      if (!user) {
        if (active) {
          setIdentity(null);
          setProfile(null);
          setStores([]);
          setOrders([]);
          setProducts([]);
          setAccess("login");
        }
        return;
      }

      const uid = user.id || user.uid;
      if (active) {
        setIdentity({ uid, email: user.email } as any);
        setAccess("checking");
      }

      try {
        const authority = await operationsApi('operations', { action: 'profile' });
        if (authority.role === 'restaurant' || authority.role === 'admin') {
          const storeId = authority.storeId 
            ? resolveSupabaseStoreUuid(authority.storeId) 
            : (authority.role === 'admin' ? 'a0000000-0000-0000-0000-000000000001' : '');

          if (authority.role === 'restaurant' && !storeId) {
            if (active) {
              setAccess("denied");
              setError("حساب الشريك التجاري قيد الاعتماد وتعيين المتجر من قِبل الإدارة المركزية. يرجى مراجعة إدارة المنظومة لربط متجرك.");
            }
            return;
          }

          const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
          if (active) {
            setProfile({
              id: uid,
              fullName: prof?.full_name || authority.displayName || (authority.role === 'admin' ? 'مدير المنظومة (معاينة المتجر)' : 'مدير المتجر'),
              email: user.email || '',
              phone: prof?.phone || '',
              role: authority.role === 'admin' ? 'admin' : 'restaurant',
              storeId,
              duty: authority.duty || 'manager',
              walletBalance: 0,
            } as any);
            setAccess("merchant");
            setError("");
          }
          return;
        }

        if (active) {
          setAccess("denied");
          setError("هذا الحساب غير مسجل كشريك تجاري معتمد في المنظومة. تواصل مع الإدارة لاعتماده.");
        }
      } catch (e: any) {
        if (active) {
          const isNetworkError = !navigator.onLine || 
            e?.message?.includes('Failed to fetch') || 
            e?.message?.includes('NetworkError') ||
            e?.message?.includes('ERR_INTERNET_DISCONNECTED') ||
            String(e).includes('fetch') ||
            String(e).includes('network');

          if (isNetworkError) {
            setError("انقطع الاتصال بالإنترنت. يرجى التحقق من اتصال الشبكة وإعادة المحاولة.");
          } else {
            setAccess("denied");
            setError(customerMessage(e, "تعذر التحقق من صلاحية المتجر."));
          }
        }
      }
    }

    const onOnline = () => {
      if (active) {
        setError("");
        setRevision(r => r + 1);
      }
    };
    window.addEventListener('online', onOnline);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        checkMerchant(session.user);
      } else {
        setAccess("login");
      }
    }).catch(() => {
      if (active) setError("انقطع الاتصال بالإنترنت. يرجى التحقق من اتصال الشبكة.");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) checkMerchant(session.user);
      else setAccess("login");
    });

    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
      subscription.unsubscribe();
    };
  }, [revision]);
  useEffect(()=>{
    setStores([]);setOrders([]);setProducts([]);setCouriers([]);setConnected(false);setCatalogLoading(true);setProductsNextCursor(null);catalogPages.current=1;
    if(access!=='merchant'||!profile)return;let active=true,inflight=false;
    const load = async () => {
      if (inflight) return;
      inflight = true;
      try {
        const currentStoreId = resolveSupabaseStoreUuid(profile.storeId);
        const targetStoreUuid = resolveSupabaseStoreUuid(currentStoreId);

        const [sbStores, sbProducts, sbCouriers, result] = await Promise.all([
          getSupabaseStores().catch(err => {
            console.warn('Failed to fetch stores from Supabase:', err);
            return [] as Store[];
          }),
          getSupabaseProducts(targetStoreUuid).catch(err => {
            console.warn('Failed to fetch products from Supabase:', err);
            return [] as Product[];
          }),
          supabase.from('profiles').select('id, full_name, phone, avatar_url, vehicle_type, vehicle_plate, courier_status').eq('role', 'courier').then(r => r.data || []).catch(() => []),
          operationsApi('operations', { action: 'store-dashboard', storeId: currentStoreId, includeOrders: false }).catch(() => null)
        ]);

        let catalog: Product[] = [];
        if (Array.isArray(sbProducts) && sbProducts.length > 0) {
          catalog = sbProducts;
        } else if (Array.isArray(result?.products) && result.products.length > 0) {
          catalog = result.products;
        } else {
          catalog = [];
        }
        let cursor = result?.productsNextCursor;
        for (let page = 1; page < catalogPages.current && cursor; page++) {
          try {
            const next = await operationsApi('operations', { action: 'store-products', storeId: currentStoreId, cursor });
            if (Array.isArray(next?.products)) catalog = [...catalog, ...next.products];
            cursor = next?.productsNextCursor;
          } catch {}
        }
        if (active) {
          if (Array.isArray(sbCouriers)) {
            setCouriers(sbCouriers.map((c: any) => ({
              id: c.id,
              name: c.full_name || 'كابتن توصيل',
              phone: c.phone || '',
              avatarUrl: c.avatar_url,
              vehicleType: c.vehicle_type,
              vehiclePlate: c.vehicle_plate,
              courierStatus: c.courier_status || 'active',
              status: c.courier_status === 'active' ? 'available' : 'busy'
            })));
          }
          const rawStores = (Array.isArray(sbStores) && sbStores.length > 0) ? sbStores : (Array.isArray(result?.stores) && result.stores.length > 0 ? result.stores : []);
          const stoppageKey = 'sangoub_store_stoppage_' + currentStoreId;
          let activeStoppage = null;
          try {
            const raw = localStorage.getItem(stoppageKey);
            if (raw) activeStoppage = JSON.parse(raw);
          } catch {}

          const resolvedStores = rawStores.map((s: Store) => {
            const isTarget = s.id === currentStoreId || s.id === (resolveSupabaseStoreUuid(profile.storeId));
            if (isTarget) {
              const isClosed = activeStoppage ? true : s.status === 'closed';
              return {
                ...s,
                commissionRate: s.commissionRate ?? 10,
                status: (isClosed ? 'closed' : (s.status || 'open')) as Store['status'],
                ...(isClosed && activeStoppage ? { stoppedAt: activeStoppage.stoppedAt } : {})
              };
            }
            return {
              ...s,
              commissionRate: s.commissionRate ?? 10
            };
          });

          setStores(resolvedStores);
          setProducts([...new Map(catalog.map((p: Product) => [p.id, p])).values()] as Product[]);
          setProductsNextCursor(cursor);
          setConnected(true);
          setError('');
        }
      } catch (e) {
        if (active) {
          setStores([]);
          setProducts([]);
          setConnected(true);
          setError('');
        }
      } finally {
        inflight = false;
        if (active) setCatalogLoading(false);
      }
    };
    refreshMerchant.current=load;void load();const timer=setInterval(()=>{if(!document.hidden)void load()},15000);return()=>{active=false;clearInterval(timer);refreshMerchant.current=async()=>{}};
  },[access,profile?.id,profile?.storeId]);

  // Handle Logout
  async function handleLogout() {
    try {
      await signOutFromSupabase();
    } catch {}
    setIdentity(null);
    setProfile(null);
    setStores([]);
    setOrders([]);
    setProducts([]);
    setAccess("login");
  }

  // Handle Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password;

      const { data, error: sbErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });
      if (!sbErr && data?.session) {
        setRevision(r => r + 1);
        return;
      }
      if (sbErr) {
        if (sbErr.message?.includes('Invalid login credentials')) {
          setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
          return;
        }
        if (sbErr.message?.includes('Email not confirmed')) {
          setError("يرجى تأكيد البريد الإلكتروني أولاً.");
          return;
        }
      }
      setError("بيانات الدخول غير صحيحة. راجع البريد وكلمة المرور.");
    } catch (err: any) {
      setError("بيانات الدخول غير صحيحة. راجع البريد وكلمة المرور.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await signInWithSupabaseGoogle(window.location.origin + '/merchant');
    } catch (err) {
      setError(customerMessage(err, "تعذر الدخول باستخدام Google. حاول مجددًا."));
    } finally {
      setBusy(false);
    }
  }

  // Handle Password Reset
  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) return;
    setBusy(true);
    setError("");
    try {
      const { error: sbErr } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: window.location.origin + '/merchant',
      });
      if (!sbErr) {
        setResetSent(true);
        setNotice(`تم إرسال رابط استعادة كلمة المرور إلى ${resetEmail} بنجاح.`);
        return;
      }
      if (sbErr) throw sbErr;
      setResetSent(true);
      setNotice(`إذا كان البريد مسجلاً، ستصله تعليمات الاستعادة.`);
    } catch (err: any) {
      setError(customerMessage(err, "تعذر إرسال رابط الاستعادة. تأكد من صحة البريد."));
    } finally {
      setBusy(false);
    }
  }

  async function merchantMutation(input:object){setError('');try{await operationsApi('operations',input);await Promise.all([refreshMerchant.current(),feed.refresh()]);}catch(e){setError(customerMessage(e,'تعذر حفظ التعديل.'));throw e;}}
  async function handleKitchenChange(id:string,_storeId:string,stage:'preparing'|'ready'){await merchantMutation({action:'legacy-prepare',id,next:stage});}
  async function handleAssignCourier(orderId: string, courierId: string, courierName?: string, courierPhone?: string) {
    const courier = couriers.find((c) => c.id === courierId);
    const feedItems = Array.isArray(feed?.items) ? feed.items : [];
    const allKnownOrders = [...feedItems, ...(orders || []), ...(history || [])];
    const targetOrder = allKnownOrders.find((o) => o.id === orderId);
    const resolvedName = courierName || courier?.name || 'كابتن توصيل';
    const resolvedPhone = courierPhone || courier?.phone || '';
    await merchantMutation({
      action: 'assign-courier',
      orderId,
      courierId,
      courierName: resolvedName,
      courierPhone: resolvedPhone,
      orderNumber: targetOrder?.orderNumber || '',
      nextStatus: 'ready'
    });
  }
  async function handleUpdateOrderStatus(_id:string,_status:Order['orderStatus']){setError('حالة التوصيل يحدّثها المندوب، وتجهيز الطلب يتم من أزرار إدارة وتجهيز الطلبات.');}
  async function handleUpdateProductStock(id:string,inStock:boolean){
    try { await supabase.from('products').update({ is_available: inStock }).eq('id', id); } catch {}
    try { await merchantMutation({action:'set-product-stock',id,inStock}); } catch {}
  }
  async function handleUpdateProductInventory(id:string,updates:{stockQuantity?:number;minStockAlert?:number;maxPerOrder?:number;inStock?:boolean}){
    try {
      const sbPatch: Record<string, any> = {};
      if (typeof updates.inStock === 'boolean') sbPatch.is_available = updates.inStock;
      if (Object.keys(sbPatch).length > 0) await supabase.from('products').update(sbPatch).eq('id', id);
    } catch {}
    try { await merchantMutation({action:'set-product-inventory',id,...updates}); } catch {}
  }
  async function handleUpdateProductPrice(id:string,price:number){
    try { await supabase.from('products').update({ price }).eq('id', id); } catch {}
    await merchantMutation({action:'set-product-price',id,price});
  }
  async function handleLinkProduct(catalogProductId:string,price:number,existingProductId?:string){await merchantMutation({action:'link-catalog-product',catalogProductId,price,...(existingProductId?{existingProductId}:{})});}
  async function handleArchiveProduct(id:string,archived:boolean){
    try { await supabase.from('products').update({ archived, is_available: !archived }).eq('id', id); } catch {}
    await merchantMutation({action:'set-product-archived',id,archived});
  }
  async function handleToggleStoreStatus(storeIdToToggle?: string) {
    const targetStoreId = storeIdToToggle || profile?.storeId || (stores[0]?.id) || '27d12743-8106-4ef0-ba3c-84abefdb75d6';
    const store = stores.find(s => s.id === targetStoreId) || stores[0];
    if (!store) return;

    const nextStatus = store.status === 'open' ? 'closed' : 'open';
    const now = Date.now();
    const targetStoreUuid = resolveSupabaseStoreUuid(targetStoreId);

    // 1. Optimistic UI update in React state
    setStores(prev => prev.map(s => {
      if (s.id === targetStoreId || s.id === store.id) {
        return {
          ...s,
          status: nextStatus,
          stoppedAt: nextStatus === 'closed' ? now : undefined
        };
      }
      return s;
    }));

    // 2. Persist Stoppage in localStorage (active stoppage + history log)
    const stoppageKey = 'sangoub_store_stoppage_' + targetStoreId;
    const historyKey = 'sangoub_store_stoppages_history_' + targetStoreId;
    const globalLogKey = 'sangoub_all_stores_stoppages_log';

    if (nextStatus === 'closed') {
      const activeRecord = {
        storeId: targetStoreId,
        storeName: store.name || 'فول وفلافل العاصمة',
        stoppedAt: now,
        stoppedBy: profile?.fullName || profile?.email || 'مدير المتجر',
        status: 'closed'
      };
      try {
        localStorage.setItem(stoppageKey, JSON.stringify(activeRecord));
        const globalLogs = JSON.parse(localStorage.getItem(globalLogKey) || '[]');
        globalLogs.unshift({ ...activeRecord, id: 'stop_' + now });
        localStorage.setItem(globalLogKey, JSON.stringify(globalLogs.slice(0, 50)));
      } catch {}
    } else {
      // Re-opening: compute duration and record in history
      try {
        const rawActive = localStorage.getItem(stoppageKey);
        if (rawActive) {
          const parsed = JSON.parse(rawActive);
          const durationMs = now - (parsed.stoppedAt || now);
          const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
          const completedRecord = {
            id: 'stop_' + (parsed.stoppedAt || now),
            storeId: targetStoreId,
            storeName: store.name || 'فول وفلافل العاصمة',
            stoppedAt: parsed.stoppedAt || now,
            resumedAt: now,
            durationMs,
            durationMinutes,
            durationLabel: durationMinutes < 60 ? `${durationMinutes} دقيقة` : `${Math.floor(durationMinutes / 60)} ساعة و ${durationMinutes % 60} دقيقة`,
            stoppedBy: parsed.stoppedBy || profile?.fullName || 'مدير المتجر'
          };

          const storeHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
          storeHistory.unshift(completedRecord);
          localStorage.setItem(historyKey, JSON.stringify(storeHistory.slice(0, 50)));

          // Update global admin log
          const globalLogs = JSON.parse(localStorage.getItem(globalLogKey) || '[]');
          const updatedGlobal = globalLogs.map((log: any) => 
            log.storeId === targetStoreId && log.status === 'closed'
              ? { ...log, ...completedRecord, status: 'completed' }
              : log
          );
          if (!updatedGlobal.some((log: any) => log.id === completedRecord.id)) {
            updatedGlobal.unshift({ ...completedRecord, status: 'completed' });
          }
          localStorage.setItem(globalLogKey, JSON.stringify(updatedGlobal.slice(0, 100)));
          localStorage.removeItem(stoppageKey);
        }
      } catch {}
    }

    // 3. Persist to Supabase stores table
    try {
      await supabase.from('stores').update({ 
        status: nextStatus,
        updated_at: new Date().toISOString() 
      }).eq('id', targetStoreUuid);
    } catch (e) {
      console.warn('Could not update Supabase store status:', e);
    }

    // 4. Send backend mutation gracefully without breaking UI
    try {
      await operationsApi('operations', { action: 'set-store-status', storeId: targetStoreId, status: nextStatus });
    } catch (e) {
      console.warn('Backend set-store-status warning:', e);
    }
  }

  // RENDER: 1. Loading State
  if (access === "checking") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center font-cairo" dir="rtl">
        <div className="relative mb-4">
          <img src={SANGOUB_MASCOT} alt="سنجوب" className="w-24 h-24 object-contain" />
        </div>
        {error ? (
          <div className="max-w-md w-full p-5 bg-white border border-amber-200 shadow-md rounded-2xl text-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertCircle size={22} />
            </div>
            <p className="text-xs font-bold text-slate-700">{error}</p>
            <button
              type="button"
              onClick={() => { setError(''); setRevision(r => r + 1); }}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              إعادة المحاولة الآن
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-base font-bold text-slate-800">جارٍ التحقق من صلاحيات بوابة الشركاء…</h2>
            <p className="text-xs text-slate-500 mt-1">سنجوب يجهز لك لوحة المتجر وإدارة الطلبات والمنتجات</p>
          </>
        )}
      </div>
    );
  }

  // RENDER: 2. Denied Access State (Customer logged into merchant portal)
  if (access === "denied") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center font-cairo" dir="rtl">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-lg font-black text-slate-900">حساب غير مصرح له كتاجر</h2>
          {error && <p role="alert" className="text-rose-600 font-bold text-xs">{error}</p>}
          <p className="text-xs text-slate-600 leading-relaxed">
            الحساب الحالي ({identity?.email || 'المسجل'}) غير مرتبط بصلاحية متجر شريك.
            هذه البوابة مخصصة حصرياً للتجار والشركاء التجاريين المعتمدين في سنجوب.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={handleLogout}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              تسجيل الخروج والتبديل لحساب التاجر
            </button>
            <a
              href="/"
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors text-center"
            >
              العودة للمتجر الرئيسي
            </a>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: 3. Logged-in Merchant Portal
  if (access === "merchant" && profile) {
    const safeStores = Array.isArray(stores) && stores.length > 0 ? stores : [];
    const fallbackStore: Store = {
      id: profile.storeId || 'store_default',
      name: 'بوابة الشريك والتاجر',
      status: 'open',
      category: 'متجر',
    } as Store;
    const userStore = safeStores.find((s) => s.id === profile?.storeId) || safeStores[0] || fallbackStore;
    const activeItems = Array.isArray(feed?.items) ? feed.items : [];

    return (
      <div className="merchant-portal min-h-screen bg-slate-100 font-cairo" dir="rtl">
        {/* Top Operational Header (Compact & Harmonized) */}
        <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800 shadow-sm">
          <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-6 h-13 flex items-center justify-between gap-3">
            {/* Store & Mascot Info */}
            <div className="flex items-center gap-2.5 min-w-0">
              {profile.role === 'admin' && safeStores.length > 0 ? (
                <div className="relative">
                  {/* Interactive Store Switcher Button */}
                  <button
                    type="button"
                    onClick={() => setIsStoreSwitcherOpen((prev) => !prev)}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 text-white border border-slate-700/80 hover:border-amber-400/60 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer shadow-2xs group"
                    title="تبديل المتجر لإدارة طلباته وقائمته"
                  >
                    <div className="w-6 h-6 rounded-md bg-white border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-2xs">
                      {((userStore?.id && typeof localStorage !== 'undefined' && localStorage.getItem(`sangoub_custom_logo_${userStore.id}`)) || userStore?.logoUrl || userStore?.logo) ? (
                        <img
                          src={(userStore?.id && typeof localStorage !== 'undefined' && localStorage.getItem(`sangoub_custom_logo_${userStore.id}`)) || userStore?.logoUrl || userStore?.logo}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs">🏪</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0 text-right">
                      {userStore?.id === 'a0000000-0000-0000-0000-000000000001' && (
                        <span className="text-amber-400 text-xs shrink-0 font-bold">⭐</span>
                      )}
                      <span className="truncate max-w-[140px] sm:max-w-[210px] text-slate-100 text-[11px] sm:text-xs">
                        {userStore?.name || 'اختر المتجر'}
                      </span>
                      <span className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-400/20 px-1 py-0.2 rounded font-bold hidden sm:inline">
                        المدير
                      </span>
                    </div>

                    <span
                      className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                        userStore?.status === 'open'
                          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse'
                          : 'bg-rose-400'
                      }`}
                    />

                    <ChevronDown
                      size={13}
                      className={`text-slate-400 group-hover:text-amber-400 transition-transform duration-200 shrink-0 ${
                        isStoreSwitcherOpen ? 'rotate-180 text-amber-400' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Floating Panel */}
                  {isStoreSwitcherOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => {
                          setIsStoreSwitcherOpen(false);
                          setStoreSearchQuery('');
                        }}
                      />

                      <div className="absolute top-full right-0 mt-1.5 z-50 w-72 sm:w-80 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 text-right">
                        {/* Dropdown Header & Search */}
                        <div className="p-2 border-b border-slate-800 bg-slate-950/70 space-y-1.5">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-bold text-slate-400">قائمة الشركاء والمتاجر</span>
                            <span className="text-[9px] text-amber-400 bg-amber-500/15 border border-amber-400/20 px-1.5 py-0.2 rounded font-mono font-bold">
                              {safeStores.length} متجر
                            </span>
                          </div>

                          {safeStores.length > 3 && (
                            <div className="relative">
                              <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={storeSearchQuery}
                                onChange={(e) => setStoreSearchQuery(e.target.value)}
                                placeholder="بحث سريع باسم المتجر..."
                                className="w-full h-7 pl-2 pr-7 text-[10px] sm:text-[11px] bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                            </div>
                          )}
                        </div>

                        {/* Stores List */}
                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60 p-1">
                          {safeStores
                            .filter((s) => {
                              if (!storeSearchQuery.trim()) return true;
                              const q = storeSearchQuery.toLowerCase();
                              return (
                                s.name?.toLowerCase().includes(q) ||
                                s.locationInDistrict?.toLowerCase().includes(q) ||
                                s.category?.toLowerCase().includes(q)
                              );
                            })
                            .map((s) => {
                              const isSelected = s.id === userStore.id;
                              const logo = (s.id && typeof localStorage !== 'undefined' && localStorage.getItem(`sangoub_custom_logo_${s.id}`)) || s.logoUrl || s.logo;
                              const isCentral = s.id === 'a0000000-0000-0000-0000-000000000001';

                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setProfile(prev => prev ? { ...prev, storeId: s.id } : null);
                                    setIsStoreSwitcherOpen(false);
                                    setStoreSearchQuery('');
                                  }}
                                  className={`w-full p-2 rounded-lg flex items-center justify-between gap-2.5 transition-colors cursor-pointer text-right ${
                                    isSelected
                                      ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200'
                                      : 'hover:bg-slate-800 text-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-2xs">
                                      {logo && (logo.startsWith('http') || logo.startsWith('data:') || logo.startsWith('/')) ? (
                                        <img src={logo} alt="" className="w-full h-full object-contain" />
                                      ) : (
                                        <span className="text-sm">🏪</span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold truncate">{s.name}</span>
                                        {isCentral && (
                                          <span className="text-[8px] bg-amber-500 text-slate-950 font-black px-1 rounded">
                                            المركزي
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                        <span className="truncate">
                                          {s.locationInDistrict ? s.locationInDistrict.replace(/^الحي الحكومي - /g, '') : (s.category || 'متجر')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'open' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                          <span className={s.status === 'open' ? 'text-emerald-400' : 'text-rose-400'}>
                                            {s.status === 'open' ? 'مفتوح' : 'مغلق'}
                                          </span>
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {isSelected && (
                                    <Check size={14} className="text-amber-400 shrink-0 font-bold" />
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-2xs">
                    {((userStore?.id && typeof localStorage !== 'undefined' && localStorage.getItem(`sangoub_custom_logo_${userStore.id}`)) || userStore?.logoUrl || userStore?.logo) ? (
                      <img
                        src={(userStore?.id && typeof localStorage !== 'undefined' && localStorage.getItem(`sangoub_custom_logo_${userStore.id}`)) || userStore?.logoUrl || userStore?.logo}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs">🏪</span>
                    )}
                  </div>
                  <h1 className="text-xs sm:text-sm font-black text-white truncate">{userStore?.name || "بوابة الشريك والتاجر"}</h1>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                      userStore?.status === 'open'
                        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse'
                        : 'bg-rose-400'
                    }`}
                  />
                </div>
              )}

              <p className="text-[10px] text-slate-400 truncate hidden md:block">
                المسؤول: {profile.fullName || profile.email} {profile.duty ? `(${profile.duty === "manager" ? "مدير المتجر" : "مسؤول التحضير"})` : ""}
              </p>
            </div>

            {/* Actions: Live Sync Badge + Cheerful Mascot Support + Logout */}
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${
                  !feed.online
                    ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                    : feed.live
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                }`}
                title={!feed.online ? "غير متصل" : feed.live ? "متصل لحظياً" : `تحديث دوري ${feed.updatedAt ? `(آخر تحقق: ${new Date(feed.updatedAt).toLocaleTimeString('ar-EG')})` : ''}`}
              >
                <RefreshCw size={12} className={feed.live ? "text-emerald-400" : !feed.online ? "text-rose-400" : "text-amber-400"} />
              </span>

              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black rounded-lg transition-transform active:scale-95 shadow-2xs cursor-pointer"
              >
                <img src={SANGOUB_WINK} alt="سنجوب" className="w-4 h-4 object-contain" />
                <span className="hidden sm:inline">دعم سنجوب</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                title="تسجيل الخروج"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Portal Body */}
        <main className="max-w-[1600px] mx-auto p-3 sm:p-5 lg:p-6">
          {(error||feed.error)&&<ErrorState message={error||feed.error} retry={()=>{void refreshMerchant.current();void feed.refresh()}}/>}
          {(catalogLoading||feed.loading)&&<LoadingState message="جارٍ تحميل المتجر والطلبات…"/>}
          {!catalogLoading&&!userStore&&!error&&<EmptyState message="لم يُربط حسابك بمتجر تشغيل متاح؛ تواصل مع الإدارة."/>}
          {userStore && (
            <RestaurantPortal
              preparationContent={activeItems.some(o => o.fulfillmentVersion === 2) ? <PreparationTasks orders={activeItems.filter(o => o.fulfillmentVersion === 2)} storeId={profile.storeId!} online={feed.online && !feed.error} refresh={feed.refresh} /> : undefined}
              currentProfile={profile}
              stores={safeStores}
              products={Array.isArray(products) ? products : []}
              orders={[...new Map([...(history || []), ...activeItems.map(normalizeOrder)].map(o => [o.id, o])).values()]}
              couriers={couriers}
              connected={connected && feed.online && !feed.error}
              feedOnline={feed.online}
              feedLive={feed.live}
              feedUpdatedAt={feed.updatedAt}
              historyBusy={historyBusy}
              historyLoaded={historyLoaded}
              historyCursor={Boolean(historyCursor)}
              historyCount={history.length}
              onLoadHistory={() => void loadHistory()}
              onKitchenChange={handleKitchenChange}
              onAssignCourier={handleAssignCourier}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdateProductStock={handleUpdateProductStock}
              onUpdateProductInventory={handleUpdateProductInventory}
              onUpdateProductPrice={handleUpdateProductPrice}
              productsNextCursor={productsNextCursor}
              productsLoading={catalogLoading}
              onLoadMoreProducts={() => { if (catalogLoading) return; catalogPages.current++; setCatalogLoading(true); void refreshMerchant.current(); }}
              onLinkProduct={handleLinkProduct}
              onArchiveProduct={handleArchiveProduct}
              onToggleStoreStatus={handleToggleStoreStatus}
              onRefreshProducts={() => void refreshMerchant.current()}
            />
          )}
        </main>



        {/* Cheerful Help Modal */}
        {isHelpOpen && <SangoubHelpModal onClose={() => setIsHelpOpen(false)} />}
      </div>
    );
  }

  // RENDER: 4. Dedicated Merchant Login Screen
  return (
    <>
      <MerchantLoginLayout onSupport={() => setIsHelpOpen(true)}>
          <div className="merchant-entry-form space-y-4">
            {error && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-bold animate-fadeIn">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-bold animate-fadeIn">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span>{notice}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs leading-relaxed">
              <strong>بوابة مخصصة لطاقم المتجر المعتمد:</strong> يتم إنشاء حسابات التجار وتعيين الصلاحيات من خلال إدارة سنجوب أو مدير المتجر حصراً.
            </div>
            <form onSubmit={handleLogin} className="space-y-4" aria-label="دخول التاجر">
              <div>
                <label htmlFor="merchant-email" className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <Mail size={14} className="text-slate-400" />
                  <span>البريد الإلكتروني المعتمد للتاجر *</span>
                </label>
                <input
                  id="merchant-email"
                  autoComplete="username"
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partner@sangoub.com"
                  className="w-full h-11 px-3.5 border border-slate-300 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all text-slate-800"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="merchant-password" className="text-slate-700 font-bold flex items-center gap-1.5">
                    <Lock size={14} className="text-slate-400" />
                    <span>كلمة المرور *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setIsResetOpen(true);
                    }}
                    className="text-[11px] text-orange-600 hover:text-orange-700 font-bold cursor-pointer hover:underline"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="merchant-password"
                    autoComplete="current-password"
                    type={showPassword ? "text" : "password"}
                    required
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-11 pr-3.5 pl-11 border border-slate-300 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all text-slate-800"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-black text-xs rounded-xl shadow-md hover:shadow-orange-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>جارٍ التحقق والدخول…</span>
                  </>
                ) : (
                  <>
                    <span>دخول التاجر</span>
                    <ArrowRight size={15} className="rotate-180" />
                  </>
                )}
              </button>
            </form>

            <p className="merchant-entry-join">ليس لديك حساب تاجر؟ <button type="button" onClick={() => setIsHelpOpen(true)}>انضم الآن</button></p>
          </div>
      </MerchantLoginLayout>

      {/* Cheerful Help Modal */}
      {isHelpOpen && <SangoubHelpModal onClose={() => setIsHelpOpen(false)} />}

      {/* Password Reset Modal */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Lock size={15} className="text-orange-600" />
                <span>استعادة كلمة المرور</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsResetOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-slate-600 leading-relaxed">
              أدخل بريدك الإلكتروني المعتمد بالمتجر، وسنرسل لك رابطاً مباشراً لتعيين كلمة مرور جديدة:
            </p>

            <form onSubmit={handlePasswordReset} className="space-y-3">
              <input
                type="email"
                required
                dir="ltr"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="partner@sangoub.com"
                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {busy ? "جارٍ الإرسال…" : "إرسال رابط التعيين"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Cheerful Sangoub Mascot Partner Support Modal
 */
function SangoubHelpModal({ onClose }: { onClose: () => void }) {
  const whatsappUrl = `${BRAND.supportUrl}?text=${encodeURIComponent(
    "مرحباً فريق عمليات سنجوب، أنا تاجر شريك وأحتاج مساعدة فنية في بوابة المتجر والطلبات."
  )}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-cairo" dir="rtl">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn text-xs">
        {/* Mascot Banner */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 text-white/80 hover:text-white p-1 rounded-full bg-black/10 hover:bg-black/20 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white/20 rounded-2xl p-2 backdrop-blur-xs shrink-0 flex items-center justify-center">
              <img src={SANGOUB_MASCOT} alt="سنجوب المبتسم" className="w-16 h-16 object-contain" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 bg-white/20 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-1">
                <Sparkles size={11} />
                <span>دعم شركاء سنجوب</span>
              </div>
              <h3 className="text-base font-black">أهلاً بك يا شريكنا العزيز!</h3>
              <p className="text-[11px] text-orange-100 mt-0.5">
                سنجوب وفريق العمليات هنا لمساعدتك في كل ما يخص متجرك وطلباتك ومنتجاتك!
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Quick Direct Channels */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 text-xs">قنوات التواصل الفوري مع غرفة العمليات:</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* WhatsApp Support Button */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-950 font-bold transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <MessageSquare size={17} />
                </div>
                <div>
                  <span className="block text-xs font-black text-emerald-900">واتساب العمليات</span>
                  <span className="block text-[10px] text-emerald-700">تواصل مع فريق الدعم</span>
                </div>
              </a>

              {/* Direct Hotline */}
              <a
                href={whatsappUrl}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 font-bold transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Phone size={17} />
                </div>
                <div>
                  <span className="block text-xs font-black text-amber-900">دعم ومساعدة المتجر</span>
                  <span className="block text-[10px] text-amber-700">التواصل عبر قناة الدعم</span>
                </div>
              </a>
            </div>
          </div>

          {/* Quick FAQ Checklist */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <HelpCircle size={14} className="text-orange-600" />
              <span>إرشادات سريعة لإدارة وتجهيز الطلبات:</span>
            </h4>

            <div className="space-y-1.5 text-[11px] text-slate-600">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
                  1
                </span>
                <p><strong>استلام الطلبات:</strong> يظهر إشعار صوتي فوري في الشاشة عند طلب العميل، انقر "قبول وبدء التجهيز".</p>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
                  2
                </span>
                <p><strong>جاهزية الوجبة:</strong> فور تغليف الطعام ووضعه في علب الحفظ الحراري، انقر "تم التجهيز" ليستلمها المندوب.</p>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
                  3
                </span>
                <p><strong>نفاد صنف أو تعديل السعر:</strong> من تبويب "قائمة الطعام" يمكنك إيقاف أي صنف نفد بنقرة زر دون إغلاق المتجر.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            حسناً، فهمت
          </button>
        </div>
      </div>
    </div>
  );
}
