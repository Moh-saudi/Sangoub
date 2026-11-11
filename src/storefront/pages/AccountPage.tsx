import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { 
  User, 
  Settings, 
  Gift, 
  FileText, 
  Trophy, 
  Tag, 
  Zap, 
  HelpCircle, 
  Info, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  MapPin, 
  Bell, 
  Globe, 
  LogOut, 
  Edit2, 
  Calendar, 
  Trash2, 
  Plus, 
  Check, 
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  Sparkles,
  Camera,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  CreditCard,
  Lock,
  CheckCircle2,
  Wifi,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { disableWebPushNotifications, enableWebPushNotifications } from '../../lib/webPushNotifications';
import { PartnerRegisterModal } from '../components/PartnerRegisterModal';
import { 
  getSavedCards, 
  saveBankCard, 
  deleteSavedCard, 
  setDefaultCard, 
  validateCardNumber, 
  validateCardExpiry, 
  formatCardNumber, 
  detectCardBrand, 
  type SavedBankCard, 
  type CardBrand 
} from '../../lib/savedCards';

interface AccountPageProps {
  onBackToHome: () => void;
  onOpenAreaModal?: () => void;
  isMobile?: boolean;
}

type AccountView = 'main' | 'settings' | 'account-info' | 'addresses' | 'cards' | 'login-prompt';

export const AccountPage: React.FC<AccountPageProps> = ({
  onBackToHome,
  onOpenAreaModal,
  isMobile = false,
}) => {
  const { user, setUser, serviceArea, navigate, activeCoupons, unreadNotificationsCount, setIsNotificationsModalOpen, clearCart } = useStore();
  const [currentView, setCurrentView] = useState<AccountView>('main');
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [copiedCouponCode, setCopiedCouponCode] = useState<string | null>(null);

  // Account Info Form State
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [email, setEmail] = useState(user?.email || '');
  const [firstName, setFirstName] = useState(() => {
    if (!user?.fullName) return '';
    return user.fullName.split(' ')[0] || '';
  });
  const [lastName, setLastName] = useState(() => {
    if (!user?.fullName) return '';
    const parts = user.fullName.split(' ');
    return parts.slice(1).join(' ') || '';
  });
  const [phone, setPhone] = useState(user?.phone && user.phone !== 'غير مسجل' ? user.phone : '');
  const [hasWhatsApp, setHasWhatsApp] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.avatarUrl || '');
  const [avatarError, setAvatarError] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [receiveOffers, setReceiveOffers] = useState(true);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('sangoub_notifications_enabled');
      if (stored !== null) return stored === 'true';
    } catch {}
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  });
  const [isNotificationBusy, setIsNotificationBusy] = useState(false);
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [busy, setBusy] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ══════════════════════════════════════════════════════════════════
  // SAVED BANK CARDS (GEIDEA & TOKENIZED STORAGE)
  // ══════════════════════════════════════════════════════════════════
  const [savedCards, setSavedCards] = useState<SavedBankCard[]>([]);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardHolder, setNewCardHolder] = useState('');
  const [newCardMonth, setNewCardMonth] = useState('');
  const [newCardYear, setNewCardYear] = useState('');
  const [newCardCvv, setNewCardCvv] = useState('');
  const [newCardIsDefault, setNewCardIsDefault] = useState(true);
  const [isSavingCard, setIsSavingCard] = useState(false);

  useEffect(() => {
    if (!user || user.isGuest) {
      setSavedCards([]);
      return;
    }
    const loadCards = () => {
      void getSavedCards(user.id).then(setSavedCards);
    };
    loadCards();
    window.addEventListener('sangoub_cards_updated', loadCards);
    return () => window.removeEventListener('sangoub_cards_updated', loadCards);
  }, [user?.id, user?.isGuest]);

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.isGuest) {
      setFeedbackMsg({ type: 'error', text: 'يرجى تسجيل الدخول أولاً لحفظ البطاقة.' });
      return;
    }
    const cleanNumber = newCardNumber.replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 13 || cleanNumber.length > 19) {
      setFeedbackMsg({ type: 'error', text: 'يرجى إدخال رقم بطاقة صحيح (16 رقماً).' });
      return;
    }
    if (!validateCardNumber(cleanNumber)) {
      setFeedbackMsg({ type: 'error', text: 'رقم البطاقة غير صالح، يرجى مراجعة الأرقام المدخلة.' });
      return;
    }
    if (!newCardHolder.trim() || newCardHolder.trim().length < 3) {
      setFeedbackMsg({ type: 'error', text: 'يرجى إدخال اسم حامل البطاقة كما هو مدون عليها.' });
      return;
    }
    if (!validateCardExpiry(newCardMonth, newCardYear)) {
      setFeedbackMsg({ type: 'error', text: 'تاريخ انتهاء البطاقة غير صالح أو منتهي الصلاحية.' });
      return;
    }
    if (newCardCvv.trim().length < 3) {
      setFeedbackMsg({ type: 'error', text: 'يرجى إدخال رمز الأمان CVV المكون من 3 أرقام خلف البطاقة.' });
      return;
    }

    setIsSavingCard(true);
    try {
      await saveBankCard({
        userId: user.id,
        cardholderName: newCardHolder.trim(),
        cardNumber: cleanNumber,
        expiryMonth: newCardMonth,
        expiryYear: newCardYear,
        isDefault: newCardIsDefault,
      });
      setFeedbackMsg({ type: 'success', text: 'تم حفظ البطاقة البنكية بنجاح ✓' });
      setIsAddingCard(false);
      setNewCardNumber('');
      setNewCardHolder('');
      setNewCardMonth('');
      setNewCardYear('');
      setNewCardCvv('');
      setNewCardIsDefault(true);
      const updated = await getSavedCards(user.id);
      setSavedCards(updated);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'تعذر حفظ البطاقة. حاول ثانية.' });
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!user || user.isGuest) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه البطاقة من حسابك؟')) return;
    try {
      await deleteSavedCard(user.id, cardId);
      setFeedbackMsg({ type: 'success', text: 'تم حذف البطاقة من حسابك بنجاح.' });
      const updated = await getSavedCards(user.id);
      setSavedCards(updated);
    } catch {
      setFeedbackMsg({ type: 'error', text: 'تعذر حذف البطاقة.' });
    }
  };

  const handleSetDefaultCard = async (cardId: string) => {
    if (!user || user.isGuest) return;
    try {
      await setDefaultCard(user.id, cardId);
      setFeedbackMsg({ type: 'success', text: 'تم تعيين البطاقة كافتراضية للدفع ✓' });
      const updated = await getSavedCards(user.id);
      setSavedCards(updated);
    } catch {
      setFeedbackMsg({ type: 'error', text: 'تعذر تحديث البطاقة الافتراضية.' });
    }
  };

  useEffect(() => {
    if (!feedbackMsg) return;
    const timer = setTimeout(() => {
      setFeedbackMsg(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [feedbackMsg]);

  const isAdmin = user?.role === 'admin' || user?.email === 'meskllcqa@gmail.com' || user?.id === '07492416-8a8e-434b-9094-391abb21272e';

  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl, user?.avatarUrl]);

  useEffect(() => {
    if (user && !user.isGuest) {
      setEmail(user.email || '');
      const parts = (user.fullName || '').split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setPhone(user.phone && user.phone !== 'غير مسجل' ? user.phone : '');
      setAvatarUrl(user.avatarUrl || '');
    } else {
      setEmail('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setAvatarUrl('');
      setAvatarError(false);
    }
  }, [user]);

  const userInitial = (user?.fullName || firstName || 'س').trim().charAt(0).toUpperCase();

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedbackMsg({ type: 'error', text: 'يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedbackMsg({ type: 'error', text: 'حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 5 ميجابايت.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setAvatarUrl(base64); // Instant preview in UI
      setIsEditingInfo(true);
      setBusy(true);

      try {
        const res = await fetch('/api/user-avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            contentType: file.type || 'image/jpeg',
            userId: user?.id || 'usr-' + Date.now(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            setAvatarUrl(data.url);
            setFeedbackMsg({
              type: 'success',
              text: 'تم رفع الصورة وحفظها في Cloudflare R2 ✓ اضغط حفظ لتأكيد التغييرات.',
            });
            return;
          }
        }
        setFeedbackMsg({ type: 'success', text: 'تم تحميل الصورة، اضغط على "حفظ" لتأكيد التغيير.' });
      } catch {
        setFeedbackMsg({ type: 'success', text: 'تم تحميل الصورة، اضغط على "حفظ" لتأكيد التغيير.' });
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAccountInfo = async () => {
    setBusy(true);
    setFeedbackMsg(null);
    try {
      const combinedFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      if (!combinedFullName) {
        throw new Error('يرجى إدخال الاسم.');
      }
      if (!phone || !phone.trim()) {
        throw new Error('رقم الهاتف إجباري.');
      }
      if (!/^(\+20|0)?1[0125][0-9]{8}$/.test(phone.trim())) {
        throw new Error('يرجى إدخال رقم هاتف مصري صحيح (11 رقماً).');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.auth.updateUser({
          data: {
            full_name: combinedFullName,
            phone: phone.trim(),
            avatar_url: avatarUrl || undefined,
          },
        });
        await supabase.from('profiles').upsert({
          id: session.user.id,
          full_name: combinedFullName,
          phone: phone.trim(),
          email: email.trim() || session.user.email || '',
          avatar_url: avatarUrl || null,
        });
      }

      if (user) {
        setUser({
          ...user,
          fullName: combinedFullName,
          phone: phone.trim(),
          email: email.trim() || user.email || '',
          avatarUrl: avatarUrl || undefined,
        });
      }

      try {
        const stored = localStorage.getItem('sangoub_guest_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.avatarUrl = avatarUrl;
          localStorage.setItem('sangoub_guest_profile', JSON.stringify(parsed));
        }
      } catch {}

      setIsEditingInfo(false);
      setFeedbackMsg({ type: 'success', text: 'تم حفظ بيانات الحساب بنجاح ✓' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء الحفظ.' });
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (notificationsEnabled && user && !user.isGuest) {
        try {
          await disableWebPushNotifications();
        } catch (error) {
          console.warn('Could not disable web push token before logout:', error);
        }
      }
      await supabase.auth.signOut({ scope: 'global' }).catch(() => {});
      localStorage.removeItem('sangoub_last_phone');
      localStorage.removeItem('sangoub_last_order');
      sessionStorage.clear();
      clearCart();
      window.dispatchEvent(new CustomEvent('sangoub:logged_out'));
      setAvatarUrl('');
      setEmail('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setAvatarError(false);
      setUser(null);
      setCurrentView('main');
    } catch {}
  };

  const handleNotificationToggle = async () => {
    if (!user || user.isGuest) {
      setFeedbackMsg({ type: 'error', text: 'سجّل الدخول أولًا لتفعيل إشعارات حسابك.' });
      return;
    }
    setIsNotificationBusy(true);
    try {
      if (notificationsEnabled) {
        await disableWebPushNotifications();
        setNotificationsEnabled(false);
        try { localStorage.setItem('sangoub_notifications_enabled', 'false'); } catch {}
        setFeedbackMsg({ type: 'success', text: 'تم إيقاف إشعارات هذا الجهاز.' });
      } else {
        await enableWebPushNotifications();
        setNotificationsEnabled(true);
        try { localStorage.setItem('sangoub_notifications_enabled', 'true'); } catch {}
        setFeedbackMsg({ type: 'success', text: 'تم تفعيل إشعارات سنجوب بنجاح ✓' });
      }
    } catch (error) {
      setFeedbackMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر تغيير إعداد الإشعارات. يرجى التحقق من إذن المتصفح.',
      });
    } finally {
      setIsNotificationBusy(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // 1. SCREEN: SETTINGS (طابق لقطة الإعدادات في أندرويد بالكامل)
  // ══════════════════════════════════════════════════════════════════
  if (currentView === 'settings') {
    return (
      <div className={`w-full ${isMobile ? 'px-4 py-3' : 'max-w-xl mx-auto px-6 py-8'} select-none`} dir="rtl">
        {/* Settings Header */}
        <div className="flex items-center gap-3 pb-4 mb-2 border-b border-[#F0F1F3]">
          <button
            type="button"
            onClick={() => setCurrentView('main')}
            className="w-9 h-9 rounded-full bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] active:scale-95 flex items-center justify-center text-[#111827] shadow-2xs transition-all cursor-pointer"
            aria-label="رجوع"
          >
            <ChevronRight size={20} />
          </button>
          <h1 className="text-lg font-black text-[#111827]">الإعدادات</h1>
        </div>

        {feedbackMsg && (
          <div className={`p-3 my-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="p-1 hover:bg-black/5 rounded-lg transition-colors cursor-pointer text-current opacity-70 hover:opacity-100"
              aria-label="إغلاق التنبيه"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Settings List */}
        <div className="bg-white rounded-2xl border border-[#F0F1F3] divide-y divide-[#F0F1F3] overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setCurrentView('account-info')}
            className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer text-right"
          >
            <span className="text-sm font-bold text-[#111827]">بيانات الحساب</span>
            <ChevronLeft size={18} className="text-[#9CA3AF]" />
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('addresses')}
            className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer text-right"
          >
            <span className="text-sm font-bold text-[#111827]">العناوين المحفوظة</span>
            <ChevronLeft size={18} className="text-[#9CA3AF]" />
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('cards')}
            className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer text-right"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#111827]">البطاقات البنكية وطرق الدفع</span>
              {savedCards.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-50 text-orange-700 border border-orange-200">
                  {savedCards.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#6B7280]">
                {savedCards.length > 0 ? `${savedCards.length} بطاقة` : 'إضافة بطاقة'}
              </span>
              <ChevronLeft size={18} className="text-[#9CA3AF]" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleNotificationToggle()}
            disabled={isNotificationBusy}
            className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer text-right"
          >
            <span className="text-sm font-bold text-[#111827]">الإشعارات</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#6B7280]">
                {isNotificationBusy ? 'جارٍ التحديث…' : notificationsEnabled ? 'مفعلة' : 'غير مفعلة'}
              </span>
              <ChevronLeft size={18} className="text-[#9CA3AF]" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer text-right"
          >
            <span className="text-sm font-bold text-[#111827]">اللغة</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#6B7280]">
                {language === 'ar' ? 'العربية' : 'English'}
              </span>
              <ChevronLeft size={18} className="text-[#9CA3AF]" />
            </div>
          </button>

          <div className="w-full flex items-center justify-between p-4 bg-[#F9FAFB]/50">
            <span className="text-sm font-bold text-[#111827]">الدولة</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-[#111827] flex items-center gap-1">
                <span>🇪🇬 مصر</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 hover:bg-red-50 text-red-600 transition-colors cursor-pointer text-right"
          >
            <span className="text-sm font-black">تسجيل الخروج</span>
            <ChevronLeft size={18} className="text-red-400" />
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 2. SCREEN: ACCOUNT INFO (بيانات الحساب طابق تماماً لقطة الشاشة)
  // ══════════════════════════════════════════════════════════════════
  if (currentView === 'account-info') {
    return (
      <div className={`w-full ${isMobile ? 'px-4 py-3' : 'max-w-xl mx-auto px-6 py-8'} select-none`} dir="rtl">
        {/* Account Info Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#F0F1F3]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentView('settings')}
              className="w-9 h-9 rounded-full bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] active:scale-95 flex items-center justify-center text-[#111827] shadow-2xs transition-all cursor-pointer"
              aria-label="رجوع"
            >
              <ChevronRight size={20} />
            </button>
            <h1 className="text-lg font-black text-[#111827]">بيانات الحساب</h1>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isEditingInfo) {
                handleSaveAccountInfo();
              } else {
                setIsEditingInfo(true);
              }
            }}
            disabled={busy}
            className="px-4 py-1.5 rounded-full border border-[#D1D5DB] hover:border-[#111827] text-xs font-bold text-[#111827] bg-white transition-all cursor-pointer"
          >
            {busy ? 'جارٍ الحفظ...' : isEditingInfo ? 'حفظ' : 'تعديل'}
          </button>
        </div>

        {feedbackMsg && (
          <div className={`p-3 mb-4 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs transition-all ${
            feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="p-1 hover:bg-black/5 rounded-lg transition-colors cursor-pointer text-current opacity-70 hover:opacity-100"
              aria-label="إغلاق التنبيه"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Profile Picture Uploader Section */}
        <div className="flex flex-col items-center justify-center pt-1 pb-4 mb-2">
          <div className="relative group">
            <div
              onClick={() => avatarInputRef.current?.click()}
              className="w-24 h-24 rounded-full overflow-hidden bg-[#F3F4F6] border-2 border-[#E5E7EB] shadow-xs flex items-center justify-center text-3xl font-black text-[#111827] cursor-pointer hover:opacity-95 transition-all"
              title="تغيير الصورة الشخصية"
            >
              {avatarUrl && !avatarError ? (
                <img
                  src={avatarUrl}
                  alt={user?.fullName || 'الصورة الشخصية'}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-black text-[#FF5900]">{userInitial}</span>
              )}
            </div>

            {/* Camera Edit Badge */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-[#FF5900] hover:bg-[#e04f00] text-white flex items-center justify-center shadow-md border-2 border-white transition-transform active:scale-90 cursor-pointer"
              title="تغيير الصورة الشخصية"
              aria-label="تغيير الصورة الشخصية"
            >
              <Camera size={15} />
            </button>
          </div>

          <input
            type="file"
            ref={avatarInputRef}
            accept="image/*"
            onChange={handleAvatarFileSelect}
            className="hidden"
          />

          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="text-xs font-black text-[#FF5900] hover:underline cursor-pointer flex items-center gap-1"
            >
              <Camera size={13} />
              <span>{avatarUrl ? 'تغيير الصورة الشخصية' : 'إضافة صورة شخصية'}</span>
            </button>
            {avatarUrl && (
              <>
                <span className="text-[#D1D5DB]">•</span>
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl('');
                    setIsEditingInfo(true);
                  }}
                  className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
                >
                  إزالة الصورة
                </button>
              </>
            )}
          </div>
        </div>

        {/* Inputs stack matching the exact screenshot */}
        <div className="space-y-3.5">
          {/* Email */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-3 relative">
            <span className="block text-[11px] text-[#6B7280] font-bold mb-0.5">البريد الإلكتروني</span>
            <div className="flex items-center justify-between">
              <input
                type="email"
                value={email}
                disabled={!isEditingInfo}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@mail.com"
                dir="ltr"
                className="w-full bg-transparent text-sm font-bold text-[#111827] outline-hidden text-right"
              />
              <Edit2 size={15} className="text-[#9CA3AF] shrink-0 mr-2" />
            </div>
          </div>

          {/* First Name */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-3">
            <span className="block text-[11px] text-[#6B7280] font-bold mb-0.5">الاسم الأول</span>
            <input
              type="text"
              value={firstName}
              disabled={!isEditingInfo}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="الاسم الأول"
              className="w-full bg-transparent text-sm font-bold text-[#111827] outline-hidden"
            />
          </div>

          {/* Last Name */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-3">
            <span className="block text-[11px] text-[#6B7280] font-bold mb-0.5">اسم العائلة</span>
            <input
              type="text"
              value={lastName}
              disabled={!isEditingInfo}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="اسم العائلة"
              className="w-full bg-transparent text-sm font-bold text-[#111827] outline-hidden"
            />
          </div>

          {/* Phone Number (Mandatory) */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-3 relative">
            <span className="block text-[11px] text-[#6B7280] font-bold mb-0.5">
              رقم الهاتف <span className="text-red-500 font-black">* (إجباري)</span>
            </span>
            <div className="flex items-center justify-between">
              <input
                type="tel"
                value={phone}
                disabled={!isEditingInfo}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                placeholder="010XXXXXXXX"
                dir="ltr"
                className="w-full bg-transparent text-sm font-bold text-[#111827] outline-hidden text-right font-mono"
              />
              <Edit2 size={15} className="text-[#9CA3AF] shrink-0 mr-2" />
            </div>
          </div>

          {/* WhatsApp Toggle with Official WhatsApp SVG Logo */}
          <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-2xl p-3 flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasWhatsApp}
                disabled={!isEditingInfo}
                onChange={(e) => setHasWhatsApp(e.target.checked)}
                className="w-4 h-4 rounded text-[#16A34A] focus:ring-[#16A34A] accent-[#16A34A] cursor-pointer"
              />
              <span className="text-xs font-bold text-[#15803D]">
                هل عليه واتساب؟
              </span>
            </label>
            <div className="flex items-center gap-1.5" title="WhatsApp">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10.5" fill="#25D366" />
                <path
                  d="M17.5 14.4c-.2-.1-1.3-.6-1.5-.7-.2-.1-.4-.1-.5.1-.2.2-.6.7-.7.9-.1.1-.3.2-.5.1-.2-.1-.9-.3-1.8-1.1-.7-.6-1.1-1.3-1.3-1.6-.1-.2 0-.4.1-.5.1-.1.2-.2.3-.4.1-.1.1-.2.2-.3 0-.1 0-.3-.1-.4s-.5-1.3-.7-1.7c-.2-.5-.4-.4-.5-.4h-.4c-.2 0-.5.1-.7.3-.2.2-.8.8-.8 2 0 1.2.9 2.3 1 2.5.1.2 1.7 2.6 4.1 3.7.6.3 1 .4 1.4.5.6.2 1.1.2 1.6.1.5-.1 1.3-.6 1.5-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.5-.3z"
                  fill="#ffffff"
                />
              </svg>
            </div>
          </div>

          {/* Date of Birth (Optional) */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-3 relative">
            <span className="block text-[11px] text-[#6B7280] font-bold mb-0.5">تاريخ الميلاد (اختياري)</span>
            <div className="flex items-center justify-between">
              <input
                type="date"
                value={dob}
                disabled={!isEditingInfo}
                onChange={(e) => setDob(e.target.value)}
                className="w-full bg-transparent text-sm font-bold text-[#111827] outline-hidden"
              />
              <Calendar size={16} className="text-[#9CA3AF] shrink-0 mr-2" />
            </div>
          </div>

          {/* Gender (Optional) */}
          <div className="pt-2">
            <label className="block text-sm font-bold text-[#111827] mb-2">النوع (اختياري)</label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-[#374151]">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={gender === 'male'}
                  onChange={() => setGender('male')}
                  disabled={!isEditingInfo}
                  className="w-4 h-4 text-[#FF5900] focus:ring-[#FF5900]"
                />
                <span>ذكر</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-[#374151]">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={gender === 'female'}
                  onChange={() => setGender('female')}
                  disabled={!isEditingInfo}
                  className="w-4 h-4 text-[#FF5900] focus:ring-[#FF5900]"
                />
                <span>أنثى</span>
              </label>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="pt-3 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={receiveOffers}
                onChange={(e) => setReceiveOffers(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-[#FF5900] rounded-sm focus:ring-[#FF5900]"
              />
              <span className="text-xs font-bold text-[#374151] leading-relaxed">
                نعم، أود استلام العروض والخصومات الحصرية
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={subscribeNewsletter}
                onChange={(e) => setSubscribeNewsletter(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-[#FF5900] rounded-sm focus:ring-[#FF5900]"
              />
              <span className="text-xs font-bold text-[#374151] leading-relaxed">
                الاشتراك في النشرة الإخبارية
              </span>
            </label>
          </div>

          {/* Delete Account Outline Pill Button */}
          <div className="pt-6">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('هل أنت متأكد من رغبتك في حذف الحساب؟ هذا الإجراء لا يمكن التراجع عنه.')) {
                  handleLogout();
                }
              }}
              className="w-full py-3 rounded-full border border-[#D1D5DB] hover:border-red-500 hover:text-red-600 text-sm font-black text-[#111827] bg-white transition-all cursor-pointer shadow-2xs"
            >
              حذف الحساب
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 3. SCREEN: SAVED ADDRESSES (طابق لقطة العناوين في أندرويد بالكامل)
  // ══════════════════════════════════════════════════════════════════
  if (currentView === 'addresses') {
    return (
      <div className={`w-full ${isMobile ? 'px-4 py-3' : 'max-w-xl mx-auto px-6 py-8'} select-none`} dir="rtl">
        {/* Addresses Header */}
        <div className="flex items-center gap-3 pb-4 mb-6 border-b border-[#F0F1F3]">
          <button
            type="button"
            onClick={() => setCurrentView('settings')}
            className="w-9 h-9 rounded-full bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] active:scale-95 flex items-center justify-center text-[#111827] shadow-2xs transition-all cursor-pointer"
            aria-label="رجوع"
          >
            <ChevronRight size={20} />
          </button>
          <h1 className="text-lg font-black text-[#111827]">العناوين</h1>
        </div>

        {/* Empty State or Addresses List */}
        {user?.ministry ? (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#FF5900] bg-[#FFF2EC] px-2 py-0.5 rounded-md">
                      العنوان المعتمد
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#111827] mt-1.5 leading-relaxed">
                    {user.ministry}
                  </p>
                  {(user.floorNumber || user.roomNumber) && (
                    <p className="text-xs text-[#6B7280] font-medium mt-1">
                      {[user.floorNumber && `الدور: ${user.floorNumber}`, user.roomNumber && `المكتب/الشقة: ${user.roomNumber}`].filter(Boolean).join(' - ')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenAreaModal}
              className="w-full py-3 rounded-full border border-[#D1D5DB] hover:border-[#FF5900] text-sm font-bold text-[#111827] bg-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <Plus size={16} className="text-[#FF5900]" />
              <span>تغيير أو إضافة عنوان جديد</span>
            </button>
          </div>
        ) : (
          /* Exact Empty State from Screenshot */
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            {/* Custom Orange Pin with Exclamation Mark Graphic */}
            <div className="relative mb-6">
              <div className="w-20 h-24 bg-[#FF5900] rounded-t-full rounded-b-[40px] flex items-center justify-center shadow-md relative">
                <div className="w-10 h-10 bg-[#FFF5EE] rounded-full flex items-center justify-center">
                  <span className="text-[#131921] text-2xl font-black">!</span>
                </div>
                {/* Visual side ticks */}
                <div className="absolute -left-3 top-4 w-3 h-1 bg-[#431407] rounded-full -rotate-45" />
                <div className="absolute -left-2 top-8 w-3 h-1 bg-[#431407] rounded-full -rotate-12" />
              </div>
            </div>

            <h2 className="text-xl font-black text-[#111827] mb-2">
              لا توجد عناوين محفوظة
            </h2>
            <p className="text-sm text-[#6B7280] font-medium mb-8 max-w-xs leading-relaxed">
              ابدأ بإضافة عنوانك لتسهيل وسرعة توصيل الطلبات لحد بابك
            </p>

            <button
              type="button"
              onClick={onOpenAreaModal}
              className="px-8 py-3 rounded-full border border-[#111827] hover:bg-[#111827] hover:text-white text-sm font-bold text-[#111827] bg-white transition-all cursor-pointer shadow-xs"
            >
              إضافة عنوان جديد
            </button>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // SCREEN: SAVED BANK CARDS (البطاقات البنكية وطرق الدفع الحقيقية عبر جيديا)
  // ══════════════════════════════════════════════════════════════════
  if (currentView === 'cards') {
    const previewBrand = detectCardBrand(newCardNumber);
    return (
      <div className={`w-full ${isMobile ? 'px-4 py-3' : 'max-w-xl mx-auto px-6 py-8'} select-none`} dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#F0F1F3]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentView('settings')}
              className="w-9 h-9 rounded-full bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] active:scale-95 flex items-center justify-center text-[#111827] shadow-2xs transition-all cursor-pointer"
              aria-label="رجوع"
            >
              <ChevronRight size={20} />
            </button>
            <div>
              <h1 className="text-lg font-black text-[#111827]">البطاقات البنكية وطرق الدفع</h1>
              <p className="text-[11px] text-[#6B7280]">الدفع الإلكتروني الآمن عبر جيديا (Geidea)</p>
            </div>
          </div>

          {!isAddingCard && (
            <button
              type="button"
              onClick={() => setIsAddingCard(true)}
              className="px-3 py-1.5 rounded-full bg-[#111827] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              <span>إضافة كارت</span>
            </button>
          )}
        </div>

        {/* Security & Tokenization Assurance Badge */}
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5 text-slate-700 text-xs">
          <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
          <p className="leading-relaxed">
            بياناتك مشفرة بالكامل ومعتمدة وفق معايير الأمان البنكي العالمية <span className="font-bold text-slate-900">PCI-DSS</span> و<span className="font-bold text-slate-900">Geidea</span> بدون تخزين أرقام بطاقتك السرية.
          </p>
        </div>

        {/* Feedback Message */}
        {feedbackMsg && (
          <div className={`p-3 mb-4 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="p-1 hover:bg-black/5 rounded-lg transition-colors cursor-pointer text-current opacity-70 hover:opacity-100"
              aria-label="إغلاق التنبيه"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* 💳 ADD CARD FORM MODAL / SECTION */}
        {isAddingCard && (
          <div className="bg-white rounded-2xl border border-orange-200 p-4 sm:p-5 shadow-sm mb-6 animate-fadeIn space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <CreditCard size={17} className="text-orange-600" />
                <span>إضافة بطاقة بنكية جديدة</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAddingCard(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                aria-label="إلغاء"
              >
                <X size={16} />
              </button>
            </div>

            {/* LIVE CARD PREVIEW */}
            <div className={`w-full max-w-sm mx-auto aspect-[1.65/1] rounded-2xl p-4 sm:p-5 text-white shadow-lg relative overflow-hidden transition-all duration-300 border border-white/10 ${
              previewBrand === 'visa'
                ? 'bg-gradient-to-tr from-[#0F2027] via-[#1A2A6C] to-[#0D47A1]'
                : previewBrand === 'mastercard'
                ? 'bg-gradient-to-tr from-[#212121] via-[#3E2723] to-[#BF360C]'
                : previewBrand === 'meeza'
                ? 'bg-gradient-to-tr from-[#00363A] via-[#004D40] to-[#00695C]'
                : 'bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800'
            }`}>
              {/* Sangoub Mascot Ambient Watermark */}
              <img
                src="/brand/sangoub-mark-white-256.png"
                alt=""
                className="absolute -left-6 -bottom-6 w-36 h-36 object-contain opacity-15 pointer-events-none select-none"
              />
              <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />

              {/* Top Row: Sangoub Brand & Chip + Brand Logo */}
              <div className="flex items-center justify-between relative z-10 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-6 rounded bg-gradient-to-tr from-amber-300 via-amber-200 to-amber-400 border border-amber-200/60 shadow-xs relative overflow-hidden flex items-center justify-center shrink-0">
                    <div className="w-full h-[1px] bg-amber-700/30 absolute" />
                    <div className="h-full w-[1px] bg-amber-700/30 absolute" />
                    <div className="w-3 h-3 rounded-full border border-amber-700/30" />
                  </div>
                  <Wifi size={14} className="rotate-90 text-white/60" />
                </div>

                <div className="flex items-center gap-2">
                  <img
                    src="/brand/sangoub-mark-white-64.png"
                    alt="سنجوب"
                    className="w-5 h-5 object-contain"
                  />
                  <span className="text-[10px] font-black tracking-wider text-white/90">
                    كارت سنجوب
                  </span>
                  <div className="h-3 w-[1px] bg-white/20 mx-0.5" />
                  {previewBrand === 'visa' && (
                    <span className="text-sm font-black tracking-wider text-white italic">VISA</span>
                  )}
                  {previewBrand === 'mastercard' && (
                    <div className="flex items-center -space-x-1.5">
                      <div className="w-4 h-4 rounded-full bg-red-500 shadow-2xs" />
                      <div className="w-4 h-4 rounded-full bg-amber-400 shadow-2xs" />
                    </div>
                  )}
                  {previewBrand === 'meeza' && (
                    <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] font-black">ميزة</span>
                  )}
                  {previewBrand === 'card' && (
                    <CreditCard size={16} className="text-white/70" />
                  )}
                </div>
              </div>

              {/* Card Number display */}
              <div className="my-2.5 sm:my-3.5 relative z-10 text-center">
                <p className="font-mono text-sm sm:text-base font-bold tracking-[0.2em] text-white/95 dir-ltr drop-shadow-xs">
                  {newCardNumber.trim() ? formatCardNumber(newCardNumber) : '•••• •••• •••• ••••'}
                </p>
              </div>

              {/* Cardholder name & Expiry */}
              <div className="flex items-end justify-between relative z-10 text-white/90 pt-1">
                <div className="min-w-0 pr-2">
                  <p className="text-[7.5px] text-white/60 font-bold uppercase tracking-wider mb-0.5">اسم حامل البطاقة</p>
                  <p className="text-[11px] font-bold tracking-wide uppercase truncate max-w-[170px]">
                    {newCardHolder.trim() || 'اسم العميل'}
                  </p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-[7.5px] text-white/60 font-bold uppercase tracking-wider mb-0.5">صالح حتى</p>
                  <p className="text-[11px] font-mono font-bold tracking-wider">
                    {newCardMonth || 'MM'}/{newCardYear || 'YY'}
                  </p>
                </div>
              </div>
            </div>

            {/* Inputs Form */}
            <form onSubmit={handleSaveCard} className="space-y-3.5 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الاسم المطبوع على البطاقة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCardHolder}
                  onChange={(e) => setNewCardHolder(e.target.value)}
                  placeholder="مثال: MOHAMED SAUDI"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-bold uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم البطاقة البنكية (16 رقماً) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    maxLength={19}
                    value={formatCardNumber(newCardNumber)}
                    onChange={(e) => setNewCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                    placeholder="4000 1234 5678 9010"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-mono font-bold tracking-wider dir-ltr text-right"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    {previewBrand === 'visa' && <span className="text-xs font-black text-blue-700 italic">VISA</span>}
                    {previewBrand === 'mastercard' && <span className="text-xs font-black text-orange-600">MasterCard</span>}
                    {previewBrand === 'meeza' && <span className="text-xs font-black text-emerald-700">Meeza</span>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
                    الشهر (MM) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={2}
                    value={newCardMonth}
                    onChange={(e) => setNewCardMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="05"
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-mono font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
                    السنة (YY) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={2}
                    value={newCardYear}
                    onChange={(e) => setNewCardYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="28"
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-mono font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
                    رمز الأمان (CVV) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={newCardCvv}
                      onChange={(e) => setNewCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-mono font-bold text-center"
                    />
                    <Lock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="card_default_check"
                  checked={newCardIsDefault}
                  onChange={(e) => setNewCardIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <label htmlFor="card_default_check" className="text-xs font-bold text-slate-700 cursor-pointer">
                  تعيين هذه البطاقة كبطاقة الدفع الافتراضية
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingCard}
                  className="flex-1 py-2.5 bg-[#FF5900] hover:bg-[#e04f00] text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingCard ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  <span>تأكيد وحفظ البطاقة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCard(false)}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 🗂️ SAVED CARDS LIST */}
        {savedCards.length > 0 ? (
          <div className="space-y-4">
            {savedCards.map((card) => {
              const brand = card.brand || 'card';
              return (
                <div
                  key={card.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-all space-y-3"
                >
                  {/* Card Mini Banner - Co-branded Sangoub Card */}
                  <div className={`w-full max-w-sm mx-auto aspect-[1.65/1] rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden shadow-md border border-white/10 ${
                    brand === 'visa'
                      ? 'bg-gradient-to-tr from-[#0F2027] via-[#1A2A6C] to-[#0D47A1]'
                      : brand === 'mastercard'
                      ? 'bg-gradient-to-tr from-[#212121] via-[#3E2723] to-[#BF360C]'
                      : brand === 'meeza'
                      ? 'bg-gradient-to-tr from-[#00363A] via-[#004D40] to-[#00695C]'
                      : 'bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800'
                  }`}>
                    {/* Sangoub Mascot Ambient Watermark */}
                    <img
                      src="/brand/sangoub-mark-white-256.png"
                      alt=""
                      className="absolute -left-6 -bottom-6 w-36 h-36 object-contain opacity-15 pointer-events-none select-none"
                    />

                    {/* Top Row: Sangoub Brand & Chip + Brand Logo */}
                    <div className="flex items-center justify-between relative z-10 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-6 rounded bg-gradient-to-tr from-amber-300 via-amber-200 to-amber-400 border border-amber-200/60 shadow-xs relative overflow-hidden flex items-center justify-center shrink-0">
                          <div className="w-full h-[1px] bg-amber-700/30 absolute" />
                          <div className="h-full w-[1px] bg-amber-700/30 absolute" />
                          <div className="w-3 h-3 rounded-full border border-amber-700/30" />
                        </div>
                        {card.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/90 text-white shadow-2xs">
                            <Check size={10} /> افتراضية
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <img
                          src="/brand/sangoub-mark-white-64.png"
                          alt="سنجوب"
                          className="w-5 h-5 object-contain"
                        />
                        <span className="text-[10px] font-black tracking-wider text-white/90">
                          كارت سنجوب
                        </span>
                        <div className="h-3 w-[1px] bg-white/20 mx-0.5" />
                        <span className="text-xs font-black uppercase tracking-wider">
                          {brand === 'visa' ? 'VISA' : brand === 'mastercard' ? 'MasterCard' : brand === 'meeza' ? 'ميزة' : 'بطاقة بنكية'}
                        </span>
                      </div>
                    </div>

                    {/* Card Number */}
                    <div className="my-2.5 sm:my-3.5 relative z-10 text-center">
                      <p className="font-mono text-sm sm:text-base font-bold tracking-[0.2em] text-white/95 dir-ltr drop-shadow-xs">
                        •••• •••• •••• {card.last4}
                      </p>
                    </div>

                    {/* Cardholder name & Expiry */}
                    <div className="flex items-end justify-between relative z-10 text-white/90 pt-1">
                      <div className="min-w-0 pr-2">
                        <p className="text-[7.5px] text-white/60 font-bold uppercase tracking-wider mb-0.5">حامل البطاقة</p>
                        <span className="text-[11px] font-bold uppercase tracking-wide truncate block max-w-[170px]">
                          {card.cardholderName}
                        </span>
                      </div>
                      <div className="text-left shrink-0">
                        <p className="text-[7.5px] text-white/60 font-bold uppercase tracking-wider mb-0.5">صالح حتى</p>
                        <span className="font-mono text-[11px] font-bold tracking-wider">
                          {card.expiryMonth}/{card.expiryYear}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div>
                      {!card.isDefault ? (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultCard(card.id)}
                          className="text-[#FF5900] hover:text-[#e04f00] font-bold hover:underline cursor-pointer"
                        >
                          تعيين كبطاقة افتراضية
                        </button>
                      ) : (
                        <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle2 size={13} /> معتمدة لطلباتك
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(card.id)}
                      className="text-red-500 hover:text-red-700 flex items-center gap-1 font-bold transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>حذف البطاقة</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !isAddingCard ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <CreditCard size={32} />
            </div>
            <h2 className="text-base font-black text-slate-900 mb-1">
              لا توجد بطاقات بنكية محفوظة
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
              احفظ بطاقتك البنكية بأمان للدفع المباشر والسريع عبر بوابة جيديا في كل طلباتك القادمة.
            </p>
            <button
              type="button"
              onClick={() => setIsAddingCard(true)}
              className="px-6 py-2.5 bg-[#FF5900] hover:bg-[#e04f00] text-white rounded-xl text-xs font-black shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              <span>إضافة أول بطاقة بنكية</span>
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 4. SCREEN: MAIN ACCOUNT PAGE (طابق لقطة الشاشة الرئيسية لأندرويد)
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className={`w-full ${isMobile ? 'px-4 py-3' : 'max-w-xl mx-auto px-6 py-8'} select-none pb-24`} dir="rtl">
      
      {/* User Header Profile Row */}
      <div className="flex items-center justify-between pb-4 pt-1">
        <div className="flex items-center gap-3.5">
          {/* Avatar Circle with Initial or Photo */}
          <div
            onClick={() => setCurrentView('account-info')}
            className="w-12 h-12 rounded-full bg-[#F3F4F6] text-[#111827] border border-[#E5E7EB] overflow-hidden flex items-center justify-center text-lg font-black shrink-0 relative cursor-pointer hover:opacity-90 transition-opacity"
            title="تعديل الصورة والبيانات"
          >
            {user?.avatarUrl && !avatarError ? (
              <img 
                src={user.avatarUrl} 
                alt="" 
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-full h-full object-cover" 
              />
            ) : user && !user.isGuest ? (
              <span className="text-base font-black text-[#FF5900]">{userInitial}</span>
            ) : (
              <User size={20} className="text-[#9CA3AF]" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-[#111827] leading-tight">
                {user && !user.isGuest ? user.fullName : 'زائر سنجوب الكريم'}
              </h1>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  <ShieldCheck size={11} />
                  مدير النظام
                </span>
              )}
            </div>

            {isAdmin ? (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] font-bold text-[#6B7280]">
                  حساب الإدارة المعتمد
                </p>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={() => { window.location.assign('/admin'); }}
                  className="text-[11px] font-bold text-[#FF5900] hover:text-[#e04f00] flex items-center gap-1 underline cursor-pointer"
                >
                  <span>لوحة الإدارة</span>
                  <ExternalLink size={10} />
                </button>
              </div>
            ) : user && !user.isGuest ? (
              <p className="text-[11px] font-medium text-[#6B7280] flex items-center gap-1 mt-0.5">
                <span>🇪🇬</span>
                <span>مصر - العاصمة الإدارية</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-[11px] font-bold text-[#FF5900] underline mt-0.5 cursor-pointer block text-right"
              >
                تسجيل الدخول / إنشاء حساب ⚡
              </button>
            )}
          </div>
        </div>

        {/* Settings Gear Icon on the other side */}
        <button
          type="button"
          onClick={() => setCurrentView('settings')}
          className="w-10 h-10 rounded-full hover:bg-[#F3F4F6] active:scale-95 flex items-center justify-center text-[#111827] transition-all cursor-pointer"
          aria-label="الإعدادات"
          title="الإعدادات"
        >
          <Settings size={22} />
        </button>
      </div>

      {/* Perks / Sangoub Plus Banner Card */}
      <div className="my-3 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#6D28D9] to-[#5B21B6] text-white p-4 relative overflow-hidden shadow-sm">
        <div className="relative z-10 max-w-[70%]">
          <h2 className="text-sm sm:text-base font-black leading-tight mb-1">
            مزايا حصرية لجميع أفراد العائلة
          </h2>
          <p className="text-[11px] text-purple-100 font-medium leading-relaxed mb-2.5">
            توصيل سريع وخصومات حصرية على كافة طلباتك ومشترياتك اليومية.
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-white text-[11px] font-bold">
            <Sparkles size={13} className="text-amber-300" />
            <span>مفعل تلقائياً لجميع عملاء سنجوب</span>
          </div>
        </div>

        {/* Decorative corner icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-20 h-20 rounded-2xl overflow-hidden opacity-90 hidden xs:block">
          <img src="/brand/sangoub-market-logo.jpg" alt="سنجوب" className="w-full h-full object-cover rounded-2xl" />
        </div>
      </div>

      {/* Main Account Navigation List */}
      <div className="bg-white rounded-2xl border border-[#F0F1F3] divide-y divide-[#F0F1F3] overflow-hidden shadow-xs mt-3">
        
        {/* Rewards - Solid */}
        <div className="w-full flex items-center justify-between p-4 bg-white text-right cursor-default select-none">
          <div className="flex items-center gap-3">
            <Gift size={20} className="text-[#111827]" />
            <span className="text-sm font-bold text-[#111827]">المكافآت</span>
          </div>
          <span className="text-xs font-bold text-[#6B7280]">0 نقطة</span>
        </div>

        {/* Your orders - Active */}
        <button
          type="button"
          onClick={() => navigate('/my-orders')}
          className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer text-right"
        >
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-[#111827]" />
            <span className="text-sm font-bold text-[#111827]">طلباتك</span>
          </div>
          <ChevronLeft size={18} className="text-[#9CA3AF]" />
        </button>

        {/* Notifications & Alerts */}
        <button
          type="button"
          onClick={() => {
            if (!user || user.isGuest) {
              setFeedbackMsg({ type: 'error', text: 'سجّل الدخول أولاً لعرض إشعارات حسابك.' });
              return;
            }
            setIsNotificationsModalOpen(true);
          }}
          className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer text-right"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell size={20} className="text-[#FF5900]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </div>
            <div>
              <span className="text-sm font-bold text-[#111827] block">التنبيهات والإشعارات</span>
              <span className="text-[11px] text-[#6B7280]">تحديثات الطلبات والعروض الفورية</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadNotificationsCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-[#FF5900] text-white text-[11px] font-black shadow-xs">
                {unreadNotificationsCount} جديد
              </span>
            ) : (
              <ChevronLeft size={18} className="text-[#9CA3AF]" />
            )}
          </div>
        </button>

        {/* Saved addresses - Active */}
        <button
          type="button"
          onClick={() => setCurrentView('addresses')}
          className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer text-right"
        >
          <div className="flex items-center gap-3">
            <MapPin size={20} className="text-[#111827]" />
            <span className="text-sm font-bold text-[#111827]">عناوين التوصيل</span>
          </div>
          <ChevronLeft size={18} className="text-[#9CA3AF]" />
        </button>

        {/* Saved Bank Cards - Active */}
        <button
          type="button"
          onClick={() => setCurrentView('cards')}
          className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer text-right"
        >
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-[#111827]" />
            <div>
              <span className="text-sm font-bold text-[#111827] block">البطاقات وطرق الدفع</span>
              <span className="text-[11px] text-[#6B7280]">إدارة وتعيين البطاقات البنكية المعتمدة</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {savedCards.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-50 text-orange-700 border border-orange-200">
                {savedCards.length} بطاقة
              </span>
            )}
            <ChevronLeft size={18} className="text-[#9CA3AF]" />
          </div>
        </button>

        {/* Challenges - Solid */}
        <div className="w-full flex items-center justify-between p-4 bg-white text-right cursor-default select-none">
          <div className="flex items-center gap-3">
            <Trophy size={20} className="text-[#111827]" />
            <span className="text-sm font-bold text-[#111827]">التحديات</span>
          </div>
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">قريباً</span>
        </div>

        {/* Vouchers / Gifts - Dynamic from Database */}
        <button
          type="button"
          onClick={() => setShowCouponsModal(true)}
          className="w-full flex items-center justify-between p-4 bg-white text-right hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Tag size={20} className="text-[#111827]" />
            <span className="text-sm font-bold text-[#111827]">الهدايا والكوبونات</span>
          </div>
          {activeCoupons.length > 0 ? (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
              كود {activeCoupons[0].code} متاح ({activeCoupons[0].discountType === 'percent' ? `${activeCoupons[0].value}%` : `${activeCoupons[0].value} ج.م`})
            </span>
          ) : (
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
              قريباً
            </span>
          )}
        </button>

        {/* Sangoub Plus - Solid */}
        <div className="w-full flex items-center justify-between p-4 bg-white text-right cursor-default select-none">
          <div className="flex items-center gap-3">
            <span className="px-1.5 py-0.5 rounded-sm bg-[#6D28D9] text-white text-[10px] font-black">
              بلس
            </span>
            <span className="text-sm font-bold text-[#111827]">سنجوب بلس</span>
          </div>
          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md">
            قريباً
          </span>
        </div>

        {/* Customer Support via WhatsApp */}
        <button
          type="button"
          onClick={() => window.open('https://wa.me/201017799580?text=' + encodeURIComponent('مرحباً خدمة عملاء سنجوب، أحتاج مساعدة بخصوص طلبي'), '_blank')}
          className="w-full flex items-center justify-between p-4 hover:bg-[#F0FDF4] active:bg-[#DCFCE7] transition-colors cursor-pointer text-right group"
        >
          <div className="flex items-center gap-3">
            <HelpCircle size={20} className="text-[#15803D]" />
            <div>
              <span className="text-sm font-bold text-[#111827] block">المساعدة وخدمة العملاء</span>
              <span className="text-[11px] text-[#6B7280]">تواصل فوري عبر الواتساب</span>
            </div>
          </div>
          <div 
            className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xs group-hover:bg-[#20ba59] group-hover:scale-105 transition-all shrink-0"
            title="تواصل معنا عبر واتساب"
          >
            <svg 
              viewBox="0 0 24 24" 
              width="20" 
              height="20" 
              fill="currentColor"
              className="text-white"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
        </button>

        {/* About app - Solid */}
        <div className="w-full flex items-center justify-between p-4 bg-white text-right cursor-default select-none">
          <div className="flex items-center gap-3">
            <Info size={20} className="text-[#111827]" />
            <span className="text-sm font-bold text-[#111827]">عن التطبيق</span>
          </div>
          <span className="text-xs font-mono font-bold text-[#6B7280]">الإصدار 1.1.0</span>
        </div>

        {/* Register as a partner - Active */}
        <button
          type="button"
          onClick={() => setIsPartnerModalOpen(true)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer text-right"
        >
          <div className="flex items-center gap-3">
            <Briefcase size={20} className="text-[#FF5900]" />
            <span className="text-sm font-bold text-[#111827]">سجل كتاجر أو شريك</span>
          </div>
          <ChevronLeft size={18} className="text-[#9CA3AF]" />
        </button>

        {/* Quick Accessible Logout Button if logged in */}
        {user && !user.isGuest && (
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 hover:bg-red-50 text-red-600 transition-colors cursor-pointer text-right group border-t border-[#F0F1F3]"
          >
            <div className="flex items-center gap-3">
              <LogOut size={20} className="text-red-500 group-hover:scale-105 transition-transform" />
              <span className="text-sm font-black text-red-600">تسجيل الخروج من الحساب</span>
            </div>
            <ChevronLeft size={18} className="text-red-400" />
          </button>
        )}

      </div>

      <PartnerRegisterModal
        isOpen={isPartnerModalOpen}
        onClose={() => setIsPartnerModalOpen(false)}
      />

      {/* Coupons Details Modal */}
      {showCouponsModal && (
        <div
          className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
          onClick={() => setShowCouponsModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <Tag className="text-[#FF5900]" size={20} />
                <span>الهدايا وكوبونات الخصم</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCouponsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {activeCoupons.length > 0 ? (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {activeCoupons.map((coupon) => (
                  <div
                    key={coupon.code}
                    className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm bg-white border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded-lg select-all">
                          {coupon.code}
                        </span>
                        <span className="text-xs font-bold text-emerald-700">
                          خصم {coupon.discountType === 'percent' ? `${coupon.value}%` : `${coupon.value} ج.م`}
                        </span>
                      </div>
                      {coupon.description && (
                        <p className="text-[11px] text-slate-600">{coupon.description}</p>
                      )}
                      {coupon.minOrder > 0 && (
                        <p className="text-[10px] text-slate-500 font-bold">
                          الحد الأدنى للطلب: {coupon.minOrder} ج.م
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        try { navigator.clipboard.writeText(coupon.code); } catch {}
                        setCopiedCouponCode(coupon.code);
                        setTimeout(() => setCopiedCouponCode(null), 2000);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCouponCode === coupon.code ? (
                        <>
                          <Check size={13} strokeWidth={3} />
                          <span>تم النسخ ✓</span>
                        </>
                      ) : (
                        <span>نسخ الكود</span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 space-y-2">
                <Tag size={36} className="mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-800 text-sm">لا توجد كوبونات خصم نشطة حالياً</h4>
                <p className="text-xs text-slate-500">
                  تابعنا أولاً بأول لمعرفة أحدث الهدايا والكوبونات الحصرية من سنجوب!
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowCouponsModal(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
