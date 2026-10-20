import React from 'react';
import { SmartImage } from './SmartImage.tsx';

interface CategoryBubble {
  id: string;
  name: string;
  categoryFilter: string;
  imageUrl: string;
  fallbackType: string;
  badge?: string;
}

interface CuisineBubblesProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CuisineBubbles: React.FC<CuisineBubblesProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  const bubbles: CategoryBubble[] = [
    {
      id: 'all',
      name: 'جميع الوجبات',
      categoryFilter: 'الكل',
      imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80',
      fallbackType: 'foul',
      badge: 'الكل',
    },
    {
      id: 'breakfast',
      name: 'فطور وسندوتشات',
      categoryFilter: 'فطور',
      imageUrl: 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?auto=format&fit=crop&w=200&q=80',
      fallbackType: 'falafel',
      badge: 'فول هند',
    },
    {
      id: 'supermarket',
      name: 'العاصمة ماركت',
      categoryFilter: 'سوبر ماركت بالقطعة',
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=200&q=80',
      fallbackType: 'water',
      badge: 'مياه وسناك',
    },
    {
      id: 'drinks',
      name: 'قهوة ومشروبات',
      categoryFilter: 'مشروبات',
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=200&q=80',
      fallbackType: 'coffee',
      badge: 'رمالة',
    },
    {
      id: 'sandwiches',
      name: 'شاورما وغداء',
      categoryFilter: 'سندوتشات',
      imageUrl: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=200&q=80',
      fallbackType: 'hawawshi',
    },
    {
      id: 'bakery',
      name: 'مخبوزات ساخنة',
      categoryFilter: 'وجبات خفيفة',
      imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=200&q=80',
      fallbackType: 'croissant',
    },
  ];

  return (
    <div className="py-2">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {bubbles.map((b) => {
          const isSelected = selectedCategory === b.categoryFilter;
          return (
            <button
              key={b.id}
              onClick={() => onSelectCategory(b.categoryFilter)}
              className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
            >
              <div
                className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden border-2 transition-all p-0.5 relative shadow-xs ${
                  isSelected
                    ? 'border-orange-600 ring-2 ring-orange-500/30 scale-105'
                    : 'border-slate-200 group-hover:border-orange-300'
                }`}
              >
                <div className="w-full h-full rounded-full overflow-hidden relative">
                  <SmartImage
                    src={b.imageUrl}
                    alt={b.name}
                    fallbackType={b.fallbackType}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    aspectRatio="h-full"
                  />
                </div>

                {b.badge && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full whitespace-nowrap shadow-xs">
                    {b.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[11px] whitespace-nowrap tracking-tight transition-colors ${
                  isSelected ? 'font-bold text-orange-600' : 'text-slate-700 font-medium group-hover:text-slate-900'
                }`}
              >
                {b.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
