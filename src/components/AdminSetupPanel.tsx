import React, { useState } from "react";
import { saveRecord } from "../lib/firebase.ts";
import type { Store } from "../types/index.ts";
export function AdminSetupPanel({
  stores,
  onError,
}: {
  stores: Store[];
  onError: (error: unknown) => void;
}) {
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
    try {
      await operation(new FormData(form));
      form.reset();
      setMessage("تم الحفظ في قاعدة البيانات.");
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const input =
    "border border-slate-300 rounded-xl p-2 text-sm w-full bg-white text-slate-900";
  return (
    <details
      className="max-w-6xl mx-auto my-4 p-4 bg-white text-slate-900 border rounded-2xl"
      dir="rtl"
    >
      <summary className="font-bold cursor-pointer">
        إعداد المتاجر والأصناف وفريق التشغيل
      </summary>
      <p className="text-xs text-slate-500 my-3">
        البيانات هنا حقيقية وتحفظ في Firestore. لا توجد حسابات أو طلبات تجريبية.
      </p>
      {message && <p role="status">{message}</p>}
      <div className="grid md:grid-cols-2 gap-6 mt-4">
        <form
          className="space-y-2"
          onSubmit={(e) =>
            save(e, async (data) => {
              const id = crypto.randomUUID();
              await saveRecord("stores", id, {
                id,
                name: String(data.get("name")),
                nameEn: String(data.get("name")),
                type: "مطعم",
                category: "sandwiches",
                logo: "🍽️",
                banner: "from-orange-600 to-slate-900",
                status: "open",
                rating: 0,
                ratingCount: 0,
                deliveryTime: "يحدده المتجر",
                minOrder: Number(data.get("minOrder")),
                deliveryFee: Number(data.get("deliveryFee")),
                locationInDistrict: String(data.get("address")),
              });
            })
          }
        >
          <h3 className="font-bold">إضافة متجر</h3>
          <input
            aria-label="اسم المتجر"
            name="name"
            placeholder="اسم المتجر"
            required
            maxLength={120}
            className={input}
          />
          <input
            aria-label="عنوان المتجر"
            name="address"
            placeholder="العنوان الحقيقي"
            required
            className={input}
          />
          <label className="block text-xs">
            أقل طلب بالجنيه
            <input
              name="minOrder"
              type="number"
              min="0"
              max="100000"
              step="0.01"
              defaultValue="0"
              required
              className={input}
            />
          </label>
          <label className="block text-xs">
            رسوم التوصيل
            <input
              name="deliveryFee"
              type="number"
              min="0"
              max="1000"
              step="0.01"
              defaultValue="10"
              required
              className={input}
            />
          </label>
          <button
            disabled={busy}
            className="bg-slate-900 text-white p-2 rounded-xl"
          >
            حفظ المتجر
          </button>
        </form>
        <form
          className="space-y-2"
          onSubmit={(e) =>
            save(e, async (data) => {
              const id = crypto.randomUUID();
              const store = stores.find((s) => s.id === data.get("store"));
              if (!store) throw new Error("اختر المتجر.");
              await saveRecord("products", id, {
                id,
                storeId: store.id,
                storeName: store.name,
                name: String(data.get("name")),
                description: String(data.get("description")),
                price: Number(data.get("price")),
                category: "وجبات خفيفة",
                imageType: "croissant",
                imageUrl: String(data.get("imageUrl")),
                inStock: true,
              });
            })
          }
        >
          <h3 className="font-bold">إضافة صنف</h3>
          <select aria-label="المتجر" name="store" required className={input}>
            <option value="">اختر المتجر</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            aria-label="اسم الصنف"
            name="name"
            placeholder="اسم الصنف"
            maxLength={120}
            required
            className={input}
          />
          <input
            aria-label="وصف الصنف"
            name="description"
            placeholder="وصف قصير"
            maxLength={500}
            required
            className={input}
          />
          <label className="block text-xs">
            السعر بالجنيه
            <input
              name="price"
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              required
              className={input}
            />
          </label>
          <input
            aria-label="صورة الصنف"
            name="imageUrl"
            type="url"
            placeholder="رابط HTTPS لصورة الصنف"
            pattern="https://.*"
            required
            className={input}
          />
          <button
            disabled={busy}
            className="bg-slate-900 text-white p-2 rounded-xl"
          >
            حفظ الصنف
          </button>
        </form>
        <form
          className="space-y-2"
          onSubmit={(e) =>
            save(e, async (data) => {
              const uid = String(data.get("uid")).trim();
              if (!/^[\w-]{1,128}$/.test(uid)) throw new Error("UID غير صالح.");
              const role = String(data.get("role"));
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
          <h3 className="font-bold">تعيين مندوب أو مدير مطعم</h3>
          <p className="text-xs">
            يجب أن يسجل الشخص حسابًا حقيقيًا أولًا. انسخ UID من صفحة حسابه أو
            Firebase Authentication.
          </p>
          <input
            aria-label="UID الموظف"
            name="uid"
            placeholder="Firebase UID"
            dir="ltr"
            required
            className={input}
          />
          <input
            aria-label="اسم الموظف"
            name="name"
            placeholder="اسم الموظف"
            required
            className={input}
          />
          <input
            aria-label="هاتف الموظف"
            name="phone"
            placeholder="الهاتف"
            type="tel"
            required
            className={input}
          />
          <select aria-label="صلاحية الموظف" name="role" className={input}>
            <option value="courier">مندوب</option>
            <option value="restaurant">مدير مطعم</option>
          </select>
          <select
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
            يُضاف من Firebase Console فقط.
          </p>
        </form>
        <form
          className="space-y-2"
          onSubmit={(e) =>
            save(e, (data) => {
              const code = String(data.get("code")).toUpperCase();
              if (!/^[A-Z0-9_-]{1,40}$/.test(code))
                throw new Error("كود غير صالح.");
              return saveRecord("coupons", code, {
                code,
                title: code,
                description: String(data.get("description")),
                discountType: "fixed",
                value: Number(data.get("value")),
                minOrder: Number(data.get("minOrder")),
              });
            })
          }
        >
          <h3 className="font-bold">إضافة كود خصم ثابت</h3>
          <input
            aria-label="كود الخصم"
            name="code"
            placeholder="WELCOME10"
            required
            className={input}
          />
          <input
            aria-label="وصف الخصم"
            name="description"
            placeholder="وصف العرض"
            required
            className={input}
          />
          <label className="block text-xs">
            الخصم بالجنيه
            <input
              type="number"
              name="value"
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
