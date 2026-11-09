import React, { useState } from 'react';
import { X, Store, User, Phone, MapPin, Building, MessageSquare, Check, AlertCircle, Loader2, Send } from 'lucide-react';
import { submitPartnerApplication } from '../../lib/partnerApplications';

interface PartnerRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PartnerRegisterModal: React.FC<PartnerRegisterModalProps> = ({ isOpen, onClose }) => {
  const [businessName, setBusinessName] = useState('');
  const [partnerType, setPartnerType] = useState('supermarket');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [branchesCount, setBranchesCount] = useState('1');
  const [locationInCapital, setLocationInCapital] = useState('');
  const [notes, setNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanBiz = businessName.trim();
    const cleanContact = contactName.trim();
    const cleanPhone = phone.trim();

    if (!cleanBiz || !cleanContact || !cleanPhone) {
      setError('يرجى ملء اسم النشاط التجاري واسم المسؤول ورقم الهاتف للتواصل.');
      return;
    }

    if (!/^(\+20|0)?1[0125][0-9]{8}$/.test(cleanPhone)) {
      setError('يرجى إدخال رقم هاتف مصري صحيح (11 رقماً).');
      return;
    }

    setBusy(true);

    try {
      const appId = `partner-${Date.now()}`;
      const payload = {
        id: appId,
        businessName: cleanBiz,
        partnerType,
        contactName: cleanContact,
        phone: cleanPhone,
        branchesCount: branchesCount.trim() || '1',
        locationInCapital: locationInCapital.trim() || 'العاصمة الإدارية',
        notes: notes.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await submitPartnerApplication(payload);

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الطلب حالياً، يرجى المحاولة ثانية.');
    } finally {
      setBusy(false);
    }
  };

  const openWhatsApp = () => {
    const text = `مرحباً إدارة سنجوب، أود الانضمام كشريك/تاجر جديد في المنصة.
اسم النشاط: ${businessName || 'متجر جديد'}
نوع النشاط: ${partnerType}
المسؤول: ${contactName || 'شريك'}
الهاتف: ${phone || ''}`;
    window.open(`https://wa.me/201017799580?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs select-none transition-all"
      dir="rtl"
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-[28px] sm:rounded-3xl shadow-2xl border-t sm:border border-[#E5E7EB] flex flex-col max-h-[92dvh] sm:max-h-[88vh] font-['Cairo',sans-serif] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F0F1F3] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF2EC] border border-[#FFD4C2] flex items-center justify-center text-[#FF5900]">
              <Store size={22} />
            </div>
            <div>
              <h3 className="font-black text-base text-[#111827] leading-tight">
                سجل كتاجر أو شريك في سنجوب 🤝
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                انضم لشبكة تجار العاصمة والشروق وابدأ في استقبال الطلبات
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-[#6B7280] hover:bg-[#F3F4F6] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          
          {error && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center py-8 px-4 space-y-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <Check size={32} />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-lg font-black text-[#111827]">
                  تم استلام طلب الشراكة بنجاح! 🎉
                </h4>
                <p className="text-xs text-[#6B7280] leading-relaxed max-w-sm mx-auto">
                  شكراً لاهتمامك بالانضمام إلى عائلة سنجوب. سيتواصل معك أحد مسؤولي التعاقد خلال 24 ساعة لمراجعة المستندات وتفعيل متجرك على المنصة.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <MessageSquare size={16} />
                  <span>تأكيد المتابعة عبر WhatsApp فوراً</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {/* Business Name */}
              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">
                  اسم المتجر أو النشاط التجاري <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="مثال: أسواق العاصمة، مخابز البركة، كافيه رويال"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-hidden focus:border-[#FF5900] text-[#111827] font-bold"
                  />
                  <Store size={15} className="absolute left-3.5 top-3 text-[#9CA3AF]" />
                </div>
              </div>

              {/* Activity Type & Branches */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#111827] mb-1">
                    نوع النشاط
                  </label>
                  <select
                    value={partnerType}
                    onChange={(e) => setPartnerType(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-hidden focus:border-[#FF5900] text-[#111827] font-bold"
                  >
                    <option value="supermarket">سوبر ماركت وبقالة</option>
                    <option value="produce">خضار وفواكه</option>
                    <option value="bakery">مخبز وحلويات</option>
                    <option value="butchery">لحوم ودواجن</option>
                    <option value="restaurant">مطعم ووجبات</option>
                    <option value="cafe">كافيه ومشروبات</option>
                    <option value="roastery">محمصة وعطارة</option>
                    <option value="other">نشاط آخر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#111827] mb-1">
                    عدد الفروع الحالية
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={branchesCount}
                    onChange={(e) => setBranchesCount(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-hidden focus:border-[#FF5900] text-[#111827] font-bold"
                  />
                </div>
              </div>

              {/* Contact Name */}
              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">
                  اسم المسؤول أو صاحب النشاط <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="الاسم ثلاثي"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-hidden focus:border-[#FF5900] text-[#111827] font-bold"
                  />
                  <User size={15} className="absolute left-3.5 top-3 text-[#9CA3AF]" />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">
                  رقم الهاتف (عليه واتساب) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                    placeholder="010XXXXXXXX"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-hidden focus:border-[#FF5900] text-[#111827] font-mono font-bold text-right"
                  />
                  <Phone size={15} className="absolute left-3.5 top-3 text-[#9CA3AF]" />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">
                  المنطقة أو عنوان الفرع الرئيسي
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={locationInCapital}
                    onChange={(e) => setLocationInCapital(e.target.value)}
                    placeholder="مثال: العاصمة الإدارية - الحي الحكومي / الشروق"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-hidden focus:border-[#FF5900] text-[#111827] font-bold"
                  />
                  <MapPin size={15} className="absolute left-3.5 top-3 text-[#9CA3AF]" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">
                  ملاحظات إضافية أو أصناف ترغب في إضافتها
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي تفاصيل تود توضيحها حول نشاطك التجاري أو سرعة التجهيز..."
                  className="w-full px-3.5 py-2 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-hidden focus:border-[#FF5900] text-[#111827] resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 px-4 rounded-xl bg-[#FF5900] hover:bg-[#e04f00] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>جارٍ إرسال الطلب...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>إرسال طلب الانضمام كشريك</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="w-full py-2.5 px-4 rounded-xl border border-[#25D366] text-[#15803D] hover:bg-[#F0FDF4] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <MessageSquare size={15} className="text-[#25D366]" />
                  <span>تواصل مباشر مع مسؤول التعاقد بالواتساب</span>
                </button>
              </div>

            </form>
          )}

        </div>

      </div>
    </div>
  );
};

