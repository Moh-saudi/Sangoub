let loading: Promise<void> | null = null;

const GEIDEA_CONFIG = {
  merchantPublicKey: '3448c010-87b1-41e7-9771-cac444268cfb',
  apiPassword: 'ecba1701-4889-4357-ba09-4d8d864f6d64',
  baseUrl: 'https://api.merchant.geidea.net',
  callbackUrl: 'https://sangoub.el7lm.com/api/geidea/callback',
  returnUrl: 'https://sangoub.el7lm.com/checkout/success',
};

function formatTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export interface CreateSessionParams {
  orderId: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

export async function createGeideaPaymentSession(params: CreateSessionParams): Promise<{ sessionId: string }> {
  // 1. Primary: Cloudflare Pages Function proxy (bypasses browser CORS & secures secrets)
  try {
    const workerRes = await fetch('/api/geidea/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (workerRes.ok) {
      const data = await workerRes.json();
      if (data?.sessionId) {
        return { sessionId: data.sessionId };
      }
    } else {
      const errData = await workerRes.json().catch(() => null);
      if (errData?.error) {
        throw new Error(errData.error);
      }
    }
  } catch (workerErr: any) {
    if (workerErr?.message && !workerErr.message.includes('Failed to fetch')) {
      throw workerErr;
    }
    console.warn('Pages function /api/geidea/session fallback:', workerErr);
  }

  // 2. Direct Geidea Gateway API call fallback
  try {
    const orderId = String(params.orderId || `ord-${Date.now()}`);
    const amount = Number(params.amount) || 20.0;
    const formattedAmount = amount.toFixed(2);
    const currency = 'EGP';
    const referenceId = `SNG_${orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}_${Date.now().toString().slice(-6)}`;
    const timestamp = formatTimestamp();

    const dataToSign = `${GEIDEA_CONFIG.merchantPublicKey}${formattedAmount}${currency}${referenceId}${timestamp}`;
    const signature = await computeHmacSha256(GEIDEA_CONFIG.apiPassword, dataToSign);
    const authHeader = btoa(`${GEIDEA_CONFIG.merchantPublicKey}:${GEIDEA_CONFIG.apiPassword}`);

    const nameParts = String(params.customerName || 'عميل سنجوب').trim().split(/\s+/);
    const firstName = nameParts[0] || 'عميل';
    const lastName = nameParts.slice(1).join(' ') || 'سنجوب';

    const payload = {
      amount,
      currency,
      merchantReferenceId: referenceId,
      timestamp,
      signature,
      callbackUrl: GEIDEA_CONFIG.callbackUrl,
      callback: GEIDEA_CONFIG.callbackUrl,
      callBackUrl: GEIDEA_CONFIG.callbackUrl,
      returnUrl: `${GEIDEA_CONFIG.returnUrl}?orderId=${encodeURIComponent(orderId)}`,
      language: 'ar',
      customer: {
        email: params.customerEmail || 'customer@sangoub.el7lm.com',
        firstName,
        lastName,
        phone: params.customerPhone || '01000000000',
      },
      metadata: {
        system: 'Sangoub',
        orderId,
      },
    };

    const directRes = await fetch(`${GEIDEA_CONFIG.baseUrl}/payment-intent/api/v2/direct/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(payload),
    });

    if (directRes.ok) {
      const data = await directRes.json().catch(() => null);
      if (data?.session?.id) {
        return { sessionId: data.session.id };
      }
    }
  } catch (directErr) {
    console.warn('Direct Geidea session initialization fallback:', directErr);
  }

  throw new Error('تعذر بدء جلسة الدفع بالبطاقة البنكية حالياً. يرجى المحاولة ثانية.');
}

/**
 * 🔍 جلب وتأكيد تفاصيل وحالة العملية رسمياً من خوادم جيديا عبر Geidea Fetch API
 * المرجع: https://docs.geidea.net/docs/fetch-1
 */
export async function fetchGeideaOrderDetails(orderIdOrReference: string): Promise<any> {
  try {
    const authHeader = btoa(`${GEIDEA_CONFIG.merchantPublicKey}:${GEIDEA_CONFIG.apiPassword}`);
    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrReference);
    const endpoint = isGuid
      ? `${GEIDEA_CONFIG.baseUrl}/pgw/api/v1/direct/order/${orderIdOrReference}`
      : `${GEIDEA_CONFIG.baseUrl}/pgw/api/v1/direct/order?MerchantReferenceId=${encodeURIComponent(orderIdOrReference)}`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return data?.order || data?.orders?.[0] || data;
    }
  } catch (err) {
    console.warn('Geidea fetch order details error:', err);
  }
  return null;
}

declare global {
  interface Window {
    GeideaCheckout?: new (
      success: (result: unknown) => void,
      error: (result: unknown) => void,
      cancel: () => void,
    ) => { startPayment: (id: string) => void };
  }
}

export interface GeideaCheckoutCallbacks {
  onSuccess: (result: unknown) => void;
  onError?: (err: unknown) => void;
  onCancel?: () => void;
}

export async function openGeideaPayment(
  sessionIdOrUrl: string,
  callbacksOrSuccess?: (() => void) | GeideaCheckoutCallbacks,
): Promise<void> {
  if (!sessionIdOrUrl) {
    throw new Error('معرف جلسة الدفع غير متوفر.');
  }

  // If a direct hosted payment redirect URL is provided, redirect directly
  if (sessionIdOrUrl.startsWith('http://') || sessionIdOrUrl.startsWith('https://')) {
    window.location.assign(sessionIdOrUrl);
    return;
  }

  if (!window.GeideaCheckout) {
    if (!loading) {
      loading = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://www.merchant.geidea.net/hpp/geideaCheckout.min.js';
        script.async = true;
        const timer = window.setTimeout(() => {
          script.remove();
          reject(new Error('انتهت مهلة تحميل بوابة الدفع. يرجى المحاولة ثانية.'));
        }, 15000);
        script.onload = () => {
          window.clearTimeout(timer);
          window.GeideaCheckout ? resolve() : reject(new Error('تعذر تهيئة بوابة جيديا.'));
        };
        script.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error('تعذر الاتصال ببوابة الدفع جيديا.'));
        };
        document.head.appendChild(script);
      }).catch((e) => {
        loading = null;
        throw e;
      });
    }
    await loading;
  }

  const successCb = typeof callbacksOrSuccess === 'function' 
    ? callbacksOrSuccess 
    : callbacksOrSuccess?.onSuccess || (() => {});
  const errorCb = typeof callbacksOrSuccess === 'function'
    ? callbacksOrSuccess
    : callbacksOrSuccess?.onError || (() => {});
  const cancelCb = typeof callbacksOrSuccess === 'function'
    ? callbacksOrSuccess
    : callbacksOrSuccess?.onCancel || (() => {});

  const checkout = new window.GeideaCheckout!(successCb, errorCb, cancelCb);
  checkout.startPayment(sessionIdOrUrl);
}
