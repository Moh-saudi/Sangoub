import React from 'react';
import { Home, ClipboardList, User, ShieldCheck, Bike, ChefHat } from 'lucide-react';
import type { UserRole } from '../types/index.ts';

interface BottomNavBarProps {
  userRole: UserRole;
  activeTab: 'home' | 'orders' | 'profile' | 'admin' | 'courier' | 'restaurant';
  setActiveTab: (tab: 'home' | 'orders' | 'profile' | 'admin' | 'courier' | 'restaurant') => void;
  activeOrdersCount: number;
  isSimulator?: boolean;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  userRole,
  activeTab,
  setActiveTab,
  activeOrdersCount,
  isSimulator = false,
}) => {
  return (
    <nav
      className={
        isSimulator
          ? 'sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-sm px-2 h-16 flex items-center justify-around w-full shrink-0'
          : 'fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 h-16 flex items-center justify-around max-w-xl mx-auto sm:rounded-t-2xl sm:border-x'
      }
      aria-label="شريط التنقل الرئيسي للتطبيق"
      dir="rtl"
    >
      {/* If Courier */}
      {userRole === 'courier' && (
        <>
          <button
            onClick={() => setActiveTab('courier')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors select-none ${
              activeTab === 'courier' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center relative transition-all ${
                activeTab === 'courier' ? 'bg-teal-50 text-teal-700' : ''
              }`}
            >
              <Bike className="w-5 h-5" />
              {activeOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-teal-600 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                  {activeOrdersCount}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">مهام الدليفري</span>
          </button>

          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors select-none ${
              activeTab === 'home' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'home' ? 'bg-teal-50 text-teal-700' : ''
              }`}
            >
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">معاينة المتجر</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors select-none ${
              activeTab === 'profile' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'profile' ? 'bg-teal-50 text-teal-700' : ''
              }`}
            >
              <User className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">محفظتي وعهدتي</span>
          </button>
        </>
      )}

      {/* If Restaurant */}
      {userRole === 'restaurant' && (
        <>
          <button
            onClick={() => setActiveTab('restaurant')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors select-none ${
              activeTab === 'restaurant' ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center relative transition-all ${
                activeTab === 'restaurant' ? 'bg-amber-50 text-amber-700' : ''
              }`}
            >
              <ChefHat className="w-5 h-5" />
              {activeOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-600 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                  {activeOrdersCount}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">مطبخ المطعم</span>
          </button>

          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors select-none ${
              activeTab === 'home' ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'home' ? 'bg-amber-50 text-amber-700' : ''
              }`}
            >
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">قائمة الفود كورت</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors select-none ${
              activeTab === 'profile' ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'profile' ? 'bg-amber-50 text-amber-700' : ''
              }`}
            >
              <User className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">حساب المطعم</span>
          </button>
        </>
      )}

      {/* If Employee or Admin */}
      {(userRole === 'employee' || userRole === 'admin') && (
        <>
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors select-none ${
              activeTab === 'home' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-label="الرئيسية"
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'home' ? 'bg-emerald-50 text-emerald-700' : ''
              }`}
            >
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">الرئيسية</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors select-none relative ${
              activeTab === 'orders' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-label="طلباتي"
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center relative transition-all ${
                activeTab === 'orders' ? 'bg-emerald-50 text-emerald-700' : ''
              }`}
            >
              <ClipboardList className="w-5 h-5" />
              {activeOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                  {activeOrdersCount}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">طلباتي</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors select-none ${
              activeTab === 'profile' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-label="حسابي"
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'profile' ? 'bg-emerald-50 text-emerald-700' : ''
              }`}
            >
              <User className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">حسابي</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors select-none ${
              activeTab === 'admin' ? 'text-purple-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-label="لوحة تحكم الإدارة"
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'admin' ? 'bg-purple-100 text-purple-700' : ''
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight">الإدارة</span>
          </button>
        </>
      )}
    </nav>
  );
};
