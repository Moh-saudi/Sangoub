import { customerMessage } from "./utils/customerMessage";
import { DeploymentVersion } from "./components/DeploymentVersion";
import { adminApi } from "./lib/adminApi";
import "./admin.css";
import { useEffect, useState, useRef } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail, sendEmailVerification } from "firebase/auth";
import { LogOut, ShieldCheck, Loader2 } from "lucide-react";
import { auth, db, googleProvider, onAuthStateChanged, isVerifiedIdentity, syncUserProfileToFirestore, signOutFromFirebase, subscribeToOrders, watchCollection, saveRecord, updateOrderRecord, approvePartner, type FirebaseUser } from "./lib/firebase";
import { AdminWorkspace } from "./components/AdminWorkspace";
import { AdminDashboard } from "./components/AdminDashboard";
import type { AdminStaff } from "./components/AdminSetupPanel";
import type { Profile, Store, Product, Order, Coupon, PartnerApplication, JobApplication, ApplicationStatus } from "./types";

const logo = "/assets/aistudio/Capital_Talabat_App_Icon_7e80c871.png";
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [partners, setPartners] = useState<PartnerApplication[]>([]);
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [connected, setConnected] = useState(false);
  const report = (error: unknown) => setError(message(error));

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (!user) loggedSession.current = "";
    setIdentity(user); setProfile(null); setError(""); setNotice(""); setPassword("");
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

  async function action(operation: () => Promise<unknown>, success?: string) {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); if (success) setNotice(success); }
    catch (error) { report(error); }
    finally { setBusy(false); }
  }
  async function assignCourier(orderId: string, courierId: string) {
    const courier = staff.find((person) => person.id === courierId && person.role === "courier");
    if (!courier || !orders.some((order) => order.id === orderId && ["ready", "with_courier"].includes(order.orderStatus))) throw new Error("راجع حالة الطلب والمندوب المختار.");
    await updateOrderRecord(orderId, { courierId, courierName: courier.name, courierPhone: courier.phone, orderStatus: "with_courier" });
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

  return <div className="admin-app min-h-screen bg-slate-50 text-slate-900" dir="rtl">
    <header className="admin-global-header border-b border-slate-200 bg-white"><div className="px-5 py-3 flex flex-wrap gap-4 items-center justify-between">
      <div className="flex items-center gap-3"><img src={logo} alt="طلبات العاصمة" className="w-14 h-14 rounded-2xl object-contain" /><div><p className="font-black text-lg">طلبات العاصمة</p><p className="text-xs text-slate-500">لوحة الإدارة · الحي الحكومي</p></div></div>
      <div id="admin-header-search" className="admin-header-search-slot" />
      <div className="flex flex-wrap gap-3 items-center text-xs"><span className="inline-flex gap-2 items-center text-orange-700 bg-orange-50 px-3 py-2 rounded-full"><ShieldCheck size={15} />بوابة الإدارة فقط</span><a href="/" className="text-slate-600 underline">الموقع الرئيسي</a>{identity && <><span className="max-w-56 truncate" dir="ltr">{identity.email || identity.phoneNumber}</span><button disabled={busy} onClick={() => action(async () => { try { if(access === "admin") await adminApi("data", {action:"session",event:"logout"}); } finally { await signOutFromFirebase(); } })} className="border border-slate-200 rounded-xl px-3 py-2 flex gap-2 items-center"><LogOut size={14} />تسجيل الخروج</button></>}</div>
    </div></header>
    <DeploymentVersion />
    {access === "admin" && profile ? <>
      {(error || notice) && <div className="max-w-7xl mx-auto px-4 pt-4">{error && <p role="alert" className="bg-red-50 text-red-700 rounded-xl p-3">{error}</p>}{notice && <p role="status" className="bg-emerald-50 text-emerald-800 rounded-xl p-3">{notice}</p>}</div>}
      <AdminWorkspace orders={orders} stores={stores} products={products} couriers={staff.filter((person) => person.role === "courier")} staff={staff} coupons={coupons} connected={connected} onError={report}>
        <AdminDashboard couriers={staff.filter((person) => person.role === "courier")} orders={orders} stores={stores} products={products} partnerApplications={partners} jobApplications={jobs}
          onUpdateOrderStatus={(id, status) => updateOrderRecord(id, { orderStatus: status })} onAssignCourier={assignCourier}
          onUpdatePartnerStatus={(id, status) => updateApplication("partnerApplications", id, status)}
          onApprovePartnerAsStore={approveStore} onUpdateJobStatus={(id, status) => updateApplication("jobApplications", id, status)} />
      </AdminWorkspace>
    </> : <main className="max-w-5xl mx-auto px-4 py-12 sm:py-20 grid lg:grid-cols-2 gap-8 items-center">
      <section><p className="text-orange-600 font-bold text-sm mb-4">CAPITAL TALABAT · ADMIN</p><h1 className="text-3xl sm:text-4xl font-black leading-relaxed">إدارة التشغيل،<br />من مكان واحد.</h1><p className="text-slate-600 leading-8 mt-5">الطلبات، المتاجر، المنتجات، وفريق التوصيل.</p><p className="text-sm text-slate-500 mt-4">حسابات الموظف والشيف والمندوب تعمل من تطبيق الموبايل. هذه البوابة مخصصة للإدارة.</p></section>
      <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5" aria-label="دخول الإدارة">
        {access === "checking" ? <div role="status" className="py-8 text-center space-y-3"><Loader2 className="animate-spin mx-auto text-orange-600" /><p>جارٍ التحقق من جلسة الإدارة والاتصال…</p></div> : access === "login" ? <>
          <h2 className="text-xl font-black">تسجيل دخول الإدارة</h2><p className="text-sm text-slate-500">استخدم الحساب الذي مُنح صلاحية الإدارة.</p>
          <button disabled={busy} onClick={() => action(() => signInWithPopup(auth, googleProvider))} className="w-full rounded-xl border border-slate-300 py-3 font-bold disabled:opacity-50">الدخول باستخدام Google</button>
          <div className="text-center text-xs text-slate-400">أو باستخدام البريد الإلكتروني</div>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void action(() => signInWithEmailAndPassword(auth, email.trim(), password)); }}>
            <label className="block text-sm space-y-2">البريد الإلكتروني<input aria-label="البريد الإلكتروني" type="email" autoComplete="username" dir="ltr" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full p-3 border border-slate-300 rounded-xl" /></label>
            <label className="block text-sm space-y-2">كلمة المرور<input aria-label="كلمة المرور" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full p-3 border border-slate-300 rounded-xl" /></label>
            <button disabled={busy} className="w-full bg-orange-600 text-white rounded-xl py-3 font-bold disabled:opacity-50">{busy ? "جارٍ تسجيل الدخول…" : "دخول لوحة الإدارة"}</button>
          </form>
          <button disabled={busy} className="text-sm text-orange-700" onClick={() => action(async () => { if (!email.includes("@")) throw new Error("اكتب بريدك الإلكتروني أولًا."); await sendPasswordResetEmail(auth, email.trim()); }, "إذا كان البريد مسجلًا فستصلك تعليمات استعادة كلمة المرور.")}>نسيت كلمة المرور؟</button>
        </> : access === "verify" ? <><h2 className="font-bold text-xl">أكد بريد الحساب أولًا</h2><p className="text-sm text-slate-600">التحقق من هوية الحساب مطلوب قبل فحص صلاحية الإدارة.</p><button disabled={busy} onClick={() => action(() => sendEmailVerification(identity!), "أُرسلت رسالة تأكيد البريد.")} className="p-3 border rounded-xl text-sm">إرسال رسالة التأكيد</button><button disabled={busy} onClick={() => action(async () => { await identity!.reload(); await identity!.getIdToken(true); setRevision((value) => value + 1); })} className="p-3 mr-2 bg-orange-600 text-white rounded-xl text-sm">تم التأكيد، إعادة الفحص</button></> : <>
          <h2 className="font-black text-xl">الحساب غير مخوّل للإدارة</h2><p className="text-sm text-slate-600 leading-7">استخدم تطبيق الموبايل لحساب الموظف أو الشيف أو المندوب. إذا كنت مسؤول المشروع، اطلب تفعيل صلاحية الإدارة من مسؤول المنصة.</p>
          <label className="block text-xs space-y-2">معرف حسابك الحقيقي (UID)<input aria-label="معرف حسابك" readOnly value={identity?.uid || ""} dir="ltr" className="w-full p-3 border rounded-xl text-xs" /></label><p className="text-xs text-slate-500">وثيقة الصلاحية: admins / UID نفسه. وجود الوثيقة يمنح الإدارة، وحذفها يلغيها.</p>
          <button disabled={busy} onClick={() => setRevision((value) => value + 1)} className="rounded-xl p-3 border text-sm">إعادة فحص الصلاحية</button>
        </>}
        {error && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</p>}{notice && <p role="status" className="bg-emerald-50 text-emerald-800 p-3 rounded-xl text-sm">{notice}</p>}
      </section>
    </main>}
  </div>;
}
