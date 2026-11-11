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

export async function openGeideaPayment(
  sessionIdOrUrl: string,
  onReturn?: () => void,
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

  const handleReturn = () => {
    if (onReturn) onReturn();
  };

  const checkout = new window.GeideaCheckout!(handleReturn, handleReturn, handleReturn);
  checkout.startPayment(sessionIdOrUrl);
}
