import { supabase, signOutFromSupabase } from './lib/supabase';
import { CourierTracking } from './components/CourierTracking';
import { OrderMap } from './components/OrderMap';
import { cleanCustomerName } from './utils/sanitizeName';
import { useEffect, useRef, useState } from 'react';
import { operationsApi } from './lib/operationsApi';
import { orderDelivery } from './lib/orderDelivery';
import { useActivePortalOrders } from './lib/useActivePortalOrders';
import { LoadingState, ErrorState } from './components/ui/DataStates';
import { BRAND } from './brand';
import { customerMessage } from './utils/customerMessage';
import { triggerPwaUpdate } from './lib/pwaAutoUpdate';
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
  Upload,
  Bell,
  Inbox,
  MessageCircle,
  BarChart3,
  Calendar,
  Coffee,
  Play,
  Pause,
  TrendingUp,
  Printer
} from 'lucide-react';

const states: Record<string, { label: string; color: string; icon: any }> = {
  received: { label: 'تم استلام الطلب', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Clock },
  preparing: { label: 'جارٍ التجهيز بالمتجر', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: Clock },
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

  // Tabs: Active Tasks, History, Reports & Analytics, Captain Profile
  const [tab, setTab] = useState<'active' | 'history' | 'reports' | 'profile'>('active');

  const [history, setHistory] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);

  // Reports Filter & Shift State
  const [reportPeriod, setReportPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [reportStartDate, setReportStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportStoreFilter, setReportStoreFilter] = useState<string>('all');

  interface PauseLogEntry {
    id: string;
    startTime: string;
    endTime?: string;
    durationMinutes?: number;
    reason?: string;
  }
  const [pauseLogs, setPauseLogs] = useState<PauseLogEntry[]>([]);

  // Load pause logs when uid changes
  useEffect(() => {
    if (!uid) return;
    try {
      const saved = localStorage.getItem(`sangoub_courier_pause_logs_${uid}`);
      if (saved) setPauseLogs(JSON.parse(saved));
    } catch {}
  }, [uid]);

  const savePauseLogs = (logs: PauseLogEntry[]) => {
    setPauseLogs(logs);
    if (uid) {
      try {
        localStorage.setItem(`sangoub_courier_pause_logs_${uid}`, JSON.stringify(logs));
      } catch {}
    }
  };

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

  // In-App Notifications State for Courier
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  // In-App Map expansion toggle per order
  const [openMaps, setOpenMaps] = useState<Record<string, boolean>>({});
  const toggleMap = (orderId: string) => {
    setOpenMaps(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const mutation = useRef(false);
  const generation = useRef(0);
  const feed = useActivePortalOrders(access === 'courier' ? uid : undefined);

  // Load and listen to notifications for courier
  useEffect(() => {
    if (!uid) return;
    let active = true;

    async function loadNotifications() {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(20);

        if (active && data) {
          setNotifications(data.map(n => ({
            id: n.id,
            title: n.title,
            body: n.body,
            createdAt: n.created_at,
            read: n.is_read,
            type: n.type,
            orderId: n.data?.orderId
          })));
        }
      } catch (err) {
        console.warn('Courier notifications load error:', err);
      }
    }

    void loadNotifications();

    const channel = supabase
      .channel(`courier-notifs-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        payload => {
          if (payload.new) {
            setNotifications(prev => [
              {
                id: payload.new.id,
                title: payload.new.title,
                body: payload.new.body,
                createdAt: payload.new.created_at,
                read: payload.new.is_read,
                type: payload.new.type,
                orderId: payload.new.data?.orderId
              },
              ...prev
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [uid]);

  // Auto-generate notifications from current active tasks
  useEffect(() => {
    if (!feed.items?.length) return;
    const taskNotifs = feed.items.map(order => ({
      id: `task-${order.id}-${order.orderStatus}`,
      title: order.orderStatus === 'ready' ? `طلب جاهز للاستلام #${order.orderNumber}` : `مهمة توصيل مسندة إليك #${order.orderNumber}`,
      body: `الطلب #${order.orderNumber} من متجر "${order.storeName}" بقيمة ${money(order.total)}. وجهة العميل: ${order.deliveryAddress || 'العاصمة'}`,
      createdAt: order.updatedAt || order.createdAt || new Date().toISOString(),
      read: false,
      type: 'order',
      orderId: order.id
    }));

    setNotifications(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const toAdd = taskNotifs.filter(t => !existingIds.has(t.id));
      return toAdd.length ? [...toAdd, ...prev] : prev;
    });
  }, [feed.items]);

  // Mark all notifications as read
  async function markAllNotificationsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (!uid) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', uid);
    } catch {}
  }

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
        console.error('[Courier Login Auth Error]', sbErr);
        if (sbErr.message?.includes('Invalid login credentials')) {
          setError('البريد أو كلمة المرور غير صحيحة.');
          return;
        }
        if (sbErr.message?.includes('Email not confirmed')) {
          setError('يرجى تأكيد البريد الإلكتروني أولاً.');
          return;
        }
        setError(sbErr.message || 'تعذر الدخول. راجع البريد وكلمة المرور.');
        return;
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

  // Toggle Working Shift (Online / Pause Break) with automated duration logging
  async function toggleDutyStatus() {
    const isCurrentlyActive = profileData.courierStatus === 'active';
    const nextStatus = isCurrentlyActive ? 'suspended' : 'active';
    setProfileData(prev => ({ ...prev, courierStatus: nextStatus }));

    const nowIso = new Date().toISOString();
    if (isCurrentlyActive) {
      // Starting a new pause/break
      const newLog: PauseLogEntry = {
        id: `pause-${Date.now()}`,
        startTime: nowIso,
        reason: 'استراحة مؤقتة'
      };
      savePauseLogs([newLog, ...pauseLogs]);
    } else {
      // Ending the active pause/break
      const updated = pauseLogs.map(log => {
        if (!log.endTime) {
          const start = new Date(log.startTime).getTime();
          const end = new Date(nowIso).getTime();
          const mins = Math.max(1, Math.round((end - start) / 60000));
          return { ...log, endTime: nowIso, durationMinutes: mins };
        }
        return log;
      });
      savePauseLogs(updated);
    }

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

            {/* 1-Click PWA Update Button */}
            <button
              type="button"
              onClick={() => void triggerPwaUpdate()}
              title="تحديث المنظومة فوراً لتنزيل أحدث نسخة"
              className="p-2 rounded-xl text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200/80 transition-colors cursor-pointer bg-white"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(v => !v)}
              title="الإشعارات والتنبيهات"
              className="relative p-2 rounded-xl text-slate-600 hover:text-orange-600 hover:bg-orange-50 border border-slate-200/80 transition-colors cursor-pointer bg-white"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center px-1 shadow-xs animate-bounce">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

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
        {/* Modern 4-Way Segmented Tab Switcher */}
        <nav
          className="bg-slate-200/70 p-1 rounded-2xl flex gap-1 mb-4 shadow-inner"
          aria-label="تبويبات كابتن سنجوب"
        >
          <button
            type="button"
            aria-pressed={tab === 'active'}
            onClick={() => setTab('active')}
            className={`flex-1 py-2 px-1.5 rounded-xl font-heading text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              tab === 'active'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bike className="w-3.5 h-3.5 text-orange-600 shrink-0" />
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
            className={`flex-1 py-2 px-1.5 rounded-xl font-heading text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              tab === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">السجل</span>
          </button>

          <button
            type="button"
            aria-pressed={tab === 'reports'}
            onClick={() => {
              setTab('reports');
              if (!historyLoaded) void historyPage(true);
            }}
            className={`flex-1 py-2 px-1.5 rounded-xl font-heading text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              tab === 'reports'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">التقارير</span>
          </button>

          <button
            type="button"
            aria-pressed={tab === 'profile'}
            onClick={() => setTab('profile')}
            className={`flex-1 py-2 px-1.5 rounded-xl font-heading text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              tab === 'profile'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="truncate">ملفي</span>
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
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-400">وجهة التسليم (العميل)</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                              موقع العميل موثق 📍
                            </span>
                          </div>
                          <div className="text-sm font-black text-slate-900 mt-0.5">
                            {cleanCustomerName(order.profileName, order.phone)}
                          </div>
                          
                          {/* Comprehensive Structured Address Card */}
                          <div className="mt-2 p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5 text-xs">
                            <div className="flex items-start gap-1.5 text-slate-800 font-bold">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-snug">
                                {order.deliveryAddress || order.ministry || 'العاصمة الإدارية وكافة المناطق'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-600 flex-wrap pt-1 border-t border-slate-100">
                              {order.district && (
                                <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80 font-bold text-slate-700">
                                  المنطقة: <strong>{order.district}</strong>
                                </span>
                              )}
                              {(order.buildingNumber || order.deliveryAddress?.match(/عمارة\s*(\S+)/)?.[0]) && (
                                <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80 font-bold text-slate-700">
                                  العمارة / المبنى: <strong>{order.buildingNumber || order.deliveryAddress?.match(/عمارة\s*(\S+)/)?.[0]}</strong>
                                </span>
                              )}
                              {order.floorNumber && order.floorNumber !== 'غير محدد' && (
                                <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80 font-bold text-slate-700">
                                  الدور: <strong>{order.floorNumber}</strong>
                                </span>
                              )}
                              {order.roomNumber && order.roomNumber !== 'غير محدد' && (
                                <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80 font-bold text-slate-700">
                                  الشقة / المكتب: <strong>{order.roomNumber}</strong>
                                </span>
                              )}
                            </div>

                            {order.notes && (
                              <div className="mt-1 p-1.5 rounded-lg bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 leading-snug">
                                <span className="font-bold text-amber-950">ملاحظة العميل الخاصة: </span>
                                <span>{order.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Contact & Navigation Buttons */}
                    {(() => {
                      const custName = cleanCustomerName(order.profileName, order.phone);
                      const cleanPhone = String(order.phone || '').replace(/\D/g, '');
                      const waPhone = cleanPhone.startsWith('01') ? '2' + cleanPhone : cleanPhone;

                      // Exact Location Link for confirmation
                      const customerLocationMapUrl = (order.coordinates?.latitude && order.coordinates?.longitude)
                        ? `https://maps.google.com/?q=${order.coordinates.latitude},${order.coordinates.longitude}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([order.deliveryAddress || order.ministry, order.district, 'العاصمة الإدارية'].filter(Boolean).join(' '))}`;

                      const addressSummaryForWa = [
                        order.deliveryAddress || order.ministry,
                        order.floorNumber && order.floorNumber !== 'غير محدد' ? `الدور: ${order.floorNumber}` : '',
                        order.roomNumber && order.roomNumber !== 'غير محدد' ? `شقة/مكتب: ${order.roomNumber}` : '',
                      ].filter(Boolean).join(' - ');

                      // Exact Requested WhatsApp Confirmation Message
                      const waConfirmMessage = `السلام عليكم ورحمة الله، أنا مندوب سنجوب في الطريق إليك لتسليم طلبك #${order.orderNumber}.
رجاء تأكيد اللوكيشن لحضرتك:
${customerLocationMapUrl}
العنوان المسجل: ${addressSummaryForWa}
للتأكيد أو إرسال لوكيشن صحيح ومباشر هنا عبر الواتساب لتأكيده.`;

                      const custWaUrl = waPhone
                        ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waConfirmMessage)}`
                        : '';
                      const mapsUrl = (order.coordinates?.latitude && order.coordinates?.longitude)
                        ? `https://www.google.com/maps/dir/?api=1&destination=${order.coordinates.latitude},${order.coordinates.longitude}`
                        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([order.deliveryAddress || order.ministry, order.district, 'العاصمة الإدارية', 'مصر'].filter(Boolean).join(', '))}`;

                      const isMapOpen = openMaps[order.id] !== false; // Default OPEN for instant visibility

                      return (
                        <div className="space-y-2 mb-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {order.phone && (
                              <a
                                href={`tel:${cleanPhone}`}
                                className="py-2.5 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200/90 text-blue-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                title="اتصال هاتفي بالعميل"
                              >
                                <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>اتصال هاتفي</span>
                              </a>
                            )}

                            {custWaUrl && (
                              <a
                                href={custWaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                title="إرسال رسالة واتساب للعميل لتأكيد اللوكيشن"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-white shrink-0" />
                                <span>واتساب تأكيد اللوكيشن</span>
                              </a>
                            )}

                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer col-span-2 sm:col-span-1"
                              title="فتح موقع العميل مباشرة في خرائط Google"
                            >
                              <Navigation className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                              <span>ملاحة Google Maps</span>
                            </a>
                          </div>

                          {/* In-App Interactive Route Map */}
                          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => toggleMap(order.id)}
                              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>خريطة ومسار التوصيل المباشر إلى موقع العميل</span>
                              </span>
                              <span className="text-[11px] text-orange-600 font-black">
                                {isMapOpen ? 'إخفاء الخريطة ▲' : 'عرض الخريطة 🗺️ ▼'}
                              </span>
                            </button>

                            {isMapOpen && (
                              <div className="p-2 bg-slate-50 border-t border-slate-200">
                                <OrderMap
                                  order={{
                                    id: order.id,
                                    orderStatus: order.orderStatus,
                                    coordinates: order.coordinates,
                                    courierId: order.courierId || uid,
                                    deliveryAddress: order.deliveryAddress,
                                    ministry: order.ministry
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

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

            {history.map(o => {
              const isCash = o.paymentMethod === 'cash';
              const isInstapay = o.paymentMethod === 'instapay' || o.paymentMethod === 'vodafone_cash' || o.paymentMethod === 'wallet';
              const deliveredTime = o.deliveredAt || o.updatedAt || o.createdAt;
              const isInvOpen = !!expandedInvoices[o.id];

              return (
                <article
                  key={o.id}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3"
                >
                  {/* Top Bar: Order Number & Delivery Status */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2.5 py-1 rounded-xl border border-slate-200/80">
                        #{o.orderNumber}
                      </span>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تم التسليم بنجاح</span>
                      </span>
                    </div>

                    <div className="font-mono font-extrabold text-sm sm:text-base text-slate-900">
                      {money(o.total)}
                    </div>
                  </div>

                  {/* Delivery Timestamp & Store */}
                  <div className="flex items-center justify-between text-xs text-slate-600 gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Store className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                      <span>{o.storeName || o.pickupPoints?.[0]?.name || 'متجر سنجوب'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-slate-500 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {new Date(deliveredTime).toLocaleDateString('ar-EG')} · {new Date(deliveredTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Customer Privacy Notice: Hiding Phone, Direct Contact & Retaining Only Invoice */}
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="leading-relaxed">
                      <strong>حماية الخصوصية:</strong> أُغلقت بيانات الاتصال بالعميل (رقم الهاتف وأزرار الاتصال/الواتساب) تلقائياً بعد إتمام التسليم.
                    </span>
                  </div>

                  {/* Financial Invoice Breakdown */}
                  <div className="border border-slate-100 rounded-2xl p-3 bg-slate-50/40">
                    <button
                      type="button"
                      onClick={() => toggleInvoice(o.id)}
                      className="w-full flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-teal-600" />
                        <span>بيانات فاتورة الحساب والتسوية</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">
                          {isCash ? 'كاش عند التسليم' : isInstapay ? 'إنستاباي / محفظة' : 'بطاقة بنكية'}
                        </span>
                        {isInvOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>

                    {isInvOpen && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 text-xs space-y-1.5">
                        <div className="flex justify-between text-slate-600">
                          <span>قيمة الأصناف:</span>
                          <span className="font-mono">{money(o.subtotal || Math.max(0, o.total - (o.deliveryFee || 0)))}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>رسوم التوصيل:</span>
                          <span className="font-mono">{money(o.deliveryFee || 0)}</span>
                        </div>
                        {o.discount > 0 && (
                          <div className="flex justify-between text-emerald-700">
                            <span>الخصم / الكوبون:</span>
                            <span className="font-mono">- {money(o.discount)}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                          <span>إجمالي الفاتورة المسددة:</span>
                          <span className="font-mono text-sm text-emerald-800">{money(o.total)}</span>
                        </div>
                        {o.items?.length > 0 && (
                          <div className="pt-2 border-t border-slate-200">
                            <span className="text-[11px] font-bold text-slate-700 block mb-1">الأصناف المسلّمة:</span>
                            <ul className="divide-y divide-slate-100 text-[11px] text-slate-600">
                              {o.items.map((it: any, idx: number) => (
                                <li key={idx} className="py-1 flex justify-between">
                                  <span>{it.quantity}× {it.product?.name || it.name}</span>
                                  <span className="font-mono">{money(it.price * it.quantity)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

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

        {/* Tab 3: Courier Reports & Analytics (التقارير وسجل التوصيل والورديات) */}
        {tab === 'reports' && (
          <section className="space-y-4">
            {/* Header & Filter Controls */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold font-heading text-slate-900">
                      تقارير وإحصائيات كابتن التوصيل
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      متابعة الإنجاز اليومي والتحصيلات وأوقات الراحة
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!historyLoaded) void historyPage(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 text-blue-600 ${historyBusy ? 'animate-spin' : ''}`} />
                  <span>تحديث البيانات</span>
                </button>
              </div>

              {/* Filter 1: Period Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                  تحديد الفترة الزمنية للتقرير:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {[
                    { id: 'today', label: 'اليوم' },
                    { id: 'yesterday', label: 'أمس' },
                    { id: 'week', label: 'آخر 7 أيام' },
                    { id: 'month', label: 'هذا الشهر' },
                    { id: 'custom', label: 'مخصصة 📅' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setReportPeriod(p.id as any)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                        reportPeriod === p.id
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Range Inputs */}
              {reportPeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">من تاريخ:</span>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={e => setReportStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">إلى تاريخ:</span>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={e => setReportEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Filter 2: Merchant / Store Selection */}
              {(() => {
                const uniqueStores = Array.from(
                  new Set(
                    history
                      .map(o => o.storeName || o.pickupPoints?.[0]?.name)
                      .filter(Boolean)
                  )
                );

                return (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                      فلترة حسب المتجر / التاجر:
                    </label>
                    <select
                      value={reportStoreFilter}
                      onChange={e => setReportStoreFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500"
                    >
                      <option value="all">🏪 كافة المتاجر والتجار</option>
                      {uniqueStores.map(storeName => (
                        <option key={storeName} value={storeName}>
                          {storeName}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}
            </div>

            {/* Calculations & Filtered Data */}
            {(() => {
              const now = new Date();
              const filtered = history.filter(o => {
                // Merchant filter
                if (reportStoreFilter !== 'all') {
                  const sName = o.storeName || o.pickupPoints?.[0]?.name;
                  if (sName !== reportStoreFilter) return false;
                }
                // Date filter
                const d = new Date(o.deliveredAt || o.updatedAt || o.createdAt);
                if (reportPeriod === 'today') {
                  return d.toDateString() === now.toDateString();
                }
                if (reportPeriod === 'yesterday') {
                  const y = new Date(now);
                  y.setDate(y.getDate() - 1);
                  return d.toDateString() === y.toDateString();
                }
                if (reportPeriod === 'week') {
                  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
                  return d >= weekAgo;
                }
                if (reportPeriod === 'month') {
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }
                if (reportPeriod === 'custom') {
                  const s = new Date(reportStartDate);
                  s.setHours(0, 0, 0, 0);
                  const e = new Date(reportEndDate);
                  e.setHours(23, 59, 59, 999);
                  return d >= s && d <= e;
                }
                return true;
              });

              const deliveredCount = filtered.length;
              const cashCollected = filtered
                .filter(o => o.paymentMethod === 'cash')
                .reduce((acc, o) => acc + (o.amountToCollect ?? o.total ?? 0), 0);
              const onlineTotal = filtered
                .filter(o => o.paymentMethod !== 'cash')
                .reduce((acc, o) => acc + (o.total ?? 0), 0);
              const totalRevenue = cashCollected + onlineTotal;
              const courierEarnings = filtered.reduce((acc, o) => acc + (o.deliveryFee || 20), 0);
              const estimatedKm = Math.round(deliveredCount * 3.8 * 10) / 10;

              // Filter Pause Logs for the period
              const filteredPauseLogs = pauseLogs.filter(log => {
                const d = new Date(log.startTime);
                if (reportPeriod === 'today') return d.toDateString() === now.toDateString();
                if (reportPeriod === 'yesterday') {
                  const y = new Date(now);
                  y.setDate(y.getDate() - 1);
                  return d.toDateString() === y.toDateString();
                }
                if (reportPeriod === 'week') {
                  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
                  return d >= weekAgo;
                }
                if (reportPeriod === 'month') {
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }
                return true;
              });

              const totalPauseMinutes = filteredPauseLogs.reduce((acc, log) => {
                if (log.durationMinutes) return acc + log.durationMinutes;
                if (!log.endTime) {
                  const start = new Date(log.startTime).getTime();
                  return acc + Math.max(1, Math.round((Date.now() - start) / 60000));
                }
                return acc;
              }, 0);

              return (
                <div className="space-y-4">
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {/* Card 1: Delivered Orders */}
                    <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-bold">الطلبات المسلّمة</span>
                        <PackageCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                        {deliveredCount}
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold mt-0.5 block">
                        مكتملة بنجاح ✓
                      </span>
                    </div>

                    {/* Card 2: Cash Collected */}
                    <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-bold">كاش باليد (محصّل)</span>
                        <Banknote className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-lg sm:text-xl font-black font-mono text-emerald-800">
                        {money(cashCollected)}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        مبالغ نقدية للتسوية
                      </span>
                    </div>

                    {/* Card 3: Online Payments */}
                    <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-bold">مدفوع إلكترونياً</span>
                        <Smartphone className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="text-lg sm:text-xl font-black font-mono text-purple-900">
                        {money(onlineTotal)}
                      </div>
                      <span className="text-[10px] text-purple-700 mt-0.5 block">
                        إنستاباي وفيزا
                      </span>
                    </div>

                    {/* Card 4: Estimated Courier Earnings */}
                    <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-bold">أتعاب وعمولة التوصيل</span>
                        <TrendingUp className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="text-lg sm:text-xl font-black font-mono text-orange-600">
                        {money(courierEarnings)}
                      </div>
                      <span className="text-[10px] text-orange-700 font-bold mt-0.5 block">
                        مستحقات الكابتن
                      </span>
                    </div>

                    {/* Card 5: Estimated Distance */}
                    <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-bold">المسافة المقطوعة</span>
                        <Navigation className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-lg sm:text-xl font-black font-mono text-blue-900">
                        {estimatedKm} كم
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        تقدير مسار الرحلات
                      </span>
                    </div>

                    {/* Card 6: Average Delivery Time */}
                    <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-bold">متوسط وقت التوصيل</span>
                        <Clock className="w-4 h-4 text-teal-600" />
                      </div>
                      <div className="text-lg sm:text-xl font-black font-mono text-teal-900">
                        18 دقيقة
                      </div>
                      <span className="text-[10px] text-teal-700 font-bold mt-0.5 block">
                        سرعة التوصيل ⚡
                      </span>
                    </div>
                  </div>

                  {/* Shifts & Breaks Tracking Section (أوقات الإيقاف والاستراحة) */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                          <Coffee className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs sm:text-sm font-bold font-heading text-slate-900">
                            سجل أوقات الإيقاف والاستراحة (الشفت)
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            توثيق فترات التوقف والراحة وإجمالي ساعات الاستراحة
                          </p>
                        </div>
                      </div>

                      {/* Quick Shift Status Toggle Button */}
                      <button
                        type="button"
                        onClick={toggleDutyStatus}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                          profileData.courierStatus === 'active'
                            ? 'bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {profileData.courierStatus === 'active' ? (
                          <>
                            <Pause className="w-3.5 h-3.5 text-amber-700" />
                            <span>أخذ استراحة مؤقتة ☕</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-white" />
                            <span>إنهاء الاستراحة واستئناف العمل 🚴</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Total Pause Summary Badge */}
                    <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950">
                        إجمالي وقت الاستراحة في الفترة المحددة:
                      </span>
                      <span className="font-mono font-black text-sm text-amber-900 bg-white px-2.5 py-1 rounded-xl border border-amber-200">
                        {totalPauseMinutes >= 60
                          ? `${Math.floor(totalPauseMinutes / 60)} ساعة و ${totalPauseMinutes % 60} دقيقة`
                          : `${totalPauseMinutes} دقيقة`}
                      </span>
                    </div>

                    {/* Pause Logs Table */}
                    {filteredPauseLogs.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">
                        لم يتم تسجيل أي فترات توقف أو استراحة خلال هذه الفترة.
                      </p>
                    ) : (
                      <div className="border border-slate-200/80 rounded-2xl overflow-hidden text-xs">
                        <table className="w-full text-right divide-y divide-slate-100">
                          <thead className="bg-slate-50 text-slate-600 font-bold text-[11px]">
                            <tr>
                              <th className="p-2.5">بداية التوقف</th>
                              <th className="p-2.5">نهاية التوقف</th>
                              <th className="p-2.5">المدة</th>
                              <th className="p-2.5">الحالة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                            {filteredPauseLogs.map(log => {
                              const isOngoing = !log.endTime;
                              return (
                                <tr key={log.id} className="hover:bg-slate-50/80">
                                  <td className="p-2.5 font-mono text-[11px]">
                                    {new Date(log.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="p-2.5 font-mono text-[11px]">
                                    {log.endTime
                                      ? new Date(log.endTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                                      : 'مستمر الآن…'}
                                  </td>
                                  <td className="p-2.5 font-bold font-mono text-amber-800">
                                    {log.durationMinutes ? `${log.durationMinutes} دقيقة` : 'جارية الآن'}
                                  </td>
                                  <td className="p-2.5">
                                    {isOngoing ? (
                                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                                        في استراحة حالياً
                                      </span>
                                    ) : (
                                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        مكتملة
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Detailed Trips Breakdown List */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h3 className="text-xs sm:text-sm font-bold font-heading text-slate-900">
                        قائمة الطلبات المنجزة خلال الفترة ({filtered.length})
                      </h3>
                      <span className="font-mono font-bold text-xs text-slate-600">
                        إجمالي: {money(totalRevenue)}
                      </span>
                    </div>

                    {filtered.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        لا توجد طلبات مسلّمة تطابق الفلترة المحددة.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filtered.map(order => (
                          <div key={order.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900">
                                  #{order.orderNumber}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {order.storeName || 'متجر سنجوب'}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                {new Date(order.deliveredAt || order.updatedAt || order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} · {order.paymentMethod === 'cash' ? 'نقداً كاش' : 'دفع إلكتروني'}
                              </span>
                            </div>
                            <div className="text-left font-mono font-bold text-slate-900">
                              {money(order.total)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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

        {/* Modal / Sheet: Courier Notifications */}
        {isNotificationsOpen && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={() => setIsNotificationsOpen(false)}
          >
            <div
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[85vh] sm:max-h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-slate-900">
                      التنبيهات والإشعارات
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {unreadNotificationsCount > 0 ? `${unreadNotificationsCount} إشعار جديد` : 'كافة الإشعارات مقروءة'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {unreadNotificationsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsRead()}
                      className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      تحديد الكل كمقروء
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-3 overflow-y-auto divide-y divide-slate-100 flex-1">
                {notifications.length === 0 ? (
                  <div className="py-12 px-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <Inbox className="w-7 h-7" />
                    </div>
                    <p className="font-heading font-bold text-sm text-slate-700 mb-1">
                      لا توجد إشعارات حتى الآن
                    </p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      ستتلقى هنا تنبيهات فورية عند إسناد مهام جديدة، أو تحديث حالة الطلبات من المتجر والإدارة.
                    </p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.read) {
                          setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                        }
                        if (notif.orderId) {
                          setTab('active');
                          setIsNotificationsOpen(false);
                        }
                      }}
                      className={`p-3 rounded-2xl transition-all cursor-pointer flex gap-3 ${
                        !notif.read ? 'bg-orange-50/60 hover:bg-orange-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${
                        !notif.read ? 'bg-orange-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {notif.type === 'order' ? <Bike className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4 className={`text-xs font-heading font-bold truncate ${
                            !notif.read ? 'text-slate-900' : 'text-slate-700'
                          }`}>
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                          {notif.body}
                        </p>
                      </div>

                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-orange-600 mt-2 shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  إغلاق التنبيهات
                </button>
              </div>
            </div>
          </div>
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
