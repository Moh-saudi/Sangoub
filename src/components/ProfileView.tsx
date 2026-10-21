import React, { useState } from "react";
import type { Profile, Coupon } from "../types/index.ts";
interface Props {
  user: Profile;
  onUpdateProfile: (profile: Profile) => Promise<void>;
  savedCoupons: Coupon[];
  onSwitchToAdmin: () => void;
  onOpenAuthModal?: () => void;
}
export const ProfileView: React.FC<Props> = ({
  user,
  onUpdateProfile,
  onSwitchToAdmin,
  onOpenAuthModal,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  if (user.isGuest)
    return (
      <div
        className="max-w-xl mx-auto p-6 text-center text-slate-900 bg-white rounded-2xl my-5"
        dir="rtl"
      >
        <h2 className="font-bold">سجّل الدخول لمتابعة طلباتك</h2>
        <button
          className="p-3 mt-3 bg-orange-600 text-white rounded-xl"
          onClick={onOpenAuthModal}
        >
          تسجيل الدخول أو إنشاء حساب
        </button>
      </div>
    );
  return (
    <section
      className="max-w-2xl mx-auto my-5 p-5 bg-white rounded-2xl text-slate-900 space-y-4"
      dir="rtl"
    >
      <h2 className="font-bold">حسابي وعنوان التوصيل</h2>
      <p className="text-sm">{user.email || user.phone}</p>
      <p className="text-xs text-slate-500 break-all" dir="ltr">
        UID: {user.id}
      </p>
      <p className="text-xs">
        صلاحية الحساب:{" "}
        {user.role === "admin"
          ? "مدير"
          : user.role === "restaurant"
            ? "مدير مطعم"
            : user.role === "courier"
              ? "مندوب"
              : "عميل"}
      </p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setSaved(false);
          setError("");
          try {
            await onUpdateProfile({
              ...user,
              fullName: String(data.get("fullName")),
              phone: String(data.get("phone")),
              ministry: String(data.get("ministry")),
              floorNumber: String(data.get("floorNumber")),
              roomNumber: String(data.get("roomNumber")),
            });
            setSaved(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "تعذر حفظ الملف.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {(
          [
            { key: "fullName", label: "الاسم", max: 120 },
            { key: "phone", label: "الهاتف", max: 30 },
            { key: "ministry", label: "الوزارة", max: 120 },
            { key: "floorNumber", label: "الدور", max: 60 },
            { key: "roomNumber", label: "المكتب", max: 80 },
          ] as const
        ).map((field) => (
          <label key={field.key} className="block text-sm">
            {field.label}
            <input
              name={field.key}
              defaultValue={user[field.key] || ""}
              maxLength={field.max}
              required
              className="block w-full border rounded-xl p-2 mt-1"
            />
          </label>
        ))}
        {error && (
          <p role="alert" className="text-red-700 text-sm">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-green-800 text-sm">
            تم الحفظ في قاعدة البيانات.
          </p>
        )}
        <button
          disabled={busy}
          className="bg-slate-900 text-white p-3 rounded-xl"
        >
          {busy ? "جارٍ الحفظ…" : "حفظ بياناتي"}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        المحفظة والدفع الإلكتروني غير مفعّلين. لا يوجد رصيد تجريبي أو شحن وهمي.
      </p>
      {user.role === "admin" && (
        <button
          className="bg-orange-600 text-white p-3 rounded-xl"
          onClick={onSwitchToAdmin}
        >
          فتح لوحة التحكم
        </button>
      )}
    </section>
  );
};
