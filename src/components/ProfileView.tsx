import React, { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  Building,
  MapPin,
  Wallet,
  Gift,
  Shield,
  Save,
  Check,
  PlusCircle,
  CreditCard,
} from 'lucide-react';
import type { Coupon, Profile } from '../types/index.ts';
import { MINISTRIES_LIST } from '../data/seedData.ts';
import { formatEGP } from '../utils/orderCalculations.ts';

interface ProfileViewProps {
  user: Profile;
  onUpdateProfile: (updated: Profile) => void;
  savedCoupons: Coupon[];
  onSwitchToAdmin: () => void;
  onOpenAuthModal?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUpdateProfile,
  savedCoupons,
  onSwitchToAdmin,
  onOpenAuthModal,
}) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email);
  const [ministry, setMinistry] = useState(user.ministry);
  const [floorNumber, setFloorNumber] = useState(user.floorNumber);
  const [roomNumber, setRoomNumber] = useState(user.roomNumber);
  const [walletBalance, setWalletBalance] = useState(user.walletBalance);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...user,
      fullName,
      phone,
      email,
      ministry,
      floorNumber,
      roomNumber,
      walletBalance,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleTopUp = (amount: number) => {
    const newBal = walletBalance + amount;
    setWalletBalance(newBal);
    onUpdateProfile({
      ...user,
      walletBalance: newBal,
    });
    setTopUpSuccess(true);
    setTimeout(() => setTopUpSuccess(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
      {user.isGuest && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
          <div>
            <h4 className="font-bold text-sm text-slate-900">أنت تتصفح كزائر دون تسجيل دخول</h4>
            <p className="text-xs text-slate-600 mt-0.5">
              سجّل دخولك الآن بحساب Google أو بالبريد لحفظ مقر عملك بالوزارة وشحن محفظتك الرقمية.
            </p>
          </div>
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>تسجيل الدخول مع Google</span>
            </button>
          )}
        </div>
      )}

      {/* Employee ID Badge Card */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-emerald-700/50 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-2xl font-bold">
              👨‍💼
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">{fullName}</h2>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full">
                  موظف حكومي معتمد
                </span>
              </div>
              <p className="text-xs text-emerald-200 mt-0.5 font-medium">
                {ministry} · {floorNumber}
              </p>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5">{email}</p>
            </div>
          </div>

          {/* Wallet summary */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-left shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-emerald-200 mb-0.5">
              <Wallet className="w-3.5 h-3.5" />
              <span>محفظة موظف العاصمة:</span>
            </div>
            <div className="text-lg font-extrabold text-amber-300 tabular-nums">
              {formatEGP(walletBalance)}
            </div>
          </div>
        </div>

        {/* Quick Top-up buttons */}
        <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-[11px] text-slate-300">شحن سريع للمحفظة عبر إنستا باي:</span>
          <div className="flex items-center gap-2">
            {[50, 100, 200].map((amt) => (
              <button
                key={amt}
                onClick={() => handleTopUp(amt)}
                className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-white font-bold transition-colors tabular-nums"
              >
                +{amt} ج.م
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Profile Edit Form */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-700" />
          <span>بيانات مقر العمل وموقع التوصيل بالحي الحكومي</span>
        </h3>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-slate-700 font-bold block mb-1">الاسم بالكامل</label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 text-slate-900"
                  required
                />
                <User className="w-3.5 h-3.5 text-slate-400 absolute top-3 right-2.5" />
              </div>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1">رقم الهاتف (للتواصل مع المندوب)</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500/20 text-slate-900"
                  required
                />
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute top-3 right-2.5" />
              </div>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1">البريد الإلكتروني الحكومي</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500/20 text-slate-900"
                  required
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute top-3 right-2.5" />
              </div>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1">الوزارة أو الهيئة (الـ 34 وزارة)</label>
              <div className="relative">
                <select
                  value={ministry}
                  onChange={(e) => setMinistry(e.target.value)}
                  className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 text-slate-900"
                >
                  {MINISTRIES_LIST.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <Building className="w-3.5 h-3.5 text-slate-400 absolute top-3 right-2.5" />
              </div>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1">رقم الدور بالحي الحكومي</label>
              <div className="relative">
                <input
                  type="text"
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(e.target.value)}
                  placeholder="الدور الخامس"
                  className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 text-slate-900"
                  required
                />
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute top-3 right-2.5" />
              </div>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1">رقم الغرفة / المكتب / الإدارة</label>
              <div className="relative">
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="مكتب 504 - الإدارة المركزية"
                  className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20 text-slate-900"
                  required
                />
                <Building className="w-3.5 h-3.5 text-slate-400 absolute top-3 right-2.5" />
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            {savedSuccess ? (
              <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600" />
                تم حفظ بيانات الموظف بنجاح
              </span>
            ) : <span />}

            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </form>
      </div>

      {/* Saved Employee Coupons */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber-600" />
          <span>القسائم المتاحة في محفظتك</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {savedCoupons.map((coupon) => (
            <div
              key={coupon.code}
              className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/80 text-right space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs bg-amber-400 text-slate-900 px-2 py-0.5 rounded">
                  {coupon.code}
                </span>
                <span className="text-xs font-extrabold text-amber-900">
                  {coupon.discountType === 'fixed' ? `${coupon.value} ج.م خصم` : `${coupon.value}% خصم`}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900">{coupon.title}</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">{coupon.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Switch to Admin Quick Access */}
      <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-slate-900 block">إدارة الفود كورت والعمليات</span>
          <span className="text-[11px] text-slate-500">
            للمشرفين ومسؤولي تعيين المناديب ومتابعة طلبات الموظفين
          </span>
        </div>

        <button
          onClick={onSwitchToAdmin}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
        >
          فتح لوحة الإدارة
        </button>
      </div>
    </div>
  );
};
