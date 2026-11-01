import { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Send,
  ExternalLink,
  ShieldCheck,
  Lock,
  Mail,
  Phone,
  User,
  Eye,
  EyeOff,
  Store,
} from 'lucide-react';

export interface AccountAccessDialogProps {
  email: string;
  role: string;
  fullName?: string;
  phone?: string;
  password?: string;
  storeName?: string;
  onClose: () => void;
}

const roleNames: Record<string, string> = {
  employee: 'عميل / مستخدم المنظومة',
  restaurant: 'شريك تجاري / إدارة متجر ومطبخ',
  courier: 'كابتن / مندوب توصيل معتمد',
  admin: 'مدير المنظومة (إدارة عامة)',
};

const rolePortals: Record<string, { path: string; name: string }> = {
  employee: { path: '/', name: 'المتجر الرئيسي وسلة الطلبات' },
  restaurant: { path: '/merchant', name: 'بوابة التاجر والمطبخ' },
  courier: { path: '/courier', name: 'بوابة كابتن التوصيل' },
  admin: { path: '/admin', name: 'لوحة الإدارة والتحكم' },
};

export function AccountAccessDialog({
  email,
  role,
  fullName = '',
  phone = '',
  password = '',
  storeName = '',
  onClose,
}: AccountAccessDialogProps) {
  const [copiedPass, setCopiedPass] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [showPassword, setShowPassword] = useState(true);

  const portal = rolePortals[role] || { path: '/', name: 'المنظومة الرئيسية' };
  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}${portal.path}` : portal.path;
  const roleTitle = roleNames[role] || role;

  // Format phone to international WhatsApp format (e.g., 01012345678 -> 201012345678)
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  let waPhone = cleanPhone;
  if (waPhone.startsWith('01')) {
    waPhone = '2' + waPhone;
  } else if (waPhone.startsWith('+')) {
    waPhone = waPhone.slice(1);
  }

  // Official secure WhatsApp welcome message (NO reset links, NO leaked tokens)
  const whatsappMessage = `مرحباً بك في منصة سنجوب 🚚

تم تفعيل حسابك المعتمد بنجاح. إليك بيانات تسجيل الدخول الرسمية الخاصة بك:

👤 الاسم: ${fullName || 'شريك سنجوب'}
🏷️ نوع الحساب: ${roleTitle}${storeName ? `\n🏪 المتجر التابع له: ${storeName}` : ''}
📧 البريد الإلكتروني: ${email}
📱 رقم الهاتف: ${phone || 'المسجل بالنظام'}
🔑 كلمة المرور: ${password || '(كلمة المرور المعتمدة)'}

🌐 رابط الدخول المباشر للبوابة:
${portalUrl}

📌 تعليمات أمنية:
- يرجى الاحتفاظ بهذه البيانات وعدم مشاركتها مع أي جهة.
- ننصح بتغيير كلمة المرور بعد أول تسجيل دخول لضمان الخصوصية.

نتمنى لك تجربة موفقة ومتميزة مع فريق سنجوب!`;

  function handleOpenWhatsApp() {
    const encoded = encodeURIComponent(whatsappMessage);
    const url = waPhone ? `https://wa.me/${waPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 3000);
    } catch {}
  }

  async function handleCopyPass() {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    } catch {}
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 to-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600/60 border border-teal-400/40 flex items-center justify-center">
              <ShieldCheck size={20} className="text-teal-200" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>بيانات الحساب وتسجيل الدخول</span>
                <span className="text-[10px] bg-teal-500/30 text-teal-200 border border-teal-400/30 px-2 py-0.5 rounded-full font-medium">
                  {roleTitle}
                </span>
              </h2>
              <p className="text-[11px] text-teal-100/80">بيانات الاعتماد الرسمية للدخول للبوابة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Credentials Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
            {fullName && (
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <User size={13} className="text-slate-400" />
                  الاسم بالكامل:
                </span>
                <span className="font-bold text-slate-800">{fullName}</span>
              </div>
            )}

            <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Mail size={13} className="text-slate-400" />
                البريد الإلكتروني:
              </span>
              <span className="font-mono text-slate-800 font-semibold" dir="ltr">
                {email}
              </span>
            </div>

            {phone && (
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Phone size={13} className="text-slate-400" />
                  رقم الهاتف (واتساب):
                </span>
                <span className="font-mono text-slate-800 font-semibold" dir="ltr">
                  {phone}
                </span>
              </div>
            )}

            {storeName && (
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Store size={13} className="text-amber-600" />
                  المتجر التابع له:
                </span>
                <span className="font-bold text-amber-900">{storeName}</span>
              </div>
            )}

            {password && (
              <div className="flex items-center justify-between py-1.5 bg-amber-50/80 border border-amber-200/80 rounded-lg px-2.5">
                <span className="text-amber-900 font-bold flex items-center gap-1.5">
                  <Lock size={13} className="text-amber-700" />
                  كلمة المرور:
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-950 text-sm tracking-wider" dir="ltr">
                    {showPassword ? password : '••••••••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showPassword ? 'إخفاء' : 'إظهار'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPass}
                    className="px-2 py-0.5 bg-white border border-amber-300 rounded text-[11px] font-bold text-amber-900 hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPass ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    <span>{copiedPass ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 text-[11px]">
              <span className="text-slate-500">رابط البوابة المباشرة:</span>
              <a
                href={portal.path}
                target="_blank"
                rel="noreferrer"
                className="text-teal-700 hover:text-teal-900 font-bold underline flex items-center gap-1"
              >
                <span>{portal.name} ({portal.path})</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Big WhatsApp Action Button */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Send size={16} />
              <span>إرسال بيانات الدخول عبر واتساب مباشرة</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMessage}
              className="w-full py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedMessage ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedMessage ? 'تم نسخ رسالة الواتساب بالكامل للمحفظة!' : 'نسخ نص رسالة الواتساب'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            تم، إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
