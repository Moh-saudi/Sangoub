import React from 'react';
import { useStore } from '../context/StoreContext';
import { Tag, Sparkles, Percent, Truck, Coffee, ShoppingBag, ArrowLeft, Check } from 'lucide-react';

export const OffersMiniSlider: React.FC = () => {
  const { navigate, applyCoupon, appliedCoupon } = useStore();
  const [copiedCoupon, setCopiedCoupon] = React.useState<string | null>(null);

  const offerBadges = [
    {
      id: 'deal-1',
      code: 'SANGOUB10',
      tag: 'كوبون خصم',
      title: 'خصم 10% فوراً',
      subtitle: 'استخدم كود SANGOUB10',
      icon: Percent,
      bg: '#FFF2EC',
      accent: '#FF5900',
      border: '#FFD4C2',
      isCoupon: true,
    },
    {
      id: 'deal-2',
      path: '/categories',
      tag: 'شحن مجاني',
      title: 'توصيل مجاني للطلبات',
      subtitle: 'للطلبات فوق 100 ج.م',
      icon: Truck,
      bg: '#ECFDF5',
      accent: '#059669',
      border: '#A7F3D0',
      isCoupon: false,
    },
    {
      id: 'deal-3',
      path: '/categories/فطور%20ومخبوزات',
      tag: 'عرض الصباح',
      title: 'فطور المكاتب السريع',
      subtitle: 'ساندوتشات وقهوة طازجة',
      icon: Coffee,
      bg: '#FEF3C7',
      accent: '#D97706',
      border: '#FDE68A',
      isCoupon: false,
    },
    {
      id: 'deal-4',
      path: '/categories/سوبرماركت%20وبقالة',
      tag: 'توفير السوبرماركت',
      title: 'سلة التوفير اليومية',
      subtitle: 'أسعار جملة وعروض حصرية',
      icon: ShoppingBag,
      bg: '#EFF6FF',
      accent: '#2563EB',
      border: '#BFDBFE',
      isCoupon: false,
    },
    {
      id: 'deal-5',
      path: '/offers',
      tag: 'كاش باك',
      title: 'نقاط سنجوب الذهبية',
      subtitle: 'استرجع رصيداً مع كل طلب',
      icon: Sparkles,
      bg: '#FDF2F8',
      accent: '#DB2777',
      border: '#FBCFE8',
      isCoupon: false,
    },
  ];

  const handleClick = (item: typeof offerBadges[0]) => {
    if (item.isCoupon && item.code) {
      applyCoupon(item.code);
      setCopiedCoupon(item.code);
      setTimeout(() => setCopiedCoupon(null), 2500);
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <div className="mb-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs sm:text-sm font-black text-[#2D3142] flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-[#FF5900] text-white flex items-center justify-center">
            <Tag size={12} />
          </span>
          <span>عروض وشعارات التوفير</span>
        </h3>
        <button
          type="button"
          onClick={() => navigate('/offers')}
          className="text-[11px] font-bold text-[#FF5900] hover:underline flex items-center gap-0.5"
        >
          <span>كل العروض</span>
          <ArrowLeft size={11} />
        </button>
      </div>

      {/* Horizontal Scrollable Offers Badges */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {offerBadges.map((item) => {
          const Icon = item.icon;
          const isThisApplied = appliedCoupon?.code === item.code || copiedCoupon === item.code;

          return (
            <div
              key={item.id}
              onClick={() => handleClick(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleClick(item)}
              className="shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 hover:shadow-xs hover:scale-101 active:scale-98 select-none"
              style={{
                backgroundColor: item.bg,
                border: `1.5px solid ${item.border}`,
                minWidth: '190px',
              }}
            >
              {/* Badge Icon / Logo */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                style={{ backgroundColor: item.accent, color: '#fff' }}
              >
                {isThisApplied ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
              </div>

              {/* Text Info */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 leading-none mb-0.5">
                  <span
                    className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm"
                    style={{ backgroundColor: `${item.accent}20`, color: item.accent }}
                  >
                    {item.tag}
                  </span>
                  {isThisApplied && (
                    <span className="text-[9px] font-black text-[#059669]">مُطبّق!</span>
                  )}
                </div>
                <span className="text-xs font-black text-[#2D3142] truncate">
                  {item.title}
                </span>
                <span className="text-[10px] text-[#6B7280] truncate font-medium">
                  {item.subtitle}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
