import { supabase } from "./supabase";
import { apiUrl } from "./apiUrl";
export async function orderDelivery(body: { action: "code" | "deliver"; orderId: string; otpCode?: string; collectedAmount?: number }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("يرجى تسجيل الدخول.");
  const response = await fetch(apiUrl("/api/order-delivery"), { method: "POST", headers: {
    "Content-Type": "application/json", Authorization: `Bearer ${token}`,
  }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({ error: "خدمة التسليم غير متاحة." }));
  if (!response.ok) throw new Error(data.error || "تعذر تأكيد التسليم.");
  return data;
}
