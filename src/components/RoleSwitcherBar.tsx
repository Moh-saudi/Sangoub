import React from 'react';
import {
  Users,
  User,
  Store as StoreIcon,
  Bike,
  ShieldAlert,
  ArrowRightLeft,
  ChevronDown,
  Sparkles,
  LogOut,
} from 'lucide-react';
import type { Profile, UserRole } from '../types/index.ts';

interface RoleSwitcherBarProps {
  currentUser: Profile;
  onSwitchPersona: (role: UserRole) => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export const RoleSwitcherBar: React.FC<RoleSwitcherBarProps> = ({
  currentUser,
  onSwitchPersona,
  onOpenAuthModal,
  onLogout,
}) => {
  const getRoleBadge = (role: UserRole) => {
    if (currentUser.isGuest) {
      return {
        label: 'زائر يتصفح بدون تسجيل (مرحلة الاستكشاف)',
        bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        icon: '👤',
      };
    }
    switch (role) {
      case 'employee':
        return {
          label: 'موظف حكومي (عميل)',
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          icon: '👨‍💼',
        };
      case 'restaurant':
        return {
          label: 'مطعم / شيف الفود كورت',
          bg: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
          icon: '🥘',
        };
      case 'courier':
        return {
          label: 'مندوب دليفري الحي الحكومي',
          bg: 'bg-teal-500/15 text-teal-700 border-teal-500/30',
          icon: '🛵',
        };
      case 'admin':
        return {
          label: 'إدارة العمليات والتحكم',
          bg: 'bg-purple-500/15 text-purple-700 border-purple-500/30',
          icon: '🏛️',
        };
    }
  };

  const badge = getRoleBadge(currentUser.role);

  return (
    <div className="bg-slate-900 text-white border-b border-slate-800 text-xs py-2 px-3 sm:px-4" dir="rtl">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
        {/* Current Active Account Status */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[11px] text-slate-300 font-medium">الحساب الحالي:</span>
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${badge.bg}`}
            >
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 font-bold flex items-center gap-1">
            <span className="text-white">{currentUser.fullName}</span>
            {currentUser.ministry && (
              <span className="text-slate-400 hidden sm:inline">
                ({currentUser.ministry} - {currentUser.floorNumber})
              </span>
            )}
          </div>
        </div>

        {/* Quick Role Toggle Bar */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar justify-start md:justify-end py-0.5">
          <span className="text-[10px] text-slate-400 font-bold shrink-0 ml-1">
            تبديل فوري للدور:
          </span>

          <button
            onClick={onLogout}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 ${
              currentUser.isGuest
                ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            title="تصفح كزائر دون تسجيل دخول لاختبار تجربة الطلب بدون حساب"
          >
            <span>👤</span>
            <span>تصفح كزائر</span>
          </button>

          <button
            onClick={() => onSwitchPersona('employee')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 ${
              !currentUser.isGuest && currentUser.role === 'employee'
                ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>👨‍💼</span>
            <span>موظف عميل</span>
          </button>

          <button
            onClick={() => onSwitchPersona('restaurant')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 ${
              currentUser.role === 'restaurant'
                ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>🥘</span>
            <span>شيف المطعم</span>
          </button>

          <button
            onClick={() => onSwitchPersona('courier')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 ${
              currentUser.role === 'courier'
                ? 'bg-teal-600 text-white shadow-xs ring-1 ring-teal-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>🛵</span>
            <span>كابتن الدليفري</span>
          </button>

          <button
            onClick={() => onSwitchPersona('admin')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 ${
              currentUser.role === 'admin'
                ? 'bg-purple-600 text-white shadow-xs ring-1 ring-purple-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>🏛️</span>
            <span>الإدارة</span>
          </button>

          <button
            onClick={onOpenAuthModal}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 bg-slate-700 hover:bg-slate-600 text-orange-300 transition-colors flex items-center gap-1 border border-slate-600"
          >
            <Sparkles className="w-3 h-3 text-orange-400" />
            <span>تسجيل حساب</span>
          </button>
        </div>
      </div>
    </div>
  );
};
