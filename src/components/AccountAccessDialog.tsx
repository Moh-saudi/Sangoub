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
  Sparkles,
} from 'lucide-react';
import { adminApi } from '../lib/adminApi';

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
  employee: 'عميل متسوق / مستخدم المنظومة',
  restaurant: 'شريك تجاري / إدارة المتجر والطلبات',
  courier: 'كابتن / مندوب توصيل معتمد',
  admin: 'مدير المنظومة (إدارة عامة)',
};

const rolePortals: Record<string, { path: string; name: string }> = {
  employee: { path: '/', name: 'المتجر الرئيسي وسلة الطلبات' },
  restaurant: { path: '/merchant', name: 'بوابة الشريك والتاجر' },
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
  const [currentPassword, setCurrentPassword] = useState(password || 'San@123456!');
  const [isEditingPass, setIsEditingPass] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
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

  // Official secure WhatsApp welcome message
  const whatsappMessage = `مرحباً بك في منصة سنجوب 🚚

تم اعتماد وتفعيل حسابك بنجاح. إليك بيانات تسجيل الدخول الرسمية الخاصة بك:

👤 الاسم: ${fullName || 'شريك سنجوب'}
🏷️ نوع الحساب: ${roleTitle}${storeName ? `\n🏪 المتجر التابع له: ${storeName}` : ''}
📧 البريد الإلكتروني: ${email}
📱 رقم الهاتف: ${phone || 'المسجل بالنظام'}
🔑 كلمة المرور (الرقم السري): ${currentPassword}

🌐 رابط الدخول المباشر للبوابة:
${portalUrl}

📌 تعليمات أمنية:
- يرجى الاحتفاظ بهذه البيانات وعدم مشاركتها مع أي جهة غير مخولة.
- يمكنك تسجيل الدخول بالبريد الإلكتروني وكلمة المرور أعلاه مباشرة.

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
      await navigator.clipboard.writeText(currentPassword);
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    } catch {}
  }

  async function handleSaveNewPassword() {
    if (!currentPassword || currentPassword.length < 6) {
      alert('كلمة المرور يجب أن تكون 6 خانات على الأقل.');
      return;
    }
    setUpdating(true);
    setUpdateMsg('');
    try {
      await adminApi('users', {
        action: 'create',
        email,
        password: currentPassword,
        fullName,
        phone,
        role
      });
      setUpdateMsg('✓ تم حفظ واعتماد كلمة المرور في قاعدة البيانات بنجاح.');
      setIsEditingPass(false);
    } catch (e: any) {
      setUpdateMsg('تعذر التحديث: ' + (e?.message || 'خطأ غير معروف'));
    } finally {
      setUpdating(false);
    }
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

            {/* Password Row with Edit & Generate options */}
            <div className="space-y-2 py-2 px-3 bg-amber-50/90 border border-amber-200/90 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-amber-900 font-bold flex items-center gap-1.5 text-xs">
                  <Lock size={14} className="text-amber-700" />
                  <span>كلمة المرور (الرقم السري):</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const generated = 'San@' + Math.floor(100000 + Math.random() * 900000);
                      setCurrentPassword(generated);
                      setIsEditingPass(true);
                      setUpdateMsg('تم توليد رقم سري جديد، اضغط "حفظ واعتماد" لتطبيقه.');
                    }}
                    className="px-2 py-0.5 bg-white border border-amber-300 hover:bg-amber-100 rounded text-[10px] font-bold text-amber-900 flex items-center gap-1 cursor-pointer shadow-2xs"
                    title="توليد رقم سري جديد تلقائياً"
                  >
                    <Sparkles size={11} className="text-amber-600" />
                    <span>توليد رقم جديد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingPass(prev => !prev)}
                    className="px-2 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 rounded text-[10px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isEditingPass ? 'إلغاء' : 'تعديل'}</span>
                  </button>
                </div>
              </div>

              {isEditingPass ? (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    dir="ltr"
                    className="flex-1 h-8 px-2.5 bg-white border border-amber-400 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="أدخل كلمة المرور الجديدة"
                  />
                  <button
                    type="button"
                    disabled={updating}
                    onClick={handleSaveNewPassword}
                    className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors shrink-0 disabled:opacity-50"
                  >
                    {updating ? 'جارٍ الحفظ...' : 'حفظ واعتماد بالنظام'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono font-bold text-amber-950 text-sm tracking-wider" dir="ltr">
                    {showPassword ? currentPassword : '••••••••••••'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-slate-500 hover:text-slate-700 p-1 cursor-pointer"
                      title={showPassword ? 'إخفاء' : 'إظهار'}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPass}
                      className="px-2.5 py-1 bg-white border border-amber-300 rounded-md text-[11px] font-bold text-amber-900 hover:bg-amber-100 flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      {copiedPass ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedPass ? 'تم النسخ ✓' : 'نسخ الرقم السري'}</span>
                    </button>
                  </div>
                </div>
              )}

              {updateMsg && (
                <p className={`text-[10px] font-medium pt-0.5 ${updateMsg.startsWith('✓') ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {updateMsg}
                </p>
              )}
            </div>

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
