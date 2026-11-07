import React from 'react';
import type { Store } from '../../types';
import { useStore } from '../context/StoreContext';
import { getStoreLogo, getStoreSlug } from '../../utils/storeAssets';
import { ArrowLeft, Bike, Clock3, Star } from 'lucide-react';
import { formatEGP } from '../../utils/orderCalculations';

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

  const deliveryTimeClean = (store.deliveryTime || '15–25 دقيقة')
    .replace(' للأدوار', '');

  return (
    <a
      href={`/stores/${storeSlug}`}
      onClick={handleClick}
      title={store.name}
      className={`group flex min-h-[124px] sm:min-h-[128px] flex-col justify-between gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-2.5 sm:p-3 text-decoration-none shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF5900]/40 hover:shadow-sm active:scale-[0.99] ${className}`}
      aria-label={`متجر ${store.name}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="relative h-[62px] w-[62px] sm:h-[66px] sm:w-[66px] shrink-0 overflow-hidden rounded-xl border border-[#F0F1F3] bg-[#F7F7F8] p-1 transition-colors group-hover:border-[#FF5900]/30">
          <img
            src={logoSrc}
            alt={store.name}
            className={`h-full w-full rounded-lg object-cover transition-transform duration-300 group-hover:scale-105 ${store.status === 'closed' ? 'grayscale opacity-75' : ''}`}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
            }}
          />
          {store.status === 'closed' && (
            <div className="absolute inset-1 bg-slate-900/60 rounded-lg flex items-center justify-center backdrop-blur-2xs">
              <span className="text-[9px] font-bold text-white bg-slate-900/90 px-1.5 py-0.5 rounded shadow-xs">
                مغلق
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className="mb-0.5 block truncate text-[10px] font-medium text-[#6B7280]">
            {store.type || 'متجر'}
          </span>
          <h3 className="line-clamp-1 sm:line-clamp-2 text-[12.5px] sm:text-[13px] font-bold leading-snug text-[#111827] transition-colors group-hover:text-[#FF5900]">
            {displayName}
          </h3>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#374151]">
            <Star size={11} className="fill-amber-400 text-amber-400 shrink-0" />
            <span>{store.rating || 4.9}</span>
            {store.status === 'open' && (
              <span className="mr-1 rounded-md bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 border border-emerald-100">
                مفتوح الآن
              </span>
            )}
            {store.status === 'busy' && (
              <span className="mr-1 rounded-md bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 border border-amber-100">
                مشغول مؤقتاً
              </span>
            )}
            {store.status === 'closed' && (
              <span className="mr-1 rounded-md bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 border border-slate-200">
                مغلق حالياً
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#F0F1F3] pt-2 text-[10px] font-medium text-[#6B7280]">
        <span className="flex items-center gap-1">
          <Clock3 size={11} className="text-[#FF5900] shrink-0" />
          <span>{deliveryTimeClean}</span>
          <span className="text-[#D1D5DB]">·</span>
          <Bike size={11} className="text-[#FF5900] shrink-0" />
          <span>{store.deliveryFee === 0 ? 'توصيل مجاني' : formatEGP(store.deliveryFee)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[#FF5900] font-bold text-[10px]">
          <span>تصفح المتجر</span>
          <ArrowLeft size={11} />
        </span>
      </div>
    </a>
  );
};
