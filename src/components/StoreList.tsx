import React from 'react';
import { Star, Clock, Store as StoreIcon, CheckCircle2 } from 'lucide-react';
import type { Store } from '../types/index.ts';

interface StoreListProps {
  stores: Store[];
  selectedStoreId: string | null;
  onSelectStore: (storeId: string | null) => void;
}

export const StoreList: React.FC<StoreListProps> = ({
  stores,
  selectedStoreId,
  onSelectStore,
}) => {
  return (
    <div className="my-4">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <StoreIcon className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold text-slate-900">متاجر الفود كورت والسوبر ماركت</h3>
        </div>
        {selectedStoreId && (
          <button
            onClick={() => onSelectStore(null)}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
          >
            عرض جميع المتاجر
          </button>
        )}
      </div>

      <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar pb-2 pt-0.5">
        {/* All stores chip */}
        <button
          onClick={() => onSelectStore(null)}
          className={`shrink-0 flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center min-w-[100px] ${
            selectedStoreId === null
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/90 hover:border-emerald-300'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-1.5 transition-colors ${
              selectedStoreId === null ? 'bg-white/20' : 'bg-slate-100'
            }`}
          >
            🏛️
          </div>
          <span className="text-xs font-bold whitespace-nowrap">الكل بالحي</span>
          <span className="text-[10px] opacity-80 whitespace-nowrap">كل الوجبات</span>
        </button>

        {stores.map((store) => {
          const isSelected = selectedStoreId === store.id;
          return (
            <button
              key={store.id}
              onClick={() => onSelectStore(isSelected ? null : store.id)}
              className={`shrink-0 flex flex-col justify-between rounded-2xl border transition-all text-right min-w-[210px] max-w-[240px] overflow-hidden relative group cursor-pointer ${
                isSelected
                  ? 'bg-orange-50/50 border-orange-500 ring-2 ring-orange-500/20 shadow-md'
                  : 'bg-white border-slate-200/90 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              {/* Store Real Banner Photo */}
              <div className="relative w-full h-24 overflow-hidden bg-slate-100">
                <img
                  src={store.bannerUrl || store.imageUrl}
                  alt={store.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Rating badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1 text-[11px] font-bold text-slate-900 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-lg shadow-xs">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span className="tabular-nums">{store.rating}</span>
                </div>

                {/* Overlapping logo icon */}
                <div className="absolute -bottom-2 right-3 w-10 h-10 rounded-xl bg-white border-2 border-white shadow-md flex items-center justify-center text-xl z-10">
                  {store.logoUrl ? <img src={store.logoUrl} alt={`شعار ${store.name}`} className="w-full h-full rounded-xl object-contain" /> : store.logo}
                </div>
              </div>

              {/* Store Details */}
              <div className="p-3 pt-4 w-full">
                <h4 className="text-xs font-bold text-slate-900 truncate mb-0.5" title={store.name}>
                  {store.name}
                </h4>
                <p className="text-[11px] text-slate-500 truncate mb-2">
                  {store.type}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1.5 border-t border-slate-100 w-full">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{store.deliveryTime.split(' ')[0]} دقيقة</span>
                  </div>
                  <span className="text-orange-700 font-bold truncate">توصيل للأدوار</span>
                </div>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center shadow-xs z-10">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
