import React from "react";
import { X, Download } from "lucide-react";
import { usePWAInstall } from "../utils/usePWAInstall.ts";
import type { Profile } from "../types/index.ts";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: Profile;
  onLoginSuccess: (profile: Profile) => void;
}
export const MobileReleaseModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
      dir="rtl"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="تثبيت التطبيق"
        className="bg-white text-slate-900 max-w-md w-full rounded-3xl p-6 space-y-4"
      >
        <div className="flex justify-between">
          <h2 className="font-bold">طلبات العاصمة على جهازك</h2>
          <button aria-label="إغلاق" onClick={onClose}>
            <X />
          </button>
        </div>
        <p className="text-sm">
          {isInstalled
            ? "التطبيق مثبت بالفعل."
            : isIOS
              ? "من قائمة المشاركة في Safari، اختر إضافة إلى الشاشة الرئيسية."
              : "يمكنك تثبيت نسخة الويب من قائمة المتصفح، ثم اختيار تثبيت التطبيق."}
        </p>
        {isInstallable && (
          <button
            className="flex gap-2 bg-orange-600 text-white p-3 rounded-xl"
            onClick={install}
          >
            <Download size={18} />
            تثبيت التطبيق
          </button>
        )}
        <p className="text-xs text-slate-500">
          المصادقة وإدارة البيانات تتمان من حسابك الحقيقي. إصدار Android على
          المتجر يحتاج إعدادًا ونشرًا منفصلين.
        </p>
      </section>
    </div>
  );
};
