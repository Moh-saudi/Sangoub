import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { User, Phone, MapPin, X, Sparkles, Check, Lock } from 'lucide-react';
import { BRAND } from '../../brand';

interface SangoubRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

export const SangoubRegisterModal: React.FC<SangoubRegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'افتح حسابك في سنجوب 🐿️',
  subtitle = 'سجّل بياناتك الآن لإتمام طلبك ومتابعة خط سير المندوب والتوصيل مباشرة',
}) => {
  const { user, serviceArea, registerSangoubAccount } = useStore();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(serviceArea.name || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();

    if (!cleanName) {
      setError('يرجى كتابة اسمك بالكامل.');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setError('يرجى إدخال رقم هاتف صحيح (11 رقم للتواصل عبر الواتساب والمكالمات).');
      return;
    }

    if (!cleanAddress) {
      setError('يرجى تحديد عنوان ومكان التوصيل بدقة.');
      return;
    }

    setIsSubmitting(true);

    try {
      registerSangoubAccount(cleanName, cleanPhone, cleanAddress);
      setIsSubmitting(false);
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch {
      setIsSubmitting(false);
      setError('حدث خطأ أثناء حفظ البيانات، يُرجى المحاولة ثانية.');
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3.5 sm:p-4 bg-black/60 backdrop-blur-xs select-none" dir="rtl">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-[#E7E9EE] relative animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto no-scrollbar font-['Cairo',sans-serif]">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-full text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          aria-label="إغلاق"
        >
          <X size={18} />
        </button>

        {/* Mascot & Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF2EC] border border-[#FFD4C2] flex items-center justify-center shrink-0 p-1.5 shadow-xs">
            <img
              src={BRAND.mascot.delivery}
              alt="سنجوب"
              className="w-full h-full object-contain"
              onError={(e) => {
                // Fallback to mascot icon
                (e.target as HTMLImageElement).src = BRAND.mascot.icon;
              }}
            />
          </div>
          <div>
            <h3 className="font-black text-base sm:text-lg text-[#111827] flex items-center gap-1.5">
              <span>{title}</span>
            </h3>
            <p className="text-[11px] text-[#6B7280] leading-tight">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Welcome Bonus Callout */}
        <div className="mb-4 bg-gradient-to-r from-[#FFF2EC] to-[#FFF7ED] border border-[#FFD4C2] rounded-2xl p-2.5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-[#FF5900] text-white flex items-center justify-center shrink-0 font-black text-xs">
            <Sparkles size={14} />
          </div>
          <div className="text-[11px] leading-tight">
            <p className="font-black text-[#FF5900]">هدية ترحيبية خاصة بمناسبة التسجيل 🎁</p>
            <p className="text-[#6B7280] text-[10px]">تم إضافة 20 ج.م في محفظة سنجوب لأول طلب توصيل</p>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold text-center">
            {error}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Full Name */}
          <div>
            <label htmlFor="reg-fullname" className="block text-xs font-black text-[#374151] mb-1">
              الاسم بالكامل:
            </label>
            <div className="relative">
              <User size={15} className="absolute right-3 top-3 text-[#9CA3AF]" />
              <input
                id="reg-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: أحمد محمد عبد الله"
                className="w-full pr-9 pl-3 py-2 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827]"
              />
            </div>
          </div>

          {/* Phone / WhatsApp */}
          <div>
            <label htmlFor="reg-phone" className="block text-xs font-black text-[#374151] mb-1">
              رقم الهاتف / الواتساب (للتواصل وتأكيد الطلب):
            </label>
            <div className="relative">
              <Phone size={15} className="absolute right-3 top-3 text-[#9CA3AF]" />
              <input
                id="reg-phone"
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full pr-9 pl-3 py-2 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-right text-[#111827]"
              />
            </div>
          </div>

          {/* Delivery Address / Street / Building */}
          <div>
            <label htmlFor="reg-address" className="block text-xs font-black text-[#374151] mb-1">
              العنوان والشارع (يظهر للتاجر والمندوب بدقة):
            </label>
            <div className="relative">
              <MapPin size={15} className="absolute right-3 top-3 text-[#FF5900]" />
              <input
                id="reg-address"
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="اسم الشارع / الحي / الوزارة / المبنى والدور"
                className="w-full pr-9 pl-3 py-2 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827]"
              />
            </div>
            <p className="text-[10px] text-[#6B7280] mt-1">
              هذا العنوان سيظهر فعلياً كنقطة تسليم للمندوب عند استلام الطلب من التاجر.
            </p>
          </div>

          {/* Optional Quick Password */}
          <div>
            <label htmlFor="reg-pass" className="block text-xs font-bold text-[#6B7280] mb-1">
              كلمة مرور الحساب (اختياري لتسجيل الدخول السريع لاحقاً):
            </label>
            <div className="relative">
              <Lock size={15} className="absolute right-3 top-3 text-[#9CA3AF]" />
              <input
                id="reg-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-9 pl-3 py-2 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none font-bold text-[#111827]"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 bg-[#FF5900] hover:bg-[#E04E00] active:scale-98 text-white text-xs font-black rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={16} strokeWidth={2.5} />
            <span>{isSubmitting ? 'جاري فتح الحساب...' : 'إنشاء الحساب ومتابعة الطلب'}</span>
          </button>
        </form>

        <p className="text-center text-[10.5px] text-[#6B7280] mt-3">
          بالمتابعة، أنت توافق على شروط خدمة وتوصيل سنجوب بالعاصمة الإدارية الجديدة 🐿️
        </p>

      </div>
    </div>
  );
};
