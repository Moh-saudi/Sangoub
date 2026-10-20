import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, Check, ArrowLeft, X } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGoogleAuth?: () => void;
}

export const ONBOARDING_SLIDES = [
  {
    id: 1,
    image: '/assets/aistudio/1__1__017f51f7.png',
    tag: 'مرحباً بك في العاصمة الإدارية',
    title: 'وجبات الفود كورت تصلك أينما كنت',
    subtitle: 'طلب وتوصيل وجبات المطاعم والسوبر ماركت لموظفي الـ 34 وزارة بالحي الحكومي بدقة فائقة حتى باب مكتبك.',
    badge: 'توصيل مكتبي حصري',
  },
  {
    id: 2,
    image: '/assets/aistudio/1__2__0c86e0f9.png',
    tag: 'سرعة وكفاءة',
    title: 'كباتن دليفري متخصصون داخل الوزارات',
    subtitle: 'أسطول مناديب مدرب ومصرح له بالدخول للأدوار والمكاتب مع فحص ومراجعة استلام الطلب وتسوية المبالغ.',
    badge: 'مندوب خاص لكل قطاع',
  },
  {
    id: 3,
    image: '/assets/aistudio/1__3__cdd090d3.png',
    tag: 'طرق دفع متطورة',
    title: 'ادفع بأمان عبر إنستا باي والبطاقات البنكية',
    subtitle: 'دعم كامل للدفع اللحظي عبر InstaPay، بطاقات Visa وميزة، وبوابة جيديا المعتمدة، أو نقداً عند استلام الأوردر.',
    badge: 'دفع رسمي معتمد',
  },
  {
    id: 4,
    image: '/assets/aistudio/1__4__b6830189.png',
    tag: 'تتبع لحظي وتجربة ذكية',
    title: 'تصفح بحرية واطلب بكل سهولة',
    subtitle: 'تصفح قائمة الطعام والعروض بدون الحاجة لتسجيل دخول مسبق. سجل حسابك فقط عند إتمام الطلب لتحديد مكتبك.',
    badge: 'ابدأ الآن دون تعقيد',
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onOpenGoogleAuth,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const slide = ONBOARDING_SLIDES[currentSlide];
  const isLast = currentSlide === ONBOARDING_SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentSlide((prev) => Math.min(prev + 1, ONBOARDING_SLIDES.length - 1));
    }
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-md sm:max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[95vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 z-10">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/Capital_Talabat_App_Icon_7e80c871.png"
              alt="طلبات العاصمة"
              className="w-8 h-8 rounded-xl object-cover shadow-xs border border-orange-200"
            />
            <div>
              <span className="font-bold text-xs sm:text-sm text-slate-900 block leading-tight">
                طلبات العاصمة الإدارية
              </span>
              <span className="text-[10px] text-orange-600 font-medium">
                جولة تعريفية بالتطبيق المكتبي
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              تخطي
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Slide Visual Area */}
        <div className="relative bg-gradient-to-b from-orange-50/40 via-white to-slate-50 overflow-hidden flex-1 flex flex-col">
          {/* Main Onboarding Visual with Real Screen Asset */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
            <img
              src={slide.image}
              alt={slide.title}
              key={slide.id}
              className="w-full h-full object-cover sm:object-contain animate-in fade-in zoom-in-95 duration-300"
            />

            {/* Badge pill over image */}
            <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs px-3 py-1 rounded-full shadow-sm border border-orange-200 text-orange-700 font-bold text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span>{slide.badge}</span>
            </div>

            {/* Official App Logo Overlay in Corner */}
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs p-1 rounded-xl shadow-xs border border-slate-200 flex items-center gap-1.5 px-2">
              <img
                src="/assets/aistudio/Capital_Talabat_App_Icon_7e80c871.png"
                alt="Logo"
                className="w-5 h-5 rounded-md object-cover"
              />
              <span className="text-[10px] font-bold text-slate-700">طلبات العاصمة</span>
            </div>
          </div>

          {/* Slide Description Content */}
          <div className="p-5 sm:p-6 flex flex-col justify-between flex-1">
            <div className="space-y-2 text-center">
              <span className="inline-block px-3 py-0.5 bg-orange-100 text-orange-800 text-[11px] font-bold rounded-full">
                {slide.tag}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {slide.title}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                {slide.subtitle}
              </p>
            </div>

            {/* Pagination Dots */}
            <div className="flex items-center justify-center gap-2 my-4">
              {ONBOARDING_SLIDES.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentSlide
                      ? 'w-8 bg-orange-600'
                      : 'w-2 bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`شريحة رقم ${idx + 1}`}
                />
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2.5 pt-1">
              {isLast ? (
                <div className="space-y-2">
                  <button
                    onClick={onClose}
                    className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md shadow-orange-600/25 flex items-center justify-center gap-2 transition-all"
                  >
                    <span>ابدأ التصفح والطلب الآن</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {onOpenGoogleAuth && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenGoogleAuth();
                      }}
                      className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-2xs"
                    >
                      {/* Google G SVG */}
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                      <span>أو سجّل مسبقاً بحساب Google</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {currentSlide > 0 && (
                    <button
                      onClick={handlePrev}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span>السابق</span>
                    </button>
                  )}

                  <button
                    onClick={handleNext}
                    className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>التالي</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}

              <p className="text-[10px] text-center text-slate-400">
                التطبيق يفتح للتصفح المباشر دون الحاجة لحساب حتى مرحلة الدفع
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
