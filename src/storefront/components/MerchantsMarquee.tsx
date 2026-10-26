import React from 'react';
import { useStore } from '../context/StoreContext';
import { Store as StoreIcon, Star, ArrowLeft, Clock } from 'lucide-react';

export const MerchantsMarquee: React.FC = () => {
  const { stores, navigate } = useStore();

  if (!stores || stores.length === 0) return null;

  // Duplicate list for infinite continuous scroll
  const marqueeList = [...stores, ...stores];

  return (
    <section className="bg-white rounded-3xl border border-[#E5E7EB] p-4 sm:p-5 shadow-xs select-none" dir="rtl">
      {/* Section Title */}
      <div className="flex items-center justify-between mb-3.5 px-1">
        <h3 className="text-sm sm:text-base font-black text-[#111827] flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5900]" />
          <span>المتاجر والشركاء المعتمدون بالعاصمة</span>
        </h3>
        <button
          type="button"
          onClick={() => navigate('/stores')}
          className="text-xs font-bold text-[#FF5900] hover:underline flex items-center gap-1"
        >
          <span>كل المتاجر ({stores.length})</span>
          <ArrowLeft size={13} />
        </button>
      </div>

      {/* Marquee Outer Container with Edge Fades */}
      <div className="overflow-hidden relative group">
        <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />

        <div
          className="flex items-center gap-3.5 w-max animate-marquee hover:[animation-play-state:paused] py-1 cursor-pointer"
          style={{ animation: 'marqueeRTL 38s linear infinite' }}
        >
          {marqueeList.map((store, index) => (
            <div
              key={`${store.id}-${index}`}
              onClick={() => navigate(`/stores/${store.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/stores/${store.id}`)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] hover:bg-[#FFF2EC] hover:border-[#FF5900]/50 transition-all shrink-0 shadow-2xs group/store min-w-[170px]"
            >
              {/* Circular Store Logo */}
              <div className="w-11 h-11 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {store.logoUrl ? (
                  <img
                    src={store.logoUrl}
                    alt={store.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/assets/sangoub/sangoub-favicon.png';
                    }}
                  />
                ) : (
                  <StoreIcon size={18} className="text-[#FF5900]" />
                )}
              </div>

              {/* Store Information */}
              <div className="flex flex-col text-right">
                <span className="text-xs font-black text-[#111827] group-hover/store:text-[#FF5900] transition-colors whitespace-nowrap">
                  {store.name}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-[#6B7280] mt-0.5">
                  <span className="flex items-center gap-0.5 text-[#D97706] font-bold">
                    <Star size={10} fill="#D97706" />
                    <span>{store.rating || '4.8'}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Clock size={10} />
                    <span>{store.deliveryTime || '20 دقيقة'}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marqueeRTL {
          0% { transform: translateX(0); }
          100% { transform: translateX(50%); }
        }
      `}</style>
    </section>
  );
};
