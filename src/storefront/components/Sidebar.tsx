import React from 'react';
import { useStore } from '../context/StoreContext';
import { 
  Coffee, 
  Sandwich, 
  UtensilsCrossed, 
  Cake, 
  Milk, 
  ShoppingBag, 
  Apple, 
  Pizza, 
  Tag, 
  Sparkles, 
  Truck,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';

interface SidebarProps {
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
  activeFilter: 'all' | 'offers' | 'popular' | 'free_shipping';
  onSelectFilter: (filter: 'all' | 'offers' | 'popular' | 'free_shipping') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  activeFilter,
  onSelectFilter,
}) => {
  const { categories, products } = useStore();

  const getCategoryIcon = (cat: string) => {
    if (cat.includes('فطور')) return <Sandwich size={16} />;
    if (cat.includes('مشروبات') || cat.includes('كافيه')) return <Coffee size={16} />;
    if (cat.includes('ماركت') || cat.includes('سوبر')) return <Milk size={16} />;
    if (cat.includes('حلويات') || cat.includes('مخبوزات')) return <Cake size={16} />;
    if (cat.includes('بيتزا') || cat.includes('شاورما') || cat.includes('ساندويتش')) return <Pizza size={16} />;
    if (cat.includes('خضر') || cat.includes('فاكهة')) return <Apple size={16} />;
    if (cat.includes('وجبة') || cat.includes('غداء')) return <UtensilsCrossed size={16} />;
    return <ShoppingBag size={16} />;
  };

  const getCategoryCount = (cat: string) => {
    return products.filter((p) => p.category?.toLowerCase() === cat.toLowerCase()).length;
  };

  return (
    <aside className="w-[230px] shrink-0 hidden lg:flex flex-col gap-3 sticky top-24 max-h-[calc(100vh-110px)] overflow-y-auto scrollbar-thin [scrollbar-width:thin] select-none" dir="rtl">
      
      {/* 1. Main Categories Box */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-2xs overflow-hidden">
        {/* Header */}
        <div className="bg-[#131921] text-white px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-black text-xs">
            <SlidersHorizontal size={14} className="text-[#FF5900]" />
            <span>أقسام المتجر</span>
          </div>
          {selectedCategory && (
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className="text-[10px] text-[#FF9E66] hover:underline"
            >
              عرض الكل
            </button>
          )}
        </div>

        {/* Categories List */}
        <div className="p-1 space-y-0.5">
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              selectedCategory === null
                ? 'bg-[#FFF2EC] text-[#FF5900]'
                : 'text-[#2D3142] hover:bg-[#F7F8FA]'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShoppingBag size={15} className={selectedCategory === null ? 'text-[#FF5900]' : 'text-[#6B7280]'} />
              <span>جميع المنتجات</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E7E9EE] text-[#6B7280]">
              {products.length}
            </span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count = getCategoryCount(cat);

            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSelectCategory(isSelected ? null : cat)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  isSelected
                    ? 'bg-[#FFF2EC] text-[#FF5900]'
                    : 'text-[#2D3142] hover:bg-[#F7F8FA]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={isSelected ? 'text-[#FF5900]' : 'text-[#6B7280]'}>
                    {getCategoryIcon(cat)}
                  </span>
                  <span className="truncate">{cat}</span>
                </div>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-[#FF5900]/15 text-[#FF5900]' : 'bg-[#E7E9EE] text-[#6B7280]'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Quick Filters Box */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] p-3 shadow-2xs space-y-2">
        <h4 className="text-xs font-black text-[#2D3142] mb-1">فلترة سريعة</h4>
        
        <button
          type="button"
          onClick={() => onSelectFilter(activeFilter === 'offers' ? 'all' : 'offers')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeFilter === 'offers'
              ? 'bg-[#FFF2EC] text-[#FF5900] border border-[#FF5900]/30'
              : 'bg-[#F7F8FA] text-[#2D3142] hover:bg-[#EDEFF2]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Tag size={13} className="text-[#FF5900]" />
            <span>عروض وتخفيضات</span>
          </span>
          {activeFilter === 'offers' && <CheckCircle2 size={13} className="text-[#FF5900]" />}
        </button>

        <button
          type="button"
          onClick={() => onSelectFilter(activeFilter === 'popular' ? 'all' : 'popular')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeFilter === 'popular'
              ? 'bg-[#FFF2EC] text-[#FF5900] border border-[#FF5900]/30'
              : 'bg-[#F7F8FA] text-[#2D3142] hover:bg-[#EDEFF2]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Sparkles size={13} className="text-[#F59E0B]" />
            <span>الأكثر طلباً</span>
          </span>
          {activeFilter === 'popular' && <CheckCircle2 size={13} className="text-[#FF5900]" />}
        </button>

        <button
          type="button"
          onClick={() => onSelectFilter(activeFilter === 'free_shipping' ? 'all' : 'free_shipping')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeFilter === 'free_shipping'
              ? 'bg-[#FFF2EC] text-[#FF5900] border border-[#FF5900]/30'
              : 'bg-[#F7F8FA] text-[#2D3142] hover:bg-[#EDEFF2]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Truck size={13} className="text-[#10B981]" />
            <span>توصيل مجاني</span>
          </span>
          {activeFilter === 'free_shipping' && <CheckCircle2 size={13} className="text-[#FF5900]" />}
        </button>
      </div>

      {/* 3. Squirrel Mascot Trust Box */}
      <div className="bg-gradient-to-br from-[#FFF2EC] to-[#FFE8DC] rounded-2xl border border-[#FFD4C2] p-3 text-center flex flex-col items-center">
        <img
          src="/assets/sangoub/mascot-cheerful.png"
          alt="سنجوب العاصمة"
          className="w-20 h-20 object-contain drop-shadow-sm mb-1.5"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
          }}
        />
        <h5 className="text-xs font-black text-[#2D3142]">سنجوب معك في العاصمة</h5>
        <p className="text-[10px] text-[#6B7280] leading-tight mt-1">
          خدمة مخصصة وسريعة لموظفي الوزارات وسكان العاصمة الجديدة
        </p>
      </div>

    </aside>
  );
};
