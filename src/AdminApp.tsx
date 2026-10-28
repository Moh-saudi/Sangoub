import { AdminLoginLayout, GoogleSignInMark } from "./components/AdminLoginLayout";
import { customerMessage } from "./utils/customerMessage";
import { DeploymentVersion } from "./components/DeploymentVersion";
import { operationsApi } from "./lib/operationsApi";
import { adminApi } from "./lib/adminApi";
import "./admin.css";
import { useEffect, useState, useRef } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail, sendEmailVerification, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { LogOut, ShieldCheck, Loader2, Eye, EyeOff, Mail, LockKeyhole, ArrowLeft } from "lucide-react";
import { auth, db, googleProvider, onAuthStateChanged, isVerifiedIdentity, syncUserProfileToFirestore, signOutFromFirebase, subscribeToOrders, watchCollection, saveRecord, updateOrderRecord, approvePartner, type FirebaseUser } from "./lib/firebase";
import { AdminWorkspace } from "./components/AdminWorkspace";
import { AdminDashboard } from "./components/AdminDashboard";
import type { AdminStaff } from "./components/AdminSetupPanel";
import type { Profile, Store, Product, Order, Coupon, PartnerApplication, JobApplication, ApplicationStatus } from "./types";

const logo = "/brand/sangoub-mark-white-128.png";
function message(error: unknown): string {
  const code = (error as { code?: string })?.code || "";
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return "راجع البريد وكلمة المرور.";
  if (/unauthorized-domain/.test(code)) return "تسجيل الدخول غير متاح حاليًا. يرجى المحاولة لاحقًا.";
  if (/permission-denied/.test(code)) return "تعذر الوصول. راجع صلاحية الإدارة وقواعد قاعدة البيانات.";
  if (/popup-closed-by-user|cancelled-popup-request/.test(code)) return "أُغلقت نافذة تسجيل الدخول قبل الإكمال.";
  if (/network|unavailable/.test(code)) return "تعذر الاتصال بالخادم. تحقق من الشبكة وأعد المحاولة.";
  return customerMessage(error, "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
}

export default function AdminApp() {
  const loggedSession = useRef("");
  const [identity, setIdentity] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [access, setAccess] = useState<"checking" | "login" | "verify" | "denied" | "admin">("checking");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [partners, setPartners] = useState<PartnerApplication[]>([]);
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [workAccount, setWorkAccount] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const report = (error: unknown) => setError(message(error));

  useEffect(() => { document.title = access === "admin" ? "لوحة الإدارة | سنجوب" : "دخول الإدارة | سنجوب"; }, [access]);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (!user) loggedSession.current = "";
    setIdentity(user); setProfile(null); setError(""); setNotice(""); setPassword(""); setShowPassword(false);
    setAccess(user ? "checking" : "login");
  }), []);
  useEffect(() => {
    setProfile(null);
    if (!identity) return;
    if (!isVerifiedIdentity(identity)) { setAccess("verify"); return; }
    setAccess("checking");
    let generation = 0;
    const stop = onSnapshot(doc(db, "admins", identity.uid), { includeMetadataChanges: true }, async (snapshot) => {
      const current = ++generation;
      if (snapshot.metadata.fromCache) { setProfile(null); setAccess("checking"); return; }
      if (!snapshot.exists()) { setProfile(null); setAccess("denied"); return; }
      try {
        const result = await syncUserProfileToFirestore(identity);
        if (current !== generation) return;
        if (result.role !== "admin") { setProfile(null); setAccess("denied"); return; }
        setProfile(result); setAccess("admin"); setError("");
      } catch (error) { if (current === generation) { setProfile(null); setAccess("denied"); report(error); } }
    }, (error) => { generation++; setProfile(null); setAccess("denied"); report(error); });
    return () => { generation++; stop(); };
  }, [identity, revision]);
  useEffect(() => {
    setOrders([]); setStores([]); setProducts([]); setStaff([]); setCoupons([]); setPartners([]); setJobs([]); setConnected(false);
    if (access !== "admin" || !profile) return;
    const stops = [
      subscribeToOrders(profile, setOrders, report, setConnected),
      watchCollection<Store>("stores", setStores, report),
      watchCollection<Product>("products", setProducts, report),
      watchCollection<AdminStaff>("staff", setStaff, report),
      watchCollection<Coupon>("coupons", setCoupons, report),
      watchCollection<PartnerApplication>("partnerApplications", setPartners, report),
      watchCollection<JobApplication>("jobApplications", setJobs, report),
    ];
    return () => stops.forEach((stop) => stop());
  }, [profile?.id, access]);

  useEffect(() => {
    if(access !== "admin" || !identity || loggedSession.current === identity.uid) return;
    loggedSession.current = identity.uid;
    void adminApi("data", {action:"session",event:"open"}).catch(report);
  }, [access, identity?.uid]);

  useEffect(() => {
    setWorkAccount(null);if(access!=="denied"||!identity)return;
    let active=true;void operationsApi("operations",{action:"profile"}).then(result=>{if(active)setWorkAccount(result);}).catch(()=>{});
    return()=>{active=false;};
  },[access,identity?.uid]);
  async function action(operation: () => Promise<unknown>, success?: string) {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); if (success) setNotice(success); }
    catch (error) { report(error); }
    finally { setBusy(false); }
  }
  async function assignCourier(orderId: string, courierId: string) {
    const courier = staff.find((person) => person.id === courierId && person.role === "courier");
    if (!courier || !orders.some((order) => order.id === orderId && ["ready", "with_courier"].includes(order.orderStatus))) throw new Error("راجع حالة الطلب والمندوب المختار.");
    const order = orders.find(item => item.id === orderId)!;
    await updateOrderRecord(orderId, { courierId, courierName: courier.name, courierPhone: courier.phone });
  }
  const updateApplication = (collection: string, id: string, status: ApplicationStatus) => {
    void action(() => saveRecord(collection, id, { status }), "تم تحديث الطلب.");
  };
  const approveStore = (partner: PartnerApplication) => {
    void action(() => approvePartner(partner.id, {
      id: crypto.randomUUID(), name: partner.businessName, nameEn: partner.businessName, type: partner.partnerType,
      category: "sandwiches", logo: "🍽️", banner: "from-orange-600 to-slate-900", status: "closed", rating: 0, ratingCount: 0,
      deliveryTime: "لم يحدد بعد", minOrder: 0, deliveryFee: 0, locationInDistrict: partner.locationInCapital,
    }), "أُضيف المتجر مغلقًا؛ راجع بياناته ورسومه من الكتالوج قبل فتحه.");
  };

  return <div className={access === "admin" ? "admin-app min-h-screen bg-slate-50 text-slate-900" : "admin-signin"} dir="rtl">
    <a className="skip-link" href="#admin-content">انتقل إلى محتوى الإدارة</a>
    {access !== "admin" ? <header className="admin-signin-header"><a className="admin-signin-brand" href="/" aria-label="سنجوب، الموقع الرئيسي"><img src={logo} alt="" /><span>سنجوب<small>Sangoub</small></span></a><div><a href="/"><ArrowLeft size={16} aria-hidden="true" />الموقع الرئيسي</a>{identity && <button disabled={busy} onClick={() => void action(signOutFromFirebase)}><LogOut size={16} aria-hidden="true" />تسجيل الخروج</button>}</div></header> : <header className="admin-global-header border-b border-slate-200 bg-white"><div className="px-5 py-3 flex flex-wrap gap-4 items-center justify-between">
      <div className="flex items-center gap-3"><img src={logo} alt="سنجوب" className="w-14 h-14 rounded-2xl object-contain" /><div><p className="font-black text-lg">سنجوب</p><p className="text-xs text-slate-500">لوحة الإدارة · الحي الحكومي</p></div></div>
      <div id="admin-header-search" className="admin-header-search-slot" />
      <div className="flex flex-wrap gap-3 items-center text-xs"><span className="inline-flex gap-2 items-center text-orange-700 bg-orange-50 px-3 py-2 rounded-full"><ShieldCheck size={15} />بوابة الإدارة فقط</span><a href="/" className="text-slate-600 underline">الموقع الرئيسي</a>{identity && <><span className="max-w-56 truncate" dir="ltr">{identity.email || identity.phoneNumber}</span><button disabled={busy} onClick={() => action(async () => { try { if(access === "admin") await adminApi("data", {action:"session",event:"logout"}); } finally { await signOutFromFirebase(); } })} className="border border-slate-200 rounded-xl px-3 py-2 flex gap-2 items-center"><LogOut size={14} />تسجيل الخروج</button></>}</div>
    </div></header>}
    {access === "admin" && <DeploymentVersion />}
    {access === "admin" && profile ? <>
      {(error || notice) && <div className="max-w-7xl mx-auto px-4 pt-4">{error && <p role="alert" className="bg-red-50 text-red-700 rounded-xl p-3">{error}</p>}{notice && <p role="status" className="bg-emerald-50 text-emerald-800 rounded-xl p-3">{notice}</p>}</div>}
      <AdminWorkspace orders={orders} stores={stores} products={products} couriers={staff.filter((person) => person.role === "courier")} staff={staff} coupons={coupons} connected={connected} onError={report}>
        <AdminDashboard couriers={staff.filter((person) => person.role === "courier")} orders={orders} partnerApplications={partners} jobApplications={jobs}
          onUpdateOrderStatus={(id, status) => updateOrderRecord(id, { orderStatus: status })} onAssignCourier={assignCourier}
          onUpdatePartnerStatus={(id, status) => updateApplication("partnerApplications", id, status)}
          onApprovePartnerAsStore={approveStore} onUpdateJobStatus={(id, status) => updateApplication("jobApplications", id, status)} />
      </AdminWorkspace>
    </> : <AdminLoginLayout>
        {access === "checking" ? <div role="status" className="py-8 text-center space-y-3"><Loader2 className="animate-spin mx-auto text-orange-600" /><p>جارٍ التحقق من جلسة الإدارة والاتصال…</p></div> : access === "login" ? <>
          <p className="admin-signin-welcome">مرحبًا بعودتك</p><h2 className="admin-signin-title">تسجيل دخول الإدارة</h2><p className="text-sm text-slate-500">استخدم الحساب الذي مُنح صلاحية الإدارة.</p>
          <button disabled={busy} onClick={() => action(async () => { await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence); await signInWithPopup(auth, googleProvider); })} className="admin-signin-google"><GoogleSignInMark />الدخول باستخدام Google</button>
          <div className="admin-signin-divider"><span>أو</span></div><p className="admin-signin-email-hint">تسجيل الدخول بالبريد الإلكتروني</p>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void action(async () => { await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence); await signInWithEmailAndPassword(auth, email.trim(), password); }); }}>
            <label className="admin-signin-field" htmlFor="admin-email">البريد الإلكتروني<span><input id="admin-email" aria-label="البريد الإلكتروني" type="email" autoComplete="username" dir="ltr" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="أدخل بريدك الإلكتروني" /><Mail size={18} aria-hidden="true" /></span></label>
            <label className="admin-signin-field" htmlFor="admin-password">كلمة المرور</label><div className="admin-signin-password"><input id="admin-password" aria-label="كلمة المرور" type={showPassword ? "text" : "password"} autoComplete="current-password" dir="ltr" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="أدخل كلمة المرور" /><LockKeyhole size={17} aria-hidden="true" /><button type="button" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <label className="admin-signin-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />تذكرني على هذا الجهاز</label>
            <button disabled={busy} className="admin-signin-submit">{busy ? "جارٍ تسجيل الدخول…" : "دخول لوحة الإدارة"}</button>
          </form>
          <button disabled={busy} className="admin-signin-reset" onClick={() => action(async () => { if (!email.includes("@")) throw new Error("اكتب بريدك الإلكتروني أولًا."); await sendPasswordResetEmail(auth, email.trim()); }, "إذا كان البريد مسجلًا فستصلك تعليمات استعادة كلمة المرور.")}>نسيت كلمة المرور؟</button>
        </> : access === "verify" ? <><h2 className="font-bold text-xl">أكد بريد الحساب أولًا</h2><p className="text-sm text-slate-600">التحقق من هوية الحساب مطلوب قبل فحص صلاحية الإدارة.</p><button disabled={busy} onClick={() => action(() => sendEmailVerification(identity!), "أُرسلت رسالة تأكيد البريد.")} className="p-3 border rounded-xl text-sm">إرسال رسالة التأكيد</button><button disabled={busy} onClick={() => action(async () => { await identity!.reload(); await identity!.getIdToken(true); setRevision((value) => value + 1); })} className="p-3 mr-2 bg-orange-600 text-white rounded-xl text-sm">تم التأكيد، إعادة الفحص</button></> : <>
          <h2 className="font-black text-xl">الحساب غير مخوّل للإدارة</h2><p className="text-sm text-slate-600 leading-7">استخدم تطبيق الموبايل لحساب الموظف أو الشيف أو المندوب. إذا كنت مسؤول المشروع، اطلب تفعيل صلاحية الإدارة من مسؤول المنصة.</p>
          {workAccount && ["restaurant","courier"].includes(workAccount.role) && <div className="account-access-guide"><strong>{workAccount.role === "courier" ? "حساب مندوب التوصيل" : workAccount.store?.preparationType === "picking" ? "حساب تحضير السوبر ماركت" : "حساب المطعم والتحضير"}</strong><p>سجل الدخول بنفس الحساب في التطبيق لتظهر مهامك تلقائيًا.{workAccount.store?.name ? ` المتجر المرتبط: ${workAccount.store.name}.` : ""}{workAccount.requiresStoreAssignment ? " اطلب من الإدارة ربط الحساب بمتجر قبل بدء التحضير." : ""}</p></div>}
          <label className="block text-xs space-y-2">معرف حسابك الحقيقي (UID)<input aria-label="معرف حسابك" readOnly value={identity?.uid || ""} dir="ltr" className="w-full p-3 border rounded-xl text-xs" /></label><p className="text-xs text-slate-500">وثيقة الصلاحية: admins / UID نفسه. وجود الوثيقة يمنح الإدارة، وحذفها يلغيها.</p>
          <button disabled={busy} onClick={() => setRevision((value) => value + 1)} className="rounded-xl p-3 border text-sm">إعادة فحص الصلاحية</button>
        </>}
        {error && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</p>}{notice && <p role="status" className="bg-emerald-50 text-emerald-800 p-3 rounded-xl text-sm">{notice}</p>}
    </AdminLoginLayout>}
  </div>;
}
