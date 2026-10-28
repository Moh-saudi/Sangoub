import React from 'react';
import { BRAND } from '../../brand';
import { useStore } from '../context/StoreContext';
import { LAUNCH_CONFIG } from '../../config/launchConfig';
import { Truck, ShieldCheck, Clock, Phone } from 'lucide-react';

export const StoreFooter: React.FC = () => {
  const { navigate } = useStore();

  const handleNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <footer className="bg-[#131921] text-[#ccc] text-xs pt-4 pb-16 sm:pb-4 border-t border-white/10 hidden sm:block select-none" dir="rtl">
      <div className="sg-container">

        {/* 1. Ultra-Compact Trust Strip */}
        <div className="flex items-center justify-around py-2.5 border-b border-white/10 text-[11px] text-[#aaa] flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Truck size={14} className="text-[#FF5900]" />
            <span>توصيل سريع وموثوق داخل {LAUNCH_CONFIG.serviceAreaLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-[#FF5900]" />
            <span>توصيل مباشر لحد بابك</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#FF5900]" />
            <span>أصناف ومقاضي طازجة ومختارة بعناية</span>
          </div>
        </div>

        {/* 2. Compact Links & Brand Row */}
        <div className="flex items-center justify-between py-3 flex-wrap gap-3">
          
          {/* Logo & Slogan */}
          <div className="flex items-center gap-2">
            <img
              src="/brand/sangoub-mark-white-128.png"
              alt="سنجوب"
              className="w-6 h-6 object-contain rounded-md"
            />
            <span className="font-black text-[#FF5900] text-sm">سنجوب</span>
            <span className="text-[10px] text-[#888]">تطبيق التوصيل الذكي</span>
          </div>

          {/* Quick Links */}
          <div className="flex items-center gap-3 text-[11px] flex-wrap">
            <a href="/" onClick={handleNav('/')} className="hover:text-white transition-colors">الرئيسية</a>
            <span className="text-white/20">|</span>
            <a href="/categories" onClick={handleNav('/categories')} className="hover:text-white transition-colors">الأقسام</a>
            <span className="text-white/20">|</span>
            <a href="/stores" onClick={handleNav('/stores')} className="hover:text-white transition-colors">المتاجر</a>
            <span className="text-white/20">|</span>
            <a href="/offers" onClick={handleNav('/offers')} className="hover:text-white transition-colors">العروض</a>
            <span className="text-white/20">|</span>
            <a href="/policies/terms" onClick={handleNav('/policies/terms')} className="hover:text-white transition-colors">الشروط</a>
            <span className="text-white/20">|</span>
            <a
              href={BRAND.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#25D366] hover:underline flex items-center gap-1 font-bold"
            >
              <Phone size={11} />
              <span>واتساب الدعم</span>
            </a>
          </div>

          {/* Copyright & Entity */}
          <div className="text-[10px] text-[#777]">
            © {new Date().getFullYear()} سنجوب (Sangoub) - {LAUNCH_CONFIG.entityLine}
          </div>

        </div>

      </div>
    </footer>
  );
};
