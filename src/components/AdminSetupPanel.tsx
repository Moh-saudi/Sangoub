import React, { useState } from "react";
import { saveRecord, deleteRecord } from "../lib/firebase.ts";
import type { Store, Coupon, Order } from "../types/index.ts";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
export interface AdminStaff { id: string; role: string; name: string; phone: string; storeId?: string; }
export function AdminSetupPanel({
  stores,
  staff = [],
  coupons = [],
  orders = [],
  onError,
  defaultOpen = false,
}: {
  stores: Store[];
  staff?: AdminStaff[];
  coupons?: Coupon[];
  orders?: Order[];
  onError: (error: unknown) => void;
  defaultOpen?: boolean;
}) {
  const [editingStaff, setEditingStaff] = useState<AdminStaff | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const save = async (
    event: React.FormEvent<HTMLFormElement>,
    operation: (data: FormData) => Promise<unknown>,
  ) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await operation(new FormData(form));
      form.reset();
      setEditingStaff(null); setEditingCoupon(null);
      setMessage("تم الحفظ في قاعدة البيانات.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحفظ.");
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  async function removeRecord(collection: "staff" | "coupons", id: string) {
    if (collection === "staff" && orders.some((order) => order.courierId === id && !["delivered", "cancelled"].includes(order.orderStatus))) {
      setError("أعد تعيين طلبات المندوب النشطة قبل إلغاء صلاحيته."); return;
    }
    if (!window.confirm(collection === "staff" ? "إلغاء صلاحية هذا الموظف؟ سيظل حسابه وطلبات العملاء محفوظة." : "حذف كود الخصم؟ لن تتغير الطلبات السابقة.")) return;
    setBusy(true); setError(""); setMessage("");
    try { await deleteRecord(collection, id); setEditingStaff(null); setEditingCoupon(null); setMessage("تم الحذف من إعدادات التشغيل."); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  const input =
    "border border-slate-300 rounded-xl p-2 text-sm w-full bg-white text-slate-900";
  return (
    <details
      open={defaultOpen || undefined}
      className="max-w-6xl mx-auto my-4 p-4 bg-white text-slate-900 border rounded-2xl"
      dir="rtl"
    >
      <summary className="font-bold cursor-pointer">
        إدارة الفريق والخصومات
      </summary>
      <p className="text-xs text-slate-500 my-3">
        أضف أعضاء فريقك وحدد صلاحياتهم ومهامهم.
      </p>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl">{error}</p>}
      {busy && <p role="status" className="text-sm text-orange-700">جارٍ رفع الصور وحفظ البيانات…</p>}
      <div className="grid lg:grid-cols-2 gap-4 my-5">
        <section className="border rounded-2xl p-4 space-y-3"><h3 className="font-bold">فريق التشغيل ({staff.length})</h3>
          {staff.map((person) => <article key={person.id} className="border-t py-3 text-sm"><p className="font-bold">{person.name} · {person.role === "courier" ? "مندوب" : "مدير متجر"}</p><p className="text-xs text-slate-500 my-2">{person.phone} · {stores.find((store) => store.id === person.storeId)?.name || ""}</p><div className="flex gap-3"><button disabled={busy} onClick={() => { setEditingStaff(person); setEditingCoupon(null); setError(""); }} className="text-orange-700">تعديل</button><button disabled={busy} onClick={() => removeRecord("staff", person.id)} className="text-red-700">إلغاء الصلاحية</button></div></article>)}
          {!staff.length && <p className="text-sm text-slate-500">لا يوجد فريق مسجل بعد.</p>}
        </section>
        <section className="border rounded-2xl p-4 space-y-3"><h3 className="font-bold">أكواد الخصم ({coupons.length})</h3>
          {coupons.map((coupon) => <article key={coupon.code} className="border-t py-3 text-sm"><p className="font-bold">{coupon.code} · {coupon.value} {coupon.discountType === "percent" ? "%" : "جنيه"}</p><p className="text-xs text-slate-500 my-2">الحد الأدنى {coupon.minOrder} جنيه · {coupon.description}</p><div className="flex gap-3"><button disabled={busy} onClick={() => { setEditingCoupon(coupon); setEditingStaff(null); setError(""); }} className="text-orange-700">تعديل</button><button disabled={busy} onClick={() => removeRecord("coupons", coupon.code)} className="text-red-700">حذف الكود</button></div></article>)}
          {!coupons.length && <p className="text-sm text-slate-500">لا توجد أكواد خصم.</p>}
        </section>
      </div>
      {(editingStaff || editingCoupon) && <button onClick={() => { setEditingStaff(null); setEditingCoupon(null); }} disabled={busy} className="text-sm border p-2 rounded-xl">إلغاء التعديل والعودة للإضافة</button>}
      <div className="grid md:grid-cols-2 gap-6 mt-4">
        <form
          key={editingStaff?.id || "new-staff"}
          className="space-y-2"
          onSubmit={(e) =>
            save(e, async (data) => {
              const uid = String(data.get("uid")).trim();
              if (!/^[\w-]{1,128}$/.test(uid)) throw new Error("UID غير صالح.");
              const role = String(data.get("role"));
              if (!editingStaff && !(await getDoc(doc(db, "users", uid))).exists())
                throw new Error("هذا المعرف ليس له ملف مستخدم. يجب تسجيل الحساب وتأكيده أولًا.");
              if (editingStaff?.role === "courier" && role !== "courier" && orders.some((order) => order.courierId === uid && !["delivered", "cancelled"].includes(order.orderStatus)))
                throw new Error("أعد تعيين طلبات المندوب النشطة قبل تغيير دوره.");
              const storeId = String(data.get("store") || "");
              if (role === "restaurant" && !storeId)
                throw new Error("اختر المتجر لهذا الحساب.");
              await saveRecord("staff", uid, {
                role,
                name: String(data.get("name")),
                phone: String(data.get("phone")),
                ...(role === "restaurant" ? { storeId } : {}),
              });
            })
          }
        >
          <h3 className="font-bold">{editingStaff ? "تعديل بيانات الموظف وصلاحياته" : "تعيين مندوب أو مدير مطعم"}</h3>
          <p className="text-xs">
            يجب أن يسجل الشخص حسابًا حقيقيًا أولًا. انسخ UID من صفحة حسابه أو
            خدمة الحسابات.
          </p>
          <input
            aria-label="UID الموظف"
            name="uid"
            defaultValue={editingStaff?.id}
            readOnly={Boolean(editingStaff)}
            placeholder="معرّف المستخدم"
            dir="ltr"
            required
            className={input}
          />
          <input
            defaultValue={editingStaff?.name}
            aria-label="اسم الموظف"
            name="name"
            placeholder="اسم الموظف"
            required
            className={input}
          />
          <input
            defaultValue={editingStaff?.phone}
            aria-label="هاتف الموظف"
            name="phone"
            placeholder="الهاتف"
            type="tel"
            required
            className={input}
          />
          <select aria-label="صلاحية الموظف" name="role" defaultValue={editingStaff?.role || "courier"} className={input}>
            <option value="courier">مندوب</option>
            <option value="restaurant">مدير مطعم</option>
          </select>
          <select
            defaultValue={editingStaff?.storeId || ""}
            aria-label="المتجر المسؤول عنه"
            name="store"
            className={input}
          >
            <option value="">المتجر (لمدير المطعم)</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            disabled={busy}
            className="bg-slate-900 text-white p-2 rounded-xl"
          >
            حفظ الصلاحية
          </button>
          <p className="text-xs">
            على الموظف إعادة تسجيل الدخول بعد تغيير صلاحياته. المدير الرئيسي
            يُضاف بواسطة مسؤول المنصة فقط.
          </p>
        </form>
        <form
          key={editingCoupon?.code || "new-coupon"}
          className="space-y-2"
          onSubmit={(e) =>
            save(e, (data) => {
              const code = String(data.get("code")).toUpperCase();
              if (!/^[A-Z0-9_-]{1,40}$/.test(code))
                throw new Error("كود غير صالح.");
              const value = Number(data.get("value"));
              const discountType = String(data.get("discountType"));
              if (discountType === "percent" && value > 100) throw new Error("النسبة يجب ألا تتجاوز 100%.");
              return saveRecord("coupons", code, {
                code,
                title: code,
                description: String(data.get("description")),
                discountType,
                value: Number(data.get("value")),
                minOrder: Number(data.get("minOrder")),
              });
            })
          }
        >
          <h3 className="font-bold">{editingCoupon ? "تعديل كود الخصم" : "إضافة كود خصم"}</h3>
          <select aria-label="نوع الخصم" name="discountType" defaultValue={editingCoupon?.discountType || "fixed"} className={input}><option value="fixed">قيمة بالجنيه</option><option value="percent">نسبة مئوية</option></select>
          <input
            defaultValue={editingCoupon?.code}
            readOnly={Boolean(editingCoupon)}
            aria-label="كود الخصم"
            name="code"
            placeholder="WELCOME10"
            required
            className={input}
          />
          <input
            defaultValue={editingCoupon?.description}
            aria-label="وصف الخصم"
            name="description"
            placeholder="وصف العرض"
            required
            className={input}
          />
          <label className="block text-xs">
            قيمة الخصم حسب النوع
            <input
              type="number"
              name="value"
              defaultValue={editingCoupon?.value}
              min="0"
              max="10000"
              step="0.01"
              required
              className={input}
            />
          </label>
          <label className="block text-xs">
            الحد الأدنى للطلب
            <input
              name="minOrder"
              defaultValue={editingCoupon?.minOrder}
              type="number"
              min="0"
              max="100000"
              step="0.01"
              required
              className={input}
            />
          </label>
          <button
            disabled={busy}
            className="bg-slate-900 text-white p-2 rounded-xl"
          >
            حفظ الكود
          </button>
        </form>
      </div>
    </details>
  );
}
