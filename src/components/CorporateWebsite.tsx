import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Building2,
  Handshake,
  Briefcase,
  ShieldCheck,
  FileText,
  MessageCircle,
  Mail,
  Phone,
  CheckCircle2,
  ArrowLeft,
  Clock,
  MapPin,
  Store as StoreIcon,
  Bike,
  Send,
  Award,
  LayoutDashboard,
} from 'lucide-react';
import type {
  JobApplication,
  PartnerApplication,
  Product,
  Store,
} from '../types/index.ts';
import { formatEGP } from '../utils/orderCalculations.ts';

export type WebsitePage = 'home' | 'partners' | 'careers' | 'terms' | 'privacy';

interface CorporateWebsiteProps {
  stores: Store[];
  products: Product[];
  partnerApplicationsCount: number;
  jobApplicationsCount: number;
  initialPage?: WebsitePage;
  onOpenMobileApp: () => void;
  onOpenAdminCommittees: (tab: 'partners' | 'jobs') => void;
  onSubmitPartnerApplication: (
    app: Omit<PartnerApplication, 'id' | 'status' | 'createdAt'>
  ) => void;
  onSubmitJobApplication: (
    app: Omit<JobApplication, 'id' | 'status' | 'createdAt'>
  ) => void;
}

const AVAILABLE_JOBS = [
  {
    id: 'job-role-1',
    title: 'كابتن توصيل بالحي الحكومي (دراجة كهربائية / سكوتر)',
    department: 'العمليات اللوجستية والتوصيل الميداني',
    type: 'دوام كامل / شفتات صباحية',
    location: 'الحي الحكومي - العاصمة الإدارية الجديدة',
    salary: 'راتب ثابت + عمولة توصيل للأدوار + إكراميات فورية',
    description:
      'استلام الوجبات من مجمع الفود كورت (C2/C3) وتوصيلها لمكاتب الموظفين داخل الـ 34 وزارة وهيئة حكومية باستخدام الدراجات الكهربائية السريعة.',
  },
  {
    id: 'job-role-2',
    title: 'مشرف تشغيل ميداني وتنسيق الوزارات',
    department: 'إدارة العمليات الميدانية',
    type: 'دوام كامل (8:00 ص - 4:30 م)',
    location: 'مجمع الوزارات - العاصمة الإدارية الجديدة',
    salary: 'راتب تنافسي + حوافز أداء شهرية',
    description:
      'الإشراف على حركة المناديب وضمان دقة مواعيد الطلبات المجدولة قبل استراحة الغداء والتنسيق مع مكاتب الأمن والاستعلامات بالوزارات.',
  },
  {
    id: 'job-role-3',
    title: 'مسؤول تعاقدات وعلاقات شركاء الفود كورت والسوبر ماركت',
    department: 'تطوير الأعمال والشراكات - شركة ميسك للتكنولوجيا',
    type: 'دوام كامل',
    location: 'العاصمة الإدارية الجديدة / القاهرة الجديدة',
    salary: 'راتب أساسي + عمولات تعاقد مجزية',
    description:
      'ضم المطاعم والكافيهات والسوبر ماركت الجديدة لمنصة طلبات العاصمة وتحديث قوائم الطعام والعروض اليومية لموظفي الوزارات.',
  },
  {
    id: 'job-role-4',
    title: 'أخصائي خدمة عملاء ودعم موظفي الوزارات',
    department: 'مركز رعاية العملاء',
    type: 'دوام كامل / هجين',
    location: 'العاصمة الإدارية الجديدة',
    salary: 'راتب مجزٍ + تأمينات شاملة',
    description:
      'متابعة الطلبات الحية والرد على استفسارات الموظفين والمطاعم عبر الواتساب والمنصة وضمان رضا العملاء بنسبة 100%.',
  },
  {
    id: 'job-role-5',
    title: 'مهندس تطوير تطبيقات ونظم سحابية (Full-Stack / Mobile)',
    department: 'الفريق الهندسي - شركة ميسك للتكنولوجيا',
    type: 'دوام كامل / عن بُعد جزئياً',
    location: 'مقر شركة ميسك للتكنولوجيا',
    salary: 'حسب الخبرة والكفاءة التقنية',
    description:
      'تطوير وتحديث منظومة تطبيقات الويب والموبايل (React, Android Capacitor, Firebase) وبوابات الدفع الرقمي.',
  },
];

export const CorporateWebsite: React.FC<CorporateWebsiteProps> = ({
  stores,
  products,
  partnerApplicationsCount,
  jobApplicationsCount,
  initialPage = 'home',
  onOpenMobileApp,
  onOpenAdminCommittees,
  onSubmitPartnerApplication,
  onSubmitJobApplication,
}) => {
  const [activePage, setActivePage] = useState<WebsitePage>(initialPage);

  useEffect(() => {
    setActivePage(initialPage);
  }, [initialPage]);

  // Partner Form State
  const [businessName, setBusinessName] = useState('');
  const [partnerType, setPartnerType] = useState<PartnerApplication['partnerType']>('مطعم فود كورت');
  const [contactName, setContactName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [locationInCapital, setLocationInCapital] = useState('فود كورت الحي الحكومي - مبنى C2');
  const [branchesCount, setBranchesCount] = useState('فرع واحد بالعاصمة الإدارية');
  const [partnerNotes, setPartnerNotes] = useState('');
  const [partnerFormError, setPartnerFormError] = useState<string | null>(null);
  const [partnerSubmittedSuccess, setPartnerSubmittedSuccess] = useState(false);

  // Job Application Form State
  const [selectedJobTitle, setSelectedJobTitle] = useState(AVAILABLE_JOBS[0].title);
  const [selectedJobDept, setSelectedJobDept] = useState(AVAILABLE_JOBS[0].department);
  const [applicantName, setApplicantName] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [experienceYears, setExperienceYears] = useState('سنتان خبرة');
  const [residenceArea, setResidenceArea] = useState('');
  const [applicantSummary, setApplicantSummary] = useState('');
  const [jobFormError, setJobFormError] = useState<string | null>(null);
  const [jobSubmittedSuccess, setJobSubmittedSuccess] = useState(false);

  const handlePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerFormError(null);

    if (!businessName.trim() || !contactName.trim() || !partnerPhone.trim()) {
      setPartnerFormError('يرجى إدخال اسم النشاط التجاري واسم المسؤول ورقم الهاتف للتواصل.');
      return;
    }

    onSubmitPartnerApplication({
      businessName: businessName.trim(),
      partnerType,
      contactName: contactName.trim(),
      phone: partnerPhone.trim(),
      email: partnerEmail.trim() || 'info@el7lm.com',
      locationInCapital: locationInCapital.trim(),
      branchesCount: branchesCount.trim(),
      notes: partnerNotes.trim(),
    });

    setPartnerSubmittedSuccess(true);
    setBusinessName('');
    setContactName('');
    setPartnerPhone('');
    setPartnerEmail('');
    setPartnerNotes('');
  };

  const handleJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJobFormError(null);

    if (!applicantName.trim() || !applicantPhone.trim() || !residenceArea.trim()) {
      setJobFormError('يرجى استكمال الاسم الثلاثي ورقم الهاتف ومنطقة السكن.');
      return;
    }

    onSubmitJobApplication({
      jobTitle: selectedJobTitle,
      department: selectedJobDept,
      applicantName: applicantName.trim(),
      phone: applicantPhone.trim(),
      email: applicantEmail.trim() || 'info@el7lm.com',
      experienceYears: experienceYears.trim(),
      residenceArea: residenceArea.trim(),
      summary:
        applicantSummary.trim() ||
        'متقدم للعمل ضمن فريق طلبات الحي الحكومي بالعاصمة الإدارية الجديدة.',
    });

    setJobSubmittedSuccess(true);
    setApplicantName('');
    setApplicantPhone('');
    setApplicantEmail('');
    setResidenceArea('');
    setApplicantSummary('');
  };

  const navigateToSection = (page: WebsitePage) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans" dir="rtl">
      {/* Sticky Corporate Top Header (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigateToSection('home')}
            className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            طلبات الحي الحكومي بالعاصمة
          </button>

          {/* Zone 2: 5 Clean Single-Line Text Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {[
              { id: 'home', label: 'الرئيسية' },
              { id: 'partners', label: 'انضم إلينا كشريك' },
              { id: 'careers', label: 'الوظائف والتقديم' },
              { id: 'terms', label: 'الشروط والأحكام' },
              { id: 'privacy', label: 'سياسة الخصوصية' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToSection(item.id as WebsitePage)}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 cursor-pointer ${
                  activePage === item.id
                    ? 'text-slate-900 font-bold border-orange-600'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigateToSection('partners')}
              className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              انضم إلينا كشريك
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="md:hidden px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'home', label: 'الرئيسية' },
            { id: 'partners', label: 'انضم إلينا كشريك' },
            { id: 'careers', label: 'الوظائف والتقديم' },
            { id: 'terms', label: 'الشروط والأحكام' },
            { id: 'privacy', label: 'سياسة الخصوصية' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateToSection(item.id as WebsitePage)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                activePage === item.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* PAGE 1: HOME LANDING PAGE */}
      {activePage === 'home' && (
        <main className="flex-1">
          {/* 1. Hero Section with Real App Photography & Glowing Logo */}
          <section className="relative bg-slate-950 text-white overflow-hidden py-12 sm:py-16 border-b border-slate-800">
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <img
                src="/assets/aistudio/edc631a6afd2f28eebdbc9a18670f58d_73d67fc0.jpg"
                alt="الحي الحكومي بالعاصمة الإدارية الجديدة"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-slate-950 via-slate-950/90 to-slate-900/75" />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                {/* Right Column: Value Proposition */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-6 text-right">
                  <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                      <span>المنصة الرقمية الرسمية لموظفي الـ 34 وزارة</span>
                      <span aria-hidden="true">·</span>
                      <span>تنفيذ شركة ميسك للتكنولوجيا (Mesk Technology)</span>
                    </div>

                    <h1
                      className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight text-white max-w-2xl"
                      style={{ textWrap: 'balance' }}
                    >
                      وجبات الفود كورت والسوبر ماركت تصل ساخنة إلى{' '}
                      <span className="text-orange-400">مكتبك بالدور والغرفة</span>
                    </h1>

                    <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                      وداعاً للانتظار في طوابير استراحة الغداء. اطلب الآن أو جدول موعد توصيل وجبتك قبل استراحة الغداء بـ 30 دقيقة من أشهر مطاعم وكافيهات الحي الحكومي بالعاصمة الإدارية، وادفع بسهولة عبر إنستا باي أو بطاقات Visa وميزة أو نقداً لمندوب الدور.
                    </p>
                  </div>

                  {/* Action Toolbar */}
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigateToSection('partners')}
                        className="px-6 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm shadow-lg flex items-center gap-2.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Handshake className="w-5 h-5" />
                        <span>انضم إلينا كشريك (للمطاعم والمتاجر)</span>
                      </button>

                      <button
                        type="button"
                        onClick={onOpenMobileApp}
                        className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg flex items-center gap-2.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Smartphone className="w-5 h-5" />
                        <span>فتح محاكي تطبيق الموبايل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigateToSection('careers')}
                        className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Briefcase className="w-4 h-4 text-amber-400" />
                        <span>صفحة الوظائف والتقديم</span>
                      </button>
                    </div>

                    {/* Direct Contact Strip: WhatsApp +01017799580 & Email info@el7lm.com */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-2">
                      <a
                        href="https://wa.me/201017799580"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 font-bold transition-colors whitespace-nowrap shrink-0"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        <span>واتساب مباشر:</span>
                        <span dir="ltr" className="font-mono tabular-nums text-white">
                          +01017799580
                        </span>
                      </a>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <a
                        href="mailto:info@el7lm.com"
                        className="inline-flex items-center gap-2 text-slate-200 hover:text-white font-bold transition-colors whitespace-nowrap shrink-0"
                      >
                        <Mail className="w-4 h-4 text-orange-400" />
                        <span>الإيميل الرسمي:</span>
                        <span className="font-mono text-white">info@el7lm.com</span>
                      </a>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenAdminCommittees('partners')}
                        className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>لوحة الإدارة ({partnerApplicationsCount} شريك · {jobApplicationsCount} وظيفة)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Left Column: Real App Screenshots & Glowing Logo Showcase */}
                <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shrink-0">
                        <img
                          src="/assets/aistudio/image_a90f8b7b.png"
                          alt="شعار طلبات العاصمة المتوهج"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h2 className="text-xs sm:text-sm font-bold text-white">
                          صور حقيقية من تطبيق الموبايل الرسمي
                        </h2>
                        <p className="text-[11px] text-slate-400">
                          تصميم وتنفيذ شركة ميسك للتكنولوجيا · Android &amp; iOS
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenMobileApp}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-600/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      تجربة التطبيق
                    </button>
                  </div>

                  {/* 4 Official Screens Grid from Real Assets */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      {
                        src: '/assets/aistudio/1__1__017f51f7.png',
                        caption: 'توصيل لمكاتب الـ 34 وزارة',
                      },
                      {
                        src: '/assets/aistudio/1__2__0c86e0f9.png',
                        caption: 'الفود كورت والسوبر ماركت',
                      },
                      {
                        src: '/assets/aistudio/1__3__cdd090d3.png',
                        caption: 'قسائم خصم ودفع إنستا باي',
                      },
                      {
                        src: '/assets/aistudio/1__4__b6830189.png',
                        caption: 'تتبع المندوب حتى باب مكتبك',
                      },
                    ].map((shot) => (
                      <div
                        key={shot.src}
                        onClick={onOpenMobileApp}
                        className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[4/5] cursor-pointer"
                      >
                        <img
                          src={shot.src}
                          alt={shot.caption}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2.5">
                          <span className="text-[11px] font-bold text-white block">
                            {shot.caption}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full-Width 4-Column Quantified KPI Strip Below Hero Split */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-800/90">
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white block tabular-nums">
                    34 وزارة
                  </span>
                  <span className="text-xs text-slate-400 mt-1 block">
                    تغطية كاملة لمباني الوزارات والهيئات الحكومية
                  </span>
                </div>
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
                  <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 block tabular-nums">
                    15–20 دقيقة
                  </span>
                  <span className="text-xs text-slate-400 mt-1 block">
                    متوسط زمن توصيل الطلبات للدور ورقم المكتب
                  </span>
                </div>
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
                  <span className="text-2xl sm:text-3xl font-extrabold text-orange-400 block tabular-nums">
                    30 دقيقة
                  </span>
                  <span className="text-xs text-slate-400 mt-1 block">
                    جدولة مسبقة للوجبات قبل موعد استراحة الغداء
                  </span>
                </div>
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
                  <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 block tabular-nums">
                    100% آمن
                  </span>
                  <span className="text-xs text-slate-400 mt-1 block">
                    دفع عبر InstaPay وبطاقات Geidea وكاش عند الاستلام
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Asymmetric Bento-Grid Capabilities */}
          <section className="py-14 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-700">
                  خدمات المنصة والتشغيل الميداني
                </span>
                <h2
                  className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1"
                  style={{ textWrap: 'balance' }}
                >
                  منظومة ذكية متكاملة لموظفي ومطاعم العاصمة الإدارية
                </h2>
              </div>
              <button
                type="button"
                onClick={onOpenMobileApp}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>تصفح المنيو الكامل الآن</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Feature 01 (Span 2) */}
              <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-1 space-y-3">
                  <span className="text-xs font-bold text-orange-600">
                    01. جدولة الطلبات قبل استراحة الغداء
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    احجز وجبتك صباحاً لتصل ساخنة قبل موعد الراحة بـ 30 دقيقة
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    تتيح ميزة جدولة الطلب للموظفين اختيار توقيت وصول المندوب بدقة (مثل 12:00 ظهراً قبل استراحة الغداء أو 10:30 صباحاً للفطور والقهوة)، حيث يبدأ مطبخ المطعم في التجهيز المسبق لضمان وصول الطلب ساخناً في الموعد المحدد.
                  </p>
                </div>
                <div className="w-full sm:w-56 h-44 rounded-2xl overflow-hidden border border-slate-200 shrink-0 bg-slate-900">
                  <img
                    src="/assets/aistudio/1__2__0c86e0f9.png"
                    alt="وجبات الفود كورت والسوبر ماركت"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Feature 02 (Span 1) */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-emerald-400">
                    02. توصيل للدور والمكتب
                  </span>
                  <h3 className="text-lg font-extrabold">
                    تغطية شاملة للـ 34 وزارة وهيئة حكومية
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    مناديب معتمدون بتصاريح دخول لمباني الوزارات يصعدون مباشرة إلى الدور ورقم المكتب المحدد في طلبك دون الحاجة لنزولك خارج المبنى.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-emerald-300 font-bold">
                  <span>أسطول دراجات كهربائية</span>
                  <Bike className="w-5 h-5" />
                </div>
              </div>

              {/* Feature 03 (Span 1) */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-slate-700">
                    03. بوابات دفع رقمية معتمدة
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    إنستا باي (InstaPay) وبطاقات بنكية وكاش
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ادفع بالتحويل اللحظي عبر تطبيق إنستا باي، أو بطاقات Visa وميزة عبر بوابة Geidea، أو نقداً لمندوب الدور عند الاستلام.
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <img
                    src="/assets/aistudio/GKV136_InstaPay-logobase.net_c6183093.png"
                    alt="InstaPay"
                    referrerPolicy="no-referrer"
                    className="h-7 object-contain"
                  />
                  <img
                    src="/assets/aistudio/visa--logo_fb3e8f25.png"
                    alt="Visa"
                    referrerPolicy="no-referrer"
                    className="h-6 object-contain"
                  />
                </div>
              </div>

              {/* Feature 04 (Span 2) */}
              <div className="md:col-span-2 bg-emerald-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 border border-emerald-900">
                <div className="space-y-3 max-w-xl">
                  <span className="text-xs font-bold text-amber-300">
                    04. التطوير والتشغيل التقني: شركة ميسك للتكنولوجيا
                  </span>
                  <h3 className="text-xl font-extrabold">
                    تنفيذ برمجي متكامل بأعلى معايير الجودة والأمان السحابي
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
                    تم تصميم وتنفيذ المنصة وتطبيقات الموبايل (Android &amp; iOS PWA) ولوحات تحكم المطاعم والمناديب والإدارة بواسطة <strong>شركة ميسك للتكنولوجيا (Mesk Technology)</strong> مع ربط مباشر بخدمة عملاء واتساب والبريد الرسمي.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <a
                      href="https://wa.me/201017799580"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-white text-emerald-950 font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span>واتساب:</span>
                      <span dir="ltr" className="font-mono tabular-nums">
                        +01017799580
                      </span>
                    </a>
                    <a
                      href="mailto:info@el7lm.com"
                      className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white border border-emerald-700 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Mail className="w-4 h-4 text-amber-300" />
                      <span className="font-mono">info@el7lm.com</span>
                    </a>
                  </div>
                </div>
                <div className="w-full sm:w-48 bg-white/10 rounded-2xl p-4 border border-white/15 text-center space-y-2 shrink-0">
                  <Award className="w-10 h-10 text-amber-300 mx-auto" />
                  <div className="text-sm font-black">شركة ميسك للتكنولوجيا</div>
                  <p className="text-[11px] text-emerald-200">
                    Mesk Technology · حلول برمجية وتطبيقات ذكية
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Real Food Court Stores & Products Showcase (Adjacent Proof Section) */}
          <section className="py-14 bg-white border-y border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-orange-600">
                    شركاء النجاح في الحي الحكومي
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                    مطاعم ومتاجر الفود كورت المعتمدة داخل التطبيق
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToSection('partners')}
                  className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-2 self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Handshake className="w-4 h-4" />
                  <span>سجل مطعمك أو متجرك كشريك الآن</span>
                </button>
              </div>

              {/* Stores Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className="group bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="h-44 overflow-hidden relative bg-slate-200">
                        {store.bannerUrl ? (
                          <img
                            src={store.bannerUrl}
                            alt={store.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">
                            {store.logo}
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-3 flex items-center justify-between text-white text-xs">
                          <span className="font-bold">
                            {store.logo} {store.type}
                          </span>
                          <span className="font-mono tabular-nums">
                            ★ {store.rating} · {store.deliveryTime}
                          </span>
                        </div>
                      </div>
                      <div className="p-5 space-y-1.5">
                        <h3 className="text-base font-extrabold text-slate-900">{store.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{store.locationInDistrict}</span>
                        </p>
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-slate-200/70 text-xs">
                      <span className="text-slate-500">
                        رسوم التوصيل للأدوار:{' '}
                        <strong className="tabular-nums text-slate-800">
                          {formatEGP(store.deliveryFee)}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={onOpenMobileApp}
                        className="font-bold text-emerald-700 hover:text-emerald-900 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        اطلب من المنيو ←
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 4. Conversion Section: Partner Registration & Careers */}
          <section className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Partner Card */}
              <div className="bg-slate-900 text-white rounded-3xl p-7 sm:p-8 flex flex-col justify-between space-y-5 border border-slate-800">
                <div className="space-y-3">
                  <span className="text-xs font-bold text-orange-400 block">
                    بوابة الشركاء التجاريين · ربط فوري مع لوحة الإدارة
                  </span>
                  <h3 className="text-2xl font-extrabold">
                    هل تمتلك مطعماً أو كافيه أو سوبر ماركت بالعاصمة الإدارية؟
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    انضم الآن كشريك معتمد في منصة طلبات الحي الحكومي ووصل مبيعاتك يومياً لآلاف الموظفين في 34 وزارة وهيئة حكومية. يتم إرسال طلبك مباشرة إلى لوحة تحكم الإدارة للمراجعة والتعاقد الفوري.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigateToSection('partners')}
                    className="px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    انضم إلينا كشريك الآن ←
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAdminCommittees('partners')}
                    className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    عرض طلبات الشركاء في لوحة الإدارة ({partnerApplicationsCount})
                  </button>
                </div>
              </div>

              {/* Careers Card */}
              <div className="bg-white text-slate-900 rounded-3xl p-7 sm:p-8 flex flex-col justify-between space-y-5 border border-slate-200">
                <div className="space-y-3">
                  <span className="text-xs font-bold text-emerald-700 block">
                    بوابة الوظائف والتشغيل · شركة ميسك للتكنولوجيا
                  </span>
                  <h3 className="text-2xl font-extrabold">
                    فرص عمل وتوظيف مباشر بالعاصمة الإدارية الجديدة
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    نعلن عن فتح باب التقديم لوظائف كباتن التوصيل الميداني، مشرفي التشغيل، مسؤولي التعاقدات، وخدمة العملاء. قدم بياناتك الآن لتصل مباشرة إلى صفحة التوظيف في لوحة تحكم الإدارة.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigateToSection('careers')}
                    className="px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    استعراض الوظائف والتقديم الفوري ←
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAdminCommittees('jobs')}
                    className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    عرض المتقدمين في لوحة الإدارة ({jobApplicationsCount})
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* PAGE 2: PARTNER REGISTRATION ('انضم إلينا كشريك') */}
      {activePage === 'partners' && (
        <main className="flex-1 py-10 sm:py-14 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-8">
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-bold text-orange-400">
                بوابة الشركاء التجاريين · مربوطة مباشرة بلوحة تحكم الإدارة
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold">
                انضم إلينا كشريك في منصة طلبات الحي الحكومي
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                سجّل بيانات مطعمك أو الكافيه أو السوبر ماركت الخاص بك ليتم إدراجه في التطبيق الرسمي لموظفي الـ 34 وزارة بالعاصمة الإدارية الجديدة. بمجرد إرسال النموذج ينتقل طلبك مباشرة إلى صفحة طلبات الشركاء في لوحة الإدارة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAdminCommittees('partners')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 whitespace-nowrap shrink-0 cursor-pointer"
            >
              معاينة طلبات الشركاء في لوحة الإدارة ({partnerApplicationsCount})
            </button>
          </div>

          {partnerSubmittedSuccess && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-3xl p-6 space-y-3 text-emerald-950">
              <div className="flex items-center gap-2.5 text-base font-extrabold text-emerald-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <span>تم إرسال طلب الانضمام كشريك إلى لوحة تحكم الإدارة بنجاح!</span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-800">
                تم تسجيل بيانات نشاطك التجاري في قسم <strong>طلبات الشركاء</strong> بلوحة تحكم الإدارة، وسيتواصل معك فريق تطوير الأعمال بشركة ميسك للتكنولوجيا.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenAdminCommittees('partners')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  افتح لوحة الإدارة الآن لمعاينة طلبك المرسل ←
                </button>
                <a
                  href="https://wa.me/201017799580?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%D8%8C%20%D9%82%D9%85%D8%AA%20%D8%A8%D8%AA%D8%B3%D8%AC%D9%8A%D9%84%20%D8%B7%D9%84%D8%A8%20%D8%A7%D9%86%D8%B6%D9%85%D8%A7%D9%85%20%D9%83%D8%B4%D8%B1%D9%8A%D9%83%20%D9%81%D9%8A%20%D8%B7%D9%84%D8%A8%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AD%D9%8A%20%D8%A7%D9%84%D8%AD%D9%83%D9%88%D9%85%D9%8A"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>تأكيد سريع عبر واتساب الإدارة (+01017799580)</span>
                </a>
              </div>
            </div>
          )}

          <form
            onSubmit={handlePartnerSubmit}
            className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5"
          >
            <h2 className="text-lg font-extrabold text-slate-900 border-b border-slate-100 pb-3">
              نموذج تسجيل شريك جديد (مطعم / كافيه / سوبر ماركت)
            </h2>

            {partnerFormError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                {partnerFormError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  اسم المطعم أو النشاط التجاري *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="مثال: مطعم ومشويات العاصمة"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  تصنيف النشاط *
                </label>
                <select
                  value={partnerType}
                  onChange={(e) =>
                    setPartnerType(e.target.value as PartnerApplication['partnerType'])
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:bg-white focus:border-emerald-600 focus:outline-none"
                >
                  <option value="مطعم فود كورت">مطعم فود كورت</option>
                  <option value="كافيه ومشروبات">كافيه ومشروبات</option>
                  <option value="سوبر ماركت وتموين">سوبر ماركت وتموين</option>
                  <option value="مخبوزات وحلويات">مخبوزات وحلويات</option>
                  <option value="خدمات لوجستية">خدمات لوجستية وتوصيل</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  اسم المسؤول / المدير *
                </label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="الاسم الثلاثي للمسؤول"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  رقم الموبايل / الواتساب *
                </label>
                <input
                  type="tel"
                  required
                  value={partnerPhone}
                  onChange={(e) => setPartnerPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  البريد الإلكتروني الرسمي
                </label>
                <input
                  type="email"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  موقع الفرع بالعاصمة الإدارية *
                </label>
                <input
                  type="text"
                  required
                  value={locationInCapital}
                  onChange={(e) => setLocationInCapital(e.target.value)}
                  placeholder="مثال: فود كورت الحي الحكومي مبنى C2"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1.5">
                  عدد الفروع الحالية وأهم الأصناف المقدمة
                </label>
                <input
                  type="text"
                  value={branchesCount}
                  onChange={(e) => setBranchesCount(e.target.value)}
                  placeholder="مثال: فرعان بالعاصمة والقاهرة الجديدة - وجبات فطور وغداء وسندوتشات"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1.5">
                  ملاحظات إضافية لإدارة التعاقدات
                </label>
                <textarea
                  rows={3}
                  value={partnerNotes}
                  onChange={(e) => setPartnerNotes(e.target.value)}
                  placeholder="أي تفاصيل حول مواعيد العمل أو العروض الخاصة لموظفي الوزارات..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                يتم إرسال هذا النموذج مباشرة إلى لوحة تحكم إدارة الحي الحكومي للمراجعة الفورية.
              </span>
              <button
                type="submit"
                className="px-7 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>إرسال طلب الشراكة إلى لوحة الإدارة</span>
              </button>
            </div>
          </form>
        </main>
      )}

      {/* PAGE 3: CAREERS & JOB APPLICATION ('صفحة الوظائف والتقديم عليها') */}
      {activePage === 'careers' && (
        <main className="flex-1 py-10 sm:py-14 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-8">
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-bold text-emerald-400">
                بوابة التوظيف الرسمية · بإشراف شركة ميسك للتكنولوجيا
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold">
                الوظائف المتاحة والتقديم المباشر بالعاصمة الإدارية
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                اختر الوظيفة المناسبة لخبراتك واملأ نموذج التقديم ليصل ملفك مباشرة إلى صفحة التوظيف في لوحة تحكم الإدارة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAdminCommittees('jobs')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 whitespace-nowrap shrink-0 cursor-pointer"
            >
              معاينة طلبات التوظيف في لوحة الإدارة ({jobApplicationsCount})
            </button>
          </div>

          {jobSubmittedSuccess && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-3xl p-6 space-y-3 text-emerald-950">
              <div className="flex items-center gap-2.5 text-base font-extrabold text-emerald-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <span>تم إرسال طلب التوظيف الخاص بك إلى لوحة الإدارة بنجاح!</span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-800">
                وصلت بياناتك إلى قسم <strong>طلبات التوظيف</strong> في لوحة تحكم الإدارة، وسيقوم فريق الموارد البشرية بشركة ميسك للتكنولوجيا بالتواصل معك لتحديد موعد المقابلة.
              </p>
              <button
                type="button"
                onClick={() => onOpenAdminCommittees('jobs')}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                افتح لوحة الإدارة الآن لمعاينة طلب التوظيف ←
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Open Positions List */}
            <div className="lg:col-span-6 space-y-3.5">
              <h2 className="text-base font-extrabold text-slate-900">
                الوظائف الشاغرة حالياً ({AVAILABLE_JOBS.length} وظائف)
              </h2>

              {AVAILABLE_JOBS.map((job) => {
                const isSelected = selectedJobTitle === job.title;
                return (
                  <div
                    key={job.id}
                    onClick={() => {
                      setSelectedJobTitle(job.title);
                      setSelectedJobDept(job.department);
                    }}
                    className={`p-5 rounded-3xl border transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-600'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-bold text-emerald-700">{job.department}</span>
                      <span aria-hidden="true">·</span>
                      <span>{job.type}</span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900">{job.title}</h3>

                    <p className="text-xs text-slate-600 leading-relaxed">{job.description}</p>

                    <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700">{job.location}</span>
                      <span className="font-extrabold text-orange-600">
                        {isSelected ? '✓ محددة للتقديم الآن' : 'اضغط لاختيار الوظيفة'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Job Application Form */}
            <form
              onSubmit={handleJobSubmit}
              className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 space-y-4 sticky top-24"
            >
              <div>
                <span className="text-xs font-bold text-emerald-700">نموذج التقديم الفوري</span>
                <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
                  التقديم على وظيفة: {selectedJobTitle}
                </h2>
              </div>

              {jobFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                  {jobFormError}
                </div>
              )}

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    الوظيفة المختارة *
                  </label>
                  <select
                    value={selectedJobTitle}
                    onChange={(e) => {
                      const found = AVAILABLE_JOBS.find((j) => j.title === e.target.value);
                      setSelectedJobTitle(e.target.value);
                      if (found) setSelectedJobDept(found.department);
                    }}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold"
                  >
                    {AVAILABLE_JOBS.map((j) => (
                      <option key={j.id} value={j.title}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      الاسم الثلاثي للمتقدم *
                    </label>
                    <input
                      type="text"
                      required
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="الاسم الكامل"
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      رقم الموبايل / واتساب *
                    </label>
                    <input
                      type="tel"
                      required
                      value={applicantPhone}
                      onChange={(e) => setApplicantPhone(e.target.value)}
                      placeholder="010XXXXXXXX"
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      البريد الإلكتروني
                    </label>
                    <input
                      type="email"
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      سنوات الخبرة *
                    </label>
                    <input
                      type="text"
                      required
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      placeholder="مثال: 3 سنوات"
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    منطقة السكن الحالية *
                  </label>
                  <input
                    type="text"
                    required
                    value={residenceArea}
                    onChange={(e) => setResidenceArea(e.target.value)}
                    placeholder="مثال: مدينة بدر / الشروق / القاهرة الجديدة / العاشر"
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    نبذة عن خبراتك أو السيرة الذاتية المختصرة
                  </label>
                  <textarea
                    rows={3}
                    value={applicantSummary}
                    onChange={(e) => setApplicantSummary(e.target.value)}
                    placeholder="اكتب ملخصاً عن خبراتك السابقة، أو توفر وسيلة انتقال خاصة..."
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>إرسال طلب التوظيف إلى لوحة الإدارة مباشرة</span>
              </button>
            </form>
          </div>
        </main>
      )}

      {/* PAGE 4: TERMS & CONDITIONS ('صفحة الشروط والأحكام') */}
      {activePage === 'terms' && (
        <main className="flex-1 py-10 sm:py-14 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 space-y-6">
            <div className="border-b border-slate-200 pb-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <FileText className="w-4 h-4" />
                <span>الوثيقة القانونية الرسمية</span>
                <span aria-hidden="true">·</span>
                <span>تنفيذ شركة ميسك للتكنولوجيا</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                الشروط والأحكام لمنصة وتطبيق طلبات الحي الحكومي بالعاصمة الإدارية
              </h1>
              <p className="text-xs text-slate-500">
                آخر تحديث: أكتوبر 2026 · البريد الرسمي: info@el7lm.com · واتساب: +01017799580
              </p>
            </div>

            <div className="space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  01. تعريف المنصة ونطاق الخدمة
                </h2>
                <p>
                  منصة وتطبيق <strong>طلبات الحي الحكومي بالعاصمة الإدارية</strong> هي منصة إلكترونية وتطبيق هاتف محمول من تنفيذ وتطوير <strong>شركة ميسك للتكنولوجيا (Mesk Technology)</strong>، تهدف إلى ربط موظفي الـ 34 وزارة وهيئة حكومية بالحي الحكومي بالعاصمة الإدارية الجديدة بمطاعم الفود كورت والكافيهات والسوبر ماركت المعتمدة، وتوصيل الطلبات مباشرة إلى الدور ورقم المكتب المحدد.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  02. شروط حساب الموظف وتحديد موقع التوصيل
                </h2>
                <p>
                  يلتزم المستخدم (الموظف أو الزائر) بتسجيل بيانات صحيحة ودقيقة تشمل الاسم الثلاثي، رقم الهاتف الفعال، اسم الوزارة أو الهيئة، رقم الدور، ورقم المكتب أو الغرفة، وذلك لضمان وصول مندوب التوصيل الميداني في الوقت المحدد دون تأخير.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  03. الطلبات الفورية والطلبات المجدولة مسبقاً
                </h2>
                <p>
                  تتيح المنصة خيارين للتوصيل: <strong>التوصيل الفوري</strong> (خلال 15 إلى 20 دقيقة من تجهيز المطعم) أو <strong>جدولة الطلب لوقت محدد</strong> (مثل قبل موعد استراحة الغداء بـ 30 دقيقة). يمكن للموظف إلغاء الطلب مجاناً طالما كانت حالته تم الاستلام قبل بدء التحضير الفعلي في مطبخ المطعم.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  04. السياسة المالية وطرق الدفع المعتمدة
                </h2>
                <p>
                  تدعم المنصة ثلاث وسائل دفع رسمية: التحويل اللحظي عبر تطبيق <strong>إنستا باي (InstaPay)</strong>، الدفع الإلكتروني بالبطاقات البنكية (Visa / Meeza) عبر بوابة <strong>Geidea</strong> الآمنة، أو الدفع النقدي (كاش) لمندوب الدور عند الاستلام. جميع الأسعار المعروضة بالجنيه المصري شاملة ضريبة القيمة المضافة المقررة.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  05. التزامات المطاعم والشركاء التجاريين
                </h2>
                <p>
                  يلتزم الشركاء من المطاعم والكافيهات والسوبر ماركت المسجلين عبر بوابة انضم إلينا كشريك بمعايير سلامة وجودة الغذاء، وتغليف الوجبات حرارياً، والالتزام بالأسعار الرسمية المعتمدة في لوحة تحكم الإدارة.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  06. حقوق الملكية الفكرية والتواصل القانوني
                </h2>
                <p>
                  جميع حقوق التصميم، البرمجيات، قواعد البيانات، والشعارات الخاصة بالتطبيق والموقع محفوظة لصالح المنصة و<strong>شركة ميسك للتكنولوجيا</strong>. لأي استفسارات قانونية أو تعاقدية يرجى التواصل عبر البريد الرسمي <code>info@el7lm.com</code> أو عبر الواتساب الرسمي <span dir="ltr" className="font-mono">+01017799580</span>.
                </p>
              </section>
            </div>
          </div>
        </main>
      )}

      {/* PAGE 5: PRIVACY POLICY ('صفحة سياسة الخصوصية') */}
      {activePage === 'privacy' && (
        <main className="flex-1 py-10 sm:py-14 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 space-y-6">
            <div className="border-b border-slate-200 pb-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
                <span>متوافقة مع معايير Google Play و Firebase Security</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                سياسة الخصوصية وحماية البيانات (Privacy Policy)
              </h1>
              <p className="text-xs text-slate-500">
                معرف الحزمة الرسمي على Google Play: <span className="font-mono">eg.gov.capital.talabat</span> · تنفيذ شركة ميسك للتكنولوجيا
              </p>
            </div>

            <div className="space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  01. البيانات التي نقوم بجمعها
                </h2>
                <p>
                  لتقديم خدمة توصيل دقيقة داخل مباني الوزارات الـ 34 بالحي الحكومي، نجمع فقط البيانات الضرورية لإتمام الطلب وهي: الاسم، البريد الإلكتروني (عند تسجيل الدخول عبر Google Firebase Authentication)، رقم الهاتف للتواصل مع المندوب، ومقر العمل (الوزارة، الدور، ورقم المكتب).
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  02. كيفية استخدام البيانات وحمايتها
                </h2>
                <p>
                  تُحفظ بيانات المستخدمين والطلبات في قواعد بيانات <strong>Google Cloud Firestore</strong> المؤمنة بقواعد حماية صارمة بحيث لا يمكن لأي مستخدم الاطلاع إلا على ملفه وطلباته الخاصة. لا نقوم ببيع أو مشاركة بيانات الموظفين مع أي جهات إعلانية خارجية تحت أي ظرف.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  03. الأذونات المطلوبة في تطبيق الموبايل
                </h2>
                <ul className="list-disc pr-5 space-y-1">
                  <li>
                    <strong>الموقع الجغرافي (اختياري):</strong> لتحديد أقرب بوابة وزارة ومطابقة الموقع عبر خرائط جوجل.
                  </li>
                  <li>
                    <strong>الميكروفون (اختياري):</strong> عند استخدام ميزة البحث والطلب الصوتي الذكي فقط وبموافقة المستخدم.
                  </li>
                  <li>
                    <strong>الإشعارات:</strong> لتنبيه الموظف بوصول المندوب إلى الدور والمكتب.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  04. حق المستخدم في تعديل أو حذف بياناته
                </h2>
                <p>
                  يحق لكل مستخدم تعديل بياناته ومقر وزارته في أي وقت من خلال صفحة حسابي بالتطبيق، كما يمكنه طلب حذف حسابه وجميع بياناته المسجلة نهائياً عبر مراسلة مسؤول حماية البيانات في <strong>شركة ميسك للتكنولوجيا</strong> على البريد الرسمي: <code>info@el7lm.com</code> أو عبر واتساب: <span dir="ltr" className="font-mono">+01017799580</span>.
                </p>
              </section>
            </div>
          </div>
        </main>
      )}

      {/* Quiet Corporate Footer with Mesk Technology, WhatsApp +01017799580, and Email info@el7lm.com */}
      <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 pt-12 pb-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Column 1: Brand & Mesk Technology */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/Capital_Talabat_App_Icon_7e80c871.png"
                  alt="شعار طلبات العاصمة"
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-2xl bg-white p-1 object-contain"
                />
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    طلبات الحي الحكومي بالعاصمة الإدارية
                  </h3>
                  <p className="text-xs text-emerald-400 font-bold">
                    من تنفيذ وتطوير: شركة ميسك للتكنولوجيا (Mesk Technology)
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md">
                المنصة الرسمية المتكاملة لتوصيل وجبات الفود كورت والسوبر ماركت والكافيهات لموظفي الـ 34 وزارة وهيئة حكومية بالحي الحكومي في العاصمة الإدارية الجديدة.
              </p>
            </div>

            {/* Column 2: Quick Website Links */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-extrabold text-white text-sm">أقسام الموقع الرسمي</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToSection('home')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    الرئيسية واللاندنج بيدج
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToSection('partners')}
                    className="hover:text-orange-400 text-orange-300 font-bold transition-colors cursor-pointer"
                  >
                    انضم إلينا كشريك (للمطاعم والمتاجر)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToSection('careers')}
                    className="hover:text-emerald-400 text-emerald-300 font-bold transition-colors cursor-pointer"
                  >
                    صفحة الوظائف والتقديم عليها
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToSection('terms')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    الشروط والأحكام
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateToSection('privacy')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    سياسة الخصوصية
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Official Contact (WhatsApp & Email) */}
            <div className="space-y-3 text-xs">
              <h4 className="font-extrabold text-white text-sm">تواصل مباشر مع الإدارة</h4>
              <div className="space-y-2">
                <a
                  href="https://wa.me/201017799580"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-900/40 hover:bg-emerald-900/70 border border-emerald-700/50 text-emerald-200 font-bold transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>واتساب:</span>
                  <span dir="ltr" className="font-mono tabular-nums text-white">
                    +01017799580
                  </span>
                </a>

                <a
                  href="mailto:info@el7lm.com"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition-colors"
                >
                  <Mail className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>الإيميل الرسمي:</span>
                  <span className="font-mono text-white">info@el7lm.com</span>
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>
              © {new Date().getFullYear()} طلبات الحي الحكومي بالعاصمة الإدارية الجديدة — من تنفيذ{' '}
              <strong className="text-white">شركة ميسك للتكنولوجيا</strong>.
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigateToSection('terms')}
                className="hover:text-white cursor-pointer"
              >
                الشروط والأحكام
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => navigateToSection('privacy')}
                className="hover:text-white cursor-pointer"
              >
                سياسة الخصوصية
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Direct Button (+01017799580) */}
      <a
        href="https://wa.me/201017799580"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 left-5 z-50 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-xl flex items-center gap-2 border border-emerald-400/40 transition-transform hover:scale-105 whitespace-nowrap shrink-0"
        title="تواصل عبر واتساب +01017799580"
      >
        <MessageCircle className="w-4 h-4 fill-white" />
        <span>واتساب الإدارة</span>
        <span dir="ltr" className="font-mono tabular-nums">
          +01017799580
        </span>
      </a>
    </div>
  );
};
