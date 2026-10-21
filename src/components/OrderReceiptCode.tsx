import { useState } from "react";
import { orderDelivery } from "../lib/orderDelivery";
export function OrderReceiptCode({ orderId }: { orderId: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="p-4 rounded-xl bg-orange-50 text-sm space-y-2">
    <p>شارك رمز الاستلام مع المندوب عند استلام طلبك فقط.</p>
    {code ? <strong dir="ltr" className="text-3xl tracking-widest block">{code}</strong> : <button disabled={busy} className="text-orange-700 font-bold" onClick={async () => {
      setBusy(true); setError("");
      try { setCode((await orderDelivery({ action: "code", orderId })).otpCode); }
      catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>{busy ? "جارٍ التحميل…" : "عرض رمز الاستلام"}</button>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
