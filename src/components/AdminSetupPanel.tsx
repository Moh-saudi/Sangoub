import React, { useState } from "react";
import { saveRecord } from "../lib/firebase.ts";
import type { Store, Product } from "../types/index.ts";
import { ImageFileField } from "./ImageFileField";
import { saveCatalogWithImages } from "../lib/catalogImages";
export function AdminSetupPanel({
  stores,
  products = [],
  onError,
  defaultOpen = false,
}: {
  stores: Store[];
  products?: Product[];
  onError: (error: unknown) => void;
  defaultOpen?: boolean;
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
      open={defaultOpen || undefined}
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
      {busy && <p role="status" className="text-sm text-orange-700">جارٍ رفع الصور وحفظ البيانات…</p>}
      <div className="grid md:grid-cols-2 gap-6 mt-4">
        <form className="space-y-2" onSubmit={(event) => save(event, async (data) => {
          const product = products.find((item) => item.id === data.get("product"));
          if (!product) throw new Error("اختر الصنف.");
          const file = data.get("productFile") as File | null;
          if (!file?.size) throw new Error("اختر صورة الصنف.");
          await saveCatalogWithImages("products", product.id, {}, [{ field: "imageUrl", file }]);
        })}>
          <h3 className="font-bold">تحديث صورة صنف موجود</h3>
          <select name="product" aria-label="الصنف لتحديث الصورة" required className={input}><option value="">اختر الصنف</option>{products.map((item) => <option key={item.id} value={item.id}>{item.storeName} · {item.name}</option>)}</select>
          <ImageFileField name="productFile" label="صورة الصنف الجديدة" disabled={busy} />
          <button disabled={busy} className="bg-slate-900 text-white p-2 rounded-xl">حفظ صورة الصنف</button>
        </form>
        <form className="space-y-2" onSubmit={(event) => save(event, async (data) => {
          const store = stores.find((item) => item.id === data.get("store"));
          if (!store) throw new Error("اختر المتجر.");
          const logo = data.get("logoFile") as File | null;
          const banner = data.get("bannerFile") as File | null;
          if (!logo?.size && !banner?.size) throw new Error("اختر صورة أو شعارًا لرفعه.");
          await saveCatalogWithImages("stores", store.id, {}, [
            { field: "logoUrl", file: logo }, { field: "bannerUrl", file: banner },
          ]);
        })}>
          <h3 className="font-bold">تحديث صور محل موجود</h3>
          <select aria-label="المحل لتحديث الصور" name="store" required className={input}>
            <option value="">اختر المتجر</option>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <ImageFileField name="logoFile" label="شعار المحل الجديد" disabled={busy} />
          <ImageFileField name="bannerFile" label="صورة المحل الجديدة" disabled={busy} />
          <button disabled={busy} className="bg-slate-900 text-white p-2 rounded-xl">حفظ الصور</button>
        </form>
        <form
          className="space-y-2"
          onSubmit={(e) =>
            save(e, async (data) => {
              const id = crypto.randomUUID();
              await saveCatalogWithImages("stores", id, {
                id,
                name: String(data.get("name")),
                nameEn: String(data.get("name")),
                type: String(data.get("type")),
                category: String(data.get("category")),
                logo: "🍽️",
                banner: "from-orange-600 to-slate-900",
                status: "open",
                rating: 0,
                ratingCount: 0,
                deliveryTime: "يحدده المتجر",
                minOrder: Number(data.get("minOrder")),
                deliveryFee: Number(data.get("deliveryFee")),
                locationInDistrict: String(data.get("address")),
              }, [
                { field: "logoUrl", file: data.get("logoFile") as File | null },
                { field: "bannerUrl", file: data.get("bannerFile") as File | null },
              ]);
            })
          }
        >
          <h3 className="font-bold">إضافة متجر</h3>
          <input aria-label="نوع النشاط" name="type" placeholder="نوع النشاط" required className={input} />
          <select aria-label="تصنيف المتجر" name="category" className={input}>{[["breakfast", "فطور"], ["sandwiches", "مطعم وسندوتشات"], ["supermarket", "سوبر ماركت"], ["cafe", "كافيه"], ["desserts", "حلويات"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
          <ImageFileField name="logoFile" label="شعار المحل" disabled={busy} />
          <ImageFileField name="bannerFile" label="صورة المحل" disabled={busy} />
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
              const file = data.get("productFile") as File | null;
              const imageUrl = String(data.get("imageUrl") || "").trim();
              if (!file?.size && !imageUrl) throw new Error("ارفع صورة الصنف أو أدخل رابطها.");
              if (imageUrl && !imageUrl.startsWith("https://")) throw new Error("رابط الصورة يجب أن يستخدم HTTPS.");
              await saveCatalogWithImages("products", id, {
                id,
                storeId: store.id,
                storeName: store.name,
                name: String(data.get("name")),
                description: String(data.get("description")),
                price: Number(data.get("price")),
                category: String(data.get("category")),
                imageType: "croissant",
                imageUrl,
                inStock: true,
              }, [{ field: "imageUrl", file }]);
            })
          }
        >
          <h3 className="font-bold">إضافة صنف</h3>
          <select aria-label="تصنيف الصنف" name="category" className={input}>{["فطور", "سندوتشات", "سوبر ماركت بالقطعة", "مشروبات", "وجبات خفيفة", "حلويات"].map((category) => <option key={category}>{category}</option>)}</select>
          <ImageFileField name="productFile" label="صورة الصنف" disabled={busy} />
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
