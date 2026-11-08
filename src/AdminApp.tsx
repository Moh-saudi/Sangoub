import { AdminLoginLayout, GoogleSignInMark } from "./components/AdminLoginLayout";
import { customerMessage } from "./utils/customerMessage";
import { DeploymentVersion } from "./components/DeploymentVersion";
import { operationsApi } from "./lib/operationsApi";
import { adminApi } from "./lib/adminApi";
import "./admin.css";
import { useEffect, useState, useRef, useCallback } from "react";
import { LogOut, ShieldCheck, Loader2, Eye, EyeOff, Mail, LockKeyhole, ArrowLeft, Bell } from "lucide-react";
import { supabase, signInWithSupabaseGoogle, signOutFromSupabase, getSupabaseStores, getSupabaseProducts, subscribeToCatalog, subscribeToAdminOrders } from "./lib/supabase";
import { updateOrderRecord, approvePartner } from "./lib/firebase";
import { AdminWorkspace } from "./components/AdminWorkspace";
import { AdminDashboard } from "./components/AdminDashboard";
import type { AdminStaff } from "./types/admin";
import type { Profile, Store, Product, Order, Coupon, PartnerApplication, JobApplication, ApplicationStatus } from "./types";

const logo = "/brand/sangoub-mark-white-128.png";

function message(error: unknown): string {
  const code = (error as { code?: string })?.code || "";
  const msg = (error as { message?: string })?.message || "";
  if (/invalid-credential|wrong-password|user-not-found|Invalid login credentials/.test(code + msg)) return "راجع البريد وكلمة المرور.";
  if (/unauthorized-domain/.test(code + msg)) return "تسجيل الدخول غير متاح حاليًا. يرجى المحاولة لاحقًا.";
  if (/permission-denied/.test(code + msg)) return "تعذر الوصول. راجع صلاحية الإدارة.";
  if (/popup-closed-by-user|cancelled-popup-request/.test(code + msg)) return "أُغلقت نافذة تسجيل الدخول قبل الإكمال.";
  if (/network|unavailable/.test(code + msg)) return "تعذر الاتصال بالخادم. تحقق من الشبكة وأعد المحاولة.";
  return customerMessage(error, "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
}

export default function AdminApp() {
  const loggedSession = useRef("");
  const verifiedAdminId = useRef("");
  const [identity, setIdentity] = useState<any>(null);
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
  const [showAdminNotifs, setShowAdminNotifs] = useState(false);
  const report = (err: unknown) => setError(message(err));

  useEffect(() => {
    document.title = access === "admin" ? "لوحة الإدارة | سنجوب" : "دخول الإدارة | سنجوب";
  }, [access]);

  // ── Authentication & Admin Role Check ──────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function checkUser(user: any, eventName?: string) {
      if (!user) {
        verifiedAdminId.current = "";
        setIdentity(null);
        setProfile(null);
        setAccess("login");
        return;
      }

      setIdentity(user);

      // If user is already verified as admin and the user ID hasn't changed,
      // never disrupt the UI by unmounting to "checking" screen.
      if (verifiedAdminId.current === user.id && access === "admin") {
        return;
      }

      if (access !== "admin") {
        setAccess("checking");
      }

      try {
        const authority = await operationsApi('operations', { action: 'profile' });
        if (!active) return;
        if (authority.role === 'admin') {
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
          if (!active) return;
          verifiedAdminId.current = user.id;
          setProfile((prof as Profile) || {
            id: user.id,
            fullName: authority.displayName || user.user_metadata?.full_name || user.email?.split("@")[0] || "مدير النظام",
            email: user.email || "",
            role: "admin",
          } as Profile);
          setAccess("admin");
          setError("");
        } else {
          verifiedAdminId.current = "";
          setProfile(null);
          setAccess("denied");
        }
      } catch (err) {
        if (active) {
          // If already authenticated as admin, a background network blip should not immediately log out
          if (verifiedAdminId.current !== user.id) {
            report(err);
            setAccess("denied");
          }
        }
      }
    }

    // 1. Check initial Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        checkUser(session.user, 'INITIAL_GET_SESSION');
      } else {
        setAccess("login");
      }
    });

    // 2. Listen to auth state changes (safeguarded against token refresh flickering)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        verifiedAdminId.current = "";
        setIdentity(null);
        setProfile(null);
        setAccess("login");
        return;
      }
      if (event === 'TOKEN_REFRESHED' && verifiedAdminId.current && session?.user?.id === verifiedAdminId.current) {
        // Token refreshed in background - keep current admin UI completely uninterrupted
        setIdentity(session.user);
        return;
      }
      if (session?.user) {
        checkUser(session.user, event);
      } else if (!session) {
        setAccess("login");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [revision, access]);

  // Direct Supabase catalog loading
  const loadAdminCatalog = useCallback(() => {
    Promise.all([
      getSupabaseStores().catch(() => [] as Store[]),
      getSupabaseProducts().catch(() => [] as Product[])
    ]).then(([spStores, spProducts]) => {
      const storeMap = new Map<string, Store>();
      spStores.forEach(s => storeMap.set(s.id, s));

      // Ensure "سنجوب ماركت" is present
      if (!storeMap.has('a0000000-0000-0000-0000-000000000001')) {
        storeMap.set('a0000000-0000-0000-0000-000000000001', {
          id: 'a0000000-0000-0000-0000-000000000001',
          name: 'سنجوب ماركت',
          nameEn: 'Sangoub Market',
          type: 'سوبرماركت ومستلزمات البيت اليومية',
          category: 'supermarket',
          logo: '/brand/sangoub-market-logo.jpg',
          logoUrl: '/brand/sangoub-market-logo.jpg',
          banner: '/brand/sangoub-market-logo.jpg',
          bannerUrl: '/brand/sangoub-market-logo.jpg',
          status: 'open',
          rating: 5,
          ratingCount: 1250,
          deliveryTime: '15-25 دقيقة',
          minOrder: 20,
          deliveryFee: 10,
          locationInDistrict: 'منصة سنجوب - المركز الرئيسي',
        });
      }
      const mergedStores = Array.from(storeMap.values());
      setStores(mergedStores);
      setProducts(spProducts);
    }).catch(err => {
      console.warn('[AdminApp] Supabase catalog load error:', err);
    });
  }, []);

  useEffect(() => {
    setOrders([]); setStores([]); setProducts([]); setStaff([]); setCoupons([]); setPartners([]); setJobs([]); setConnected(false);
    if (access !== "admin" || !profile) return;
    let active = true;

    loadAdminCatalog();
    void adminApi('users', { action: 'list' }).then(result => {
      if (!active) return;
      setStaff((result.users || []).filter((user: any) => !user.disabled && ['restaurant', 'courier'].includes(user.role)).map((user: any) => ({
        id: user.uid, role: user.role, name: user.fullName, phone: user.phone, storeId: user.storeId,
      })));
    }).catch(err => { if (active) console.warn('[AdminApp] Supabase account load error:', err); });

    const unsubCatalog = subscribeToCatalog(
      () => { loadAdminCatalog(); },
      () => { loadAdminCatalog(); }
    );
    const loadApplications = async () => {
      const collections = await Promise.all(['coupons','partnerApplications','jobApplications'].map(collection =>
        adminApi('data',{action:'application-list',collection}).catch(() => ({items:[]}))
      ));
      if (!active) return;
      setCoupons(collections[0].items || []);
      setPartners(collections[1].items || []);
      setJobs(collections[2].items || []);
    };
    void loadApplications();
    const applicationsTimer = window.setInterval(() => { if (!document.hidden) void loadApplications(); }, 20000);

    const stops = [
      subscribeToAdminOrders(setOrders, () => {}, setConnected),
      () => { unsubCatalog(); },
      () => window.clearInterval(applicationsTimer),
    ];
    return () => { active = false; stops.forEach(stop => stop()); };
  }, [profile?.id, access]);

  useEffect(() => {
    if (access !== "admin" || !identity || loggedSession.current === identity.id) return;
    loggedSession.current = identity.id;
    void adminApi("data", { action: "session", event: "open" }).catch(() => {});
  }, [access, identity?.id]);

  useEffect(() => {
    setWorkAccount(null);
    if (access !== "denied" || !identity) return;
    let active = true;
    void operationsApi("operations", { action: "profile" }).then(result => {
      if (active) setWorkAccount(result);
    }).catch(() => {});
    return () => { active = false; };
  }, [access, identity?.id]);

  async function action(operation: () => Promise<unknown>, success?: string) {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); if (success) setNotice(success); }
    catch (err) { report(err); }
    finally { setBusy(false); }
  }

  async function assignCourier(orderId: string, courierId: string) {
    const courier = staff.find((person) => person.id === courierId && person.role === "courier");
    if (!courier) throw new Error("يرجى اختيار مندوب صالح من القائمة.");
    await updateOrderRecord(orderId, { courierId, courierName: courier.name, courierPhone: courier.phone });
  }

  const updateApplication = (collection: string, id: string, status: ApplicationStatus) => {
    void action(() => adminApi('data',{action:'application-status',collection,id,status}), "تم تحديث الطلب.");
  };

  const approveStore = (partner: PartnerApplication) => {
    void action(() => approvePartner(partner.id, {
      id: crypto.randomUUID(), name: partner.businessName, nameEn: partner.businessName, type: partner.partnerType,
      category: "sandwiches", logo: "🍽️", banner: "from-orange-600 to-slate-900", status: "closed", rating: 0, ratingCount: 0,
      deliveryTime: "لم يحدد بعد", minOrder: 0, deliveryFee: 0, locationInDistrict: partner.locationInCapital,
    }), "أُضيف المتجر مغلقًا؛ راجع بياناته ورسومه من الكتالوج قبل فتحه.");
  };

  const handleProductUpdate = (updated: Product) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleProductDelete = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleStoreUpdate = (updated: Store) => {
    setStores(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  return (
    <div className={access === "admin" ? "admin-app min-h-screen bg-slate-50 text-slate-900" : "admin-signin"} dir="rtl">
      <a
        className="skip-link"
        href="#admin-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("admin-content")?.focus();
        }}
      >
        انتقل إلى محتوى الإدارة
      </a>
      {access !== "admin" ? (
        <header className="admin-signin-header">
          <a className="admin-signin-brand" href="/" aria-label="سنجوب، الموقع الرئيسي">
            <img src={logo} alt="" />
            <span>سنجوب<small>Sangoub</small></span>
          </a>
          <div>
            <a href="/"><ArrowLeft size={16} aria-hidden="true" />الموقع الرئيسي</a>
            {identity && (
              <button disabled={busy} onClick={() => void action(async () => { await signOutFromSupabase(); })}>
                <LogOut size={16} aria-hidden="true" />تسجيل الخروج
              </button>
            )}
          </div>
        </header>
      ) : (
        <header className="admin-global-header border-b border-slate-200 bg-white">
          <div className="px-5 py-3 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="سنجوب" className="w-14 h-14 rounded-2xl object-contain" />
              <div>
                <p className="font-black text-lg">سنجوب</p>
                <p className="text-xs text-slate-500">لوحة الإدارة العامة · منصة سنجوب</p>
              </div>
            </div>
            <div id="admin-header-search" className="admin-header-search-slot" />
            <div className="flex flex-wrap gap-3 items-center text-xs">
              {/* Admin Live Operational Notifications Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAdminNotifs(!showAdminNotifs)}
                  className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  title="إشعارات وتنبيهات الطلبات الحية"
                >
                  <Bell size={16} />
                  {orders.filter(o => !o.orderStatus || o.orderStatus === 'received' || o.orderStatus === 'pending').length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                      {orders.filter(o => !o.orderStatus || o.orderStatus === 'received' || o.orderStatus === 'pending').length}
                    </span>
                  )}
                </button>

                {showAdminNotifs && (
                  <div
                    className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in space-y-2 select-none"
                    dir="rtl"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                        <Bell size={14} className="text-orange-600" />
                        <span>إشعارات الطلبات الواردة</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {orders.length} طلب
                      </span>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1.5">
                      {orders.length > 0 ? (
                        orders.slice(0, 6).map((ord) => (
                          <div
                            key={ord.id}
                            className="p-2 rounded-xl bg-slate-50 hover:bg-orange-50/70 border border-slate-100 transition text-xs space-y-1 cursor-pointer"
                            onClick={() => {
                              setShowAdminNotifs(false);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-black text-slate-900 text-[11px]">
                                #{ord.orderNumber || ord.id.slice(0, 8)}
                              </span>
                              <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-md ${
                                ord.orderStatus === 'delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                              }`}>
                                {ord.orderStatus || 'received'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span className="truncate max-w-[150px]">{ord.profileName || ord.ministry || 'طلب جديد'}</span>
                              <strong className="text-orange-600 font-bold">{ord.total} ج.م</strong>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center py-6 text-xs text-slate-400 font-bold">
                          لا توجد طلبات واردة حالياً
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <span className="inline-flex gap-2 items-center text-orange-700 bg-orange-50 px-3 py-2 rounded-full">
                <ShieldCheck size={15} />بوابة الإدارة فقط
              </span>
              <a href="/" className="text-slate-600 underline">الموقع الرئيسي</a>
              {identity && (
                <>
                  <span className="max-w-56 truncate" dir="ltr">{identity.email || identity.phone || identity.id}</span>
                  <button
                    disabled={busy}
                    onClick={() => action(async () => {
                      try {
                        if (access === "admin") await adminApi("data", { action: "session", event: "logout" });
                      } finally {
                        await signOutFromSupabase();
                      }
                    })}
                    className="border border-slate-200 rounded-xl px-3 py-2 flex gap-2 items-center"
                  >
                    <LogOut size={14} />تسجيل الخروج
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {access === "admin" && <DeploymentVersion />}

      {access === "admin" && profile ? (
        <>
          {(error || notice) && (
            <div className="max-w-7xl mx-auto px-4 pt-4">
              {error && (
                <div role="alert" className="bg-red-50 text-red-700 rounded-xl p-3 flex items-center justify-between shadow-xs">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError("")} className="text-xs text-red-600 hover:text-red-800 font-bold px-2 py-1 rounded-lg bg-red-100 hover:bg-red-200 transition-colors">
                    إغلاق ✕
                  </button>
                </div>
              )}
              {notice && <p role="status" className="bg-emerald-50 text-emerald-800 rounded-xl p-3">{notice}</p>}
            </div>
          )}
          <AdminWorkspace
            orders={orders}
            stores={stores}
            products={products}
            couriers={staff.filter((p) => p.role === "courier")}
            staff={staff}
            coupons={coupons}
            connected={connected}
            onError={report}
            onProductUpdate={handleProductUpdate}
            onProductDelete={handleProductDelete}
            onStoreUpdate={handleStoreUpdate}
            onProductsRefresh={loadAdminCatalog}
          >
            <AdminDashboard
              couriers={staff.filter((p) => p.role === "courier")}
              orders={orders}
              partnerApplications={partners}
              jobApplications={jobs}
              onUpdateOrderStatus={(id, status) => updateOrderRecord(id, { orderStatus: status })}
              onAssignCourier={assignCourier}
              onUpdatePartnerStatus={(id, status) => updateApplication("partnerApplications", id, status)}
              onApprovePartnerAsStore={approveStore}
              onUpdateJobStatus={(id, status) => updateApplication("jobApplications", id, status)}
            />
          </AdminWorkspace>
        </>
      ) : (
        <AdminLoginLayout>
          {access === "checking" ? (
            <div role="status" className="py-8 text-center space-y-3">
              <Loader2 className="animate-spin mx-auto text-orange-600" />
              <p>جارٍ التحقق من جلسة الإدارة والاتصال…</p>
            </div>
          ) : access === "login" ? (
            <>
              <p className="admin-signin-welcome">مرحبًا بعودتك</p>
              <h2 className="admin-signin-title">تسجيل دخول الإدارة</h2>
              <p className="text-sm text-slate-500">استخدم الحساب المعتمد للإدارة.</p>
              <button
                disabled={busy}
                onClick={() => action(async () => { await signInWithSupabaseGoogle(window.location.origin + '/admin'); })}
                className="admin-signin-google"
              >
                <GoogleSignInMark />الدخول باستخدام Google
              </button>
              <div className="admin-signin-divider"><span>أو</span></div>
              <p className="admin-signin-email-hint">تسجيل الدخول بالبريد الإلكتروني</p>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void action(async () => {
                    const cleanEmail = email.trim().toLowerCase();
                    const cleanPassword = password;

                    const { error: signInErr } = await supabase.auth.signInWithPassword({
                      email: cleanEmail,
                      password: cleanPassword,
                    });
                    if (signInErr) throw signInErr;
                  });
                }}
              >
                <label className="admin-signin-field" htmlFor="admin-email">
                  البريد الإلكتروني
                  <span>
                    <input
                      id="admin-email"
                      aria-label="البريد الإلكتروني"
                      type="email"
                      autoComplete="username"
                      dir="ltr"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="أدخل بريدك الإلكتروني"
                    />
                    <Mail size={18} aria-hidden="true" />
                  </span>
                </label>
                <label className="admin-signin-field" htmlFor="admin-password">كلمة المرور</label>
                <div className="admin-signin-password">
                  <input
                    id="admin-password"
                    aria-label="كلمة المرور"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    dir="ltr"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="أدخل كلمة المرور"
                  />
                  <LockKeyhole size={17} aria-hidden="true" />
                  <button
                    type="button"
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <label className="admin-signin-remember">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  تذكرني على هذا الجهاز
                </label>
                <button disabled={busy} className="admin-signin-submit">
                  {busy ? "جارٍ تسجيل الدخول…" : "دخول لوحة الإدارة"}
                </button>
              </form>
            </>
          ) : access === "verify" ? (
            <>
              <h2 className="font-bold text-xl">أكد بريدك الإلكتروني أولًا</h2>
              <p className="text-sm text-slate-600">تم إرسال رابط تأكيد إلى بريدك الإلكتروني لتفعيل الحساب.</p>
              <button disabled={busy} onClick={() => setRevision(v => v + 1)} className="p-3 bg-orange-600 text-white rounded-xl text-sm">
                تم التأكيد، إعادة الفحص
              </button>
            </>
          ) : (
            <>
              <h2 className="font-black text-xl">الحساب غير مخوّل للإدارة</h2>
              <p className="text-sm text-slate-600 leading-7">
                تم تسجيل دخولك بنجاح، ولكن رتبتك الحالية هي ({profile?.role || "employee"}).
              </p>
              <label className="block text-xs space-y-2">
                معرف حسابك الحقيقي (UID)
                <input aria-label="معرف حسابك" readOnly value={identity?.id || ""} dir="ltr" className="w-full p-3 border rounded-xl text-xs bg-slate-50 font-mono" />
              </label>
              <p className="text-sm text-slate-600">لا يمكن منح صلاحية الإدارة من شاشة تسجيل الدخول. اطلب من مشرف النظام تعيين الدور.</p>
              <button
                disabled={busy}
                onClick={() => setRevision((v) => v + 1)}
                className="w-full rounded-xl p-3 border text-sm mt-2"
              >
                إعادة فحص الصلاحية
              </button>
            </>
          )}

          {error && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-xl text-sm mt-4">{error}</p>}
          {notice && <p role="status" className="bg-emerald-50 text-emerald-800 p-3 rounded-xl text-sm mt-4">{notice}</p>}
        </AdminLoginLayout>
      )}
    </div>
  );
}
