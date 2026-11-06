import React from 'react';
import type { Store } from '../../types';
import { useStore } from '../context/StoreContext';
import { getStoreLogo, getStoreSlug } from '../../utils/storeAssets';
import { Star } from 'lucide-react';

interface MerchantLogoCardProps {
  store: Store;
  className?: string;
}

export const MerchantLogoCard: React.FC<MerchantLogoCardProps> = ({ store, className = '' }) => {
  const { navigate } = useStore();
  const logoSrc = getStoreLogo(store);

  const displayName = store.name
    .replace(' - 24/7', '')
    .replace(' (Hyper One)', '')
    .replace(' المركزية', '')
    .replace('متجر ', '');

  const storeSlug = getStoreSlug(store);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/stores/${storeSlug}`);
  };

  const deliveryTimeClean = (store.deliveryTime || '15-25 دقيقة')
    .replace(' دقيقة', 'د')
    .replace(' للأدوار', '');

  return (
    <a
      href={`/stores/${storeSlug}`}
      onClick={handleClick}
      title={store.name}
      className={`group flex flex-col items-center gap-1.5 cursor-pointer select-none text-decoration-none transition-transform active:scale-95 ${className}`}
      aria-label={`متجر ${store.name}`}
    >
      {/* 1. Squircle Card with Rounded Corners like Talabat — image fills the entire card, ZERO overlay text */}
      <div className="w-[74px] h-[74px] sm:w-[84px] sm:h-[84px] rounded-2xl sm:rounded-[20px] bg-[#F4F5F7] p-1.5 border border-[#EBECEF] group-hover:border-[#FF5900]/40 group-hover:shadow-sm transition-all duration-300 flex items-center justify-center overflow-hidden shrink-0">
        <img
          src={logoSrc}
          alt={store.name}
          className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
          }}
        />
      </div>

      {/* 2. Store info UNDER the card — small font in Tajawal */}
      <div className="flex flex-col items-center text-center w-full px-0.5">
        <span
          className="text-[11px] sm:text-[11.5px] font-bold text-[#1F2937] group-hover:text-[#FF5900] transition-colors line-clamp-1 leading-tight w-full font-tajawal"
          style={{ fontFamily: "'Tajawal', sans-serif" }}
        >
          {displayName}
        </span>
        <div 
          className="flex items-center justify-center gap-1 text-[9.5px] sm:text-[10px] text-[#6B7280] font-medium mt-0.5 font-tajawal"
          style={{ fontFamily: "'Tajawal', sans-serif" }}
        >
          <span className="flex items-center gap-0.5 text-amber-600 font-bold">
            <Star size={9} className="fill-amber-400 text-amber-400 inline" />
            <span>{store.rating || 4.9}</span>
          </span>
          <span className="text-[#D1D5DB]">•</span>
          <span>{deliveryTimeClean}</span>
        </div>
      </div>
    </a>
  );
};
