import React from "react";
import {
  Bell,
  MapPin,
  ChevronDown,
  Smartphone,
  LayoutDashboard,
  Bike,
  ChefHat,
  UserCheck,
  Sparkles,
  LogIn,
  Rocket,
} from "lucide-react";
import type { AppNotification, Profile } from "../types/index.ts";

interface HeaderBarProps {
  user: Profile;
  activeTab: "home" | "orders" | "profile" | "admin" | "courier" | "restaurant";
  setActiveTab: (
    tab: "home" | "orders" | "profile" | "admin" | "courier" | "restaurant",
  ) => void;
  onOpenLocationModal: () => void;
  notifications: AppNotification[];
  onOpenNotifications: () => void;
  onOpenAuthModal: () => void;
  unreadCount: number;
  isSimulatorActive?: boolean;
  onToggleSimulator?: () => void;
  onOpenOnboarding?: () => void;
  onOpenMobileRelease?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenLocationModal,
  notifications: _notifications,
  onOpenNotifications,
  onOpenAuthModal,
  unreadCount,
  isSimulatorActive = false,
  onToggleSimulator,
  onOpenOnboarding,
  onOpenMobileRelease,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2">
        {/* Right side in RTL: District Brand with Official Logo & Location Selector */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            onClick={() => setActiveTab("home")}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden shadow-xs shrink-0 cursor-pointer border border-orange-200 hover:scale-105 transition-transform bg-white"
            title="الصفحة الرئيسية - طلبات العاصمة"
          >
            <img
              src="/brand/capital-talabat-mascot-logo-256x256.png"
              alt="شعار طلبات العاصمة"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] sm:text-xs font-black text-slate-900 tracking-tight whitespace-nowrap">
                طلبات العاصمة الإدارية
              </span>
              <span className="text-[9px] sm:text-[10px] text-orange-800 bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200/60 font-bold hidden xs:inline-block">
                34 وزارة
              </span>
            </div>

            {/* Tap to change ministry/floor */}
            <button
              onClick={onOpenLocationModal}
              className="flex items-center gap-1 text-slate-700 text-[11px] sm:text-xs font-semibold hover:text-orange-600 transition-colors group text-right truncate max-w-[140px] xs:max-w-[190px] sm:max-w-xs cursor-pointer"
              title="تغيير الوزارة ومكان التوصيل"
            >
              <MapPin className="w-3 h-3 text-orange-600 shrink-0" />
              <span className="truncate">
                {user.ministry || "اختر الوزارة"} ·{" "}
                {user.floorNumber || "الدور"}
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-slate-400 group-hover:text-orange-600 shrink-0" />
            </button>
          </div>
        </div>

        {/* Center / Left Controls: Portal Switchers, Simulator, Onboarding & Notifications */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Google Play & Firebase Mobile Release Button */}
          {onOpenMobileRelease && (
            <button
              onClick={onOpenMobileRelease}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="تثبيت تطبيق طلبات العاصمة"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                نسخة الموبايل & Google Play
              </span>
            </button>
          )}

          {/* Mobile Simulator Toggle Button */}
          {onToggleSimulator && (
            <button
              onClick={onToggleSimulator}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isSimulatorActive
                  ? "bg-orange-600 text-white border-orange-600 shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200"
              }`}
              title="تجربة محاكي الهاتف الذكي الفعلي"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isSimulatorActive ? "إغلاق المحاكي" : "محاكي الموبايل"}
              </span>
            </button>
          )}

          {/* Onboarding Slides Replay Button */}
          {onOpenOnboarding && (
            <button
              onClick={onOpenOnboarding}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-900 text-xs font-bold transition-colors cursor-pointer"
              title="عرض شاشات الـ Onboarding الأربعة المعتمدة"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>الـ Onboarding</span>
            </button>
          )}

          {/* Quick Portal Switch Pills */}
          <div className="hidden lg:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setActiveTab("home")}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                activeTab === "home" || activeTab === "orders"
                  ? "bg-white text-orange-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>المتجر</span>
            </button>

            {user.role === "restaurant" && (
              <button
                onClick={() => setActiveTab("restaurant")}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "restaurant"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>المطبخ</span>
              </button>
            )}

            {user.role === "courier" && (
              <button
                onClick={() => setActiveTab("courier")}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "courier"
                    ? "bg-teal-700 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                <span>الدليفري</span>
              </button>
            )}

            {user.role === "admin" && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "admin"
                    ? "bg-purple-700 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>الإدارة</span>
              </button>
            )}
          </div>

          {/* User Account / Auth Trigger */}
          {user.isGuest ? (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-transform cursor-pointer"
              title="تسجيل الدخول بحساب Google أو إنشاء حساب"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>دخول / Google</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              title="تبديل الحساب أو تسجيل الخروج"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-orange-600" />
              )}
              <span className="hidden sm:inline truncate max-w-[90px]">
                {user.fullName.split(" ")[0]}
              </span>
            </button>
          )}

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="الإشعارات وتحديثات الطلبات"
          >
            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-600 text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-xs">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
