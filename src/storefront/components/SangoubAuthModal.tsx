import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import {
  auth,
  db,
  signInWithFirebaseGoogle,
  signOutFromFirebase,
} from '../../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Profile } from '../../types';
import { cleanDisplayAddress } from '../../utils/orderCalculations';
import { BRAND } from '../../brand';
import {
  X,
  User,
  Phone,
  Mail,
  Lock,
  MapPin,
  Building,
  Wallet,
  LogOut,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Edit3,
  ChevronLeft
} from 'lucide-react';

interface SangoubAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialTab?: 'login' | 'register' | 'profile';
}

export const SangoubAuthModal: React.FC<SangoubAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'login',
}) => {
  const { user, setUser, serviceArea, setServiceArea } = useStore();

  const [tab, setTab] = useState<'login' | 'register' | 'profile'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form Fields (Exact Firebase / Flutter User Schema)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ministryAddress, setMinistryAddress] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [roomNumber, setRoomNumber] = useState('');

  // Editing profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Sync tab and initial data when modal opens
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSuccessNotice(null);
      return;
    }

    if (user && !user.isGuest) {
      setTab('profile');
      setFullName(user.fullName || '');
      setPhone(user.phone && user.phone !== 'غير مسجل' ? user.phone : '');
      setEmail(user.email || '');
      setMinistryAddress(cleanDisplayAddress(user.ministry || serviceArea.name || ''));
      setFloorNumber(user.floorNumber || '');
      setRoomNumber(user.roomNumber || '');
    } else {
      setTab(initialTab === 'profile' ? 'login' : initialTab);
      setMinistryAddress(cleanDisplayAddress(serviceArea.name || ''));
    }
  }, [isOpen, user, initialTab, serviceArea.name, serviceArea.id]);

  if (!isOpen) return null;

  // 1. Firebase Login with Email & Password
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const cleanEmail = email.trim();
      const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const uid = userCred.user.uid;

      // Fetch user profile from Firestore "users" collection (Matching Flutter App)
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);

      let profileData: Profile;
      if (userSnap.exists()) {
        const d = userSnap.data();
        profileData = {
          id: uid,
          fullName: d.fullName || userCred.user.displayName || 'عميل سنجوب',
          email: userCred.user.email || d.email || '',
          phone: d.phone || userCred.user.phoneNumber || '',
          ministry: d.ministry || '',
          floorNumber: d.floorNumber || '',
          roomNumber: d.roomNumber || '',
          walletBalance: typeof d.walletBalance === 'number' ? d.walletBalance : 20,
          role: d.role || 'employee',
          isGuest: false,
          authProvider: 'email',
        };
      } else {
        // Create initial doc in Firestore if missing
        profileData = {
          id: uid,
          fullName: userCred.user.displayName || cleanEmail.split('@')[0],
          email: userCred.user.email || cleanEmail,
          phone: '',
          ministry: serviceArea.name || '',
          floorNumber: '',
          roomNumber: '',
          walletBalance: 20,
          role: 'employee',
          isGuest: false,
          authProvider: 'email',
        };
        await setDoc(userDocRef, {
          uid,
          fullName: profileData.fullName,
          email: profileData.email,
          phone: '',
          ministry: profileData.ministry,
          role: 'employee',
          walletBalance: 20,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setUser(profileData);
      if (profileData.ministry) {
        setServiceArea({
          id: `addr_${uid}`,
          name: profileData.ministry,
          deliveryTime: '20-30 دقيقة',
          active: true,
        });
      }

      setSuccessNotice('تم تسجيل الدخول بنجاح! مرحباً بك 🐿️');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else onClose();
      }, 700);
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
        'auth/user-not-found': 'لا يوجد حساب بهذا البريد. يمكنك إنشاء حساب جديد.',
        'auth/wrong-password': 'كلمة المرور غير صحيحة.',
        'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
        'auth/too-many-requests': 'محاولات دخول كثيرة، يرجى الانتظار قليلاً.',
      };
      setError(msgs[err.code] || err.message || 'تعذر تسجيل الدخول، يرجى المحاولة ثانية.');
    } finally {
      setBusy(false);
    }
  };

  // 2. Firebase Registration with Exact Firestore Schema
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();
    const cleanAddress = ministryAddress.trim() || serviceArea.name || '';

    if (!cleanName) {
      setError('يرجى كتابة الاسم بالكامل.');
      setBusy(false);
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setError('يرجى كتابة رقم هاتف صحيح (11 رقم للتواصل).');
      setBusy(false);
      return;
    }

    if (!password || password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل.');
      setBusy(false);
      return;
    }

    try {
      // Create user in Firebase Auth
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const uid = userCred.user.uid;

      await updateProfile(userCred.user, { displayName: cleanName });

      // Save directly to Firestore collection "users" matching Flutter app schema
      const userDocRef = doc(db, 'users', uid);
      const newUserData = {
        uid,
        fullName: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        ministry: cleanAddress,
        floorNumber: floorNumber.trim(),
        roomNumber: roomNumber.trim(),
        role: 'employee',
        walletBalance: 20, // Free welcome gift
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(userDocRef, newUserData);

      const profile: Profile = {
        id: uid,
        fullName: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        ministry: cleanAddress,
        floorNumber: floorNumber.trim(),
        roomNumber: roomNumber.trim(),
        walletBalance: 20,
        role: 'employee',
        isGuest: false,
        authProvider: 'email',
      };

      setUser(profile);

      if (cleanAddress) {
        setServiceArea({
          id: `addr_${uid}`,
          name: cleanAddress,
          deliveryTime: '20-30 دقيقة',
          active: true,
        });
      }

      setSuccessNotice('تم إنشاء حسابك في سنجوب بنجاح! تمت إضافة 20 ج.م في محفظتك 🎁');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else onClose();
      }, 900);
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/email-already-in-use': 'هذا البريد مسجل بالفعل. يرجى تسجيل الدخول.',
        'auth/weak-password': 'كلمة المرور ضعيفة. استخدم 6 رموز على الأقل.',
        'auth/invalid-email': 'البريد الإلكتروني غير صحيح.',
      };
      setError(msgs[err.code] || err.message || 'تعذر إنشاء الحساب، يرجى المحاولة ثانية.');
    } finally {
      setBusy(false);
    }
  };

  // 3. Google Sign In
  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const profile = await signInWithFirebaseGoogle({
        ministry: serviceArea.name,
      });
      setUser(profile);
      setSuccessNotice('تم تسجيل الدخول عبر Google بنجاح 🐿️');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else onClose();
      }, 700);
    } catch (err: any) {
      setError('تعذر تسجيل الدخول عبر Google.');
    } finally {
      setBusy(false);
    }
  };

  // 4. Update Profile in Firestore
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.isGuest) return;

    setBusy(true);
    setError(null);

    try {
      const uid = user.id;
      const cleanName = fullName.trim() || user.fullName || 'عميل سنجوب';
      const cleanPhone = phone.trim();
      const cleanAddress = cleanDisplayAddress(ministryAddress.trim() || user.ministry || serviceArea.name);

      if (!cleanPhone || cleanPhone === 'غير مسجل' || cleanPhone.length < 10) {
        setError('يرجى كتابة رقم هاتف صحيح (11 رقم للتواصل وتأكيد الطلب).');
        setBusy(false);
        return;
      }

      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, {
        fullName: cleanName,
        phone: cleanPhone,
        ministry: cleanAddress,
        floorNumber: floorNumber.trim(),
        roomNumber: roomNumber.trim(),
        updatedAt: serverTimestamp(),
      });

      const updatedProfile: Profile = {
        ...user,
        fullName: cleanName,
        phone: cleanPhone,
        ministry: cleanAddress,
        floorNumber: floorNumber.trim(),
        roomNumber: roomNumber.trim(),
      };

      setUser(updatedProfile);
      if (cleanAddress) {
        setServiceArea({
          id: `addr_${uid}`,
          name: cleanAddress,
          deliveryTime: '20-30 دقيقة',
          active: true,
        });
      }

      setIsEditingProfile(false);
      setSuccessNotice('تم حفظ تعديلات الملف الشخصي بنجاح!');
      setTimeout(() => setSuccessNotice(null), 2500);
    } catch (err: any) {
      setError('حدث خطأ أثناء حفظ التعديلات.');
    } finally {
      setBusy(false);
    }
  };

  // 5. Logout
  const handleLogout = async () => {
    setBusy(true);
    try {
      await signOutFromFirebase();
      setUser(null);
      setTab('login');
      onClose();
    } catch {
      setUser(null);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs select-none transition-all"
      dir="rtl"
    >
      <div 
        className="bg-white w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl shadow-2xl border-t sm:border border-[#E5E7EB] flex flex-col max-h-[92dvh] sm:max-h-[88vh] font-['Cairo',sans-serif] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        {/* Mobile Pull-Down Indicator Pill */}
        <div className="w-12 h-1 bg-[#D1D5DB] rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Header Bar */}
        <div className="px-4 py-3 sm:py-3.5 border-b border-[#F0F1F3] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#FFF2EC] border border-[#FFD4C2] flex items-center justify-center shrink-0 p-1">
              <img
                src={BRAND.mascot.delivery}
                alt="سنجوب"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = BRAND.mascot.icon;
                }}
              />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-[#111827] leading-tight">
                {tab === 'profile'
                  ? 'الملف الشخصي في سنجوب 🐿️'
                  : tab === 'register'
                  ? 'فتح حساب جديد في سنجوب 🐿️'
                  : 'تسجيل الدخول إلى سنجوب 🐿️'}
              </h3>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                {tab === 'profile'
                  ? 'بيانات حسابك ومكان التوصيل المسجل'
                  : 'حساب موحد للتوصيل السريع لجميع الطلبات'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-[#6B7280] hover:bg-[#F3F4F6] active:bg-[#E5E7EB] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher (Only if NOT in profile mode) */}
        {tab !== 'profile' && (
          <div className="px-4 pt-3 pb-1 bg-white shrink-0">
            <div className="flex bg-[#F3F4F6] p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => { setTab('login'); setError(null); }}
                className={`flex-1 py-2 sm:py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer ${
                  tab === 'login'
                    ? 'bg-white text-[#FF5900] shadow-2xs'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                تسجيل الدخول
              </button>
              <button
                type="button"
                onClick={() => { setTab('register'); setError(null); }}
                className={`flex-1 py-2 sm:py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer ${
                  tab === 'register'
                    ? 'bg-white text-[#FF5900] shadow-2xs'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                إنشاء حساب جديد
              </button>
            </div>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="px-4 py-3 overflow-y-auto overscroll-contain flex-1 space-y-3.5 pb-6 sm:pb-5">
          
          {error && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 rounded-2xl bg-green-50 border border-green-200 text-green-700 text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-2">
              <Check size={16} className="shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              MODE 1: PROFILE VIEW (When Logged In)
              ══════════════════════════════════════════════════════════════ */}
          {tab === 'profile' && user && !user.isGuest && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Wallet & Balance Header Card */}
              <div className="bg-gradient-to-r from-[#FFF2EC] to-[#FFF7ED] border border-[#FFD4C2] rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#FF5900] text-white flex items-center justify-center shadow-xs">
                    <Wallet size={22} />
                  </div>
                  <div>
                    <p className="text-[11px] text-[#6B7280] font-bold">رصيد محفظة سنجوب</p>
                    <p className="text-lg font-black text-[#FF5900] leading-tight">
                      {user.walletBalance || 0} <span className="text-xs font-bold text-[#6B7280]">ج.م</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="px-3 py-2 bg-white text-[#FF5900] text-xs font-black rounded-xl border border-[#FFD4C2] flex items-center gap-1.5 cursor-pointer shadow-2xs hover:bg-[#FFF2EC] active:scale-95 transition-all"
                >
                  <Edit3 size={14} />
                  <span>{isEditingProfile ? 'إلغاء' : 'تعديل البيانات'}</span>
                </button>
              </div>

              {isEditingProfile ? (
                /* Profile Edit Form */
                <form onSubmit={handleUpdateProfile} className="space-y-3">
                  <div>
                    <label className="block text-xs font-black text-[#374151] mb-1">الاسم الكامل:</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full h-11 px-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[#374151] mb-1">رقم الهاتف / واتساب:</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-11 px-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-right text-[#111827]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[#374151] mb-1">عنوان التوصيل المعتمد:</label>
                    <input
                      type="text"
                      value={ministryAddress}
                      onChange={(e) => setMinistryAddress(e.target.value)}
                      className="w-full h-11 px-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-black text-[#374151] mb-1">الدور:</label>
                      <input
                        type="text"
                        value={floorNumber}
                        onChange={(e) => setFloorNumber(e.target.value)}
                        placeholder="مثال: الدور 3"
                        className="w-full h-11 px-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-[#374151] mb-1">رقم الشقة / المكتب:</label>
                      <input
                        type="text"
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                        placeholder="مثال: مكتب 304"
                        className="w-full h-11 px-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-12 bg-[#FF5900] active:scale-[0.98] text-white text-sm font-black rounded-xl hover:bg-[#E04E00] transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer mt-2"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    <span>حفظ التعديلات في الحساب</span>
                  </button>
                </form>
              ) : (
                /* Profile Info Cards */
                <div className="space-y-2.5">
                  {/* Urgent Phone Input Prompt if phone is missing */}
                  {(!user.phone || user.phone === 'غير مسجل' || user.phone.trim().length < 10) && (
                    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 space-y-2 animate-in fade-in">
                      <div className="flex items-center gap-2 text-amber-900 text-xs font-black">
                        <AlertCircle size={16} className="text-amber-600 shrink-0" />
                        <span>رقم هاتفك غير مسجل! يلزم إضافة الهاتف للتوصيل وتأكيد الطلبات:</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          inputMode="tel"
                          dir="ltr"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="01012345678"
                          className="flex-1 h-10 px-3 text-base sm:text-sm bg-white border border-amber-300 rounded-xl font-bold text-right outline-none focus:border-[#FF5900]"
                        />
                        <button
                          type="button"
                          disabled={busy || phone.trim().length < 10}
                          onClick={handleUpdateProfile}
                          className="px-3.5 h-10 bg-[#FF5900] disabled:bg-gray-300 text-white text-xs font-black rounded-xl hover:bg-[#E04E00] shrink-0 transition-all cursor-pointer shadow-xs"
                        >
                          {busy ? <Loader2 size={14} className="animate-spin" /> : 'حفظ الرقم'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="bg-[#F9FAFB] rounded-2xl p-3.5 border border-[#E5E7EB] space-y-2.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between py-1.5 border-b border-[#E5E7EB]">
                      <span className="text-[#6B7280] font-bold flex items-center gap-1.5">
                        <User size={14} className="text-[#9CA3AF]" />
                        <span>الاسم:</span>
                      </span>
                      <span className="font-black text-[#111827]">{user.fullName}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-[#E5E7EB]">
                      <span className="text-[#6B7280] font-bold flex items-center gap-1.5">
                        <Phone size={14} className="text-[#9CA3AF]" />
                        <span>رقم الهاتف:</span>
                      </span>
                      {user.phone && user.phone !== 'غير مسجل' ? (
                        <span className="font-bold text-[#111827]" dir="ltr">{user.phone}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(true)}
                          className="text-xs font-black text-[#FF5900] underline"
                        >
                          + إضافة رقم الهاتف (إجباري)
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-[#E5E7EB]">
                      <span className="text-[#6B7280] font-bold flex items-center gap-1.5">
                        <Mail size={14} className="text-[#9CA3AF]" />
                        <span>البريد:</span>
                      </span>
                      <span className="font-bold text-[#111827]" dir="ltr">{user.email || 'غير مسجل'}</span>
                    </div>

                    <div className="pt-1.5">
                      <span className="text-[#6B7280] font-bold flex items-center gap-1.5 mb-1">
                        <MapPin size={14} className="text-[#FF5900]" />
                        <span>مكان التوصيل والشارع:</span>
                      </span>
                      <div className="bg-white p-2.5 rounded-xl border border-[#E5E7EB]">
                        <span className="font-black text-[#FF5900] block text-xs sm:text-sm leading-relaxed">
                          {cleanDisplayAddress(user.ministry)}
                        </span>
                        {(user.floorNumber || user.roomNumber) && (
                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#6B7280] font-bold">
                            <Building size={12} className="text-[#9CA3AF]" />
                            <span>
                              {[user.floorNumber && `الدور: ${user.floorNumber}`, user.roomNumber && `المكتب/الشقة: ${user.roomNumber}`].filter(Boolean).join(' - ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                disabled={busy}
                className="w-full h-11 bg-red-50 text-red-600 border border-red-200 text-xs sm:text-sm font-black rounded-xl hover:bg-red-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <LogOut size={16} />
                <span>تسجيل الخروج من الحساب</span>
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              MODE 2: LOGIN FORM
              ══════════════════════════════════════════════════════════════ */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5 animate-in fade-in duration-150">
              
              {/* Google Fast Sign In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy}
                className="w-full h-12 bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] active:scale-[0.98] rounded-xl text-xs sm:text-sm font-black text-[#374151] flex items-center justify-center gap-2.5 shadow-2xs transition-all cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>المتابعة باستخدام حساب Google</span>
              </button>

              <div className="relative flex items-center justify-center my-2">
                <span className="h-[1px] w-full bg-[#E5E7EB]" />
                <span className="bg-white px-3 text-[11px] text-[#9CA3AF] font-bold absolute">أو بالبريد وكلمة المرور</span>
              </div>

              <div>
                <label className="block text-xs font-black text-[#374151] mb-1.5">البريد الإلكتروني:</label>
                <div className="relative">
                  <Mail size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-11 pr-10 pl-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#374151] mb-1.5">كلمة المرور:</label>
                <div className="relative">
                  <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pr-10 pl-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full h-12 mt-2 bg-[#FF5900] hover:bg-[#E04E00] active:scale-[0.98] text-white text-sm font-black rounded-xl sm:rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={18} className="animate-spin" />}
                <span>{busy ? 'جاري التحقق...' : 'تسجيل الدخول'}</span>
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setTab('register'); setError(null); }}
                  className="text-xs text-[#6B7280] hover:text-[#FF5900] font-bold transition-colors cursor-pointer"
                >
                  ليس لديك حساب بعد؟ <span className="text-[#FF5900] font-black underline">إنشاء حساب جديد</span>
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════
              MODE 3: REGISTRATION FORM (Matches Flutter App User Schema)
              ══════════════════════════════════════════════════════════════ */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3 animate-in fade-in duration-150">
              
              {/* Full Name */}
              <div>
                <label className="block text-xs font-black text-[#374151] mb-1">الاسم بالكامل:</label>
                <div className="relative">
                  <User size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: محمد مصطفى"
                    className="w-full h-11 pr-10 pl-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827] transition-all"
                  />
                </div>
              </div>

              {/* Phone / WhatsApp */}
              <div>
                <label className="block text-xs font-black text-[#374151] mb-1">رقم الهاتف / الواتساب (للتواصل وتأكيد الطلب):</label>
                <div className="relative">
                  <Phone size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="tel"
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full h-11 pr-10 pl-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-right text-[#111827] transition-all"
                  />
                </div>
              </div>

              {/* Email & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-black text-[#374151] mb-1">البريد الإلكتروني:</label>
                  <input
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@mail.com"
                    className="w-full h-11 px-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-[#374151] mb-1">كلمة المرور:</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 px-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827] transition-all"
                  />
                </div>
              </div>

              {/* Delivery Address / Street / Building (prefilled from map) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black text-[#374151]">مكان التوصيل والشارع:</label>
                  <span className="text-[10px] text-[#FF5900] font-black bg-[#FFF2EC] px-2 py-0.5 rounded-full">
                    محدد من الخريطة 📍
                  </span>
                </div>
                <div className="relative">
                  <MapPin size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#FF5900]" />
                  <input
                    type="text"
                    required
                    value={ministryAddress}
                    onChange={(e) => setMinistryAddress(e.target.value)}
                    placeholder="اسم الشارع / الحي / المدينة / المبنى"
                    className="w-full h-11 pr-10 pl-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827] transition-all"
                  />
                </div>
              </div>

              {/* Floor & Room / Apartment */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] mb-1">رقم الدور (اختياري):</label>
                  <input
                    type="text"
                    value={floorNumber}
                    onChange={(e) => setFloorNumber(e.target.value)}
                    placeholder="مثال: الدور 4"
                    className="w-full h-11 px-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] mb-1">رقم الشقة/المكتب:</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="مثال: 402"
                    className="w-full h-11 px-3 text-base sm:text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827] transition-all"
                  />
                </div>
              </div>

              {/* Wallet Bonus Gift Banner */}
              <div className="p-3 bg-[#FFF2EC] border border-[#FFD4C2] rounded-2xl flex items-center gap-2.5 text-xs text-[#9A3412]">
                <Sparkles size={18} className="text-[#FF5900] shrink-0" />
                <span className="font-bold">تحصل على <strong className="font-black text-[#FF5900]">20 ج.م هدية ترحيبية</strong> في محفظتك فوراً عند إنشاء الحساب 🎁</span>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full h-12 mt-2 bg-[#FF5900] hover:bg-[#E04E00] active:scale-[0.98] text-white text-sm font-black rounded-xl sm:rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={18} className="animate-spin" />}
                <span>{busy ? 'جاري فتح الحساب...' : 'إنشاء الحساب والبدء بالتسوق'}</span>
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError(null); }}
                  className="text-xs text-[#6B7280] hover:text-[#FF5900] font-bold transition-colors cursor-pointer"
                >
                  لديك حساب بالفعل؟ <span className="text-[#FF5900] font-black underline">تسجيل الدخول</span>
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
