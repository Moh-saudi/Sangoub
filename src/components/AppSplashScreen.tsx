import React, { useEffect, useState } from 'react';

interface AppSplashScreenProps {
  isOpen: boolean;
  onFinish: () => void;
}

const SPLASH_STEPS = [
  'تجهيز قائمة الفود كورت والسوبر ماركت',
  'مزامنة مقرات الـ 34 وزارة بالحي الحكومي',
  'تجهيز حسابك ومحفظتك',
];

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({ isOpen, onFinish }) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setActiveStepIndex(0);
      setIsFadingOut(false);
      return;
    }

    const step1Timer = setTimeout(() => setActiveStepIndex(1), 950);
    const step2Timer = setTimeout(() => setActiveStepIndex(2), 1900);
    const fadeTimer = setTimeout(() => setIsFadingOut(true), 2850);
    const finishTimer = setTimeout(() => {
      onFinish();
    }, 3250);

    return () => {
      clearTimeout(step1Timer);
      clearTimeout(step2Timer);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [isOpen, onFinish]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onFinish}
      dir="rtl"
      className={`absolute inset-0 z-50 bg-white flex flex-col items-center justify-center px-6 select-none cursor-pointer transition-opacity duration-400 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Center Squircle Icon with Rotating Multi-Color Glow */}
      <div className="relative flex items-center justify-center mb-10">
        {/* Outer diffused rotating color aura */}
        <div
          className="absolute -inset-3.5 rounded-[42px] splash-orbit-glow opacity-80 blur-xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Secondary counter-rotating soft color halo */}
        <div
          className="absolute -inset-2 rounded-[38px] splash-orbit-glow-secondary opacity-75 blur-md pointer-events-none"
          aria-hidden="true"
        />

        {/* Crisp edge glow ring */}
        <div
          className="absolute -inset-[3px] rounded-[34px] splash-orbit-glow opacity-90 blur-[2px] pointer-events-none"
          aria-hidden="true"
        />

        {/* White Squircle Card housing the Brand Logo */}
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-[32px] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)] flex items-center justify-center p-4 border border-white/90">
          <img
            src="/brand/capital-talabat-mascot-logo-256x256.png"
            alt="شعار طلبات الحي الحكومي بالعاصمة الإدارية"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-contain drop-shadow-xs"
          />
        </div>
      </div>

      {/* Main Title */}
      <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight text-center mb-5">
        طلبات الحي الحكومي بالعاصمة
      </h1>

      {/* Cascading 3-Line Status Hierarchy (matching the reference design) */}
      <div className="flex flex-col items-center space-y-2.5 text-center min-h-[88px]">
        {SPLASH_STEPS.map((stepText, idx) => {
          const isCurrent = idx === activeStepIndex;
          const isPassed = idx < activeStepIndex;

          return (
            <p
              key={stepText}
              className={`transition-all duration-500 text-xs sm:text-sm ${
                isCurrent
                  ? 'font-bold text-slate-900 scale-100 opacity-100'
                  : isPassed
                  ? 'font-medium text-slate-400 scale-95 opacity-60'
                  : 'font-normal text-slate-300 scale-95 opacity-40'
              }`}
            >
              {stepText}
            </p>
          );
        })}
      </div>

      {/* Subtle bottom caption */}
      <div className="absolute bottom-7 inset-x-0 flex flex-col items-center gap-1 text-center">
        <span className="text-[11px] font-semibold text-slate-400">
          خدمة التوصيل السريع لمكاتب الـ 34 وزارة وهيئة حكومية
        </span>
      </div>
    </div>
  );
};
