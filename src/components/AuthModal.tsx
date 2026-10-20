import React, { useState } from 'react';
import {
  X,
  User,
  Store as StoreIcon,
  Bike,
  Shield,
  LogIn,
  UserPlus,
  Building,
  Phone,
  Mail,
  Lock,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import type { MinistryName, Profile, Store, UserRole } from '../types/index.ts';
import { MINISTRIES_LIST } from '../data/seedData.ts';
import { signInWithFirebaseGoogle, signOutFromFirebase } from '../lib/firebase.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile;
  stores: Store[];
  onLoginSuccess: (profile: Profile) => void;
  onLogout: () => void;
  checkoutInterceptNotice?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  stores,
  onLoginSuccess,
  onLogout,
  checkoutInterceptNotice,
}) => {
  if (!isOpen) return null;

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee');
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(false);

  // Google Account Chooser Modal state
  const [showGooglePicker, setShowGooglePicker] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [ministry, setMinistry] = useState<MinistryName | string>('وزارة النقل');
  const [floorNumber, setFloorNumber] = useState('الدور الخامس');
  const [roomNumber, setRoomNumber] = useState('مكتب 504');
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id || 'store-foul-hind');
  const [vehicleType, setVehicleType] = useState('دراجة كهربائية سريعة');

  // Google Mock Accounts
  const GOOGLE_ACCOUNTS = [
    {
      name: 'أحمد محمود النجار',
      email: 'ahmed.m.elnaggar@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      role: 'employee' as UserRole,
      ministry: 'وزارة النقل',
      floor: 'الدور الخامس',
      room: 'مكتب 504 - الإدارة المركزية',
    },
    {
      name: 'م. شريف عبد العظيم',
      email: 'sherif.capital.ops@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      role: 'admin' as UserRole,
      ministry: 'رئاسة مجلس الوزراء',
      floor: 'الدور الثاني',
      room: 'غرفة التحكم المركزية',
    },
    {
      name: 'أحمد رجب (كابتن التوصيل)',
      email: 'captain.rajab.delivery@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      role: 'courier' as UserRole,
      ministry: 'فريق دليفري مجمع الوزارات',
      floor: 'محطة المناديب B1',
      room: 'وحدة التوصيل السريع',
    },
    {
      name: 'الشيف إبراهيم هنداوي',
      email: 'chef.hindawi.foul@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=150&q=80',
      role: 'restaurant' as UserRole,
      ministry: 'فود كورت الحي الحكومي - مبنى C2',
      floor: 'الدور الأرضي',
      room: 'محل رقم 12',
      storeId: 'store-foul-hind',
    },
  ];

  // Pre-configured Demo Personas for 1-Click login
  const demoPersonas: { title: string; subtitle: string; icon: string; profile: Profile }[] = [
    {
      title: 'موظف حكومي (عميل)',
      subtitle: 'أحمد محمود النجار · وزارة النقل الدور 5',
      icon: '👨‍💼',
      profile: {
        id: 'usr-employee-1',
        fullName: 'أحمد محمود النجار',
        phone: '01091234567',
        email: 'a.elnaggar@mot.gov.eg',
        ministry: 'وزارة النقل',
        floorNumber: 'الدور الخامس',
        roomNumber: 'مكتب 504 - الإدارة المركزية',
        walletBalance: 350,
        role: 'employee',
        isGuest: false,
        authProvider: 'email',
      },
    },
    {
      title: 'مدير مطعم (فول هند)',
      subtitle: 'الشيف إبراهيم هنداوي · فود كورت C2',
      icon: '🥘',
      profile: {
        id: 'usr-store-foul',
        fullName: 'إبراهيم هنداوي (مدير فرع فول هند)',
        phone: '01123456789',
        email: 'hind.foul@gov-foodcourt.eg',
        ministry: 'فود كورت الحي الحكومي - مبنى C2',
        floorNumber: 'الدور الأرضي',
        roomNumber: 'محل رقم 12',
        walletBalance: 2400,
        role: 'restaurant',
        storeId: 'store-foul-hind',
        isGuest: false,
        authProvider: 'email',
      },
    },
    {
      title: 'مندوب دليفري الحي الحكومي',
      subtitle: 'أحمد رجب · دراجة كهربائية - قطاع الوزارات A',
      icon: '🛵',
      profile: {
        id: 'usr-courier-ahmed',
        fullName: 'أحمد رجب (مندوب الحي الحكومي)',
        phone: '01099887766',
        email: 'ahmed.rajab@delivery.gov.eg',
        ministry: 'فريق دليفري مجمع الوزارات',
        floorNumber: 'محطة المناديب B1',
        roomNumber: 'وحدة التوصيل السريع',
        walletBalance: 850,
        role: 'courier',
        vehicleType: 'دراجة كهربائية سريعة',
        vehiclePlate: 'س ق و - 442',
        isGuest: false,
        authProvider: 'email',
      },
    },
    {
      title: 'إدارة العمليات المركزية',
      subtitle: 'مشرف قطاع الفود كورت والتوصيل الميداني',
      icon: '🏛️',
      profile: {
        id: 'usr-admin-1',
        fullName: 'م. شريف عبد العظيم (إدارة الحي الحكومي)',
        phone: '01222334455',
        email: 'admin.district@cabinet.gov.eg',
        ministry: 'رئاسة مجلس الوزراء',
        floorNumber: 'الدور الثاني',
        roomNumber: 'غرفة التحكم المركزية',
        walletBalance: 10000,
        role: 'admin',
        isGuest: false,
        authProvider: 'email',
      },
    },
  ];

  const handlePersonaSelect = (profile: Profile) => {
    onLoginSuccess(profile);
    onClose();
  };

  const handleSelectGoogleAccount = (acc: (typeof GOOGLE_ACCOUNTS)[0]) => {
    const profile: Profile = {
      id: 'usr-google-' + Date.now(),
      fullName: acc.name,
      email: acc.email,
      phone: '010' + Math.floor(10000000 + Math.random() * 90000000),
      ministry: acc.ministry,
      floorNumber: acc.floor,
      roomNumber: acc.room,
      walletBalance: 400,
      role: acc.role,
      storeId: acc.storeId,
      avatarUrl: acc.avatar,
      isGuest: false,
      authProvider: 'google',
    };
    onLoginSuccess(profile);
    setShowGooglePicker(false);
    onClose();
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail.trim()) return;

    const profile: Profile = {
      id: 'usr-google-' + Date.now(),
      fullName: customGoogleName.trim() || customGoogleEmail.split('@')[0],
      email: customGoogleEmail.trim(),
      phone: '010' + Math.floor(10000000 + Math.random() * 90000000),
      ministry: 'وزارة النقل',
      floorNumber: 'الدور الخامس',
      roomNumber: 'مكتب الموظف',
      walletBalance: 300,
      role: 'employee',
      isGuest: false,
      authProvider: 'google',
    };
    onLoginSuccess(profile);
    setShowGooglePicker(false);
    onClose();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newProfile: Profile = {
      id: 'usr-' + Date.now(),
      fullName: fullName || (selectedRole === 'employee' ? 'موظف حكومي جديد' : 'مستخدم نظام'),
      phone: phone || '01000000000',
      email: email || 'user@gov.eg',
      ministry: selectedRole === 'employee' ? ministry : 'الحي الحكومي',
      floorNumber: selectedRole === 'employee' ? floorNumber : 'الدور الأرضي',
      roomNumber: selectedRole === 'employee' ? roomNumber : 'مكتب العمل',
      walletBalance: 200,
      role: selectedRole,
      isGuest: false,
      authProvider: 'email',
      storeId: selectedRole === 'restaurant' ? selectedStoreId : undefined,
      vehicleType: selectedRole === 'courier' ? vehicleType : undefined,
    };

    onLoginSuccess(newProfile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full sm:max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Official Logo */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/Capital_Talabat_App_Icon_7e80c871.png"
              alt="شعار طلبات العاصمة"
              className="w-10 h-10 rounded-2xl object-cover shadow-xs border border-orange-200"
            />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                المصادقة وبوابة الحسابات الموحدة
              </h3>
              <p className="text-[11px] text-slate-500">
                الحي الحكومي بالعاصمة الإدارية (موظفين · مطاعم · دليفري · إدارة)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Checkout Intercept Notice Banner */}
        {checkoutInterceptNotice && (
          <div className="bg-amber-500 text-white px-4 py-2.5 text-xs font-semibold flex items-center gap-2 shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{checkoutInterceptNotice}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Prominent Google Sign-In Button (Real Firebase Auth) */}
          <div className="space-y-2">
            <button
              type="button"
              disabled={isFirebaseLoading}
              onClick={async () => {
                setIsFirebaseLoading(true);
                try {
                  const profile = await signInWithFirebaseGoogle({
                    ministry,
                    floorNumber,
                    roomNumber,
                  });
                  onLoginSuccess(profile);
                  onClose();
                } catch {
                  // Fallback to quick Google account chooser if popup is blocked inside iframe
                  setShowGooglePicker(true);
                } finally {
                  setIsFirebaseLoading(false);
                }
              }}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] border-2 border-slate-200 hover:border-slate-300 rounded-2xl shadow-xs flex items-center justify-center gap-3 transition-all text-slate-800 font-bold text-xs sm:text-sm group"
            >
              {isFirebaseLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>
                {authMode === 'login'
                  ? 'تسجيل الدخول الفعلي باستخدام Google (Firebase Auth)'
                  : 'إنشاء حساب موظف جديد باستخدام Google (Firebase Auth)'}
              </span>
            </button>
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] text-slate-400">
                مربوط بمصادقة Google Firebase وقاعدة بيانات Firestore
              </p>
              <button
                type="button"
                onClick={() => setShowGooglePicker(true)}
                className="text-[10px] font-bold text-orange-600 hover:underline"
              >
                أو اختر حساباً سريعاً
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] text-slate-400 font-medium shrink-0">
              أو اختر دوراً تجريبياً / بريد إلكتروني
            </span>
          </div>

          {/* Quick 1-Click Persona Switcher */}
          <div className="bg-orange-50/70 rounded-2xl p-4 border border-orange-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-orange-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-orange-600" />
                الدخول السريع بحساب تجريبي لأي دور (1-Click Demo):
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {demoPersonas.map((persona) => {
                const isCurrent =
                  !currentUser.isGuest &&
                  currentUser.role === persona.profile.role &&
                  currentUser.fullName === persona.profile.fullName;
                return (
                  <button
                    key={persona.profile.id}
                    onClick={() => handlePersonaSelect(persona.profile)}
                    className={`p-3 rounded-xl border text-right transition-all flex items-start gap-2.5 ${
                      isCurrent
                        ? 'bg-white border-orange-500 ring-2 ring-orange-500/20 shadow-xs'
                        : 'bg-white/90 border-slate-200 hover:border-orange-300 hover:bg-white'
                    }`}
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{persona.icon}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate flex items-center gap-1">
                        <span>{persona.title}</span>
                        {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-orange-600 inline" />}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {persona.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Tabs: Login vs Signup */}
          <div className="space-y-3 pt-1">
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors ${
                  authMode === 'login'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                تسجيل الدخول بالبريد
              </button>
              <button
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors ${
                  authMode === 'signup'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                إنشاء حساب جديد بالبريد
              </button>
            </div>

            {/* Role Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                نوع الحساب المطلوب:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { role: 'employee' as UserRole, label: 'موظف عميل', icon: '👨‍💼' },
                  { role: 'restaurant' as UserRole, label: 'مدير مطعم', icon: '🥘' },
                  { role: 'courier' as UserRole, label: 'مندوب دليفري', icon: '🛵' },
                  { role: 'admin' as UserRole, label: 'إدارة الحي', icon: '🏛️' },
                ].map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => setSelectedRole(item.role)}
                    className={`py-2 px-1 rounded-xl border text-center transition-all ${
                      selectedRole === item.role
                        ? 'bg-orange-600 border-orange-600 text-white font-bold shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-base mb-0.5">{item.icon}</span>
                    <span className="text-[10px] leading-tight block truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="space-y-3 pt-1">
              {authMode === 'signup' && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    الاسم بالكامل
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: م. أحمد عبد العزيز"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@ministry.gov.eg"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    رقم الهاتف المحمول
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 text-xs font-mono"
                />
              </div>

              {/* Role specific inputs */}
              {selectedRole === 'employee' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 block text-[11px]">
                    بيانات مقر العمل والتوصيل بالحي الحكومي:
                  </span>
                  <div>
                    <label className="text-[10px] text-slate-600 block mb-0.5">الوزارة التابع لها</label>
                    <select
                      value={ministry}
                      onChange={(e) => setMinistry(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      {MINISTRIES_LIST.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 block mb-0.5">الدور</label>
                      <input
                        type="text"
                        value={floorNumber}
                        onChange={(e) => setFloorNumber(e.target.value)}
                        placeholder="الدور الخامس"
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 block mb-0.5">رقم المكتب</label>
                      <input
                        type="text"
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                        placeholder="مكتب 504"
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedRole === 'restaurant' && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1.5">
                  <label className="font-bold text-amber-950 block text-[11px]">
                    المطعم التابع له بالفود كورت:
                  </label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.locationInDistrict})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedRole === 'courier' && (
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1.5">
                  <label className="font-bold text-emerald-950 block text-[11px]">
                    وسيلة الانتقال في قطاع الوزارات:
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full p-2 bg-white border border-emerald-300 rounded-xl text-xs font-semibold"
                  >
                    <option value="دراجة كهربائية سريعة">دراجة كهربائية سريعة (Eco E-Bike)</option>
                    <option value="سكوتر كهربائي">سكوتر كهربائي ذكي</option>
                    <option value="سيارة جولف مجمع الوزارات">سيارة جولف مجمع الوزارات</option>
                    <option value="مترجل سريع داخل المبنى">مترجل سريع داخل المبنى</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-xs transition-colors text-xs flex items-center justify-center gap-1.5"
              >
                {authMode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                <span>{authMode === 'login' ? 'دخول فوري' : 'تأكيد إنشاء الحساب'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer with logout if currently logged in */}
        {!currentUser.isGuest && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 truncate">
              مسجل حالياً باسم: <strong className="text-slate-900">{currentUser.fullName}</strong>
            </span>
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="text-rose-600 hover:underline font-bold"
            >
              تسجيل الخروج
            </button>
          </div>
        )}

        {/* Google Account Picker Simulated Dialog */}
        {showGooglePicker && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col">
              {/* Google Dialog Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="font-bold text-xs text-slate-800">
                    تسجيل الدخول باستخدام Google
                  </span>
                </div>
                <button
                  onClick={() => setShowGooglePicker(false)}
                  className="w-6 h-6 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                <p className="text-[11px] text-slate-500">
                  اختر حساب Google للمتابعة إلى تطبيق طلبات العاصمة:
                </p>

                <div className="space-y-1.5">
                  {GOOGLE_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      onClick={() => handleSelectGoogleAccount(acc)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-orange-400 hover:bg-orange-50/50 flex items-center gap-3 text-right transition-colors"
                    >
                      <img
                        src={acc.avatar}
                        alt={acc.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-xs truncate">
                          {acc.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate font-mono">
                          {acc.email}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded-md text-slate-600 font-semibold shrink-0">
                        {acc.role === 'employee'
                          ? 'موظف'
                          : acc.role === 'courier'
                          ? 'دليفري'
                          : acc.role === 'restaurant'
                          ? 'مطعم'
                          : 'إدارة'}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Google input */}
                <form
                  onSubmit={handleCustomGoogleSubmit}
                  className="pt-2 border-t border-slate-100 space-y-2"
                >
                  <label className="text-[10px] font-bold text-slate-700 block">
                    أو ادخل أي بريد Google شخصي:
                  </label>
                  <input
                    type="email"
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                  <input
                    type="text"
                    value={customGoogleName}
                    onChange={(e) => setCustomGoogleName(e.target.value)}
                    placeholder="اسمك (اختياري)"
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    متابعة بهذا الحساب
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
