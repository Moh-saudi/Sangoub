import React from 'react';
import type { Store } from '../../types';
import { useStore } from '../context/StoreContext';
import { Store as StoreIcon } from 'lucide-react';

interface MerchantLogoCardProps {
  store: Store;
}

export const MerchantLogoCard: React.FC<MerchantLogoCardProps> = ({ store }) => {
  const { navigate } = useStore();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/stores/${store.id}`);
  };

  return (
    <a
      href={`/stores/${store.id}`}
      onClick={handleClick}
      className="sg-merchant-card group"
      aria-label={`متجر ${store.name}`}
    >
      <div className="w-[80px] h-[80px] flex items-center justify-center bg-[#F7F8FA] rounded-xl p-2 mb-2 group-hover:scale-105 transition-transform">
        {store.logoUrl || store.logo ? (
          <img
            src={store.logoUrl || store.logo}
            alt={store.name}
            className="sg-merchant-logo max-h-full max-w-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <StoreIcon size={34} className="text-[#6B7280] opacity-60" />
        )}
      </div>
      <h4 className="sg-merchant-name" title={store.name}>
        {store.name}
      </h4>
      <span className="sg-merchant-category">
        {store.type || 'متجر معتمد'}
      </span>
      {store.deliveryTime && (
        <span className="text-[10px] text-[#FF5900] font-bold mt-1">
          {store.deliveryTime}
        </span>
      )}
    </a>
  );
};
