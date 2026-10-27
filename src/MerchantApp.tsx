import React, { useEffect, useState, useRef } from "react";
import {
  auth,
  db,
  onAuthStateChanged,
  syncUserProfileToFirestore,
  signOutFromFirebase,
  watchCollection,
  updateOrderRecord,
  type FirebaseUser,
} from "./lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
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
const SANGOUB_LOGO = "/brand/sangoub-logo-128x128.png";
const SANGOUB_WINK = "/assets/sangoub/mascot-wink.png";

export default function MerchantApp() {
  const [identity, setIdentity] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [access, setAccess] = useState<"checking" | "login" | "denied" | "merchant">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Data for Restaurant Portal
  const [stores, setStores] = useState<Store[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [connected, setConnected] = useState(true);

  // Help & Support Modal State
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // 1. Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIdentity(user);
      if (!user) {
        setProfile(null);
        setAccess("login");
        return;
      }
      setAccess("checking");
      try {
        const userProfile = await syncUserProfileToFirestore(user);
        if (userProfile.role === "restaurant" || userProfile.role === "admin") {
          setProfile(userProfile);
          setAccess("merchant");
        } else {
          setProfile(userProfile);
          setAccess("denied");
        }
      } catch (err: any) {
        console.error("Profile sync error:", err);
        setAccess("denied");
        setError(err.message || "تعذر قراءة ملف الحساب.");
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Load Firestore Data when Merchant Access is granted
  useEffect(() => {
    if (access !== "merchant" || !profile) return;

    const stopStores = watchCollection<Store>(
      "stores",
      (data) => setStores(data),
      (err) => console.error("Stores listener error:", err)
    );

    const stopOrders = watchCollection<Order>(
      "orders",
      (data) => setOrders(data),
      (err) => console.error("Orders listener error:", err),
      [],
      (conn) => setConnected(conn)
    );

    const stopProducts = watchCollection<Product>(
      "products",
      (data) => setProducts(data),
      (err) => console.error("Products listener error:", err)
    );

    const stopUsers = watchCollection<any>(
      "users",
      (data) => {
        const activeCouriers = data
          .filter((u) => u.role === "courier")
          .map((c) => ({
            id: c.uid || c.id,
            name: c.fullName || c.name || "كابتن سنجوب",
            phone: c.phone || "",
            rating: 4.9,
            avgDeliveryMinutes: 18,
            coordinates: c.coordinates || null,
            status: c.disabled ? "offline" : "available",
          }));
        setCouriers(activeCouriers);
      },
      (err) => console.error("Couriers listener error:", err)
    );

    return () => {
      stopStores();
      stopOrders();
      stopProducts();
      stopUsers();
    };
  }, [access, profile?.id]);

  // Handle Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userProfile = await syncUserProfileToFirestore(cred.user);
      if (userProfile.role === "restaurant" || userProfile.role === "admin") {
        setProfile(userProfile);
        setAccess("merchant");
      } else {
        setProfile(userProfile);
        setAccess("denied");
      }
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

  // Handle Kitchen Stage Change
  async function handleKitchenChange(id: string, storeId: string, stage: "preparing" | "ready") {
    try {
      const order = orders.find((o) => o.id === id);
      if (!order) return;
      const kitchenStatus = { ...(order.kitchenStatus || {}), [storeId]: stage };
      await updateOrderRecord(id, {
        kitchenStatus,
        orderStatus: stage === "ready" ? "ready" : "preparing",
      });
    } catch (err: any) {
      console.error("Failed to update kitchen stage:", err);
    }
  }

  // Handle Order Status
  async function handleUpdateOrderStatus(orderId: string, status: Order["orderStatus"]) {
    try {
      await updateOrderRecord(orderId, { orderStatus: status });
    } catch (err) {
      console.error("Order status update failed:", err);
    }
  }

  // Handle Product Stock Toggle
  async function handleUpdateProductStock(productId: string, inStock: boolean) {
    try {
      await updateDoc(doc(db, "products", productId), { inStock });
    } catch (err) {
      console.error("Product stock update failed:", err);
    }
  }

  // Handle Product Price Update
  async function handleUpdateProductPrice(productId: string, newPrice: number) {
    try {
      await updateDoc(doc(db, "products", productId), { price: newPrice });
    } catch (err) {
      console.error("Product price update failed:", err);
    }
  }

  // Handle Add Product
  async function handleAddProduct(product: Product) {
    // Handled via Admin/Partner APIs
  }

  // Handle Store Open/Close Toggle
  async function handleToggleStoreStatus(storeId: string) {
    try {
      const store = stores.find((s) => s.id === storeId);
      if (!store) return;
      const nextStatus = store.status === "open" ? "closed" : "open";
      await updateDoc(doc(db, "stores", storeId), {
        status: nextStatus,
      });
    } catch (err) {
      console.error("Store status toggle failed:", err);
    }
  }

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
          <h2 className="text-lg font-black text-slate-900">حساب غير مصرح له كتاجر</h2>
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
    const userStore = stores.find((s) => s.id === profile.storeId) || stores[0];

    return (
      <div className="min-h-screen bg-slate-100 font-cairo" dir="rtl">
        {/* Top Operational Header */}
        <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            {/* Store & Mascot Info */}
            <div className="flex items-center gap-3">
              <img src={SANGOUB_LOGO} alt="سنجوب" className="w-9 h-9 rounded-lg bg-white p-1" />
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
          <RestaurantPortal
            currentProfile={profile}
            stores={stores}
            products={products}
            orders={orders}
            couriers={couriers}
            connected={connected}
            onKitchenChange={handleKitchenChange}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateProductStock={handleUpdateProductStock}
            onUpdateProductPrice={handleUpdateProductPrice}
            onAddProduct={handleAddProduct}
            onToggleStoreStatus={handleToggleStoreStatus}
          />
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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between font-cairo" dir="rtl">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#f97316_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Header Bar */}
      <header className="relative z-10 p-4 sm:p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <a href="/" className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity">
          <img src={SANGOUB_LOGO} alt="سنجوب" className="w-10 h-10 rounded-xl bg-white p-1" />
          <div>
            <span className="font-black text-base tracking-tight block">سنجوب الشركاء</span>
            <span className="text-[10px] text-orange-400 font-bold block">Sangoub Merchant Portal</span>
          </div>
        </a>

        {/* Cheerful Mascot Quick Contact */}
        <button
          type="button"
          onClick={() => setIsHelpOpen(true)}
          className="inline-flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 text-amber-300 border border-amber-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
        >
          <img src={SANGOUB_WINK} alt="سنجوب" className="w-5 h-5 object-contain" />
          <span>دعم المطابخ والشركاء</span>
        </button>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn">
          {/* Card Top Banner with Cheerful Mascot */}
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-sm" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-white/20 p-2 backdrop-blur-xs shadow-md mb-2 flex items-center justify-center">
                <img src={SANGOUB_MASCOT} alt="سنجوب التاجر" className="w-16 h-16 object-contain" />
              </div>
              <h2 className="text-xl font-black tracking-tight">بوابة شركاء سنجوب</h2>
              <p className="text-xs text-orange-100 mt-1 max-w-xs font-medium">
                منظومة المطبخ المباشر لإدارة طلبات الوجبات وتحديث قائمة الطعام اللحظية
              </p>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 sm:p-7 space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-bold animate-fadeIn">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-bold animate-fadeIn">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span>{notice}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <Mail size={14} className="text-slate-400" />
                  <span>البريد الإلكتروني المعتمد للتاجر *</span>
                </label>
                <input
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
                  <label className="text-slate-700 font-bold flex items-center gap-1.5">
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
                    <span>تسجيل الدخول للمطبخ المباشر</span>
                    <ArrowRight size={15} className="rotate-180" />
                  </>
                )}
              </button>
            </form>

            {/* Note & Guidelines */}
            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 text-center leading-relaxed">
              يتم إنشاء حسابات التجار والمطابخ مركزياً عبر إدارة عمليات سنجوب.
              <br />
              تحتاج لتسجيل مطعمك أو استلام بيانات الدخول؟{" "}
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="text-orange-600 font-bold hover:underline cursor-pointer"
              >
                تواصل مع سنجوب
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-4 text-center text-slate-500 text-xs">
        منظومة سنجوب لخدمات توصيل الطعام والطلبات السريعة © 2026 — العاصمة الإدارية الجديدة
      </footer>

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
    </div>
  );
}

/**
 * Cheerful Sangoub Mascot Partner Support Modal
 */
function SangoubHelpModal({ onClose }: { onClose: () => void }) {
  const whatsappNumber = "201012345678";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
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
                <span>دعم شركاء سنجوب 24/7</span>
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
                  <span className="block text-[10px] text-emerald-700">رد فوري خلال دقائق</span>
                </div>
              </a>

              {/* Direct Hotline */}
              <a
                href="tel:01012345678"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 font-bold transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Phone size={17} />
                </div>
                <div>
                  <span className="block text-xs font-black text-amber-900">طوارئ المطبخ والطلبات</span>
                  <span className="block text-[10px] text-amber-700">اتصال هاتفي مباشر</span>
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
