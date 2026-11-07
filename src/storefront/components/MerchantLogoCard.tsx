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
      className={`group flex min-h-[168px] flex-col justify-between gap-3 rounded-3xl border border-[#E5E7EB] bg-white p-3.5 text-decoration-none shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF5900]/40 hover:shadow-md active:scale-[0.99] ${className}`}
      aria-label={`متجر ${store.name}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl border border-[#F0F1F3] bg-[#F7F7F8] p-1.5 transition-colors group-hover:border-[#FF5900]/30">
          <img
            src={logoSrc}
            alt={store.name}
            className={`h-full w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-105 ${store.status === 'closed' ? 'grayscale opacity-75' : ''}`}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
            }}
          />
          {store.status === 'closed' && (
            <div className="absolute inset-1.5 bg-slate-900/50 rounded-xl flex items-center justify-center backdrop-blur-2xs">
              <span className="text-[10px] font-black text-white bg-slate-900/90 px-2 py-0.5 rounded-md shadow-xs">
                مغلق
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className="mb-1 block truncate text-[11px] font-bold text-[#6B7280]">
            {store.type || 'متجر'}
          </span>
          <h3 className="line-clamp-2 text-[15px] font-black leading-5 text-[#111827] transition-colors group-hover:text-[#FF5900]">
            {displayName}
          </h3>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-[#374151]">
            <Star size={13} className="fill-amber-400 text-amber-400" />
            <span>{store.rating || 4.9}</span>
            {store.status === 'open' && <span className="mr-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">مفتوح الآن</span>}
            {store.status === 'busy' && <span className="mr-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">مشغول مؤقتاً</span>}
            {store.status === 'closed' && <span className="mr-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">مغلق حالياً</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#F0F1F3] pt-2.5 text-[11px] font-bold text-[#6B7280]">
        <span className="flex items-center gap-1.5">
          <Clock3 size={13} className="text-[#FF5900]" />
          <span>{deliveryTimeClean}</span>
          <span className="text-[#D1D5DB]">·</span>
          <Bike size={13} className="text-[#FF5900]" />
          <span>{store.deliveryFee === 0 ? 'توصيل مجاني' : formatEGP(store.deliveryFee)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[#FF5900]">
          تصفح المتجر <ArrowLeft size={14} />
        </span>
      </div>
    </a>
  );
};
