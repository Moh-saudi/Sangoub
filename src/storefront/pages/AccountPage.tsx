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
  CheckCheck,
  Clock,
  Package
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { disableWebPushNotifications, enableWebPushNotifications } from '../../lib/webPushNotifications';
import { authenticatedApi } from '../../lib/authenticatedApi';
import { PartnerRegisterModal } from '../components/PartnerRegisterModal';

interface AccountPageProps {
  onBackToHome: () => void;
  onOpenAreaModal?: () => void;
  isMobile?: boolean;
}

type AccountView = 'main' | 'settings' | 'account-info' | 'addresses' | 'login-prompt';

export const AccountPage: React.FC<AccountPageProps> = ({
  onBackToHome,
  onOpenAreaModal,
  isMobile = false,
}) => {
  const { user, setUser, serviceArea, navigate, activeCoupons } = useStore();
  const [currentView, setCurrentView] = useState<AccountView>('main');
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [copiedCouponCode, setCopiedCouponCode] = useState<string | null>(null);

  // Customer In-App Notifications State
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

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
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );
  const [isNotificationBusy, setIsNotificationBusy] = useState(false);
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [busy, setBusy] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      if (user.avatarUrl) {
        setAvatarUrl(user.avatarUrl);
      }
      void loadUserNotifications();
    } else {
      setNotificationsList([]);
      setUnreadNotificationsCount(0);
    }
  }, [user]);

  const loadUserNotifications = async () => {
    if (!user || user.isGuest) return;
    setIsLoadingNotifications(true);
    try {
      const data = await authenticatedApi('/api/notifications', { action: 'inbox' });
      if (data && data.ok) {
        setNotificationsList(data.notifications || []);
        setUnreadNotificationsCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
      }
    } catch (e) {
      console.warn('Could not load user notifications:', e);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const handleMarkAsRead = async (id?: string) => {
    try {
      if (id) {
        await authenticatedApi('/api/notifications', { action: 'mark-read', id });
        setNotificationsList((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadNotificationsCount((c) => Math.max(0, c - 1));
      } else {
        await authenticatedApi('/api/notifications', { action: 'mark-all-read' });
        setNotificationsList((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadNotificationsCount(0);
      }
    } catch (e) {
      console.warn('Could not mark notification as read:', e);
    }
  };

  const handleNotificationClick = (item: any) => {
    if (!item.is_read) {
      void handleMarkAsRead(item.id);
    }
    setShowNotificationsModal(false);
    if (item.targetScreen === 'orders' || item.targetScreen === 'track') {
      navigate('/my-orders');
    } else if (item.targetScreen === 'offers') {
      navigate('/offers');
    } else if (item.targetScreen === 'coupons') {
      setShowCouponsModal(true);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return 'الآن';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `منذ ${diffDays} يوم`;
      return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

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
      await supabase.auth.signOut();
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
        setFeedbackMsg({ type: 'success', text: 'تم إيقاف إشعارات هذا الجهاز.' });
      } else {
        await enableWebPushNotifications();
        setNotificationsEnabled(true);
        setFeedbackMsg({ type: 'success', text: 'تم تفعيل إشعارات سنجوب على هذا الجهاز.' });
      }
    } catch (error) {
      setFeedbackMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر تغيير إعداد الإشعارات.',
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
          <div className={`p-3 my-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {feedbackMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMsg.text}</span>
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
          <div className={`p-3 mb-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
            feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {feedbackMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMsg.text}</span>
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
              <h1 className="text-base sm:text-lg font-black text-[#111827] leading-tight">
                {user && !user.isGuest ? user.fullName : 'زائر سنجوب الكريم'}
              </h1>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200">
                  <ShieldCheck size={11} />
                  مدير النظام
                </span>
              )}
            </div>

            {isAdmin ? (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs font-bold text-[#6B7280]">
                  حساب الإدارة المعتمد
                </p>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={() => { window.location.assign('/admin'); }}
                  className="text-xs font-black text-[#FF5900] hover:text-[#e04f00] flex items-center gap-1 underline cursor-pointer"
                >
                  <span>لوحة الإدارة</span>
                  <ExternalLink size={11} />
                </button>
              </div>
            ) : user && !user.isGuest ? (
              <p className="text-xs font-bold text-[#6B7280] flex items-center gap-1 mt-0.5">
                <span>🇪🇬</span>
                <span>مصر - العاصمة الإدارية</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs font-black text-[#FF5900] underline mt-0.5 cursor-pointer block text-right"
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
            setShowNotificationsModal(true);
            void loadUserNotifications();
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

      {/* Notifications Inbox Modal */}
      {showNotificationsModal && (
        <div
          className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowNotificationsModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F1F3] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-50 text-[#FF5900] flex items-center justify-center">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">التنبيهات والإشعارات</h3>
                  {unreadNotificationsCount > 0 && (
                    <span className="text-[10px] font-bold text-[#FF5900]">
                      {unreadNotificationsCount} إشعار غير مقروء
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleMarkAsRead()}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    title="تعليم كل الإشعارات كمقروءة"
                  >
                    <CheckCheck size={13} />
                    <span>قراءة الكل</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNotificationsModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="إغلاق"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto space-y-2.5 flex-1 pr-0.5 -mr-0.5">
              {isLoadingNotifications ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FF5900]" />
                  <span className="text-xs font-bold">جارٍ تحميل التنبيهات...</span>
                </div>
              ) : notificationsList.length > 0 ? (
                notificationsList.map((item) => {
                  const isOrder =
                    item.type === 'operational' ||
                    item.targetScreen === 'orders' ||
                    item.targetScreen === 'track';
                  const isOffer = item.targetScreen === 'offers' || item.targetScreen === 'coupons';

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                        !item.is_read
                          ? 'bg-[#FFF7ED] border-[#FDBA74] shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-[#F0F1F3]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isOrder
                              ? 'bg-orange-100 text-[#FF5900]'
                              : isOffer
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-600'
                          }`}
                        >
                          {isOrder ? (
                            <Package size={18} />
                          ) : isOffer ? (
                            <Tag size={18} />
                          ) : (
                            <Bell size={18} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4
                              className={`text-xs sm:text-sm font-black truncate ${
                                !item.is_read ? 'text-slate-900' : 'text-slate-700'
                              }`}
                            >
                              {item.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                              {formatTimeAgo(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                            {item.body}
                          </p>
                          {(item.targetScreen === 'orders' ||
                            item.targetScreen === 'track' ||
                            item.targetScreen === 'offers') && (
                            <div className="mt-2 flex items-center gap-1 text-[11px] font-black text-[#FF5900]">
                              <span>عرض التفاصيل</span>
                              <ChevronLeft size={13} />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Unread dot */}
                      {!item.is_read && (
                        <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-[#FF5900]" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF5900] flex items-center justify-center mx-auto">
                    <Bell size={24} />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">لا توجد إشعارات حالياً</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    ستصلك هنا إشعارات فورية بكل مرحلة من مراحل طلبك، والعروض الخاصة أولاً بأول.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-[#F0F1F3] shrink-0">
              <button
                type="button"
                onClick={() => setShowNotificationsModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
