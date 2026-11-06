import { customerMessage } from "../utils/customerMessage";
import React, { useState, useRef } from "react";
import type { Profile, Coupon } from "../types/index.ts";
import { Camera, Trash2, User } from "lucide-react";

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
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("حجم الصورة كبير، الحد الأقصى المسموح به 2 ميجابايت.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
        setError("");
      }
    };
    reader.readAsDataURL(file);
  }

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
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h2 className="font-bold text-lg">حسابي وعنوان التوصيل</h2>
          <p className="text-sm text-slate-600">{user.email || user.phone}</p>
          <p className="text-xs text-slate-400 break-all" dir="ltr">
            UID: {user.id}
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 font-bold text-slate-700 border">
          {user.role === "admin"
            ? "مدير المنظومة"
            : user.role === "restaurant"
              ? "مدير / شريك متجر"
              : user.role === "courier"
                ? "كابتن توصيل"
                : "عميل المنظومة"}
        </span>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setSaved(false);
          setError("");
          try {
            await onUpdateProfile({
              ...user,
              avatarUrl: avatarUrl || undefined,
              fullName: String(data.get("fullName")),
              phone: String(data.get("phone")),
              ministry: String(data.get("ministry")),
              floorNumber: String(data.get("floorNumber")),
              roomNumber: String(data.get("roomNumber")),
            });
            setSaved(true);
          } catch (e) {
            setError(customerMessage(e, "تعذر حفظ الملف."));
          } finally {
            setBusy(false);
          }
        }}
      >
        {/* Profile Avatar Card */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="الصورة الشخصية"
                referrerPolicy="no-referrer"
                onError={() => setAvatarUrl("")}
                className="w-16 h-16 rounded-full object-cover border-2 border-orange-500 shadow-xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-lg border">
                {(user.fullName || user.email || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1 text-center sm:text-right space-y-1">
            <p className="font-bold text-sm text-slate-800">الصورة الشخصية للحساب</p>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Camera size={14} className="text-slate-600" />
                <span>{avatarUrl ? "تغيير الصورة" : "رفع صورة شخصية"}</span>
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl("")}
                  className="px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 size={13} />
                  <span>إزالة</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              يمكنك رفع وتحديث صورتك الشخصية في أي وقت (بحد أقصى 2 ميجابايت).
            </p>
          </div>
        </div>

        {(
          [
            { key: "fullName", label: "الاسم بالكامل", max: 120 },
            { key: "phone", label: "رقم الهاتف", max: 30 },
            { key: "ministry", label: "عنوان التوصيل / المنطقة السكنية أو جهة العمل", max: 120 },
            { key: "floorNumber", label: "رقم المبنى / الدور", max: 60 },
            { key: "roomNumber", label: "رقم الشقة أو المكتب", max: 80 },
          ] as const
        ).map((field) => (
          <label key={field.key} className="block text-sm font-bold text-slate-700">
            {field.label}
            <input
              name={field.key}
              defaultValue={user[field.key] || ""}
              maxLength={field.max}
              required
              className="block w-full border border-slate-300 rounded-xl p-2.5 mt-1 text-sm bg-white font-medium focus:outline-none focus:border-orange-500"
            />
          </label>
        ))}

        {error && (
          <p role="alert" className="text-red-700 text-sm font-bold bg-red-50 p-2.5 rounded-lg border border-red-200">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-green-800 text-sm font-bold bg-green-50 p-2.5 rounded-lg border border-green-200">
            تم الحفظ بنجاح وتحديث بيانات ملفك الشخصي.
          </p>
        )}

        <button
          disabled={busy}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          {busy ? "جارٍ الحفظ…" : "حفظ بياناتي"}
        </button>
      </form>

      <p className="text-xs text-slate-500 pt-2 border-t">
        المحفظة والدفع الإلكتروني غير مفعّلين. لا يوجد رصيد تجريبي أو شحن وهمي.
      </p>

      {user.role === "admin" && (
        <button
          className="w-full bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-xl font-bold text-sm transition-colors cursor-pointer"
          onClick={onSwitchToAdmin}
        >
          فتح لوحة التحكم الإدارية
        </button>
      )}
    </section>
  );
};
