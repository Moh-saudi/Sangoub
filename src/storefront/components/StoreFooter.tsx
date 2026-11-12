import React from 'react';
import { useStore } from '../context/StoreContext';
import { BRAND } from '../../brand';

export const StoreFooter: React.FC = () => {
  const { navigate } = useStore();

  const handleNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <footer className="bg-white border-t border-[#E5E7EB] text-[#6B7280] text-[11px] py-3.5 select-none" dir="rtl">
      <div className="sg-container px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Copyright & Entity */}
          <div className="text-[11px] text-[#9CA3AF] order-2 sm:order-1">
            © 2026 سنجوب · شركة ميسك للتكنولوجيا
          </div>

          {/* Cloudflare-style Clean Links */}
          <div className="flex items-center gap-2 sm:gap-3 text-[11px] flex-wrap justify-center order-1 sm:order-2">
            <a
              href={BRAND.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6B7280] hover:text-[#FF5900] transition-colors"
            >
              الدعم
            </a>
            <span className="text-[#D1D5DB]">|</span>
            <a
              href="/careers"
              onClick={handleNav('/careers')}
              className="text-[#6B7280] hover:text-[#FF5900] transition-colors"
            >
              الوظائف
            </a>
            <span className="text-[#D1D5DB]">|</span>
            <a
              href="/terms"
              onClick={handleNav('/terms')}
              className="text-[#6B7280] hover:text-[#FF5900] transition-colors"
            >
              الشروط والأحكام
            </a>
            <span className="text-[#D1D5DB]">|</span>
            <a
              href="/privacy"
              onClick={handleNav('/privacy')}
              className="text-[#6B7280] hover:text-[#FF5900] transition-colors"
            >
              سياسة الخصوصية
            </a>
          </div>

        </div>
      </div>
    </footer>
  );
};
