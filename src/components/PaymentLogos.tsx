import React from 'react';

export const OFFICIAL_PAYMENT_LOGOS = {
  instapay: '/assets/aistudio/GKV136_InstaPay-logobase.net_c6183093.png',
  visa: '/assets/aistudio/visa--logo_fb3e8f25.png',
  wallets: '/assets/aistudio/edc631a6afd2f28eebdbc9a18670f58d_73d67fc0.jpg',
  appIcon: '/brand/capital-talabat-mascot-logo-256x256.png',
};

interface PaymentBadgeProps {
  type: 'instapay' | 'visa' | 'wallets' | 'all';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PaymentBadge: React.FC<PaymentBadgeProps> = ({
  type,
  className = '',
  size = 'md',
}) => {
  const heightClass = size === 'sm' ? 'h-5' : size === 'lg' ? 'h-8' : 'h-6';

  if (type === 'instapay') {
    return (
      <div className={`inline-flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-purple-200 shadow-2xs ${className}`}>
        <img
          src={OFFICIAL_PAYMENT_LOGOS.instapay}
          alt="InstaPay إنستا باي"
          className={`${heightClass} w-auto object-contain`}
        />
        <span className="text-[10px] font-bold text-purple-900 font-mono">InstaPay</span>
      </div>
    );
  }

  if (type === 'visa') {
    return (
      <div className={`inline-flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-blue-200 shadow-2xs ${className}`}>
        <img
          src={OFFICIAL_PAYMENT_LOGOS.visa}
          alt="Visa فيزا"
          className={`${heightClass} w-auto object-contain`}
        />
        <span className="text-[10px] font-bold text-blue-900 font-mono">VISA</span>
      </div>
    );
  }

  if (type === 'wallets') {
    return (
      <div className={`inline-flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-emerald-200 shadow-2xs ${className}`}>
        <img
          src={OFFICIAL_PAYMENT_LOGOS.wallets}
          alt="محافظ رقمية وفودافون كاش وميزة"
          className={`${heightClass} w-auto object-contain rounded-xs`}
        />
        <span className="text-[10px] font-bold text-emerald-900">محافظ إلكترونية</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <div className="inline-flex items-center bg-white px-2 py-1 rounded-lg border border-purple-200 shadow-2xs">
        <img
          src={OFFICIAL_PAYMENT_LOGOS.instapay}
          alt="InstaPay"
          className={`${heightClass} w-auto object-contain`}
        />
      </div>
      <div className="inline-flex items-center bg-white px-2 py-1 rounded-lg border border-blue-200 shadow-2xs">
        <img
          src={OFFICIAL_PAYMENT_LOGOS.visa}
          alt="Visa"
          className={`${heightClass} w-auto object-contain`}
        />
      </div>
      <div className="inline-flex items-center bg-white px-1.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
        <img
          src={OFFICIAL_PAYMENT_LOGOS.wallets}
          alt="Wallets"
          className={`${heightClass} w-auto object-contain rounded-xs`}
        />
      </div>
    </div>
  );
};
