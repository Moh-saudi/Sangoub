import { useState } from "react";
import { X, Minus, Plus, Trash2, ArrowLeft } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { formatEGP } from "../../utils/orderCalculations";
import {
  checkoutLines,
  checkoutCartKey,
} from "../../shop/storefrontCartBridge";
import type { TrackableOrder } from "./OrderTrackingModal";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRequestRegister: () => void;
  onOpenAreaModal: () => void;
  onOrderPlaced?: (order: TrackableOrder) => void;
}
export function CartCheckoutModal({ isOpen, onClose }: Props) {
  const { cartItems, updateQuantity, removeFromCart, subtotal } = useStore();
  const [error, setError] = useState("");
  if (!isOpen) return null;
  function checkout() {
    try {
      localStorage.setItem(
        checkoutCartKey,
        JSON.stringify(checkoutLines(cartItems)),
      );
      window.location.assign("/checkout");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "تعذر حفظ السلة؛ اسمح بالتخزين في المتصفح ثم حاول مجددًا.",
      );
    }
  }
  return (
    <div
      className="fixed inset-0 z-[125] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      dir="rtl"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-review-title"
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-5 space-y-4"
      >
        <header className="flex items-center justify-between">
          <h2 id="cart-review-title" className="text-xl font-black">
            سلة مشترياتك
          </h2>
          <button onClick={onClose} aria-label="إغلاق السلة" className="p-3">
            <X size={20} />
          </button>
        </header>
        {!cartItems.length ? (
          <p>السلة فارغة. اختر منتجاتك أولًا.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {cartItems.map((item) => (
                <li key={item.id} className="border rounded-xl p-3 space-y-2">
                  <div className="flex justify-between gap-3">
                    <strong>{item.product.name}</strong>
                    <span>
                      {formatEGP(
                        (item.product.price + item.extraPrice) * item.quantity,
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {Object.entries(item.selectedOptions)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      aria-label={`تقليل ${item.product.name}`}
                      className="p-3 border rounded-lg"
                      onClick={() => updateQuantity(item.id, -1)}
                    >
                      <Minus size={16} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      aria-label={`زيادة ${item.product.name}`}
                      disabled={item.quantity >= 50}
                      className="p-3 border rounded-lg"
                      onClick={() => updateQuantity(item.id, 1)}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      aria-label={`حذف ${item.product.name}`}
                      className="p-3 text-red-700"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="flex justify-between font-bold">
              <span>قيمة المنتجات المبدئية</span>
              <span>{formatEGP(subtotal)}</span>
            </p>
            <p className="text-sm text-slate-600">
              تراجع الأسعار والتوصيل والضريبة من المتجر قبل التأكيد. الدفع عند
              الاستلام، أو عبر جيديا عند تفعيلها. لا يتم إرسال الطلب أو تفريغ
              السلة قبل تأكيد الخادم.
            </p>
            {error && (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            )}
            <button
              onClick={checkout}
              className="w-full bg-orange-700 text-white rounded-xl p-3 font-bold flex justify-center items-center gap-2"
            >
              متابعة العنوان ومراجعة السعر والدفع
              <ArrowLeft size={18} />
            </button>
          </>
        )}
      </section>
    </div>
  );
}
