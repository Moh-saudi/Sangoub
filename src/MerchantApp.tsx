import { useActivePortalOrders } from './lib/useActivePortalOrders';
import { normalizeOrder } from './utils/orderIntegration';
import { PreparationTasks } from './components/PreparationTasks';
import { LoadingState, ErrorState, EmptyState, ConnectionState } from './components/ui/DataStates';
import {operationsApi} from './lib/operationsApi';
import { BRAND } from './brand';
import { MerchantLoginLayout } from './components/MerchantLoginLayout';
import React, { useEffect, useState, useRef } from "react";
import {
  auth,
  googleProvider,
  isVerifiedIdentity,
  db,
  onAuthStateChanged,
  syncUserProfileToFirestore,
  signOutFromFirebase,
  watchCollection,
  updateOrderRecord,
  type FirebaseUser,
} from "./lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, setPersistence, browserLocalPersistence, browserSessionPersistence, sendEmailVerification } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
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
} from "lucide-react";
import type { Order, Product, Profile, Store } from "./types";
import { RestaurantPortal } from "./components/RestaurantPortal";
import { customerMessage } from "./utils/customerMessage";

const SANGOUB_MASCOT = "/assets/sangoub/mascot-cheerful.png";
const SANGOUB_LOGO = "/brand/sangoub-mark-white-128.png";
const SANGOUB_WINK = "/assets/sangoub/mascot-wink.png";

export default function MerchantApp() {
  const [identity, setIdentity] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [access, setAccess] = useState<"checking" | "login" | "denied" | "merchant">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
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
  useEffect(()=>onAuthStateChanged(auth,user=>{setIdentity(user);setProfile(null);setStores([]);setOrders([]);setProducts([]);setAccess(user?'checking':'login')}),[]);
  useEffect(()=>{
    if(!identity)return;let generation=0;
    const stop=onSnapshot(doc(db,'staff',identity.uid),{includeMetadataChanges:true},async snapshot=>{
      const current=++generation;setProfile(null);setError('');
      if(snapshot.metadata.fromCache){setAccess('checking');return;}
      if(snapshot.data()?.role!=='restaurant'||!snapshot.data()?.storeId){setAccess('denied');return;}
      try{const p=await syncUserProfileToFirestore(identity);if(current!==generation)return;if(p.role!=='restaurant'||!p.storeId){setAccess('denied');return;}setProfile({...p,duty:snapshot.data()?.duty||'manager'});setAccess('merchant');}catch(e){if(current===generation){setAccess('denied');setError(customerMessage(e,'أكد الحساب وراجع ربط المتجر.'));}}
    },e=>{generation++;setProfile(null);setAccess('denied');setError(customerMessage(e,'تعذر التحقق من صلاحية المتجر.'))});return()=>{generation++;stop()};
  },[identity,revision]);
  useEffect(()=>{
    setStores([]);setOrders([]);setProducts([]);setCouriers([]);setConnected(false);setCatalogLoading(true);setProductsNextCursor(null);catalogPages.current=1;
    if(access!=='merchant'||!profile)return;let active=true,inflight=false;
    const load=async()=>{if(inflight)return;inflight=true;try{const result=await operationsApi('operations',{action:'store-dashboard',includeOrders:false});
      let catalog=result.products,cursor=result.productsNextCursor;
      for(let page=1;page<catalogPages.current&&cursor;page++){const next=await operationsApi('operations',{action:'store-products',cursor});catalog=[...catalog,...next.products];cursor=next.productsNextCursor;}
      if(active){setStores(result.stores);setProducts([...new Map(catalog.map((p:Product)=>[p.id,p])).values()] as Product[]);setProductsNextCursor(cursor);setConnected(true);setError('');}}catch(e){if(active){setConnected(false);setError(customerMessage(e,'تعذر تحميل بيانات متجرك.'));}}finally{inflight=false;if(active)setCatalogLoading(false);}};
    refreshMerchant.current=load;void load();const timer=setInterval(()=>{if(!document.hidden)void load()},15000);return()=>{active=false;clearInterval(timer);refreshMerchant.current=async()=>{}};
  },[access,profile?.id,profile?.storeId]);

  // Handle Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      const code = err.code || "";
      if (/invalid-credential|wrong-password|user-not-found/.test(code)) {
        setError("بيانات الدخول غير صحيحة. راجع البريد وكلمة المرور.");
      } else {
        setError(customerMessage(err, "تعذر تسجيل الدخول. يرجى المحاولة مرة أخرى."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithPopup(auth, googleProvider);
    } catch (err) { setError(customerMessage(err, "تعذر الدخول باستخدام Google. حاول مجددًا.")); }
    finally { setBusy(false); }
  }

  // Handle Password Reset
  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) return;
    setBusy(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSent(true);
      setNotice(`تم إرسال رابط إعادة تعيين كلمة المرور إلى ${resetEmail} بنجاح.`);
    } catch (err: any) {
      setError(customerMessage(err, "تعذر إرسال رابط الاستعادة. تأكد من صحة البريد."));
    } finally {
      setBusy(false);
    }
  }

  async function merchantMutation(input:object){setError('');try{await operationsApi('operations',input);await Promise.all([refreshMerchant.current(),feed.refresh()]);}catch(e){setError(customerMessage(e,'تعذر حفظ التعديل.'));throw e;}}
  async function handleKitchenChange(id:string,_storeId:string,stage:'preparing'|'ready'){await merchantMutation({action:'legacy-prepare',id,next:stage});}
  async function handleUpdateOrderStatus(_id:string,_status:Order['orderStatus']){setError('حالة التوصيل يحدّثها المندوب، والتحضير من أزرار المطبخ.');}
  async function handleUpdateProductStock(id:string,inStock:boolean){try{await merchantMutation({action:'set-product-stock',id,inStock})}catch{}}
  async function handleUpdateProductPrice(id:string,price:number){await merchantMutation({action:'set-product-price',id,price});}
  async function handleLinkProduct(catalogProductId:string,price:number,existingProductId?:string){await merchantMutation({action:'link-catalog-product',catalogProductId,price,...(existingProductId?{existingProductId}:{})});}
  async function handleArchiveProduct(id:string,archived:boolean){await merchantMutation({action:'set-product-archived',id,archived});}
  async function handleToggleStoreStatus(_storeId:string){const store=stores.find(s=>s.id===profile?.storeId);if(!store)return;try{await merchantMutation({action:'set-store-status',status:store.status==='open'?'closed':'open'})}catch{}}

  // RENDER: 1. Loading State
  if (access === "checking") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center font-cairo" dir="rtl">
        <div className="relative mb-4">
          <img src={SANGOUB_MASCOT} alt="سنجوب" className="w-24 h-24 object-contain animate-bounce" />
        </div>
        <h2 className="text-base font-bold text-slate-800">جارٍ التحقق من صلاحيات بوابة الشركاء…</h2>
        <p className="text-xs text-slate-500 mt-1">سنجوب يجهز لك لوحة المطبخ والطلبات اللحظية</p>
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
          <h2 className="text-lg font-black text-slate-900">{identity&&!isVerifiedIdentity(identity)?'أكد بريد الحساب أولًا':'حساب غير مصرح له كتاجر'}</h2>
          {error&&<p role="alert" className="text-red-700">{error}</p>}
          {identity&&!isVerifiedIdentity(identity)&&<div className="space-y-2"><button className="p-3 border rounded-lg" disabled={busy} onClick={async()=>{setBusy(true);try{await sendEmailVerification(identity);setError('أرسلت رسالة تأكيد البريد.')}catch(e){setError(customerMessage(e,'تعذر الإرسال.'))}finally{setBusy(false)}}}>إرسال تأكيد البريد</button><button className="p-3 border rounded-lg" disabled={busy} onClick={async()=>{setBusy(true);try{await identity.reload();await identity.getIdToken(true);setRevision(v=>v+1)}catch(e){setError(customerMessage(e,'تعذر التحقق.'))}finally{setBusy(false)}}}>تم التأكيد، إعادة الفحص</button></div>}
          <p className="text-xs text-slate-600 leading-relaxed">
            الحساب الحالي مسجل كـ (<strong>{profile?.role === "employee" ? "عميل بالحي الحكومي" : profile?.role || "مستخدم"}</strong>).
            هذه البوابة مخصصة حصرياً للمطابخ والمتاجر الشريكة المعتمدة في سنجوب.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => signOutFromFirebase()}
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
    const userStore = stores.find((s) => s.id === profile.storeId);

    return (
      <div className="merchant-portal min-h-screen bg-slate-100 font-cairo" dir="rtl">
        {/* Top Operational Header */}
        <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            {/* Store & Mascot Info */}
            <div className="flex items-center gap-3">
              <img src={SANGOUB_LOGO} alt="سنجوب" className="w-9 h-9 rounded-lg bg-white" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-black text-white">{userStore?.name || "بوابة التاجر والمطبخ"}</h1>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      userStore?.status === "open"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${userStore?.status === "open" ? "bg-emerald-400" : "bg-rose-400"}`} />
                    <span>{userStore?.status === "open" ? "مفتوح ويستقبل الطلبات" : "مغلق مؤقتاً"}</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  المسؤول: {profile.fullName || profile.email} {profile.duty ? `(${profile.duty === "manager" ? "مدير المتجر" : "مسؤول التحضير"})` : ""}
                </p>
              </div>
            </div>

            {/* Actions: Cheerful Mascot Support Button + Logout */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-lg transition-transform active:scale-95 shadow-sm cursor-pointer"
              >
                <img src={SANGOUB_WINK} alt="سنجوب" className="w-5 h-5 object-contain" />
                <span>دعم سنجوب للشركاء</span>
              </button>

              <button
                type="button"
                onClick={() => signOutFromFirebase()}
                title="تسجيل الخروج"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Portal Body */}
        <main className="max-w-7xl mx-auto p-4 sm:p-6">
          <ConnectionState online={feed.online} live={feed.live} updatedAt={feed.updatedAt}/>
          {(error||feed.error)&&<ErrorState message={error||feed.error} retry={()=>{void refreshMerchant.current();void feed.refresh()}}/>}
          {(catalogLoading||feed.loading)&&<LoadingState message="جارٍ تحميل المتجر والطلبات…"/>}
          <button className="btn btn-outline-secondary mb-3" disabled={historyBusy||(historyLoaded&&!historyCursor)} onClick={()=>void loadHistory()}>{historyLoaded&&!historyCursor?'اكتمل تحميل السجل':historyBusy?'جارٍ تحميل السجل…':history.length&&historyCursor?'تحميل المزيد من الطلبات السابقة':'تحميل سجل الطلبات السابق'}</button>
          {history.length>0&&<p className="text-sm">المالية والسجل يعرضان الطلبات المحملة فقط، وليس إجمالي الحساب.</p>}
          {feed.truncated&&<p role="status">تعرض أول 50 طلباً نشطاً؛ راجع الإدارة إذا تجاوز العدد هذا الحد.</p>}
          {!catalogLoading&&!userStore&&!error&&<EmptyState message="لم يُربط حسابك بمتجر تشغيل متاح؛ تواصل مع الإدارة."/>}
          {userStore&&<RestaurantPortal
            preparationContent={feed.items.some(o=>o.fulfillmentVersion===2)?<PreparationTasks orders={feed.items.filter(o=>o.fulfillmentVersion===2)} storeId={profile.storeId!} online={feed.online&&!feed.error} refresh={feed.refresh}/>:undefined}
            currentProfile={profile}
            stores={stores}
            products={products}
            orders={[...new Map([...history,...feed.items.map(normalizeOrder)].map(o=>[o.id,o])).values()]}
            couriers={couriers}
            connected={connected&&feed.online&&!feed.error}
            onKitchenChange={handleKitchenChange}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateProductStock={handleUpdateProductStock}
            onUpdateProductPrice={handleUpdateProductPrice}
            productsNextCursor={productsNextCursor}
            productsLoading={catalogLoading}
            onLoadMoreProducts={()=>{if(catalogLoading)return;catalogPages.current++;setCatalogLoading(true);void refreshMerchant.current();}}
            onLinkProduct={handleLinkProduct}
            onArchiveProduct={handleArchiveProduct}
            onToggleStoreStatus={handleToggleStoreStatus}
          />}
        </main>

        {/* Floating Cheerful Support Button */}
        <div className="fixed bottom-5 left-5 z-50">
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="flex items-center gap-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs px-4 py-2.5 rounded-full shadow-2xl hover:shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-white"
          >
            <img src={SANGOUB_MASCOT} alt="سنجوب" className="w-7 h-7 object-contain" />
            <span>مساعدة سنجوب السريعة 🐿️</span>
          </button>
        </div>

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
              <label className="merchant-entry-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />تذكرني على هذا الجهاز</label>
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
                سنجوب وفريق العمليات هنا لمساعدتك في كل ما يخص مطبخك وطلباتك!
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
                  <span className="block text-xs font-black text-amber-900">مساعدة المطبخ والطلبات</span>
                  <span className="block text-[10px] text-amber-700">التواصل عبر قناة الدعم</span>
                </div>
              </a>
            </div>
          </div>

          {/* Quick FAQ Checklist */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <HelpCircle size={14} className="text-orange-600" />
              <span>إرشادات سريعة لطاقم المطبخ:</span>
            </h4>

            <div className="space-y-1.5 text-[11px] text-slate-600">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
                  1
                </span>
                <p><strong>استلام الطلبات:</strong> يظهر إشعار صوتي فوري في الشاشة عند طلب العميل، انقر "قبول وبدء التحضير".</p>
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
