let loading: Promise<void> | null = null;

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
