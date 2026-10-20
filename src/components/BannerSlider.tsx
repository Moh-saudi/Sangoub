import React, { useState, useEffect } from 'react';
import { Tag, Sparkles, ChevronLeft, ChevronRight, Gift, Check, Clock } from 'lucide-react';

interface BannerSliderProps {
  onApplyCoupon: (code: string) => void;
}

export const BannerSlider: React.FC<BannerSliderProps> = ({ onApplyCoupon }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const banners = [
    {
      id: 'b1',
      title: 'خصم 100 جنيه لموظفي الحي الحكومي',
      subtitle: 'ساري على طلبات الفطور والغداء بحد أدنى 250 ج.م بكود',
      code: 'GOV100',
      badge: 'عرض حصري لـ 34 وزارة',
      imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80',
      bgGradient: 'from-emerald-950/90 via-teal-900/80 to-slate-900/60',
      tag: 'قسيمة الشراء الرسمية',
    },
    {
      id: 'b2',
      title: 'توصيل فوري مجاني لأدوار ومكاتب الوزارات',
      subtitle: 'اطلب من فود كورت C2 ومندوبنا يوصلك لمكتبك في 15 دقيقة',
      code: 'CAPITAL50',
      badge: 'خدمة سريعة في 15 دقيقة',
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80',
      bgGradient: 'from-amber-950/90 via-orange-950/80 to-slate-900/60',
      tag: 'سكان المجمع الوزاري',
    },
    {
      id: 'b3',
      title: 'خصم 20% على طلبات الصباح والقهوة',
      subtitle: 'ابدأ يومك بفول هند وسندوتشات الطعمية وقهوة الرمالة',
      code: 'NEWCAP20',
      badge: 'فول هند & ديوان كافيه',
      imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80',
      bgGradient: 'from-teal-950/90 via-cyan-950/80 to-slate-900/60',
      tag: 'فطور الدوام الرسمي',
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [banners.length]);

  const activeBanner = banners[currentIndex];

  const handleCopy = (code: string) => {
    onApplyCoupon(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-sm border border-slate-200/80 my-3 group">
      {/* Real Photo Background */}
      <img
        src={activeBanner.imageUrl}
        alt={activeBanner.title}
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 scale-105 group-hover:scale-100"
      />

      {/* Rich Directional Gradient Overlay */}
      <div
        className={`relative z-10 bg-gradient-to-l ${activeBanner.bgGradient} p-5 sm:p-6 text-white min-h-[175px] flex flex-col justify-between backdrop-blur-[1px]`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white shadow-xs border border-white/20">
            <Gift className="w-3.5 h-3.5 text-amber-300" />
            <span>{activeBanner.tag}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-white/90 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
            <Clock className="w-3 h-3 text-amber-300" />
            <span>{activeBanner.badge}</span>
          </div>
        </div>

        <div className="my-1">
          <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white mb-1 drop-shadow-sm">
            {activeBanner.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-100 max-w-md font-medium drop-shadow-xs">
            {activeBanner.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-white/15">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/80 font-bold">كود الخصم:</span>
            <span className="font-mono font-black text-sm tracking-wider bg-black/40 px-3 py-1 rounded-lg text-amber-300 border border-amber-300/40 shadow-inner">
              {activeBanner.code}
            </span>
          </div>

          <button
            onClick={() => handleCopy(activeBanner.code)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            {copiedCode === activeBanner.code ? (
              <>
                <Check className="w-4 h-4 text-emerald-950" />
                <span>تم التفعيل في السلة!</span>
              </>
            ) : (
              <>
                <Tag className="w-3.5 h-3.5" />
                <span>تطبيق القسيمة الآن</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={() => setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all z-20 cursor-pointer"
        aria-label="السابق"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <button
        onClick={() => setCurrentIndex((prev) => (prev + 1) % banners.length)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all z-20 cursor-pointer"
        aria-label="التالي"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Indicator dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
        {banners.map((b, idx) => (
          <button
            key={b.id}
            onClick={() => setCurrentIndex(idx)}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              idx === currentIndex ? 'w-6 bg-amber-400' : 'w-2 bg-white/50'
            }`}
            aria-label={`شريحة رقم ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
