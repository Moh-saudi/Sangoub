import React from 'react';
import { useStore } from '../context/StoreContext';
import { Home, LayoutGrid, Tag, ShoppingBag, User } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const { currentPath, navigate, cartItems, user } = useStore();
  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const tabs = [
    { label: 'الرئيسية', path: '/', icon: Home },
    { label: 'الأقسام',  path: '/categories', icon: LayoutGrid },
    { label: 'العروض',   path: '/offers',     icon: Tag },
    { label: 'السلة',    path: '/cart',        icon: ShoppingBag, badge: totalCartCount },
    { label: user ? 'حسابي' : 'الدخول', path: user ? '/account' : '/login', icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] px-3 py-1.5 flex items-center justify-around sm:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      dir="rtl"
      aria-label="شريط التنقل السفلي"
      role="navigation"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.path === '/'
          ? currentPath === '/'
          : currentPath.startsWith(tab.path);

        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all cursor-pointer relative ${
              isActive ? 'text-[#FF5A00] font-black' : 'text-[#6B7280] font-bold hover:text-[#111827]'
            }`}
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.label}
          >
            <div className="relative flex items-center justify-center">
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                aria-hidden="true"
                className={`transition-transform ${isActive ? 'scale-110' : ''}`}
              />
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1.5 -left-2 bg-[#FF5A00] text-white text-[9px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-xs">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A00] mt-0.5" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
