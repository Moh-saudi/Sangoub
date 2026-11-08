import { supabase, signOutFromSupabase } from './lib/supabase';
import { CourierTracking } from './components/CourierTracking';
import { useEffect, useRef, useState } from 'react';
import { operationsApi } from './lib/operationsApi';
import { orderDelivery } from './lib/orderDelivery';
import { useActivePortalOrders } from './lib/useActivePortalOrders';
import { LoadingState, ErrorState } from './components/ui/DataStates';
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
  AlertCircle,
  User,
  Camera,
  Car,
  Save,
  CheckCircle,
  FileText,
  Receipt,
  Smartphone,
  Eye,
  X,
  Upload
} from 'lucide-react';

const states: Record<string, { label: string; color: string; icon: any }> = {
  received: { label: 'تم استلام الطلب', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Clock },
  preparing: { label: 'جاري التحضير بالمطعم', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: Clock },
  ready: { label: 'جاهز للاستلام من المتجر', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: PackageCheck },
  with_courier: { label: 'في الطريق للعميل', color: 'bg-blue-50 text-blue-800 border-blue-200', icon: Bike },
  delivered: { label: 'تم التسليم بنجاح', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  cancelled: { label: 'ملغي', color: 'bg-rose-50 text-rose-800 border-rose-200', icon: AlertCircle }
};

const vehicleNames: Record<string, string> = {
  motorcycle: 'دراجة نارية (موتوسيكل)',
  car: 'سيارة نقل خفيف / ملاكي',
  auto: 'سكوتر / تروسيكل (أوتو)',
  bicycle: 'دراجة هوائية (عجلة)'
};

// Calculate Haversine estimated road distance between two points
function estimateDistance(
  p1?: { latitude: number; longitude: number },
  p2?: { latitude: number; longitude: number }
): { distanceKm: number; durationMin: number } | null {
  if (!p1 || !p2 || !Number.isFinite(p1.latitude) || !Number.isFinite(p2.latitude)) return null;
  const R = 6371; // km
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;
  const roadKm = Math.round(straightKm * 1.35 * 10) / 10;
  const durationMin = Math.max(3, Math.round(roadKm * 2.5 + 3));
  return { distanceKm: Math.max(0.4, roadKm), durationMin };
}

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

  // Tabs: Active Tasks, History, Captain Profile
  const [tab, setTab] = useState<'active' | 'history' | 'profile'>('active');

  const [history, setHistory] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);

  // Profile data for captain
  const [profileData, setProfileData] = useState({
    fullName: '',
    phone: '',
    emergencyPhone: '',
    nationalId: '',
    avatarUrl: '',
    vehicleType: 'motorcycle',
    vehiclePlate: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    hasThermalBox: false,
    hasThermalBackpack: false,
    courierStatus: 'active',
    medicalCheck: 'pending',
    criminalRecord: 'pending'
  });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<string>();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [collected, setCollected] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // InstaPay & Wallets receipt capture state
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [uploadingReceipt, setUploadingReceipt] = useState<Record<string, boolean>>({});
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

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
            const displayName = authority.displayName || authority.fullName || user.user_metadata?.full_name || 'كابتن التوصيل';
            setName(displayName);
            setProfileData({
              fullName: authority.fullName || displayName,
              phone: authority.phone || '',
              emergencyPhone: authority.emergencyPhone || '',
              nationalId: authority.nationalId || '',
              avatarUrl: authority.avatarUrl || '',
              vehicleType: authority.vehicleType || 'motorcycle',
              vehiclePlate: authority.vehiclePlate || '',
              vehicleMake: authority.vehicleMake || '',
              vehicleModel: authority.vehicleModel || '',
              vehicleYear: authority.vehicleYear || '',
              hasThermalBox: !!authority.hasThermalBox,
              hasThermalBackpack: !!authority.hasThermalBackpack,
              courierStatus: authority.courierStatus || 'active',
              medicalCheck: authority.medicalCheck || 'pending',
              criminalRecord: authority.criminalRecord || 'pending'
            });
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
      const isInstapay = order.paymentMethod === 'instapay' || order.paymentMethod === 'vodafone_cash' || order.paymentMethod === 'wallet';
      const finalAmount = order.amountToCollect ?? (order.paymentMethod === 'cash' ? order.total : 0);
      if (action === 'deliver') {
        await orderDelivery({
          action: 'deliver',
          orderId: order.id,
          otpCode: codes[order.id] || '',
          collectedAmount: isInstapay ? 0 : finalAmount
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

  function toggleInvoice(orderId: string) {
    setExpandedInvoices(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  }

  // Handle Receipt Upload for InstaPay / E-Wallets
  async function handleReceiptUpload(orderId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert('حجم الصورة كبير؛ يرجى اختيار صورة أقل من 4 ميجابايت.');
      return;
    }

    setUploadingReceipt(prev => ({ ...prev, [orderId]: true }));
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result;
        setReceipts(prev => ({ ...prev, [orderId]: dataUrl }));
        try {
          await operationsApi('operations', {
            action: 'upload-receipt',
            orderId,
            receiptUrl: dataUrl
          });
          // Also refresh active feed so all parties see it
          void feed.refresh();
        } catch (err) {
          console.warn('Failed to upload receipt:', err);
        } finally {
          setUploadingReceipt(prev => ({ ...prev, [orderId]: false }));
        }
      }
    };
    reader.readAsDataURL(file);
  }

  // Handle Avatar Upload with FileReader
  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileError('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError('حجم الصورة كبير؛ الحد الأقصى 2 ميجابايت.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileData(prev => ({ ...prev, avatarUrl: reader.result as string }));
        setProfileError('');
      }
    };
    reader.readAsDataURL(file);
  }

  // Save Courier Profile with resilient fallback
  async function saveProfile(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setProfileBusy(true);
    setProfileError('');
    setProfileSaved(false);
    try {
      await operationsApi('operations', {
        action: 'update-profile',
        fullName: profileData.fullName.trim(),
        phone: profileData.phone.trim(),
        emergencyPhone: profileData.emergencyPhone.trim(),
        nationalId: profileData.nationalId.trim(),
        avatarUrl: profileData.avatarUrl,
        vehicleType: profileData.vehicleType,
        vehiclePlate: profileData.vehiclePlate.trim(),
        vehicleMake: profileData.vehicleMake.trim(),
        vehicleModel: profileData.vehicleModel.trim(),
        vehicleYear: profileData.vehicleYear.trim(),
        hasThermalBox: profileData.hasThermalBox,
        hasThermalBackpack: profileData.hasThermalBackpack,
        courierStatus: profileData.courierStatus
      });
      setName(profileData.fullName.trim() || 'كابتن التوصيل');
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3500);
    } catch (err: any) {
      setProfileError(err?.message || 'تعذر حفظ تعديلات الملف الشخصي. أعد المحاولة.');
    } finally {
      setProfileBusy(false);
    }
  }

  // Toggle Working Shift (Online/Offline)
  async function toggleDutyStatus() {
    const nextStatus = profileData.courierStatus === 'active' ? 'suspended' : 'active';
    setProfileData(prev => ({ ...prev, courierStatus: nextStatus }));
    try {
      await operationsApi('operations', {
        action: 'update-profile',
        courierStatus: nextStatus
      });
    } catch {}
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
            {profileData.avatarUrl ? (
              <img
                src={profileData.avatarUrl}
                alt={name}
                className="w-10 h-10 rounded-2xl object-cover border border-orange-200 shadow-2xs"
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                <img src={BRAND.logo} alt="سنجوب" width={32} height={32} className="w-8 h-8 object-contain" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold font-heading text-slate-900 leading-tight">
                  {name || 'كابتن التوصيل'}
                </h1>
                <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded-md">
                  كابتن
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {profileData.courierStatus === 'active' ? 'متاح لاستقبال المهام' : 'في استراحة مؤقتة'}
              </p>
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
        {/* Modern 3-Way Segmented Tab Switcher */}
        <nav
          className="bg-slate-200/70 p-1 rounded-2xl flex gap-1 mb-4 shadow-inner"
          aria-label="تبويبات كابتن سنجوب"
        >
          <button
            type="button"
            aria-pressed={tab === 'active'}
            onClick={() => setTab('active')}
            className={`flex-1 py-2.5 px-2 rounded-xl font-heading text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'active'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bike className="w-4 h-4 text-orange-600 shrink-0" />
            <span className="truncate">المهام</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full transition-colors ${
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
            className={`flex-1 py-2.5 px-2 rounded-xl font-heading text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate">السجل</span>
          </button>

          <button
            type="button"
            aria-pressed={tab === 'profile'}
            onClick={() => setTab('profile')}
            className={`flex-1 py-2.5 px-2 rounded-xl font-heading text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'profile'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="truncate">ملفي الشخصي</span>
          </button>
        </nav>

        {/* Global Error Notice */}
        {(error || feed.error) && tab !== 'profile' && (
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
                المهام المسندة إليك ({feed.items.length})
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
                  لا توجد مهام نشطة مسندة إليك حالياً
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-5 leading-relaxed">
                  أنت متاح وجاهز للعمل! ستظهر مهامك هنا تلقائياً فور تكليفك بأي طلب من المتجر أو الإدارة.
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
                const isInvoiceOpen = !!expandedInvoices[order.id];

                // Payment types
                const isCash = order.paymentMethod === 'cash';
                const isInstapay = order.paymentMethod === 'instapay' || order.paymentMethod === 'vodafone_cash' || order.paymentMethod === 'wallet';
                const isOnlineCard = order.paymentMethod === 'card' || order.paymentMethod === 'geidea';
                const amountToCollect = isCash ? (order.amountToCollect ?? order.total) : 0;

                // Estimated Distance & Time
                const distEstimate = estimateDistance(order.storeCoordinates, order.coordinates);
                const currentReceipt = receipts[order.id] || order.receiptUrl;

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

                      {/* Route Distance & Timing Indicator */}
                      <div className="flex items-center gap-2 pr-3.5 my-1">
                        <div className="border-r-2 border-dashed border-slate-300 h-6" />
                        {distEstimate ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 shadow-2xs">
                            <Navigation className="w-3 h-3 text-orange-600" />
                            <span>المسافة التقديرية للمسار: {distEstimate.distanceKm} كم</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500">حوالي {distEstimate.durationMin} دقيقة</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">مسار التوصيل في نطاق العاصمة والمقر</span>
                        )}
                      </div>

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

                    {/* Order Invoice & Breakdown Accordion */}
                    <div className="border border-slate-100 rounded-2xl p-3 mb-3 bg-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => toggleInvoice(order.id)}
                        className="w-full flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-teal-600" />
                          <span>تفاصيل فاتورة الحساب والمبالغ</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900">{money(order.total)}</span>
                          {isInvoiceOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </button>

                      {isInvoiceOpen && (
                        <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-2">
                          <div className="flex justify-between text-slate-600">
                            <span>قيمة الأصناف:</span>
                            <span className="font-mono font-medium">{money(order.subtotal || Math.max(0, order.total - (order.deliveryFee || 0)))}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>خدمة التوصيل:</span>
                            <span className="font-mono font-medium">{money(order.deliveryFee || 0)}</span>
                          </div>
                          {order.discount > 0 && (
                            <div className="flex justify-between text-emerald-700">
                              <span>قيمة الخصم / كوبون:</span>
                              <span className="font-mono font-bold">- {money(order.discount)}</span>
                            </div>
                          )}
                          {order.taxTotal > 0 && (
                            <div className="flex justify-between text-slate-600">
                              <span>الضريبة:</span>
                              <span className="font-mono">{money(order.taxTotal)}</span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                            <span>إجمالي الفاتورة:</span>
                            <span className="font-mono text-base">{money(order.total)}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                            <span>طريقة الدفع المسجلة:</span>
                            <span className="font-bold text-slate-700">
                              {isCash
                                ? 'الدفع نقداً عند الاستلام'
                                : isInstapay
                                ? 'إنستاباي / محفظة إلكترونية'
                                : 'بطاقة بنكية / فيزا'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Payment & Cash / InstaPay Collection Banner */}
                    {isCash ? (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-2xl p-3.5 mb-3 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Banknote className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-emerald-950">
                              المطلوب تحصيله نقدياً عند التسليم
                            </div>
                            <div className="text-[11px] text-emerald-700">
                              استلم المبلغ كاملاً قبل إدخال رمز التسليم
                            </div>
                          </div>
                        </div>
                        <div className="text-left font-mono font-extrabold text-base sm:text-lg text-emerald-900">
                          {money(amountToCollect)}
                        </div>
                      </div>
                    ) : isInstapay ? (
                      /* InstaPay & E-Wallet Section with Receipt Capture */
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/90 rounded-2xl p-3.5 mb-3 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <Smartphone className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-purple-950">
                                الدفع عبر إنستاباي / المحفظة الإلكترونية
                              </div>
                              <div className="text-[11px] text-purple-700">
                                {order.paymentStatus === 'paid'
                                  ? '✓ تم التحويل والدفع إلكترونياً مسبقاً (مؤكد)'
                                  : 'تحويل عند الاستلام — اطلب من العميل إشعار التحويل'}
                              </div>
                            </div>
                          </div>
                          <div className="text-left font-mono font-extrabold text-base sm:text-lg text-purple-900">
                            {money(order.total)}
                          </div>
                        </div>

                        {/* Receipt Upload / Preview Box */}
                        <div className="pt-2 border-t border-purple-200/60">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-[11px] font-bold text-purple-900">
                              إيصال التحويل (ريست إنستاباي):
                            </div>

                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer">
                              <Camera className="w-3.5 h-3.5" />
                              <span>{uploadingReceipt[order.id] ? 'جارٍ الحفظ…' : currentReceipt ? 'إعادة تصوير الإيصال' : 'تصوير / إرفاق الإيصال'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={e => handleReceiptUpload(order.id, e)}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {currentReceipt && (
                            <div className="mt-2.5 p-2 bg-white rounded-xl border border-purple-200 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <img
                                  src={currentReceipt}
                                  alt="إيصال التحويل"
                                  className="w-12 h-12 object-cover rounded-lg border border-slate-200 cursor-pointer"
                                  onClick={() => setPreviewReceiptUrl(currentReceipt)}
                                />
                                <div>
                                  <div className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>تم إرفاق الإيصال بنجاح</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500">تم تسجيل التحويل للطلب</div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setPreviewReceiptUrl(currentReceipt)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>معاينة</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-blue-50/70 border border-blue-200/70 rounded-2xl p-3 mb-3 flex items-center gap-3 shadow-2xs">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-blue-900">
                            الطلب مدفوع إلكترونياً بالفيزا بالكامل
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

                        {/* Handover & Cash/InstaPay Collection Checkbox */}
                        <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 has-checked:border-emerald-300 has-checked:bg-emerald-50/30 rounded-2xl cursor-pointer select-none transition-colors courier-touch-check">
                          <input
                            type="checkbox"
                            checked={!!collected[order.id]}
                            onChange={e => setCollected(v => ({ ...v, [order.id]: e.target.checked }))}
                            className="w-5 h-5 rounded accent-emerald-600 shrink-0 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-800">
                            {isCash
                              ? 'أؤكد استلام كامل المبلغ النقدي وتسليم الأوردر للعميل'
                              : isInstapay
                              ? 'أؤكد مطابقة تحويل إنستاباي/المحفظة وتسليم الأوردر للعميل'
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
                  الطلبات التي تنهي تسليمها ستظهر هنا مع المبالغ المحصلة وتفاصيل المهمة.
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

        {/* Tab 3: Captain Profile Page */}
        {tab === 'profile' && (
          <section className="space-y-4">
            {/* Captain Hero Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 text-center relative overflow-hidden">
              <div className="relative inline-block mx-auto mb-3">
                {profileData.avatarUrl ? (
                  <img
                    src={profileData.avatarUrl}
                    alt={profileData.fullName}
                    className="w-24 h-24 rounded-3xl object-cover border-4 border-orange-100 shadow-md"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-3xl bg-orange-50 border-4 border-orange-100 flex items-center justify-center text-orange-600 shadow-md">
                    <User className="w-12 h-12" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  title="تغيير الصورة الشخصية"
                  className="absolute -bottom-2 -left-2 p-2 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarFile}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
              </div>

              <h2 className="text-base font-bold font-heading text-slate-900 mb-0.5">
                {profileData.fullName || name || 'كابتن سنجوب'}
              </h2>
              <p className="text-xs text-slate-500 mb-3" dir="ltr">
                {currentEmail}
              </p>

              {/* Working Availability Switcher */}
              <div className="inline-flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 px-2">حالة العمل:</span>
                <button
                  type="button"
                  onClick={toggleDutyStatus}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    profileData.courierStatus === 'active'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${profileData.courierStatus === 'active' ? 'bg-white' : 'bg-slate-400'}`} />
                  <span>متاح للطلبات</span>
                </button>
                <button
                  type="button"
                  onClick={toggleDutyStatus}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    profileData.courierStatus !== 'active'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${profileData.courierStatus !== 'active' ? 'bg-white' : 'bg-slate-400'}`} />
                  <span>في استراحة</span>
                </button>
              </div>
            </div>

            {/* Notifications / Feedback */}
            {profileSaved && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>تم حفظ وتحديث بيانات ملفك الشخصي بنجاح!</span>
              </div>
            )}

            {profileError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {/* Profile Form */}
            <form onSubmit={saveProfile} className="space-y-4">
              {/* Section 1: Personal Details */}
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold font-heading text-slate-800 pb-2 border-b border-slate-100">
                  <User className="w-4 h-4 text-orange-600" />
                  <span>البيانات الشخصية والاتصال</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الاسم الكامل والشهرة
                  </label>
                  <input
                    type="text"
                    required
                    value={profileData.fullName}
                    onChange={e => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="مثال: أحمد محمد علي"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      رقم هاتف التواصل
                    </label>
                    <input
                      type="tel"
                      required
                      value={profileData.phone}
                      onChange={e => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="01017799582"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all text-slate-900 text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      رقم هاتف الطوارئ (اختياري)
                    </label>
                    <input
                      type="tel"
                      value={profileData.emergencyPhone}
                      onChange={e => setProfileData(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                      placeholder="01xxxxxxxxx"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all text-slate-900 text-right"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الرقم القومي (14 رقماً - اختياري)
                  </label>
                  <input
                    type="text"
                    maxLength={14}
                    value={profileData.nationalId}
                    onChange={e => setProfileData(prev => ({ ...prev, nationalId: e.target.value.replace(/[^0-9]/g, '') }))}
                    placeholder="298xxxxxxxxxxx"
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all text-slate-900 text-right font-mono"
                  />
                </div>
              </div>

              {/* Section 2: Vehicle & Equipment */}
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold font-heading text-slate-800 pb-2 border-b border-slate-100">
                  <Car className="w-4 h-4 text-teal-600" />
                  <span>وسيلة التوصيل وتجهيزات الحفظ</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نوع وسيلة التوصيل
                    </label>
                    <select
                      value={profileData.vehicleType}
                      onChange={e => setProfileData(prev => ({ ...prev, vehicleType: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all text-slate-900 cursor-pointer"
                    >
                      {Object.entries(vehicleNames).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      رقم اللوحة المعدنية
                    </label>
                    <input
                      type="text"
                      value={profileData.vehiclePlate}
                      onChange={e => setProfileData(prev => ({ ...prev, vehiclePlate: e.target.value }))}
                      placeholder="مثال: س ع ق 194"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الماركة والموديل
                    </label>
                    <input
                      type="text"
                      value={profileData.vehicleModel}
                      onChange={e => setProfileData(prev => ({ ...prev, vehicleModel: e.target.value }))}
                      placeholder="دايون 4 / هوندا سكوتر"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      سنة الصنع
                    </label>
                    <input
                      type="number"
                      min={1990}
                      max={2030}
                      value={profileData.vehicleYear}
                      onChange={e => setProfileData(prev => ({ ...prev, vehicleYear: e.target.value }))}
                      placeholder="2024"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all text-slate-900 font-mono"
                    />
                  </div>
                </div>

                {/* Thermal gear check */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={profileData.hasThermalBox}
                      onChange={e => setProfileData(prev => ({ ...prev, hasThermalBox: e.target.checked }))}
                      className="w-4 h-4 rounded accent-orange-600"
                    />
                    <span>يوجد صندوق حفظ حراري مثبت (Thermal Box)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={profileData.hasThermalBackpack}
                      onChange={e => setProfileData(prev => ({ ...prev, hasThermalBackpack: e.target.checked }))}
                      className="w-4 h-4 rounded accent-orange-600"
                    />
                    <span>يوجد حقيبة ظهر عازلة للحرارة</span>
                  </label>
                </div>
              </div>

              {/* Section 3: Verification Badges */}
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold font-heading text-slate-800 pb-2 border-b border-slate-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>التوثيق الرسمي والفحص الجنائي والطبي</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">الفحص الطبي والتحاليل</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">تحليل المخدرات واللياقة</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      قيد الفحص
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">الصحيفة الجنائية (الفيش)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">سجل الحالة الجنائية</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      قيد الاستخراج
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={profileBusy}
                className="w-full py-3.5 px-4 rounded-2xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold font-heading text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {profileBusy ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ حفظ التعديلات…</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ تحديثات الملف الشخصي</span>
                  </>
                )}
              </button>
            </form>
          </section>
        )}

        {/* Modal: Full Receipt Preview */}
        {previewReceiptUrl && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setPreviewReceiptUrl(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">معاينة إيصال التحويل</span>
                <button
                  type="button"
                  onClick={() => setPreviewReceiptUrl(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex items-center justify-center bg-slate-50 max-h-[75vh] overflow-auto">
                <img
                  src={previewReceiptUrl}
                  alt="إيصال التحويل"
                  className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-sm"
                />
              </div>
              <div className="p-3 bg-white border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => setPreviewReceiptUrl(null)}
                  className="px-6 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
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
