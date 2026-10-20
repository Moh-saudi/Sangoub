import React from 'react';
import { Sparkles, Globe, Smartphone, Handshake, Briefcase } from 'lucide-react';
import type { Profile, UserRole } from '../types/index.ts';
import type { WebsitePage } from './CorporateWebsite.tsx';

interface RoleSwitcherBarProps {
  currentUser: Profile;
  isWebsiteOpen: boolean;
  onOpenWebsite: (page?: WebsitePage) => void;
  onOpenMobileApp: () => void;
  onSwitchPersona: (role: UserRole) => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export const RoleSwitcherBar: React.FC<RoleSwitcherBarProps> = ({
  currentUser,
  isWebsiteOpen,
  onOpenWebsite,
  onOpenMobileApp,
  onSwitchPersona,
  onOpenAuthModal,
  onLogout,
}) => {
  const getRoleBadge = (role: UserRole) => {
    if (currentUser.isGuest) {
      return {
        label: 'زائر يتصفح بدون تسجيل',
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
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          icon: '🥘',
        };
      case 'courier':
        return {
          label: 'مندوب دليفري الحي الحكومي',
          bg: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
          icon: '🛵',
        };
      case 'admin':
        return {
          label: 'إدارة العمليات والتحكم',
          bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          icon: '🏛️',
        };
    }
  };

  const badge = getRoleBadge(currentUser.role);

  return (
    <div
      className="bg-slate-900 text-white border-b border-slate-800 text-xs py-2 px-3 sm:px-4"
      dir="rtl"
    >
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-2">
        {/* Left/Right Mode Switcher: Website vs Mobile App */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-start overflow-x-auto no-scrollbar">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => onOpenWebsite('home')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isWebsiteOpen
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>الموقع الرسمي واللاندنج بيدج</span>
            </button>

            <button
              type="button"
              onClick={onOpenMobileApp}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !isWebsiteOpen
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>تطبيق الموبايل</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenWebsite('partners')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Handshake className="w-3 h-3" />
            <span>انضم كشريك</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenWebsite('careers')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Briefcase className="w-3 h-3" />
            <span>الوظائف</span>
          </button>

          <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-slate-300 shrink-0">
            <span className="text-slate-500">|</span>
            <div
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${badge.bg}`}
            >
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </div>
          </div>
        </div>

        {/* Quick Role Toggle Bar */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto overflow-x-auto no-scrollbar justify-start lg:justify-end py-0.5">
          <span className="text-[10px] text-slate-400 font-bold shrink-0 ml-1">
            تبديل الدور بالتطبيق:
          </span>

          <button
            type="button"
            onClick={() => {
              onOpenMobileApp();
              onLogout();
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
              !isWebsiteOpen && currentUser.isGuest
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>👤</span>
            <span>تصفح كزائر</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenMobileApp();
              onSwitchPersona('employee');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
              !isWebsiteOpen && !currentUser.isGuest && currentUser.role === 'employee'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>👨‍💼</span>
            <span>موظف عميل</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenMobileApp();
              onSwitchPersona('restaurant');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
              !isWebsiteOpen && currentUser.role === 'restaurant'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>🥘</span>
            <span>شيف المطعم</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenMobileApp();
              onSwitchPersona('courier');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
              !isWebsiteOpen && currentUser.role === 'courier'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>🛵</span>
            <span>كابتن الدليفري</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenMobileApp();
              onSwitchPersona('admin');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
              !isWebsiteOpen && currentUser.role === 'admin'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>🏛️</span>
            <span>لوحة الإدارة</span>
          </button>

          <button
            type="button"
            onClick={onOpenAuthModal}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 bg-slate-700 hover:bg-slate-600 text-orange-300 transition-colors flex items-center gap-1 border border-slate-600 cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-orange-400" />
            <span>تسجيل حساب</span>
          </button>
        </div>
      </div>
    </div>
  );
};
