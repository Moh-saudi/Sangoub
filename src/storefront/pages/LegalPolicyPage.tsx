import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ShieldCheck, 
  Briefcase, 
  ArrowRight, 
  Bike, 
  ChefHat, 
  Headset, 
  ArrowLeft,
  CreditCard,
  Lock
} from 'lucide-react';
import { BRAND } from '../../brand';

interface LegalPolicyPageProps {
  initialTab?: 'terms' | 'privacy' | 'careers';
  onBackToHome: () => void;
}

export const LegalPolicyPage: React.FC<LegalPolicyPageProps> = ({ 
  initialTab = 'terms', 
  onBackToHome 
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'careers'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [initialTab]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10" dir="rtl">
      {/* Back to Home & Tab Navigation Bar */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#6B7280] hover:text-[#111827] bg-white border border-[#E5E7EB] rounded-xl hover:bg-gray-50 transition-colors shadow-2xs"
        >
          <ArrowRight size={15} />
          <span>العودة للمتجر</span>
        </button>

        {/* Minimal Navigation Tabs */}
        <div className="inline-flex p-1 bg-[#F3F4F6] rounded-xl border border-[#E5E7EB] text-xs font-bold">
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'terms'
                ? 'bg-white text-[#FF5900] shadow-xs'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            الشروط والأحكام
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'privacy'
                ? 'bg-white text-[#FF5900] shadow-xs'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            سياسة الخصوصية
          </button>
          <button
            onClick={() => setActiveTab('careers')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'careers'
                ? 'bg-white text-[#FF5900] shadow-xs'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            الوظائف
          </button>
        </div>
      </div>

      {/* 1. TERMS & CONDITIONS */}
      {activeTab === 'terms' && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-150">
          <div className="border-b border-[#E5E7EB] pb-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF5900]">
              <FileText size={15} />
              <span>الوثيقة الرسمية</span>
              <span className="text-gray-300">·</span>
              <span>تنفيذ شركة ميسك للتكنولوجيا (Mesk Technology)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#111827]">
              الشروط والأحكام لمنصة وتطبيق سنجوب
            </h1>
            <p className="text-xs text-[#6B7280]">
              سارية لعام 2026 · البريد الرسمي: info@el7lm.com · واتساب: +01017799580
            </p>
          </div>

          <div className="space-y-5 text-xs sm:text-sm text-[#4B5563] leading-relaxed">
            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-bold text-[#111827]">
                01. تعريف المنصة ونطاق الخدمة
              </h2>
              <p>
                منصة وتطبيق <strong>سنجوب</strong> هي منصة إلكترونية وتطبيق هاتف محمول من تنفيذ وتطوير <strong>شركة ميسك للتكنولوجيا (Mesk Technology)</strong>، تهدف إلى توفير خدمات الطلب والتوصيل الذكي السريع داخل العاصمة الإدارية ومحيطها، وربط المستخدمين بالمطاعم والكافيهات والسوبرماركت المعتمدة، وتوصيل الطلبات مباشرة إلى مكاتب ومنازل العملاء.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-bold text-[#111827]">
                02. شروط الحساب وتحديد موقع التوصيل
              </h2>
              <p>
                يلتزم المستخدم بتسجيل بيانات صحيحة ودقيقة تشمل الاسم ورقم الهاتف الفعال وعنوان التوصيل التفصيلي (المنطقة، المبنى، رقم الدور أو المكتب) لضمان وصول مندوب التوصيل في أسرع وقت وتجنب أي تأخير.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-bold text-[#111827]">
                03. الطلبات والتوصيل والتتبع المباشر
              </h2>
              <p>
                تتيح المنصة توصيلاً فورياً وتتبعاً مباشراً للطلب عبر الخريطة لحظة بلحظة. يمكن للمستخدم إلغاء الطلب مجاناً طالما كان الطلب في مرحلة الاستلام وقبل بدء التجهيز الفعلي في المطبخ أو المتجر.
              </p>
            </section>

            <section className="space-y-2.5 p-4 rounded-xl bg-orange-50/60 border border-orange-100">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#FF5900]">
                <CreditCard size={16} />
                <span>04. السياسة المالية، الدفع الإلكتروني، وحفظ البطاقات</span>
              </div>
              <p className="text-slate-700">
                تدعم المنصة وسائل دفع متعددة ومعتمدة تشمل:
              </p>
              <ul className="list-disc pr-5 space-y-1 text-slate-700">
                <li>
                  <strong>الدفع الإلكتروني بالبطاقات البنكية:</strong> بطاقات (Visa / MasterCard / Meeza) عبر بوابة <strong>Geidea</strong> الآمنة والمرخصة من البنك المركزي المصري.
                </li>
                <li>
                  <strong>التحويل اللحظي عبر InstaPay والمحافظ الإلكترونية:</strong> لضمان مرونة وسرعة التحويل.
                </li>
                <li>
                  <strong>الدفع النقدي (كاش):</strong> عند استلام الطلب من مندوب التوصيل.
                </li>
                <li>
                  <strong>حفظ البطاقات المشفرة (Saved Cards):</strong> عند تفعيل خيار حفظ البطاقة، يتم تخزين رمز توكن مشفر (Tokenized) مشفر بمعايير البنك المركزي دون تخزين أرقام البطاقة الأصلية، ويمكن للمستخدم حذف البطاقة في أي وقت من حسابه.
                </li>
                <li>
                  <strong>سياسة الاسترجاع ورد الأموال (Refunds):</strong> في حال إلغاء الطلب المؤهل قبل التجهيز أو تعذر تسليمه، يتم رد كامل المبلغ المدفوع إلكترونياً إلى نفس وسيلة الدفع خلال دورة العمل البنكية المقررة.
                </li>
              </ul>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-bold text-[#111827]">
                05. حقوق الملكية الفكرية والتواصل القانوني
              </h2>
              <p>
                جميع حقوق التصميم والبرمجيات والعلامة التجارية وقواعد البيانات محفوظة لصالح منصة سنجوب و<strong>شركة ميسك للتكنولوجيا (Mesk Technology)</strong>. لأي استفسارات قانونية أو تعاقدية يرجى التواصل عبر البريد الرسمي <code>info@el7lm.com</code> أو عبر واتساب الدعم <code>+01017799580</code>.
              </p>
            </section>
          </div>
        </div>
      )}

      {/* 2. PRIVACY POLICY */}
      {activeTab === 'privacy' && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-150">
          <div className="border-b border-[#E5E7EB] pb-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <ShieldCheck size={16} />
              <span>حماية البيانات والخصوصية</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#111827]">
              سياسة الخصوصية وحماية البيانات
            </h1>
            <p className="text-xs text-[#6B7280]">
              سارية لعام 2026 · تنفيذ شركة ميسك للتكنولوجيا
            </p>
          </div>

          <div className="space-y-5 text-xs sm:text-sm text-[#4B5563] leading-relaxed">
            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-bold text-[#111827]">
                01. البيانات التي نجمعها
              </h2>
              <p>
                نجمع فقط البيانات الضرورية لتنفيذ وتوصيل الطلبات بدقة: الاسم، رقم الهاتف للتواصل عند الوصول، وعنوان التوصيل الجغرافي، وسجل الطلبات السابقة لتسهيل إعادة الطلب السريع.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-bold text-[#111827]">
                02. أمان وسرية البيانات وعدم مشاركتها
              </h2>
              <p>
                تُحفظ البيانات مشفرة داخل خوادم وقواعد بيانات سحابية آمنة. نلتزم التزاماً تاماً بعدم بيع أو تأجير أو مشاركة بيانات المستخدمين مع أي جهات إعلانية أو أطراف ثالثة خارج نطاق تنفيذ الطلب.
              </p>
            </section>

            <section className="space-y-2.5 p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                <Lock size={16} />
                <span>03. أمان بيانات الدفع والبطاقات البنكية (معايير PCI-DSS)</span>
              </div>
              <ul className="list-disc pr-5 space-y-1.5 text-slate-700">
                <li>
                  <strong>عدم تخزين أرقام البطاقات:</strong> منصة سنجوب <strong>لا تقوم مطلقاً</strong> بتخزين أرقام البطاقات الائتمانية الكاملة أو رمز التحقق السري (CVV/CVC) على خوادمها.
                </li>
                <li>
                  <strong>المعالجة عبر Geidea والبنك المركزي:</strong> تتم جميع عمليات معالجة الدفع عبر قنوات اتصال بنكية مشفرة (TLS 1.3) وبوابة الدفع المعتمدة <strong>Geidea</strong> الخاضعة لرقابة البنك المركزي المصري والمطابقة لمعايير أمان بطاقات الدفع العالمية (PCI-DSS Level 1).
                </li>
                <li>
                  <strong>حفظ البطاقات بتقنية الرموز (Tokenization):</strong> عند رغبة المستخدم في حفظ بطاقته، يتم إنشاء رمز تعريفي بنكي فريد (Token) دون كشف تفاصيل البطاقة الحساسة، ولا يمكن لأي مندوب أو مطعم أو موظف الاطلاع عليها.
                </li>
              </ul>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-bold text-[#111827]">
                04. حق المستخدم في حذف أو تعديل بياناته
              </h2>
              <p>
                يحق لأي مستخدم تعديل بياناته أو طلب حذف حسابه وجميع بياناته المسجلة نهائياً في أي وقت عبر التواصل مع فريق حماية البيانات في شركة ميسك للتكنولوجيا على البريد الرسمي <code>info@el7lm.com</code> أو عبر واتساب الدعم المباشر.
              </p>
            </section>
          </div>
        </div>
      )}

      {/* 3. CAREERS */}
      {activeTab === 'careers' && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-150">
          <div className="border-b border-[#E5E7EB] pb-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF5900]">
              <Briefcase size={16} />
              <span>فرص العمل والانضمام</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#111827]">
              انضم إلى فريق سنجوب
            </h1>
            <p className="text-xs text-[#6B7280]">
              فرص عمل مستمرة في التوصيل، التشغيل، وخدمة العملاء لعام 2026.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center mb-2.5">
                  <Bike size={18} />
                </div>
                <h3 className="text-sm font-bold text-[#111827]">فريق كباتن التوصيل</h3>
                <p className="text-xs text-[#6B7280] mt-1">توصيل الطلبات باحترافية وسرعة داخل نطاق الخدمة.</p>
              </div>
              <a
                href="https://wa.me/201017799580?text=%D9%85%D8%B1%D8%AD%D8%A8%D9%8B%D8%A7%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D9%86%D8%B6%D9%85%D8%A7%D9%85%20%D9%84%D9%81%D8%B1%D9%8A%D9%82%20%D9%83%D8%A8%D8%A7%D8%AA%D9%86%20%D8%A7%D9%84%D8%AA%D9%88%D8%B5%D9%8A%D9%84%20%D9%81%D9%8A%20%D8%B3%D9%86%D8%AC%D9%88%D8%A8"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-between text-xs font-bold text-[#FF5900] hover:underline"
              >
                <span>تقديم عبر واتساب</span>
                <ArrowLeft size={14} />
              </a>
            </div>

            <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#059669] flex items-center justify-center mb-2.5">
                  <ChefHat size={18} />
                </div>
                <h3 className="text-sm font-bold text-[#111827]">فريق المطبخ والتجهيز</h3>
                <p className="text-xs text-[#6B7280] mt-1">تنسيق وتجهيز طلبات المطاعم والشركاء المعتمدين.</p>
              </div>
              <a
                href="https://wa.me/201017799580?text=%D9%85%D8%B1%D8%AD%D8%A8%D9%8B%D8%A7%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D9%86%D8%B6%D9%85%D8%A7%D9%85%20%D9%84%D9%81%D8%B1%D9%8A%D9%82%20%D8%A7%D9%84%D8%AA%D8%AC%D9%87%D9%8A%D8%B2%20%D9%81%D9%8A%20%D8%B3%D9%86%D8%AC%D9%88%D8%A8"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-between text-xs font-bold text-[#059669] hover:underline"
              >
                <span>تقديم عبر واتساب</span>
                <ArrowLeft size={14} />
              </a>
            </div>

            <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mb-2.5">
                  <Headset size={18} />
                </div>
                <h3 className="text-sm font-bold text-[#111827]">فريق التشغيل والدعم</h3>
                <p className="text-xs text-[#6B7280] mt-1">متابعة العمليات الميدانية وخدمة العملاء والشركاء.</p>
              </div>
              <a
                href="https://wa.me/201017799580?text=%D9%85%D8%B1%D8%AD%D8%A8%D9%8B%D8%A7%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D9%86%D8%B6%D9%85%D8%A7%D9%85%20%D9%84%D9%81%D8%B1%D9%8A%D9%82%20%D8%A7%D9%84%D8%AA%D8%B4%D8%BA%D9%8A%D9%84%20%D9%81%D9%8A%20%D8%B3%D9%86%D8%AC%D9%88%D8%A8"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-between text-xs font-bold text-[#2563EB] hover:underline"
              >
                <span>تقديم عبر واتساب</span>
                <ArrowLeft size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
