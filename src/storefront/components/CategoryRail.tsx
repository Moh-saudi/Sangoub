import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type CategoryItem = { code: string; name_ar: string; image: string };

interface CategoryRailProps {
  categories: CategoryItem[];
  selectedCategory: string | null;
  onSelect: (category: string | null) => void;
  compact?: boolean;
}

export function CategoryRail({ categories, selectedCategory, onSelect, compact = false }: CategoryRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: 'next' | 'previous') => {
    const rail = railRef.current;
    if (!rail) return;
    const distance = Math.max(rail.clientWidth * 0.72, 220);
    rail.scrollBy({ left: direction === 'next' ? -distance : distance, behavior: 'smooth' });
  };

  return (
    <section aria-labelledby="category-rail-heading" className={compact ? 'pt-1' : 'mb-7'}>
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
        <h2 id="category-rail-heading" className={`${compact ? 'text-sm' : 'text-base sm:text-lg'} font-black text-[#111827]`}>
          الأقسام
        </h2>
        <div className="flex items-center gap-1">
          {selectedCategory && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="min-h-10 px-2 text-xs font-bold text-[#FF5900] hover:underline focus-visible:outline-2 focus-visible:outline-[#FF5900]"
            >
              عرض الكل
            </button>
          )}
          <button
            type="button"
            onClick={() => scroll('next')}
            aria-label="تمرير الأقسام إلى اليسار"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#E5E7EB] bg-white text-[#374151] hover:border-[#FF5900] hover:text-[#FF5900] focus-visible:outline-2 focus-visible:outline-[#FF5900]"
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scroll('previous')}
            aria-label="تمرير الأقسام إلى اليمين"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#E5E7EB] bg-white text-[#374151] hover:border-[#FF5900] hover:text-[#FF5900] focus-visible:outline-2 focus-visible:outline-[#FF5900]"
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        role="group"
        aria-label="تصفّح الأقسام"
        className="grid grid-flow-col grid-rows-2 auto-cols-[76px] sm:auto-cols-[88px] gap-x-2 gap-y-2 overflow-x-auto overscroll-x-contain touch-pan-x snap-x snap-mandatory scroll-smooth px-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ direction: 'rtl' }}
      >
        {categories.map((category) => {
          const selected = selectedCategory === category.name_ar || selectedCategory === category.code;
          return (
            <button
              key={category.code}
              type="button"
              aria-pressed={selected}
              aria-label={`عرض قسم ${category.name_ar}`}
              onClick={() => onSelect(selected ? null : category.name_ar)}
              className="group flex min-h-[92px] snap-start flex-col items-center gap-1 rounded-xl px-1 py-1 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5900]"
            >
              <span className={`grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border bg-[#F4F5F7] p-1.5 transition-colors ${selected ? 'border-[#FF5900] bg-[#FFF2EC] ring-2 ring-[#FF5900]/20' : 'border-[#EBECEF] group-hover:border-[#FF5900]/50'}`}>
                <img
                  src={category.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full rounded-xl object-contain"
                  onError={(event) => { event.currentTarget.src = '/brand/sangoub-mark-white-128.png'; }}
                />
              </span>
              <span className={`line-clamp-2 min-h-7 w-full text-[10px] font-bold leading-tight ${selected ? 'text-[#FF5900]' : 'text-[#374151]'}`}>
                {category.name_ar}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
