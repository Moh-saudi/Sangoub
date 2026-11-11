let loading: Promise<void> | null = null;

const GEIDEA_CONFIG = {
  merchantPublicKey: '3448c010-87b1-41e7-9771-cac444268cfb',
  apiPassword: 'ecba1701-4889-4357-ba09-4d8d864f6d64',
  baseUrl: 'https://api.merchant.geidea.net',
  sessionProxyUrl: 'https://www.el7lm.com/api/geidea/create-session',
  callbackUrl: 'https://sangoub.el7lm.com/checkout/success',
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
  const orderId = String(params.orderId || `ord-${Date.now()}`);
  const amount = Number(params.amount) || 20.0;
  const customerEmail = params.customerEmail || 'customer@sangoub.el7lm.com';
  const customerName = params.customerName || 'عميل سنجوب';

  // 1. Primary: Secure Parent Session Proxy (handles HMAC signing, Basic Auth, CORS & per-request dynamic callback)
  try {
    const proxyRes = await fetch(GEIDEA_CONFIG.sessionProxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        currency: 'EGP',
        orderId,
        customerEmail,
        customerName,
        customerPhone: params.customerPhone || '01000000000',
        callbackUrl: GEIDEA_CONFIG.callbackUrl,
        returnUrl: `${GEIDEA_CONFIG.returnUrl}?orderId=${encodeURIComponent(orderId)}`,
      }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data?.sessionId) {
        return { sessionId: data.sessionId };
      }
      if (data?.session?.id) {
        return { sessionId: data.session.id };
      }
    } else {
      const errData = await proxyRes.json().catch(() => null);
      if (errData?.error) {
        console.warn('Geidea session proxy reported error:', errData);
      }
    }
  } catch (proxyErr) {
    console.warn('Geidea session proxy unreachable, trying local endpoint:', proxyErr);
  }

  // 2. Secondary: Local /api/geidea/session endpoint
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
    }
  } catch {}

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
