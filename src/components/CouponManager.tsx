import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, TicketPercent, X } from "lucide-react";
import type { Coupon } from "../types";
import { deleteRecord, saveRecord } from "../lib/firebase";
import { customerMessage } from "../utils/customerMessage";
import { formatEGP } from "../utils/orderCalculations";

export function CouponManager({ coupons }: { coupons: Coupon[] }) {
  const [editor, setEditor] = useState<{ coupon?: Coupon } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (editor) dialog.current?.showModal(); else dialog.current?.close(); }, [editor]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      const code = String(data.get("code") || "").trim().toUpperCase();
      const value = Number(data.get("value"));
      const minOrder = Number(data.get("minOrder"));
      const discountType = String(data.get("discountType"));
      if (!/^[A-Z0-9_-]{1,40}$/.test(code)) throw new Error("استخدم حروفًا إنجليزية وأرقامًا للكود، بحد أقصى 40 حرفًا.");
      if (!editor?.coupon && coupons.some(coupon => coupon.code === code)) throw new Error("الكود موجود بالفعل؛ يمكنك تعديله من القائمة.");
      if (!Number.isFinite(value) || value <= 0 || value > 100000 || (discountType === "percent" && value > 100) || !Number.isFinite(minOrder) || minOrder < 0 || minOrder > 100000) throw new Error("راجع قيمة الخصم والحد الأدنى للطلب.");
      await saveRecord("coupons", code, { code, title: code, description: String(data.get("description") || "").trim(), discountType, value, minOrder });
      setEditor(null); setNotice("تم حفظ كود الخصم.");
    } catch (error) { setError(customerMessage(error, "تعذر حفظ كود الخصم.")); }
    finally { setBusy(false); }
  }
  async function remove(coupon: Coupon) {
    if (!window.confirm(`حذف كود ${coupon.code}؟ لن تتغير الطلبات السابقة.`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await deleteRecord("coupons", coupon.code); setNotice("تم حذف كود الخصم."); }
    catch (error) { setError(customerMessage(error, "تعذر حذف الكود.")); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5" aria-label="إدارة أكواد الخصم">
    <header className="ops-heading"><div><p className="admin-eyebrow">التسويق والعروض</p><h1>أكواد الخصم</h1><p>قسائم يضيفها العميل عند إتمام الطلب. خصومات المنتجات تُدار من عروض المنتجات.</p></div><button className="admin-primary btn btn-primary" disabled={busy} onClick={() => { setError(""); setEditor({}); }}><Plus size={18} />إضافة كود خصم</button></header>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 text-emerald-800 p-3">{notice}</p>}
    {!editor && error && <p role="alert" className="ops-warning alert alert-warning">{error}</p>}
    <div className="admin-panel"><div className="admin-panel-heading"><h2>أكواد الخصم <span className="badge admin-count">{coupons.length}</span></h2></div><div className="admin-table-scroll"><table className="table table-hover align-middle admin-data-table"><thead><tr><th>الكود / الوصف</th><th>الخصم</th><th>الحد الأدنى</th><th>الإجراءات</th></tr></thead><tbody>{coupons.map(coupon => <tr key={coupon.code}><td><strong dir="ltr">{coupon.code}</strong><small>{coupon.description}</small></td><td>{coupon.discountType === "percent" ? `${coupon.value}%` : formatEGP(coupon.value)}</td><td>{formatEGP(coupon.minOrder)}</td><td><div className="catalog-row-actions"><button disabled={busy} className="compact-row-action btn btn-outline-secondary" onClick={() => { setError(""); setEditor({ coupon }); }}>تعديل</button><button disabled={busy} className="compact-row-action btn btn-outline-secondary" onClick={() => void remove(coupon)}>حذف</button></div></td></tr>)}</tbody></table></div>{!coupons.length && <div className="admin-empty"><TicketPercent size={28} /><h3>لا توجد أكواد خصم بعد</h3><p>أضف أول كود وحدد قيمته والحد الأدنى للطلب.</p></div>}</div>
    <dialog ref={dialog} className="admin-user-dialog" dir="rtl" aria-label={editor?.coupon ? "تعديل كود الخصم" : "إضافة كود خصم"} onCancel={event => { if (busy) event.preventDefault(); else setEditor(null); }} onClose={() => { if (!busy) setEditor(null); }}><div className="admin-dialog-heading"><h2>{editor?.coupon ? "تعديل كود الخصم" : "إضافة كود خصم"}</h2><button disabled={busy} aria-label="إغلاق محرر الخصم" onClick={() => setEditor(null)}><X size={20} /></button></div>{editor && <form key={editor.coupon?.code || "new"} className="admin-user-form" onSubmit={save}><fieldset disabled={busy} className="space-y-4"><label className="block">كود الخصم<input className="form-control" name="code" dir="ltr" required maxLength={40} readOnly={Boolean(editor.coupon)} defaultValue={editor.coupon?.code} /></label><label className="block">وصف الخصم<input className="form-control" name="description" required maxLength={500} defaultValue={editor.coupon?.description} /></label><label className="block">نوع الخصم<select className="form-select" name="discountType" defaultValue={editor.coupon?.discountType || "fixed"}><option value="fixed">قيمة بالجنيه</option><option value="percent">نسبة مئوية</option></select></label><label className="block">قيمة الخصم<input className="form-control" name="value" type="number" required min="0.01" max="100000" step="0.01" defaultValue={editor.coupon?.value} /></label><label className="block">الحد الأدنى للطلب<input className="form-control" name="minOrder" type="number" required min="0" max="100000" step="0.01" defaultValue={editor.coupon?.minOrder ?? 0} /></label></fieldset>{error && <p role="alert" className="ops-warning alert alert-warning">{error}</p>}<button className="admin-primary btn btn-primary" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ كود الخصم"}</button></form>}</dialog>
  </section>;
}
