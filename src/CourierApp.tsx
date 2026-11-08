import { supabase, signOutFromSupabase } from './lib/supabase';
import { CourierTracking } from './components/CourierTracking';
import { useEffect, useRef, useState } from 'react';
import { operationsApi } from './lib/operationsApi';
import { orderDelivery } from './lib/orderDelivery';
import { useActivePortalOrders } from './lib/useActivePortalOrders';
import { LoadingState, ErrorState, EmptyState } from './components/ui/DataStates';
import { BRAND } from './brand';
import { customerMessage } from './utils/customerMessage';
import './courier.css';
import {
  PackageCheck,
  Bike,
  Phone,
  Navigation,
  CheckCircle2,
  Clock,
  RotateCw,
  LogOut,
  Banknote,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Store,
  MapPin,
  ShoppingBag,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Lock,
  Mail,
  AlertCircle
} from 'lucide-react';

const states: Record<string, { label: string; color: string; icon: any }> = {
  received: { label: 'تم استلام الطلب', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Clock },
  preparing: { label: 'جاري التحضير بالمطعم', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: Clock },
  ready: { label: 'جاهز للاستلام من المتجر', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: PackageCheck },
  with_courier: { label: 'في الطريق للعميل', color: 'bg-blue-50 text-blue-800 border-blue-200', icon: Bike },
  delivered: { label: 'تم التسليم بنجاح', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  cancelled: { label: 'ملغي', color: 'bg-rose-50 text-rose-800 border-rose-200', icon: AlertCircle }
};

export default function CourierApp() {
  const [uid, setUid] = useState<string>();
  const [access, setAccess] = useState<'checking' | 'login' | 'denied' | 'courier'>('checking');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [accessMessage, setAccessMessage] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [revision, setRevision] = useState(0);

  const [history, setHistory] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [historyBusy, setHistoryBusy] = useState(false);

  const [pending, setPending] = useState<string>();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [collected, setCollected] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const mutation = useRef(false);
  const generation = useRef(0);
  const feed = useActivePortalOrders(access === 'courier' ? uid : undefined);

  useEffect(() => {
    let active = true;

    async function checkCourier(user: any) {
      if (!user) {
        if (active) {
          setUid(undefined);
          setCurrentEmail('');
          setAccess('login');
        }
        return;
      }

      const userId = user.id || user.uid;
      if (active) {
        setUid(userId);
        setCurrentEmail(user.email || '');
        setAccess('checking');
      }

      try {
        const authority = await operationsApi('operations', { action: 'profile' });
        if (authority.role === 'courier') {
          if (active) {
            setName(authority.displayName || user.user_metadata?.full_name || 'كابتن التوصيل');
            setAccess('courier');
            setAccessMessage('');
            setError('');
          }
          return;
        }

        if (active) {
          setAccessMessage('هذا الحساب ليس مسجلاً كمندوب توصيل. اطلب من الإدارة تفعيل رتبة المندوب لحسابك.');
          setAccess('denied');
        }
      } catch (e) {
        if (active) {
          setAccess('denied');
          setAccessMessage(customerMessage(e, 'تعذر التحقق من صلاحية المندوب.'));
        }
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        checkCourier(session.user);
      } else {
        setAccess('login');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) checkCourier(session.user);
      else setAccess('login');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [revision]);

  useEffect(() => {
    const tag = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!tag) return;
    const old = tag.getAttribute('href');
    tag.setAttribute('href', '/courier.webmanifest');
    return () => {
      if (old) tag.setAttribute('href', old);
    };
  }, []);

  async function handleLogout() {
    try {
      await signOutFromSupabase();
    } catch {}
    setAccess('login');
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
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
          setError('البريد أو كلمة المرور غير صحيحة.');
          return;
        }
        if (sbErr.message?.includes('Email not confirmed')) {
          setError('يرجى تأكيد البريد الإلكتروني أولاً.');
          return;
        }
      }
      setError('تعذر الدخول. راجع البريد وكلمة المرور.');
    } catch {
      setError('تعذر الدخول. راجع البريد وكلمة المرور واتصالك.');
    } finally {
      setBusy(false);
    }
  }

  async function historyPage(reset = false) {
    if (historyBusy) return;
    const current = generation.current;
    setHistoryBusy(true);
    setError('');
    try {
      const r = await operationsApi('operations', {
        action: 'portal-history',
        ...(!reset && cursor ? { cursor } : {})
      });
      if (current !== generation.current) return;
      setHistory(prev => reset ? r.items : [...new Map([...prev, ...r.items].map(o => [o.id, o])).values()]);
      setCursor(r.nextCursor);
      setHistoryLoaded(true);
    } catch {
      if (current === generation.current) setError('تعذر تحميل سجل التوصيل. أعد المحاولة.');
    } finally {
      if (current === generation.current) setHistoryBusy(false);
    }
  }

  async function act(order: any, action: string, storeId?: string) {
    if (mutation.current || !feed.online) return;
    mutation.current = true;
    setPending(order.id);
    setError('');
    const current = generation.current;
    try {
      if (action === 'deliver') {
        await orderDelivery({
          action: 'deliver',
          orderId: order.id,
          otpCode: codes[order.id] || '',
          collectedAmount: order.amountToCollect
        });
      } else {
        await operationsApi('operations', {
          action,
          orderId: order.id,
          ...(storeId ? { storeId } : {}),
          confirmed: true
        });
      }
      if (current !== generation.current) return;
      setCodes(v => ({ ...v, [order.id]: '' }));
      await feed.refresh();
    } catch {
      if (current === generation.current) setError('لم يتم تأكيد الإجراء. حدّث المهام ثم راجع الحالة ورمز التسليم قبل إعادة المحاولة.');
    } finally {
      mutation.current = false;
      if (current === generation.current) setPending(undefined);
    }
  }

  const money = (n: number) =>
    new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: 'EGP'
    }).format(n || 0);

  function copyOrderNumber(orderNumber: string, orderId: string) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(orderNumber);
      setCopiedId(orderId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  function toggleItems(orderId: string) {
    setExpandedItems(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  }

  // Checking state
  if (access === 'checking') {
    return (
      <main className="courier-app-root min-h-screen flex items-center justify-center p-4">
        <LoadingState message="جارٍ التحقق من رتبة كابتن التوصيل…" />
      </main>
    );
  }

  // Login / Access Denied
  if (access === 'login' || access === 'denied') {
    return (
      <main className="courier-app-root min-h-screen flex flex-col items-center justify-center p-4 sm:p-6" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-orange-50 border border-orange-100 shadow-xs mb-3">
              <img src={BRAND.logo} alt="سنجوب" width={56} height={56} className="w-14 h-14 object-contain" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 mb-1">
              بوابة كابتن سنجوب
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              مهام التوصيل الميدانية، واستلام وتسليم الأوردرات بالرمز
            </p>
          </div>

          {access === 'denied' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm leading-relaxed">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>تنبيه الصلاحية</span>
                </div>
                <p>{accessMessage || 'لم يتم العثور على رتبة كابتن توصيل مفعلة لهذا الحساب.'}</p>
                {currentEmail && (
                  <p className="mt-2 text-slate-600 text-xs">
                    الحساب المسجل: <strong dir="ltr">{currentEmail}</strong>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج والتبديل لحساب آخر</span>
              </button>
            </div>
          ) : (
            <form onSubmit={login} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  البريد الإلكتروني للكابتن
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    dir="ltr"
                    placeholder="courier@example.com"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    dir="ltr"
                    placeholder="••••••••"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all text-slate-900"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  {notice}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold font-heading text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {busy ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ تسجيل الدخول…</span>
                  </>
                ) : (
                  <>
                    <Bike className="w-4 h-4" />
                    <span>دخول الكابتن</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  disabled={busy || !email}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                        redirectTo: window.location.origin + '/courier'
                      });
                      if (resetError) throw resetError;
                      setNotice('إذا كان البريد مسجلاً فستصله تعليمات الاستعادة فوراً.');
                    } catch {
                      setError('تعذر إرسال تعليمات الاستعادة. تأكد من صحة البريد.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-orange-600 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <a href="/" className="hover:text-slate-900 transition-colors">
              المتجر الرئيسي
            </a>
            <a href={BRAND.supportUrl} className="hover:text-orange-600 font-medium transition-colors">
              الدعم الفني والعمليات
            </a>
          </div>
        </div>
      </main>
    );
  }

  // Active Courier View
  return (
    <main className="courier-app-root pb-20" dir="rtl">
      {/* Sleek Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5 shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 p-1 flex items-center justify-center shrink-0 shadow-2xs">
              <img src={BRAND.logo} alt="سنجوب" width={32} height={32} className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold font-heading text-slate-900 leading-tight">
                  {name || 'كابتن التوصيل'}
                </h1>
                <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded-md">
                  كابتن
                </span>
              </div>
              <p className="text-[11px] text-slate-500">بوابة التوصيل الميداني</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Status Chip */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                !feed.online
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : feed.live
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !feed.online
                    ? 'bg-rose-500'
                    : feed.live
                    ? 'bg-emerald-500 courier-live-beacon'
                    : 'bg-amber-500'
                }`}
              />
              <span>{!feed.online ? 'غير متصل' : feed.live ? 'لحظي' : 'متصل'}</span>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              title="تسجيل الخروج"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-xl mx-auto px-4 pt-4">
        {/* Modern Segmented Tab Switcher */}
        <nav
          className="bg-slate-200/70 p-1 rounded-2xl flex gap-1 mb-4 shadow-inner"
          aria-label="تبويبات كابتن سنجوب"
        >
          <button
            type="button"
            aria-pressed={tab === 'active'}
            onClick={() => setTab('active')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-heading text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'active'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bike className="w-4 h-4 text-orange-600" />
            <span>المهام النشطة</span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                tab === 'active'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-300 text-slate-700'
              }`}
            >
              {feed.items.length}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={tab === 'history'}
            onClick={() => {
              setTab('history');
              if (!historyLoaded) void historyPage(true);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl font-heading text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>سجل التوصيل</span>
          </button>
        </nav>

        {/* Global Error Notice */}
        {(error || feed.error) && (
          <div className="mb-4">
            <ErrorState
              message={error || feed.error}
              retry={() => {
                setError('');
                if (tab === 'history') void historyPage(true);
                else void feed.refresh();
              }}
            />
          </div>
        )}

        {/* Tab 1: Active Tasks */}
        {tab === 'active' && (
          <section className="space-y-4">
            {/* Quick Action Bar */}
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-xs font-bold text-slate-500">
                المهام المكلف بها حالياً ({feed.items.length})
              </span>
              <button
                type="button"
                onClick={() => void feed.refresh()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-bold text-slate-700 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 text-orange-600 ${feed.loading ? 'animate-spin' : ''}`} />
                <span>تحديث المهام</span>
              </button>
            </div>

            {feed.loading ? (
              <LoadingState message="جارٍ تحديث مهام التوصيل…" />
            ) : !feed.items.length ? (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center shadow-xs">
                <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-4">
                  <PackageCheck className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold font-heading text-slate-900 mb-1">
                  لا توجد مهام نشطة حالياً
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-5 leading-relaxed">
                  أنت جاهز ومتاح لاستقبال الطلبات! ستظهر مهامك هنا فور إسنادها إليك من إدارة العمليات.
                </p>
                <button
                  type="button"
                  onClick={() => void feed.refresh()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>فحص المهام الجديدة الآن</span>
                </button>
              </div>
            ) : (
              feed.items.map(order => {
                const statusMeta = states[order.orderStatus] || {
                  label: order.orderStatus,
                  color: 'bg-slate-100 text-slate-800 border-slate-200',
                  icon: Clock
                };
                const StatusIcon = statusMeta.icon;
                const isReady = order.orderStatus === 'ready';
                const isWithCourier = order.orderStatus === 'with_courier';
                const isItemsOpen = expandedItems[order.id] !== false; // Default open for ease of checking

                return (
                  <article
                    key={order.id}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 courier-card-hover"
                  >
                    {/* Top Row: Order Badge & Status */}
                    <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm bg-slate-100 text-slate-900 px-2.5 py-1 rounded-xl border border-slate-200/80">
                          #{order.orderNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyOrderNumber(order.orderNumber, order.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="نسخ رقم الطلب"
                        >
                          {copiedId === order.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.color}`}>
                        <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{statusMeta.label}</span>
                      </div>
                    </div>

                    {/* Delivery Route Journey (Pickup -> Dropoff) */}
                    <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/70 mb-3 space-y-3">
                      {/* Store / Pickup Point */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Store className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-slate-400">نقطة الاستلام (المتجر)</div>
                          <div className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                            {order.pickupPoints?.[0]?.name || order.storeName || 'متجر سنجوب'}
                          </div>
                          {order.pickupPoints?.[0]?.address && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {order.pickupPoints[0].address}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="border-r-2 border-dashed border-slate-200 mr-3.5 my-1 h-3" />

                      {/* Customer / Dropoff Point */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-slate-400">وجهة التسليم (العميل)</div>
                          <div className="text-xs sm:text-sm font-bold text-slate-900">
                            {order.profileName || 'عميل سنجوب'}
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {order.deliveryAddress || order.ministry || 'العاصمة وكافة المناطق'}
                          </p>
                          {order.floorNumber && order.floorNumber !== 'غير محدد' && (
                            <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-700">
                              <span>الدور / الشقة:</span>
                              <strong>{[order.floorNumber, order.roomNumber].filter(x => x && x !== 'غير محدد').join(' · ')}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Contact & Navigation Buttons */}
                    <div className="flex items-center gap-2 mb-3">
                      {order.phone && (
                        <a
                          href={`tel:${String(order.phone).replace(/[^+0-9]/g, '')}`}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>اتصال بالعميل</span>
                        </a>
                      )}

                      {order.coordinates && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${order.coordinates.latitude},${order.coordinates.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5 text-slate-600" />
                          <span>توجيه الخريطة</span>
                        </a>
                      )}
                    </div>

                    {/* Order Items Accordion */}
                    <div className="border border-slate-100 rounded-2xl p-3 mb-3 bg-slate-50/50">
                      <button
                        type="button"
                        onClick={() => toggleItems(order.id)}
                        className="w-full flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-orange-600" />
                          <span>محتويات الطلب ({order.items.length} أصناف)</span>
                        </div>
                        {isItemsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>

                      {isItemsOpen && (
                        <ul className="mt-2.5 pt-2 border-t border-slate-200/60 divide-y divide-slate-100 text-xs">
                          {order.items.map((item: any, i: number) => (
                            <li key={item.id || i} className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-orange-700 bg-orange-100/80 px-1.5 py-0.5 rounded text-[11px] shrink-0 mt-0.5">
                                  {item.quantity}×
                                </span>
                                <div>
                                  <div className="font-medium text-slate-800">{item.product.name}</div>
                                  <div className="text-[11px] text-slate-500">{item.product.storeName}</div>
                                  {item.selectedOptions && (
                                    <div className="text-[10px] text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                                      {Object.values(item.selectedOptions).join('، ')}
                                    </div>
                                  )}
                                  {item.notes && (
                                    <p className="text-[11px] text-amber-700 mt-0.5">
                                      ملاحظة: {item.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Payment / Cash Collection Banner */}
                    {order.paymentMethod === 'cash' ? (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-2xl p-3.5 mb-3 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Banknote className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-emerald-950">
                              المطلوب تحصيله نقدياً
                            </div>
                            <div className="text-[11px] text-emerald-700">
                              استلم المبلغ كاملاً عند التسليم
                            </div>
                          </div>
                        </div>
                        <div className="text-left font-mono font-extrabold text-base sm:text-lg text-emerald-900">
                          {money(order.amountToCollect)}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-blue-50/70 border border-blue-200/70 rounded-2xl p-3 mb-3 flex items-center gap-3 shadow-2xs">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-blue-900">
                            مدفوع إلكترونياً بالكامل
                          </div>
                          <div className="text-[11px] text-blue-700">
                            لا تقم بتحصيل أي مبالغ نقدية من العميل
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Integrated Live GPS Tracking */}
                    <CourierTracking order={order} />

                    {/* Operational Delivery Actions by Status */}
                    {isReady && (
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                        {/* Verification Checkbox */}
                        <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-orange-50/40 border border-slate-200 has-checked:border-orange-300 has-checked:bg-orange-50/30 rounded-2xl cursor-pointer select-none transition-colors courier-touch-check">
                          <input
                            type="checkbox"
                            checked={!!confirmed[order.id]}
                            onChange={e => setConfirmed(v => ({ ...v, [order.id]: e.target.checked }))}
                            className="w-5 h-5 rounded accent-orange-600 shrink-0 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-800">
                            راجعت وطابقت الأصناف والكميات عند الاستلام من المحل
                          </span>
                        </label>

                        {/* Multi-stop Pickup Buttons (v2) */}
                        {order.fulfillmentVersion === 2 ? (
                          <div className="space-y-2">
                            {(order.stops || []).map((stop: any) => (
                              <button
                                key={stop.storeId}
                                type="button"
                                disabled={
                                  !feed.online ||
                                  !!feed.error ||
                                  !!pending ||
                                  !confirmed[order.id] ||
                                  stop.status !== 'ready' ||
                                  stop.issueOpen
                                }
                                onClick={() => void act(order, 'pickup', stop.storeId)}
                                className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                  stop.status === 'picked_up'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                    : 'bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white shadow-xs'
                                }`}
                              >
                                <PackageCheck className="w-4 h-4" />
                                <span>{stop.status === 'picked_up' ? 'تم الاستلام من' : 'استلام من'} {stop.storeName}</span>
                              </button>
                            ))}

                            <button
                              type="button"
                              disabled={
                                !feed.online ||
                                !!feed.error ||
                                !!pending ||
                                !(order.stops?.length && order.stops.every((s: any) => s.status === 'picked_up'))
                              }
                              onClick={() => void act(order, 'depart')}
                              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                              <Bike className="w-4 h-4" />
                              <span>بدء التوصيل والانطلاق للعميل</span>
                            </button>
                          </div>
                        ) : (
                          /* Single Store Pickup Flow */
                          <div className="space-y-2">
                            {!order.received ? (
                              <button
                                type="button"
                                disabled={!feed.online || !!feed.error || !!pending || !confirmed[order.id]}
                                onClick={() => void act(order, 'courier-pickup')}
                                className="w-full py-3.5 px-4 rounded-2xl bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold font-heading text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                              >
                                <PackageCheck className="w-4 h-4" />
                                <span>{pending === order.id ? 'جارٍ التأكيد…' : 'تأكيد استلام الطلب من المحل'}</span>
                              </button>
                            ) : (
                              <div className="space-y-2">
                                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>تم تأكيد استلام الطلب من المحل بنجاح. يمكنك الآن الانطلاق.</span>
                                </div>
                                <button
                                  type="button"
                                  disabled={!feed.online || !!feed.error || !!pending}
                                  onClick={() => void act(order, 'courier-depart')}
                                  className="w-full py-3.5 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold font-heading text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                                >
                                  <Bike className="w-4 h-4" />
                                  <span>{pending === order.id ? 'جارٍ الانطلاق…' : 'بدء التوصيل والانطلاق للعميل'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Operational Delivery Actions: With Courier (OTP Handover) */}
                    {isWithCourier && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4">
                          <div className="flex items-center gap-2 mb-1.5 text-amber-900 font-bold text-xs sm:text-sm">
                            <KeyRound className="w-4 h-4 text-amber-600" />
                            <span>كود التسليم السري (OTP)</span>
                          </div>
                          <p className="text-xs text-amber-800 mb-3 leading-relaxed">
                            اطلب كود التأكيد المكوّن من 4 أرقام من العميل الظاهر على هاتفه:
                          </p>
                          <input
                            aria-label={`رمز تسليم ${order.orderNumber}`}
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={4}
                            placeholder="••••"
                            value={codes[order.id] || ''}
                            onChange={e =>
                              setCodes(v => ({
                                ...v,
                                [order.id]: e.target.value.replace(/[^0-9]/g, '')
                              }))
                            }
                            className="courier-otp-input w-full text-center text-2xl font-bold py-2.5 rounded-xl border-2 border-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 bg-white text-slate-900 shadow-inner"
                          />
                        </div>

                        {/* Handover & Cash Collection Checkbox */}
                        <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 has-checked:border-emerald-300 has-checked:bg-emerald-50/30 rounded-2xl cursor-pointer select-none transition-colors courier-touch-check">
                          <input
                            type="checkbox"
                            checked={!!collected[order.id]}
                            onChange={e => setCollected(v => ({ ...v, [order.id]: e.target.checked }))}
                            className="w-5 h-5 rounded accent-emerald-600 shrink-0 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-800">
                            {order.paymentMethod === 'cash'
                              ? 'أؤكد استلام كامل المبلغ النقدي وتسليم الأوردر للعميل'
                              : 'أؤكد تسليم الأوردر كاملاً للعميل دون تحصيل نقدي'}
                          </span>
                        </label>

                        {/* Submit Delivery Button */}
                        <button
                          type="button"
                          disabled={
                            !feed.online ||
                            !!feed.error ||
                            !!pending ||
                            !collected[order.id] ||
                            !/^\d{4}$/.test(codes[order.id] || '')
                          }
                          onClick={() => void act(order, 'deliver')}
                          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold font-heading text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>
                            {pending === order.id ? 'جارٍ التحقق وتأكيد التسليم…' : 'تأكيد التسليم بالرمز وإنهاء الطلب'}
                          </span>
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}

            {feed.truncated && (
              <p className="text-xs text-slate-500 text-center py-2" role="status">
                تعرض أول 50 مهمة فقط. تواصل مع الإدارة إذا كان لديك تكليفات إضافية.
              </p>
            )}
          </section>
        )}

        {/* Tab 2: Delivery History */}
        {tab === 'history' && (
          <section className="space-y-3">
            {historyBusy && <LoadingState message="جارٍ استرجاع سجل التوصيل…" />}
            {historyLoaded && !history.length && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold font-heading text-slate-800 mb-1">
                  لا توجد مهام سابقة في السجل
                </h3>
                <p className="text-xs text-slate-500">
                  الطلبات التي تنهي تسليمها ستظهر هنا مع المبالغ المحصلة.
                </p>
              </div>
            )}

            {history.map(o => (
              <article
                key={o.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200">
                      #{o.orderNumber}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      تم التسليم
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {o.profileName || 'العميل'} · {o.deliveryAddress || 'عنوان التوصيل'}
                  </p>
                </div>
                <div className="text-left font-mono font-bold text-sm text-slate-900">
                  {money(o.total)}
                </div>
              </article>
            ))}

            {cursor && (
              <button
                type="button"
                disabled={historyBusy}
                onClick={() => void historyPage()}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                تحميل المزيد من السجل
              </button>
            )}
          </section>
        )}

        {/* Mobile Footer */}
        <footer className="mt-8 pt-4 border-t border-slate-200/60 text-center text-xs text-slate-400 flex items-center justify-center gap-4">
          <a href={BRAND.supportUrl} className="hover:text-orange-600 transition-colors">
            دعم كباتن سنجوب
          </a>
          <span>·</span>
          <a href="/" className="hover:text-slate-700 transition-colors">
            المتجر الرئيسي
          </a>
        </footer>
      </div>
    </main>
  );
}
