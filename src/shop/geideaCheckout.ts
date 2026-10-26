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
  sessionId: string,
  onReturn: () => void,
) {
  if (!window.GeideaCheckout) {
    if (!loading)
      loading = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://www.merchant.geidea.net/hpp/geideaCheckout.min.js";
        script.async = true;
        const timer = window.setTimeout(() => {
          script.remove();
          reject(new Error("انتهت مهلة فتح بوابة الدفع. تابع من صفحة طلبك."));
        }, 15000);
        script.onload = () => {
          window.clearTimeout(timer);
          window.GeideaCheckout
            ? resolve()
            : reject(new Error("بوابة الدفع لم تكتمل تهيئتها."));
        };
        script.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error("تعذر فتح بوابة الدفع. حاول من صفحة طلبك."));
        };
        document.head.appendChild(script);
      }).catch((e) => {
        loading = null;
        throw e;
      });
    await loading;
  }
  const checkout = new window.GeideaCheckout!(onReturn, onReturn, onReturn);
  checkout.startPayment(sessionId);
}
