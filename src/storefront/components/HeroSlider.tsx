import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import type { Product } from '../../types';
import type { StoreBanner } from '../types/banner';
import { ChevronRight, ChevronLeft, Sparkles, ArrowLeft } from 'lucide-react';

interface HeroSliderProps {
  onOpenAreaModal?: () => void;
  onSelectProduct?: (product: Product) => void;
  onSelectCategory?: (category: string) => void;
  onSelectOffers?: () => void;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({
  onSelectProduct,
  onSelectCategory,
  onSelectOffers,
}) => {
  const { banners, handleBannerClick, sliderShowArrows } = useStore();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const activeSlides = banners && banners.length > 0 ? banners : [];

  // Reset currentSlide if banners change and index becomes out of bounds
  useEffect(() => {
    if (currentSlide >= activeSlides.length) {
      setCurrentSlide(0);
    }
  }, [activeSlides.length, currentSlide]);

  // Auto-slide every 5 seconds
  useEffect(() => {
    if (isPaused || activeSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused, activeSlides.length]);

  const handleNext = () => {
    if (activeSlides.length === 0) return;
    setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
  };

  const handlePrev = () => {
    if (activeSlides.length === 0) return;
    setCurrentSlide((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || activeSlides.length <= 1) return;
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

  const onClickSlide = (slide: StoreBanner) => {
    handleBannerClick(slide, {
      onSelectProduct,
      onSelectCategory,
      onSelectOffers,
    });
  };

  if (activeSlides.length === 0) return null;

  return (
    <div
      className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs select-none bg-[#131921] w-full"
      dir="rtl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="سلايدر العروض والحملات"
    >
      {/* ── Slide Frame (Compact 135px on Mobile, 175px on Tablet, 215px on Desktop) ── */}
      <div className="relative w-full h-[135px] sm:h-[175px] md:h-[215px]">
        {activeSlides.map((slide, index) => {
          const isActive = currentSlide === index;
          const hasImage = Boolean(slide.imageUrl || (slide.image && (slide.image.startsWith('http') || slide.image.startsWith('/'))));
          const hasTextOverlay = !slide.hideOverlay && Boolean(slide.title || slide.subtitle || (slide.btnText && slide.btnText.trim()) || (slide.tag && slide.tag.trim()));
          const bannerImgUrl = slide.imageUrl || slide.image;

          return (
            <div
              key={slide.id || index}
              onClick={() => onClickSlide(slide)}
              className={`absolute inset-0 transition-opacity duration-300 ease-in-out cursor-pointer ${
                isActive
                  ? 'opacity-100 pointer-events-auto z-10'
                  : 'opacity-0 pointer-events-none z-0'
              }`}
              style={{ background: slide.bgGradient || 'linear-gradient(135deg, #131921 0%, #1F2937 100%)' }}
            >
              {hasImage ? (
                /* ── Real Banner Image Layout (with scrim overlay for crisp typography) ── */
                <div className="relative w-full h-full overflow-hidden group">
                  <img
                    src={bannerImgUrl}
                    alt={slide.title || 'عرض سنجوب'}
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-102"
                    onError={(e) => {
                      // Fallback to hide broken image so background gradient shows cleanly
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />

                  {/* Gradient Scrim & text/buttons only rendered when banner is not a clean graphic design */}
                  {hasTextOverlay && (
                    <div className="absolute inset-0 bg-gradient-to-l from-[#0F172A]/90 via-[#0F172A]/60 to-transparent/10 z-10 py-3.5 sm:py-6 pl-4 sm:pl-8 pr-14 sm:pr-18 md:pr-24 flex flex-col justify-center max-w-[85%] sm:max-w-[70%] md:max-w-[65%]">
                      {slide.tag && (
                        <span
                          className="inline-flex items-center gap-1 text-[9px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full text-white w-fit mb-1 sm:mb-1.5 shadow-xs"
                          style={{ backgroundColor: slide.badgeColor || '#FF5900' }}
                        >
                          <Sparkles size={11} />
                          <span>{slide.tag}</span>
                        </span>
                      )}

                      {slide.title && (
                        <h2 className="text-xs sm:text-lg md:text-xl font-black text-white leading-tight line-clamp-2 drop-shadow-md">
                          {slide.title}
                        </h2>
                      )}

                      {(slide.subtitle || slide.desc) && (
                        <p className="text-[10px] sm:text-xs text-gray-200 line-clamp-1 sm:line-clamp-2 mt-0.5 sm:mt-1 drop-shadow-xs font-medium">
                          {slide.subtitle || slide.desc}
                        </p>
                      )}

                      {slide.btnText && (
                        <div className="pt-1 sm:pt-2.5">
                          <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-0.8 sm:px-3.5 sm:py-1.5 rounded-xl bg-[#FF5900] text-white text-[9.5px] sm:text-xs font-black shadow-md hover:bg-[#E04E00] active:scale-95 transition-all">
                            <span>{slide.btnText}</span>
                            <ArrowLeft size={12} />
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Mascot + Gradient Themed Layout (Default Fallback) ── */
                <>
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

                  <div className="relative z-10 w-full h-full py-2.5 sm:py-5 pl-4 sm:pl-8 pr-14 sm:pr-18 md:pr-24 flex items-center justify-between gap-2.5">
                    {/* Text Content */}
                    <div className="flex-1 max-w-[66%] sm:max-w-[62%] flex flex-col justify-center space-y-1 sm:space-y-2">
                      {slide.tag && (
                        <span
                          className="inline-flex items-center gap-1 text-[9px] sm:text-[11px] font-black px-2 py-0.5 rounded-full text-white w-fit shadow-2xs"
                          style={{ backgroundColor: slide.badgeColor || '#FF5900' }}
                        >
                          <Sparkles size={10} />
                          <span>{slide.tag}</span>
                        </span>
                      )}

                      <h2 className="text-xs sm:text-lg md:text-xl font-black text-white leading-tight line-clamp-2">
                        {slide.title}
                      </h2>

                      {(slide.subtitle || slide.desc) && (
                        <p className="text-[10px] sm:text-xs text-gray-300 line-clamp-1 leading-normal hidden xs:block">
                          {slide.subtitle || slide.desc}
                        </p>
                      )}

                      <div className="pt-0.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-[#FF5900] text-white text-[10px] sm:text-xs font-black shadow-xs">
                          <span>{slide.btnText || 'اطلب الآن'}</span>
                          <ArrowLeft size={11} />
                        </span>
                      </div>
                    </div>

                    {/* Mascot Illustration */}
                    <div className="w-[32%] sm:w-[35%] h-full flex items-center justify-center shrink-0">
                      <img
                        src={slide.mascotImg || '/brand/sangoub-logo-256x256.png'}
                        alt="سنجوب Sangoub"
                        className="max-h-[115px] sm:max-h-[155px] md:max-h-[185px] w-auto object-contain drop-shadow-md"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Prev/Next arrows strictly hidden on small screens (< 768px), visible on md+ */}
      {sliderShowArrows !== false && activeSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="hidden md:flex absolute top-1/2 right-3 sm:right-4 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white items-center justify-center backdrop-blur-md transition-all z-20 shadow-lg cursor-pointer hover:scale-105 active:scale-95"
            aria-label="الشريحة السابقة"
          >
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="hidden md:flex absolute top-1/2 left-3 sm:left-4 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white items-center justify-center backdrop-blur-md transition-all z-20 shadow-lg cursor-pointer hover:scale-105 active:scale-95"
            aria-label="الشريحة التالية"
          >
            <ChevronLeft size={18} />
          </button>
        </>
      )}

      {/* Slide Indicators Dots */}
      {activeSlides.length > 1 && (
        <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center gap-1.5 z-20 pointer-events-none">
          {activeSlides.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                currentSlide === i ? 'w-4 bg-[#FF5900]' : 'w-1 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
