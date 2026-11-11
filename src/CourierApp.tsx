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
import { getCuratedProductImageSync } from './utils/productImageFinder';
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
  Printer,
  ChevronRight,
  Trash2,
  Home,
  MoreHorizontal
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

export function toEnglishDigits(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val);
  return str
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u200e\u200f]/g, '');
}

export const toArabicDigits = toEnglishDigits;

export function formatDateTimeEnglish(dateVal?: string | number | Date | null): string {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const datePart = toEnglishDigits(d.toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', year: 'numeric', month: 'numeric', day: 'numeric' }));
  const timePart = toEnglishDigits(d.toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' }));
  return `${datePart} · ${timePart}`;
}

export function formatTimeEnglish(dateVal?: string | number | Date | null): string {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return toEnglishDigits(d.toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' }));
}

function getItemImg(item: any, cache?: Record<string, string>): string {
  const pId = item?.product?.id || item?.product_id;
  if (pId && cache && cache[pId]) {
    return cache[pId];
  }
  const directImg = item?.product?.imageUrl || item?.imageUrl || item?.image_url || item?.image;
  // If the direct image is the generic supermarket aisle unsplash image, prefer curated image
  if (directImg && !directImg.includes('photo-1542838132-92c53300491e') && !directImg.includes('photo-1578916171728')) {
    return directImg;
  }
  return getCuratedProductImageSync(item?.product?.name || item?.name || item?.product_name || '');
}

function ReceiptCameraModal({
  isOpen,
  orderId,
  orderNumber,
  onClose,
  onCapture,
}: {
  isOpen: boolean;
  orderId: string;
  orderNumber?: string;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loadingCamera, setLoadingCamera] = useState(true);
  const fileFallbackRef = useRef<HTMLInputElement>(null);
  const galleryFallbackRef = useRef<HTMLInputElement>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedImage(null);
      setCameraError(null);
      return;
    }

    let active = true;
    setLoadingCamera(true);
    setCameraError(null);
    setCapturedImage(null);

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('الكاميرا المباشرة غير مدعومة في هذا المتصفح');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setLoadingCamera(false);
      } catch (err: any) {
        if (!active) return;
        setLoadingCamera(false);
        setCameraError(err.message || 'تعذر الوصول إلى الكاميرا. يرجى السماح بصلاحية الكاميرا.');
      }
    };

    void startCamera();

    return () => {
      active = false;
      stopStream();
    };
  }, [isOpen]);

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopStream();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setLoadingCamera(true);
    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    }).then((stream) => {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play();
      }
      setLoadingCamera(false);
    }).catch((err) => {
      setLoadingCamera(false);
      setCameraError(err.message || 'تعذر إعادة فتح الكاميرا');
    });
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        onCapture(ev.target.result);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between p-3 sm:p-5 backdrop-blur-xs select-none font-['Cairo',sans-serif]" dir="rtl">
      {/* Top Header */}
      <div className="flex items-center justify-between text-white z-10 px-2 py-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-sm">
            📷
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base">تصوير إيصال التحويل (شاشة العميل)</h3>
            <p className="text-[11px] text-gray-300">طلب #{orderNumber || orderId.slice(0, 8)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Viewfinder Area */}
      <div className="relative flex-1 my-2 rounded-2xl overflow-hidden bg-black flex items-center justify-center border-2 border-white/20">
        {capturedImage ? (
          <img src={capturedImage} alt="لقطة الإيصال" className="w-full h-full object-contain" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
            {/* Target Alignment Scanner Frame */}
            <div className="absolute inset-6 sm:inset-12 border-2 border-purple-400 rounded-2xl pointer-events-none flex flex-col justify-between p-3 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-center text-purple-300 text-[10px] font-bold">
                <span>زاوية الشاشة</span>
                <span>إشعار التحويل</span>
              </div>
              <p className="text-center text-xs font-bold text-white bg-black/60 px-3 py-1 rounded-full self-center">
                وجه الكاميرا نحو شاشة موبايل العميل
              </p>
              <div className="flex justify-between items-center text-purple-300 text-[10px] font-bold">
                <span>المبلغ ورقم العملية</span>
                <span>تأكيد الاستلام</span>
              </div>
            </div>
          </>
        )}

        {loadingCamera && !capturedImage && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white gap-2">
            <RotateCw className="w-8 h-8 animate-spin text-purple-500" />
            <p className="text-xs font-bold">جارٍ تشغيل الكاميرا الخلفية…</p>
          </div>
        )}

        {cameraError && !capturedImage && (
          <div className="absolute inset-0 bg-black/90 p-5 flex flex-col items-center justify-center text-center text-white space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-500" />
            <p className="text-xs font-bold text-amber-200">{cameraError}</p>
            <p className="text-[11px] text-gray-400">يمكنك استخدام الكاميرا القياسية أو اختيار لقطة شاشة من الاستوديو</p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => fileFallbackRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>التقاط بالكاميرا القياسية 📸</span>
              </button>
              <button
                type="button"
                onClick={() => galleryFallbackRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold cursor-pointer flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>المعرض 📁</span>
              </button>
            </div>
            <input
              type="file"
              ref={fileFallbackRef}
              accept="image/*"
              capture="environment"
              onChange={handleFallbackFile}
              className="hidden"
            />
            <input
              type="file"
              ref={galleryFallbackRef}
              accept="image/*"
              onChange={handleFallbackFile}
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-center gap-3 p-2 z-10 flex-wrap">
        {capturedImage ? (
          <>
            <button
              type="button"
              onClick={handleRetake}
              className="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition"
            >
              <RotateCw className="w-4 h-4" />
              <span>إعادة التصوير 🔄</span>
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center gap-2 shadow-lg cursor-pointer transition"
            >
              <Check className="w-4 h-4" />
              <span>تأكيد واستخدام الإيصال ✓</span>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-4">
            <label className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition">
              <Upload className="w-4 h-4 text-purple-400" />
              <span>الاستوديو</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFallbackFile}
                className="hidden"
              />
            </label>

            <button
              type="button"
              disabled={loadingCamera || Boolean(cameraError)}
              onClick={handleCaptureFrame}
              className="w-16 h-16 rounded-full bg-white border-4 border-purple-500 hover:bg-purple-50 active:scale-95 shadow-xl flex items-center justify-center text-purple-600 cursor-pointer disabled:opacity-50 transition"
              title="التقاط الصورة الآن"
            >
              <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white">
                <Camera className="w-6 h-6" />
              </div>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-bold cursor-pointer transition"
            >
              إلغاء
            </button>
          </div>
        )}
      </div>
    </div>
  );
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

  // Selected order for full Screen 2 details & Screen 3 payment proof
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showPaymentProofOrderId, setShowPaymentProofOrderId] = useState<string | null>(null);
  const [receiptNotes, setReceiptNotes] = useState<Record<string, string>>({});

  // InstaPay & Wallets receipt capture state
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [uploadingReceipt, setUploadingReceipt] = useState<Record<string, boolean>>({});
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [activeCameraOrderId, setActiveCameraOrderId] = useState<string | null>(null);

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

  // Dynamic product image cache directly resolved from Supabase products table
  const [productImagesCache, setProductImagesCache] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!feed.items || feed.items.length === 0) return;
    const missingProductIds = new Set<string>();
    for (const order of feed.items) {
      for (const item of order.items || []) {
        const pId = item?.product?.id || item?.product_id;
        if (pId && !productImagesCache[pId]) {
          missingProductIds.add(pId);
        }
      }
    }
    if (missingProductIds.size === 0) return;

    let active = true;
    supabase
      .from('products')
      .select('id, image_url')
      .in('id', Array.from(missingProductIds))
      .then(({ data }) => {
        if (!active || !data || data.length === 0) return;
        const updates: Record<string, string> = {};
        for (const row of data) {
          if (row.id && row.image_url) {
            updates[row.id] = row.image_url;
          }
        }
        if (Object.keys(updates).length > 0) {
          setProductImagesCache(prev => ({ ...prev, ...updates }));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [feed.items, productImagesCache]);

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

  const verifiedCourierId = useRef('');

  useEffect(() => {
    let active = true;

    async function checkCourier(user: any) {
      if (!user) {
        verifiedCourierId.current = '';
        if (active) {
          setUid(undefined);
          setCurrentEmail('');
          setAccess('login');
        }
        return;
      }

      const userId = user.id || user.uid;
      // If courier was already verified for this user id, DO NOT flicker or set access to 'checking'
      if (verifiedCourierId.current && verifiedCourierId.current === userId) {
        if (active) {
          setUid(userId);
          setCurrentEmail(user.email || '');
          setAccess(prev => (prev === 'courier' ? prev : 'courier'));
        }
        return;
      }

      if (active) {
        setUid(userId);
        setCurrentEmail(user.email || '');
        setAccess('checking');
      }

      try {
        const authority = await operationsApi('operations', { action: 'profile' });
        if (authority.role === 'courier') {
          if (active) {
            verifiedCourierId.current = userId;
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
          verifiedCourierId.current = '';
          setAccessMessage('هذا الحساب ليس مسجلاً كمندوب توصيل. اطلب من الإدارة تفعيل رتبة المندوب لحسابك.');
          setAccess('denied');
        }
      } catch (e) {
        if (active) {
          if (verifiedCourierId.current && verifiedCourierId.current === userId) {
            // Already verified; maintain session despite transient network hiccup
            return;
          }
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        verifiedCourierId.current = '';
        setUid(undefined);
        setCurrentEmail('');
        setAccess('login');
        return;
      }
      if (session?.user) {
        // Fast-path: if already verified for this user, do nothing and stay in courier view
        if (verifiedCourierId.current && verifiedCourierId.current === session.user.id) {
          setUid(session.user.id);
          setCurrentEmail(session.user.email || '');
          return;
        }
        checkCourier(session.user);
      } else {
        setAccess('login');
      }
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

  const money = (n: number | string | undefined | null) => {
    if (n === undefined || n === null || n === '') return '0.00 ج.م';
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00 ج.م';
    const str = String(n);
    let formatted: string;
    if (str.includes('.')) {
      const parts = str.split('.');
      const decimals = parts[1] || '';
      formatted = decimals.length < 2 ? num.toFixed(2) : `${parts[0]}.${decimals}`;
    } else {
      formatted = num.toFixed(2);
    }
    return `${toEnglishDigits(formatted)} ج.م`;
  };

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

  // Helper to compress camera and file images for fast upload
  async function compressImageToDataUrl(fileOrBlob: File | Blob, maxWidth = 1280, maxHeight = 1280, quality = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(typeof reader.result === 'string' ? reader.result : '');
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        img.src = typeof e.target?.result === 'string' ? e.target.result : '';
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    });
  }

  // Unified process and save receipt for InstaPay / Wallets
  async function processAndSaveReceipt(orderId: string, fileOrDataUrl: File | Blob | string) {
    setUploadingReceipt(prev => ({ ...prev, [orderId]: true }));
    try {
      let dataUrl: string;
      if (typeof fileOrDataUrl === 'string') {
        dataUrl = fileOrDataUrl;
      } else {
        dataUrl = await compressImageToDataUrl(fileOrDataUrl);
      }
      setReceipts(prev => ({ ...prev, [orderId]: dataUrl }));
      await operationsApi('operations', {
        action: 'upload-receipt',
        orderId,
        receiptUrl: dataUrl
      });
      // Also refresh active feed so all parties see it
      void feed.refresh();
    } catch (err) {
      console.warn('Failed to upload receipt:', err);
      alert('تعذر حفظ صورة الإيصال، يرجى المحاولة مرة أخرى.');
    } finally {
      setUploadingReceipt(prev => ({ ...prev, [orderId]: false }));
    }
  }

  // Handle Receipt Upload via file picker
  async function handleReceiptUpload(orderId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
      return;
    }
    e.target.value = '';
    await processAndSaveReceipt(orderId, file);
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

  // Active Courier View — Sangoub v2 Design
  // Stats derived from live feed
  const todayCompleted = (() => {
    try {
      const today = new Date().toDateString();
      return (typeof window !== 'undefined' && localStorage.getItem(`sangoub_today_delivered_${uid}`))
        ? parseInt(localStorage.getItem(`sangoub_today_delivered_${uid}`) || '0', 10)
        : 0;
    } catch { return 0; }
  })();
  const activeOrders = feed.items.filter(o => o.orderStatus === 'with_courier').length;
  const readyOrders = feed.items.filter(o => o.orderStatus === 'ready' || o.orderStatus === 'preparing' || o.orderStatus === 'received').length;

  // Elapsed time helper
  function elapsedLabel(ts?: string): string {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1) return 'الآن';
    if (diff < 60) return `منذ ${toArabicDigits(diff)} دقيقة`;
    return `منذ ${toArabicDigits(Math.floor(diff / 60))} ساعة`;
  }

  return (
    <main className="courier-app-root min-h-screen bg-gray-50 pb-24" dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif" }}>

      {/* ═══ HEADER — dark navy ═══ */}
      <header className="sticky top-0 z-40" style={{ background: '#101A31' }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                src="/assets/sangoub/mascot-delivery.png"
                alt="سنجوب كابتن"
                className="w-11 h-11 object-contain drop-shadow-md transition-transform active:scale-95"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/brand/capital-talabat-mascot-logo-128x128.png';
                }}
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#101A31] ${
                  !feed.online ? 'bg-rose-500' : feed.live ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
                title={!feed.online ? 'غير متصل' : feed.live ? 'متصل لحظياً' : 'جارٍ الاتصال'}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-white font-black text-lg tracking-tight leading-none" style={{ fontFamily: "'Cairo', sans-serif" }}>
                  سنجوب
                </h1>
                <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-xs leading-none">
                  كابتن
                </span>
              </div>
              <p className="text-white/60 text-[11px] font-medium mt-1 leading-none">
                لوحة المندوب
              </p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* PWA Update */}
            <button
              type="button"
              onClick={() => void triggerPwaUpdate()}
              title="تحديث"
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(v => !v)}
              className="relative p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-orange-500 text-white font-black text-[10px] flex items-center justify-center px-1 shadow-xs">
                  {unreadNotificationsCount > 9 ? '9+' : toEnglishDigits(unreadNotificationsCount)}
                </span>
              )}
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              title="خروج"
              className="p-2 rounded-xl text-white/60 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="max-w-md mx-auto px-4 pb-3 grid grid-cols-3 gap-2">
          <div className="bg-white/10 rounded-2xl p-2.5 text-center border border-white/10">
            <div className="text-white font-black text-lg leading-none" style={{ fontFamily: "'Cairo', sans-serif" }}>
              {toArabicDigits(todayCompleted)}
            </div>
            <div className="text-white/60 text-[10px] mt-0.5">اليوم</div>
            <div className="text-white/50 text-[9px]">طلبات مكتملة</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-2.5 text-center border border-white/10">
            <div className="text-emerald-400 font-black text-lg leading-none" style={{ fontFamily: "'Cairo', sans-serif" }}>
              {toArabicDigits(activeOrders)}
            </div>
            <div className="text-white/60 text-[10px] mt-0.5">جارٍ</div>
            <div className="text-white/50 text-[9px]">طلبات جارية</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-2.5 text-center border border-white/10">
            <div className="text-blue-400 font-black text-lg leading-none" style={{ fontFamily: "'Cairo', sans-serif" }}>
              {toArabicDigits(readyOrders)}
            </div>
            <div className="text-white/60 text-[10px] mt-0.5">قادم</div>
            <div className="text-white/50 text-[9px]">طلب قادم</div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-md mx-auto px-3 pt-4">
        {/* Hidden 4-Way Tab Switcher — kept for functionality */}
        <nav className="sr-only" aria-label="تبويبات كابتن سنجوب">
          <button type="button" aria-pressed={tab === 'active'} onClick={() => setTab('active')}>الرئيسية</button>
          <button type="button" aria-pressed={tab === 'history'} onClick={() => { setTab('history'); if (!historyLoaded) void historyPage(true); }}>السجل</button>
          <button type="button" aria-pressed={tab === 'reports'} onClick={() => { setTab('reports'); if (!historyLoaded) void historyPage(true); }}>التقارير</button>
          <button type="button" aria-pressed={tab === 'profile'} onClick={() => setTab('profile')}>ملفي</button>
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

        {/* Tab 1: Active Tasks (Sangoub v2 Mobile Design) */}
        {tab === 'active' && (
          <section className="space-y-4">
            {/* If an order is selected, show Screen 2: Order Details */}
            {selectedOrderId ? (() => {
              const order = feed.items.find(o => o.id === selectedOrderId);
              if (!order) {
                return (
                  <div className="bg-white rounded-3xl p-6 text-center border border-slate-200">
                    <p className="text-sm font-bold text-slate-700">لم يتم العثور على الطلب أو تم تسليمه.</p>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderId(null)}
                      className="mt-3 px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold"
                    >
                      العودة لقائمة الطلبات
                    </button>
                  </div>
                );
              }

              const isReady = order.orderStatus === 'ready';
              const isWithCourier = order.orderStatus === 'with_courier';
              const isCash = order.paymentMethod === 'cash';
              const isInstapay = order.paymentMethod === 'instapay' || order.paymentMethod === 'vodafone_cash' || order.paymentMethod === 'wallet';
              const isOnlineCard = order.paymentMethod === 'card' || order.paymentMethod === 'geidea';
              const amountToCollect = isCash ? (order.amountToCollect ?? order.total) : 0;
              const distEstimate = estimateDistance(order.storeCoordinates, order.coordinates);
              const currentReceipt = receipts[order.id] || order.receiptUrl;
              const cleanPhone = String(order.phone || '').replace(/\D/g, '');
              const waPhone = cleanPhone.startsWith('01') ? '2' + cleanPhone : cleanPhone;
              const custName = cleanCustomerName(order.profileName, order.phone);

              // If Screen 3 (Payment Proof) is active for this order
              if (showPaymentProofOrderId === order.id) {
                return (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Screen 3 Header */}
                    <div className="flex items-center gap-3 py-1">
                      <button
                        type="button"
                        onClick={() => setShowPaymentProofOrderId(null)}
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="رجوع"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <h2 className="text-base font-black text-slate-900" style={{ fontFamily: "'Cairo', sans-serif" }}>
                        إثبات الدفع
                      </h2>
                    </div>

                    {/* Blue Info Banner */}
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                        i
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-blue-950 mb-0.5" style={{ fontFamily: "'Cairo', sans-serif" }}>
                          طلب دفع إلكتروني عبر InstaPay
                        </h4>
                        <p className="text-[11px] text-blue-800">
                          يرجى رفع صورة الإيصال للتحقق من الدفع وتوثيق المعاملة
                        </p>
                      </div>
                    </div>

                    {/* Receipt Upload Card */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
                      <label className="block text-xs font-black text-slate-800" style={{ fontFamily: "'Cairo', sans-serif" }}>
                        صورة الإيصال
                      </label>

                      {currentReceipt ? (
                        <div className="space-y-3">
                          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center p-2">
                            <img
                              src={currentReceipt}
                              alt="صورة الإيصال"
                              className="max-h-72 w-full object-contain rounded-xl"
                            />
                            <div className="absolute top-4 right-4 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                              <Check className="w-4 h-4" />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setReceipts(prev => {
                                  const copy = { ...prev };
                                  delete copy[order.id];
                                  return copy;
                                });
                              }}
                              className="absolute bottom-4 left-4 p-2 bg-white/90 hover:bg-white text-rose-600 rounded-xl shadow-md flex items-center gap-1.5 text-xs font-bold transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>حذف</span>
                            </button>
                          </div>

                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-emerald-800 text-xs font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>تم رفع الصورة بنجاح ✓</span>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-slate-300 hover:border-orange-400 rounded-2xl p-6 text-center space-y-3 bg-slate-50/50 transition-colors">
                          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
                            <Camera className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800" style={{ fontFamily: "'Cairo', sans-serif" }}>
                              اضغط لالتقاط صورة
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              أو اختر من المعرض
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              (5MB الحد الأقصى - JPG, PNG)
                            </p>
                          </div>

                          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setActiveCameraOrderId(order.id)}
                              disabled={uploadingReceipt[order.id]}
                              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                            >
                              <Camera className="w-4 h-4" />
                              <span>التقاط بالكاميرا 📷</span>
                            </button>

                            <label className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs">
                              <Upload className="w-4 h-4 text-orange-500" />
                              <span>المعرض 📁</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={e => handleReceiptUpload(order.id, e)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Notes (Optional) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          ملاحظات (اختيارية)
                        </label>
                        <textarea
                          rows={2}
                          value={receiptNotes[order.id] || ''}
                          onChange={e => setReceiptNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="أضف أي ملاحظات..."
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all outline-hidden"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPaymentProofOrderId(null);
                          }}
                          className="py-3 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                          style={{ background: '#101A31' }}
                        >
                          <Navigation className="w-4 h-4 text-orange-400" />
                          <span>إرسال للمراجعة 📍</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowPaymentProofOrderId(null)}
                          className="py-3 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Normal Screen 2 (Order Details)
              return (
                <div className="space-y-4 animate-in fade-in duration-200 pb-6">
                  {/* Screen 2 Top Header */}
                  <div className="flex items-center justify-between py-1">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderId(null)}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    <div className="text-center">
                      <h2 className="text-sm font-black text-slate-900 leading-tight" style={{ fontFamily: "'Cairo', sans-serif" }}>
                        تفاصيل الطلب
                      </h2>
                      <span className="text-xs text-slate-500 font-mono">#{order.orderNumber}</span>
                    </div>

                    <div className="w-9" /> {/* Spacer */}
                  </div>

                  {/* Status Banner */}
                  <div className={`p-4 rounded-3xl border flex items-center justify-between gap-3 shadow-2xs ${
                    isWithCourier
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : isReady
                      ? 'bg-orange-50 border-orange-200 text-orange-950'
                      : 'bg-blue-50 border-blue-200 text-blue-950'
                  }`}>
                    <div>
                      <h3 className="text-sm font-black" style={{ fontFamily: "'Cairo', sans-serif" }}>
                        {isWithCourier ? 'في طريقه للتوصيل' : isReady ? 'جاهز للاستلام من المتجر' : 'قيد التجهيز'}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {distEstimate ? `متوقع الوصول خلال ${distEstimate.durationMin} دقيقة` : 'مسار التوصيل متاح الآن'}
                      </p>
                    </div>
                    <div className="text-3xl shrink-0">
                      🛵
                    </div>
                  </div>

                  {/* Customer Quick Call Card */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-4 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 border border-slate-200">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                          {custName}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5" dir="ltr">
                          {cleanPhone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {order.phone && (
                        <a
                          href={`tel:${cleanPhone}`}
                          className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>اتصال</span>
                        </a>
                      )}
                      {waPhone && (
                        <a
                          href={`https://wa.me/${waPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                          title="واتساب"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Interactive Map View */}
                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 flex items-center gap-1.5" style={{ fontFamily: "'Cairo', sans-serif" }}>
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span>موقع المندوب والعميل الآن</span>
                      </span>
                      {distEstimate && (
                        <span className="text-[11px] font-bold text-slate-500">
                          {distEstimate.distanceKm} كم · ~{distEstimate.durationMin} دقيقة
                        </span>
                      )}
                    </div>
                    <div className="p-2">
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
                  </div>

                  {/* Customer Information Card */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-2.5 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-900 pb-2 border-b border-slate-100" style={{ fontFamily: "'Cairo', sans-serif" }}>
                      <User className="w-4 h-4 text-slate-500" />
                      <span>معلومات العميل</span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-slate-400">الاسم:</span>
                        <span className="font-bold text-slate-900">{custName}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-slate-400">رقم الهاتف:</span>
                        <span className="font-mono font-bold text-slate-900" dir="ltr">{cleanPhone}</span>
                      </div>
                      <div className="flex items-start justify-between text-slate-700 gap-2">
                        <span className="text-slate-400 shrink-0">العنوان:</span>
                        <span className="font-medium text-slate-900 text-left">
                          {order.deliveryAddress || order.ministry || 'العاصمة الإدارية وكافة المناطق'}
                          {order.floorNumber && order.floorNumber !== 'غير محدد' ? ` — الدور ${order.floorNumber}` : ''}
                          {order.roomNumber && order.roomNumber !== 'غير محدد' ? ` — شقة ${order.roomNumber}` : ''}
                        </span>
                      </div>
                      {order.notes && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed mt-1">
                          <strong>ملاحظة العميل: </strong>{order.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Products List (Screen 2) */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-900" style={{ fontFamily: "'Cairo', sans-serif" }}>
                        <ShoppingBag className="w-4 h-4 text-orange-500" />
                        <span>المنتجات ({toArabicDigits(order.items?.length || 0)} قطع)</span>
                      </div>
                    </div>

                    <ul className="divide-y divide-slate-100">
                      {(order.items || []).map((item: any, i: number) => (
                        <li key={item.id || i} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {getItemImg(item, productImagesCache) ? (
                              <img
                                src={getItemImg(item, productImagesCache)}
                                alt={item.product?.name || item.name}
                                className="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0 shadow-2xs"
                                onError={(e) => {
                                  // Fallback to curated image if URL fails to load
                                  (e.target as HTMLImageElement).src = getCuratedProductImageSync(item.product?.name || item.name);
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                <ShoppingBag className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-slate-900 truncate">
                                {item.product?.name}
                              </h5>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {toArabicDigits(item.quantity)} × {money(item.product?.price || 0)}
                              </p>
                              {item.selectedOptions && Object.values(item.selectedOptions).length > 0 && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {Object.values(item.selectedOptions).join(' - ')}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-xs font-black text-slate-900 shrink-0" style={{ fontFamily: "'Cairo', sans-serif" }}>
                            {money((item.product?.price || 0) * (item.quantity || 1))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Financial Summary Card */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-2 shadow-2xs text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>إجمالي المنتجات</span>
                      <span className="font-bold text-slate-900" style={{ fontFamily: "'Cairo', sans-serif" }}>{money(order.subtotal || Math.max(0, order.total - (order.deliveryFee || 0)))}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>رسوم التوصيل</span>
                      <span className="font-bold text-slate-900" style={{ fontFamily: "'Cairo', sans-serif" }}>{money(order.deliveryFee || 0)}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>الخصم</span>
                        <span className="font-bold text-emerald-700" style={{ fontFamily: "'Cairo', sans-serif" }}>- {money(order.discount)}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="font-black text-slate-900 text-sm" style={{ fontFamily: "'Cairo', sans-serif" }}>
                        الإجمالي النهائي
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-black" style={{ fontFamily: "'Cairo', sans-serif" }}>
                        {money(order.total)}
                      </span>
                    </div>
                  </div>

                  {/* InstaPay Proof of Payment Entry (if electronic) */}
                  {isInstapay && (
                    <div className="bg-purple-50 border border-purple-200 rounded-3xl p-4 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-purple-950" style={{ fontFamily: "'Cairo', sans-serif" }}>
                            إثبات الدفع (InstaPay)
                          </h4>
                          <p className="text-[11px] text-purple-700">
                            {currentReceipt ? '✓ تم رفع صورة الإيصال' : 'مطلوب رفع صورة الإيصال للتحقق'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowPaymentProofOrderId(order.id)}
                        className="px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                      >
                        {currentReceipt ? 'معاينة / تعديل' : 'إرفاق إيصال 📷'}
                      </button>
                    </div>
                  )}

                  {/* Actions by status */}
                  {isReady && (
                    <div className="space-y-3 pt-2">
                      <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 has-checked:border-orange-300 has-checked:bg-orange-50/30 rounded-2xl cursor-pointer select-none transition-colors">
                        <input
                          type="checkbox"
                          checked={!!confirmed[order.id]}
                          onChange={e => setConfirmed(v => ({ ...v, [order.id]: e.target.checked }))}
                          className="w-5 h-5 rounded accent-orange-500 shrink-0 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          راجعت وطابقت الأصناف والكميات عند الاستلام من المحل
                        </span>
                      </label>

                      {!order.received ? (
                        <button
                          type="button"
                          disabled={!feed.online || !!feed.error || !!pending || !confirmed[order.id]}
                          onClick={() => void act(order, 'courier-pickup')}
                          className="w-full py-3.5 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                          style={{ fontFamily: "'Cairo', sans-serif" }}
                        >
                          <PackageCheck className="w-5 h-5" />
                          <span>{pending === order.id ? 'جارٍ التأكيد…' : 'تأكيد استلام الطلب من المحل'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!feed.online || !!feed.error || !!pending}
                          onClick={() => void act(order, 'courier-depart')}
                          className="w-full py-3.5 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                          style={{ fontFamily: "'Cairo', sans-serif" }}
                        >
                          <Bike className="w-4 h-4" />
                          <span>{pending === order.id ? 'جارٍ الانطلاق…' : 'بدء التوصيل والانطلاق للعميل'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {isWithCourier && (
                    <div className="space-y-3 pt-2">
                      {/* OTP Box */}
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-1.5 text-amber-900 font-bold text-xs">
                          <KeyRound className="w-4 h-4 text-amber-600" />
                          <span>كود الاستلام من العميل (OTP)</span>
                        </div>
                        <p className="text-xs text-amber-800 mb-3">
                          اطلب كود التأكيد المكوّن من 4 أرقام من العميل:
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
                          className="courier-otp-input w-full text-center text-2xl font-black py-2.5 rounded-xl border-2 border-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 bg-white text-slate-900 shadow-inner"
                        />
                      </div>

                      {/* Cash/Collection Checkbox */}
                      <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 has-checked:border-emerald-300 has-checked:bg-emerald-50/30 rounded-2xl cursor-pointer select-none transition-colors">
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
                            ? 'أؤكد مطابقة تحويل إنستاباي وتسليم الأوردر للعميل'
                            : 'أؤكد تسليم الأوردر كاملاً للعميل'}
                        </span>
                      </label>

                      {/* Prominent Orange CTA Button (matching Screen 2) */}
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
                        className="w-full py-4 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-black text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                        style={{ fontFamily: "'Cairo', sans-serif" }}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>{pending === order.id ? 'جارٍ التحقق وتأكيد التسليم…' : 'تأكيد التسليم ✓'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })() : (
              /* Screen 1: Order Cards List */
              <>
                {/* Section Header */}
                <div className="flex items-center justify-between gap-2 px-1 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900" style={{ fontFamily: "'Cairo', sans-serif" }}>
                      طلباتي الحالية
                    </span>
                    {feed.items.length > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-orange-500 text-white text-xs font-black px-1.5">
                        {toArabicDigits(feed.items.length)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void feed.refresh()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition-all cursor-pointer"
                  >
                    <RotateCw className={`w-3.5 h-3.5 text-orange-500 ${feed.loading ? 'animate-spin' : ''}`} />
                    <span>تحديث</span>
                  </button>
                </div>

                {feed.loading ? (
                  <LoadingState message="جارٍ تحديث مهام التوصيل…" />
                ) : !feed.items.length ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-xs">
                    <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-4">
                      <PackageCheck className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1" style={{ fontFamily: "'Cairo', sans-serif" }}>
                      لا توجد مهام نشطة حالياً
                    </h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto mb-5 leading-relaxed">
                      أنت متاح وجاهز! ستظهر مهامك هنا تلقائياً فور تكليفك بأي طلب من المتجر أو الإدارة.
                    </p>
                    <button
                      type="button"
                      onClick={() => void feed.refresh()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>فحص المهام الجديدة</span>
                    </button>
                  </div>
                ) : (
                  feed.items.map(order => {
                    const isWithCourier = order.orderStatus === 'with_courier';
                    const isReady = order.orderStatus === 'ready';

                    // Status badge style per mockup
                    const statusBadge = (() => {
                      if (order.orderStatus === 'with_courier') return { cls: 'bg-emerald-100 text-emerald-800', label: 'في الطريق' };
                      if (order.orderStatus === 'ready') return { cls: 'bg-blue-100 text-blue-800', label: 'للتجهيز' };
                      if (order.orderStatus === 'preparing') return { cls: 'bg-amber-100 text-amber-800', label: 'جارٍ' };
                      if (order.orderStatus === 'delivered') return { cls: 'bg-gray-100 text-gray-600', label: 'مكتمل' };
                      return { cls: 'bg-slate-100 text-slate-700', label: order.orderStatus };
                    })();

                    const thumbItems = (order.items || []).slice(0, 4);
                    const thumbOverflow = Math.max(0, (order.items?.length || 0) - 4);
                    const custName = cleanCustomerName(order.profileName, order.phone);
                    const mapsUrl = (order.coordinates?.latitude && order.coordinates?.longitude)
                      ? `https://www.google.com/maps/dir/?api=1&destination=${order.coordinates.latitude},${order.coordinates.longitude}`
                      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([order.deliveryAddress || order.ministry, 'مصر'].filter(Boolean).join(', '))}`;

                    return (
                      <article
                        key={order.id}
                        className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition-all hover:shadow-md"
                      >
                        <div className="p-4 space-y-3">
                          {/* Top Row: Status badge + Order Number + Elapsed time */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${statusBadge.cls}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                              {statusBadge.label}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-sm text-slate-900" style={{ fontFamily: "'Cairo', sans-serif" }}>
                                #{order.orderNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyOrderNumber(order.orderNumber, order.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title="نسخ رقم الطلب"
                              >
                                {copiedId === order.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0 font-medium">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {elapsedLabel(order.createdAt)}
                            </span>
                          </div>

                          {/* Customer Name & Price Row */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <User className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="text-sm font-bold text-slate-900 truncate">
                                {custName}
                              </span>
                            </div>

                            <div className="text-left shrink-0">
                              <span className="text-base sm:text-lg font-black text-emerald-700" style={{ fontFamily: "'Cairo', sans-serif" }}>
                                {money(order.total)}
                              </span>
                            </div>
                          </div>

                          {/* Address Row */}
                          <div className="flex items-start gap-1.5 text-xs text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="truncate leading-snug">
                              {order.deliveryAddress || order.ministry || 'العاصمة الإدارية وكافة المناطق'}
                              {order.district ? ` — ${order.district}` : ''}
                            </span>
                          </div>

                          {/* Product Thumbnails Row */}
                          <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
                            {thumbItems.map((item: any, i: number) => {
                              const img = getItemImg(item, productImagesCache);
                              return img ? (
                                <img
                                  key={i}
                                  src={img}
                                  alt={item.product?.name || item.name}
                                  className="w-10 h-10 rounded-xl object-cover border border-slate-100 shadow-2xs shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = getCuratedProductImageSync(item.product?.name || item.name);
                                  }}
                                />
                              ) : (
                                <div key={i} className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                  <ShoppingBag className="w-4 h-4" />
                                </div>
                              );
                            })}

                            {thumbOverflow > 0 && (
                              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-600 shrink-0" style={{ fontFamily: "'Cairo', sans-serif" }}>
                                +{toArabicDigits(thumbOverflow)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Bottom Actions */}
                        <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl font-bold text-xs text-white shadow-sm transition-all cursor-pointer"
                            style={{ background: '#101A31' }}
                          >
                            <Navigation className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <span>متابعة التوصيل 📍</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => setSelectedOrderId(order.id)}
                            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 font-bold text-xs text-slate-800 transition-all cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>عرض التفاصيل 👁️</span>
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}

                {feed.truncated && (
                  <p className="text-xs text-slate-500 text-center py-2" role="status">
                    تعرض أول 50 مهمة فقط.
                  </p>
                )}
              </>
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
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {formatDateTimeEnglish(deliveredTime)}
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
                                  <td className="p-2.5 text-[11px]">
                                    {formatTimeEnglish(log.startTime)}
                                  </td>
                                  <td className="p-2.5 text-[11px]">
                                    {log.endTime
                                      ? formatTimeEnglish(log.endTime)
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
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {formatTimeEnglish(order.deliveredAt || order.updatedAt || order.createdAt)} · {order.paymentMethod === 'cash' ? 'نقداً كاش' : 'دفع إلكتروني'}
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
                            {notif.createdAt ? formatTimeEnglish(notif.createdAt) : ''}
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

        {/* Modal: Live Camera Shutter for Receipt Capture (Taking photo of customer screen) */}
        {activeCameraOrderId && (
          <ReceiptCameraModal
            isOpen={Boolean(activeCameraOrderId)}
            orderId={activeCameraOrderId}
            orderNumber={feed.items.find(o => o.id === activeCameraOrderId)?.orderNumber}
            onClose={() => setActiveCameraOrderId(null)}
            onCapture={(dataUrl) => {
              void processAndSaveReceipt(activeCameraOrderId, dataUrl);
              setActiveCameraOrderId(null);
            }}
          />
        )}

        {/* Mobile Footer */}
        <footer className="mt-8 pt-4 pb-8 border-t border-slate-200/60 text-center text-xs text-slate-400 flex items-center justify-center gap-4">
          <a href={BRAND.supportUrl} className="hover:text-orange-600 transition-colors">
            دعم كباتن سنجوب
          </a>
          <span>·</span>
          <a href="/" className="hover:text-slate-700 transition-colors">
            المتجر الرئيسي
          </a>
        </footer>
      </div>

      {/* ═══ SANGOUB V2 BOTTOM NAVIGATION BAR ═══ */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
        aria-label="شريط التنقل السفلي للكابتن"
      >
        <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-2">
          {/* 1: الرئيسية */}
          <button
            type="button"
            onClick={() => {
              setSelectedOrderId(null);
              setShowPaymentProofOrderId(null);
              setTab('active');
            }}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
              tab === 'active' && !selectedOrderId
                ? 'text-orange-500 font-black'
                : 'text-slate-400 hover:text-slate-700 font-bold'
            }`}
          >
            <Home className="w-5 h-5 shrink-0" />
            <span className="text-[11px]" style={{ fontFamily: "'Cairo', sans-serif" }}>
              الرئيسية
            </span>
          </button>

          {/* 2: طلباتي */}
          <button
            type="button"
            onClick={() => {
              setSelectedOrderId(null);
              setShowPaymentProofOrderId(null);
              setTab('history');
              if (!historyLoaded) void historyPage(true);
            }}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all cursor-pointer relative ${
              tab === 'history'
                ? 'text-orange-500 font-black'
                : 'text-slate-400 hover:text-slate-700 font-bold'
            }`}
          >
            <FileText className="w-5 h-5 shrink-0" />
            <span className="text-[11px]" style={{ fontFamily: "'Cairo', sans-serif" }}>
              طلباتي
            </span>
          </button>

          {/* 3: الملف الشخصي */}
          <button
            type="button"
            onClick={() => {
              setSelectedOrderId(null);
              setShowPaymentProofOrderId(null);
              setTab('profile');
            }}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
              tab === 'profile'
                ? 'text-orange-500 font-black'
                : 'text-slate-400 hover:text-slate-700 font-bold'
            }`}
          >
            <User className="w-5 h-5 shrink-0" />
            <span className="text-[11px]" style={{ fontFamily: "'Cairo', sans-serif" }}>
              الملف الشخصي
            </span>
          </button>

          {/* 4: المزيد */}
          <button
            type="button"
            onClick={() => {
              setSelectedOrderId(null);
              setShowPaymentProofOrderId(null);
              setTab('reports');
              if (!historyLoaded) void historyPage(true);
            }}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all cursor-pointer ${
              tab === 'reports'
                ? 'text-orange-500 font-black'
                : 'text-slate-400 hover:text-slate-700 font-bold'
            }`}
          >
            <MoreHorizontal className="w-5 h-5 shrink-0" />
            <span className="text-[11px]" style={{ fontFamily: "'Cairo', sans-serif" }}>
              المزيد
            </span>
          </button>
        </div>
      </nav>
    </main>
  );
}
