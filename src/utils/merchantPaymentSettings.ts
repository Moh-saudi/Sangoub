export interface MerchantPaymentInfo {
  instapayHandle: string;
  walletPhone: string;
  instapayLink?: string;
}

const STORAGE_KEY = 'sangoub_merchants_payment_settings_v1';

const DEFAULT_MERCHANT_PAYMENTS: Record<string, MerchantPaymentInfo> = {
  // سنجوب ماركت
  'a0000000-0000-0000-0000-000000000001': {
    instapayHandle: 'sangoub@instapay',
    walletPhone: '01099887766',
    instapayLink: 'https://ipn.eg/',
  },
  'sangoub-market': {
    instapayHandle: 'sangoub@instapay',
    walletPhone: '01099887766',
    instapayLink: 'https://ipn.eg/',
  },

  // صيدلية العاصمة المركزية
  'b1111111-2222-3333-4444-555555555501': {
    instapayHandle: 'capital-pharmacy@instapay',
    walletPhone: '01011223344',
    instapayLink: 'https://ipn.eg/',
  },
  'capital-pharmacy': {
    instapayHandle: 'capital-pharmacy@instapay',
    walletPhone: '01011223344',
    instapayLink: 'https://ipn.eg/',
  },

  // فول وفلافل العاصمة
  '27d12743-8106-4ef0-ba3c-84abefdb75d6': {
    instapayHandle: 'capital-falafel@instapay',
    walletPhone: '01055667788',
    instapayLink: 'https://ipn.eg/',
  },
  'capital-falafel': {
    instapayHandle: 'capital-falafel@instapay',
    walletPhone: '01055667788',
    instapayLink: 'https://ipn.eg/',
  },

  // كافيه العاصمة
  '55508f0e-f818-452e-b946-ab803fe9d637': {
    instapayHandle: 'capital-cafe@instapay',
    walletPhone: '01033445566',
    instapayLink: 'https://ipn.eg/',
  },
  'government-cafe': {
    instapayHandle: 'capital-cafe@instapay',
    walletPhone: '01033445566',
    instapayLink: 'https://ipn.eg/',
  },
};

export function getAllMerchantPaymentSettings(): Record<string, MerchantPaymentInfo> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_MERCHANT_PAYMENTS, ...parsed };
  } catch {
    return { ...DEFAULT_MERCHANT_PAYMENTS };
  }
}

export function getMerchantPaymentSettings(storeId?: string): MerchantPaymentInfo {
  if (!storeId) {
    return {
      instapayHandle: 'sangoub@instapay',
      walletPhone: '01099887766',
      instapayLink: 'https://ipn.eg/',
    };
  }

  const all = getAllMerchantPaymentSettings();
  if (all[storeId]) return all[storeId];

  // Try matching by standard id or fallback
  return {
    instapayHandle: 'sangoub@instapay',
    walletPhone: '01099887766',
    instapayLink: 'https://ipn.eg/',
  };
}

export function updateMerchantPaymentSettings(
  storeId: string,
  settings: Partial<MerchantPaymentInfo>
): void {
  try {
    const current = getAllMerchantPaymentSettings();
    const existing = current[storeId] || {
      instapayHandle: 'sangoub@instapay',
      walletPhone: '01099887766',
      instapayLink: 'https://ipn.eg/',
    };

    const updated = {
      ...current,
      [storeId]: {
        ...existing,
        ...settings,
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('sangoub:merchant-payment-updated', { detail: { storeId, settings } }));
  } catch (err) {
    console.error('Failed to update merchant payment settings:', err);
  }
}

