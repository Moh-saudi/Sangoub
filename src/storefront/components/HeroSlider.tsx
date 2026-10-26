import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { ChevronRight, ChevronLeft, Sparkles, ArrowLeft } from 'lucide-react';

interface HeroSliderProps {
  onOpenAreaModal?: () => void;
}

export const HeroSlider: React.FC<HeroSliderProps> = () => {
  const { navigate } = useStore();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const slides = [
    {
      id: 1,
      tag: 'أسرع توصيل طلبات',
      title: 'سنجوب يوصلك لحد باب بيتك أو مكتبك 🐿️',
      desc: 'خدمة التوصيل السريع لطلبك في 15-25 دقيقة أينما كنت.',
      btnText: 'اطلب الآن',
      targetPath: '/categories',
      badgeColor: '#FF5900',
      bgGradient: 'linear-gradient(135deg, #131921 0%, #1F2937 100%)',
      mascotImg: '/assets/sangoub/mascot-cheerful.png',
    },
    {
      id: 2,
      tag: 'فطور الصباح الساخن',
      title: 'قهوة وفطور طازج لبداية يوم مميز ☕',
      desc: 'ساندوتشات ومخبوزات ومشروبات ساخنة بأعلى جودة.',
      btnText: 'عروض الفطور',
      targetPath: '/categories',
      badgeColor: '#E65100',
      bgGradient: 'linear-gradient(135deg, #1E1B4B 0%, #2E1065 100%)',
      mascotImg: '/assets/sangoub/mascot-delivery.png',
    },
    {
      id: 3,
      tag: 'بقالة في 20د',
      title: 'سنجوب بقالة ومقاضي البيت السريعة 🛒',
      desc: 'ألبان ومياه وسناكس ومستلزماتك بأسرع توصيل.',
      btnText: 'تسوق البقالة',
      targetPath: '/categories',
      badgeColor: '#059669',
      bgGradient: 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
      mascotImg: '/assets/sangoub/mascot-trio.png',
    },
  ];

  // Auto-slide every 5 seconds
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused, slides.length]);

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    // RTL: swiping right-to-left diff > 40 means next
    if (diff > 40) {
      handleNext();
    } else if (diff < -40) {
      handlePrev();
    }
    touchStartX.current = null;
  };

  return (
    <div
      className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs select-none bg-[#131921] w-full"
      dir="rtl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Slide Frame (Compact 135px on Mobile, 175px on Tablet, 210px on Desktop) ── */}
      <div className="relative w-full h-[135px] sm:h-[175px] md:h-[210px]">
        {slides.map((slide, index) => {
          const isActive = currentSlide === index;

          return (
            <div
              key={slide.id}
              onClick={() => navigate(slide.targetPath)}
              className={`absolute inset-0 transition-opacity duration-300 ease-in-out cursor-pointer ${
                isActive
                  ? 'opacity-100 pointer-events-auto z-10'
                  : 'opacity-0 pointer-events-none z-0'
              }`}
              style={{ background: slide.bgGradient }}
            >
              {/* Radial texture pattern */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

              {/* Flex Content Box */}
              <div className="relative z-10 w-full h-full px-3.5 py-2.5 sm:px-8 sm:py-5 flex items-center justify-between gap-2.5">
                
                {/* Text Content */}
                <div className="flex-1 max-w-[66%] sm:max-w-[62%] flex flex-col justify-center space-y-1 sm:space-y-2">
                  
                  {/* Badge */}
                  <span
                    className="inline-flex items-center gap-1 text-[9px] sm:text-[11px] font-black px-2 py-0.5 rounded-full text-white w-fit shadow-2xs"
                    style={{ backgroundColor: slide.badgeColor }}
                  >
                    <Sparkles size={10} />
                    <span>{slide.tag}</span>
                  </span>

                  {/* Heading */}
                  <h2 className="text-xs sm:text-lg md:text-xl font-black text-white leading-tight line-clamp-2">
                    {slide.title}
                  </h2>

                  {/* Subtitle (Hidden on small mobile, visible on tablet) */}
                  <p className="text-[10px] sm:text-xs text-gray-300 line-clamp-1 leading-normal hidden xs:block">
                    {slide.desc}
                  </p>

                  {/* Action CTA */}
                  <div className="pt-0.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-[#FF5900] text-white text-[10px] sm:text-xs font-black shadow-xs">
                      <span>{slide.btnText}</span>
                      <ArrowLeft size={11} />
                    </span>
                  </div>

                </div>

                {/* Mascot Illustration Side (Fit snugly without clipping) */}
                <div className="w-[32%] sm:w-[35%] h-full flex items-center justify-center shrink-0">
                  <img
                    src={slide.mascotImg}
                    alt="سنجوب"
                    className="max-h-[115px] sm:max-h-[155px] md:max-h-[185px] w-auto object-contain drop-shadow-md"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/assets/sangoub/sangoub-favicon.png';
                    }}
                  />
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Prev/Next arrows strictly hidden on mobile (< 768px), visible on md+ */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handlePrev(); }}
        className="hidden md:flex absolute top-1/2 right-3 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-xs transition-colors z-20 shadow-md cursor-pointer"
        aria-label="الشريحة السابقة"
      >
        <ChevronRight size={18} />
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleNext(); }}
        className="hidden md:flex absolute top-1/2 left-3 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-xs transition-colors z-20 shadow-md cursor-pointer"
        aria-label="الشريحة التالية"
      >
        <ChevronLeft size={18} />
      </button>

      {/* Slide Indicators Dots */}
      <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center gap-1.5 z-20 pointer-events-none">
        {slides.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              currentSlide === i ? 'w-4 bg-[#FF5900]' : 'w-1 bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
