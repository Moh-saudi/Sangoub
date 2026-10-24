import { customerMessage } from "../utils/customerMessage";
import { HeroShowcase } from './HeroShowcase.tsx';
import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
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
} from "lucide-react";
import type {
  JobApplication,
  PartnerApplication,
  Product,
  Store,
} from "../types/index.ts";
import { formatEGP } from "../utils/orderCalculations.ts";

export type WebsitePage = "home" | "partners" | "careers" | "terms" | "privacy";

interface CorporateWebsiteProps {
  stores: Store[];
  products: Product[];
  partnerApplicationsCount: number;
  jobApplicationsCount: number;
  initialPage?: WebsitePage;
  onOpenMobileApp: () => void;
  onOpenAdminCommittees: (tab: "partners" | "jobs") => void;
  onSubmitPartnerApplication: (
    app: Omit<PartnerApplication, "id" | "status" | "createdAt">,
  ) => Promise<void>;
  onSubmitJobApplication: (
    app: Omit<JobApplication, "id" | "status" | "createdAt">,
  ) => Promise<void>;
}

const AVAILABLE_JOBS = [
  {
    id: "job-role-1",
    title: "كابتن توصيل بالحي الحكومي (دراجة كهربائية / سكوتر)",
    department: "العمليات اللوجستية والتوصيل الميداني",
    type: "دوام كامل / شفتات صباحية",
    location: "الحي الحكومي - العاصمة الإدارية الجديدة",
    salary: "راتب ثابت + عمولة توصيل للأدوار + إكراميات فورية",
    description:
      "استلام الوجبات من مجمع الفود كورت (C2/C3) وتوصيلها لمكاتب الموظفين داخل الـ 34 وزارة وهيئة حكومية باستخدام الدراجات الكهربائية السريعة.",
  },
  {
    id: "job-role-2",
    title: "مشرف تشغيل ميداني وتنسيق الوزارات",
    department: "إدارة العمليات الميدانية",
    type: "دوام كامل (8:00 ص - 4:30 م)",
    location: "مجمع الوزارات - العاصمة الإدارية الجديدة",
    salary: "راتب تنافسي + حوافز أداء شهرية",
    description:
      "الإشراف على حركة المناديب وضمان دقة مواعيد الطلبات المجدولة قبل استراحة الغداء والتنسيق مع مكاتب الأمن والاستعلامات بالوزارات.",
  },
  {
    id: "job-role-3",
    title: "مسؤول تعاقدات وعلاقات شركاء الفود كورت والسوبر ماركت",
    department: "تطوير الأعمال والشراكات - شركة ميسك للتكنولوجيا",
    type: "دوام كامل",
    location: "العاصمة الإدارية الجديدة / القاهرة الجديدة",
    salary: "راتب أساسي + عمولات تعاقد مجزية",
    description:
      "ضم المطاعم والكافيهات والسوبر ماركت الجديدة لمنصة طلبات العاصمة وتحديث قوائم الطعام والعروض اليومية لموظفي الوزارات.",
  },
  {
    id: "job-role-4",
    title: "أخصائي خدمة عملاء ودعم موظفي الوزارات",
    department: "مركز رعاية العملاء",
    type: "دوام كامل / هجين",
    location: "العاصمة الإدارية الجديدة",
    salary: "راتب مجزٍ + تأمينات شاملة",
    description:
      "متابعة الطلبات الحية والرد على استفسارات الموظفين والمطاعم عبر الواتساب والمنصة وضمان رضا العملاء بنسبة 100%.",
  },
  {
    id: "job-role-5",
    title: "مهندس تطوير تطبيقات ونظم سحابية (Full-Stack / Mobile)",
    department: "الفريق الهندسي - شركة ميسك للتكنولوجيا",
    type: "دوام كامل / عن بُعد جزئياً",
    location: "مقر شركة ميسك للتكنولوجيا",
    salary: "حسب الخبرة والكفاءة التقنية",
    description:
      "تطوير تطبيقات الويب والموبايل وخدمات الدفع الرقمي.",
  },
];

export const CorporateWebsite: React.FC<CorporateWebsiteProps> = ({
  stores,
  products,
  partnerApplicationsCount,
  jobApplicationsCount,
  initialPage = "home",
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
  const [businessName, setBusinessName] = useState("");
  const [partnerType, setPartnerType] =
    useState<PartnerApplication["partnerType"]>("مطعم فود كورت");
  const [contactName, setContactName] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [locationInCapital, setLocationInCapital] = useState(
    "فود كورت الحي الحكومي - مبنى C2",
  );
  const [branchesCount, setBranchesCount] = useState(
    "فرع واحد بالعاصمة الإدارية",
  );
  const [partnerNotes, setPartnerNotes] = useState("");
  const [partnerFormError, setPartnerFormError] = useState<string | null>(null);
  const [partnerSubmittedSuccess, setPartnerSubmittedSuccess] = useState(false);

  // Job Application Form State
  const [selectedJobTitle, setSelectedJobTitle] = useState(
    AVAILABLE_JOBS[0].title,
  );
  const [selectedJobDept, setSelectedJobDept] = useState(
    AVAILABLE_JOBS[0].department,
  );
  const [applicantName, setApplicantName] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [experienceYears, setExperienceYears] = useState("سنتان خبرة");
  const [residenceArea, setResidenceArea] = useState("");
  const [applicantSummary, setApplicantSummary] = useState("");
  const [jobFormError, setJobFormError] = useState<string | null>(null);
  const [jobSubmittedSuccess, setJobSubmittedSuccess] = useState(false);

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerFormError(null);

    if (!businessName.trim() || !contactName.trim() || !partnerPhone.trim()) {
      setPartnerFormError(
        "يرجى إدخال اسم النشاط التجاري واسم المسؤول ورقم الهاتف للتواصل.",
      );
      return;
    }

    try {
      await onSubmitPartnerApplication({
        businessName: businessName.trim(),
        partnerType,
        contactName: contactName.trim(),
        phone: partnerPhone.trim(),
        email: partnerEmail.trim() || "info@el7lm.com",
        locationInCapital: locationInCapital.trim(),
        branchesCount: branchesCount.trim(),
        notes: partnerNotes.trim(),
      });
    } catch (error) {
      setPartnerFormError(
        customerMessage(error, "تعذر إرسال الطلب."),
      );
      return;
    }

    setPartnerSubmittedSuccess(true);
    setBusinessName("");
    setContactName("");
    setPartnerPhone("");
    setPartnerEmail("");
    setPartnerNotes("");
  };

  const handleJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJobFormError(null);

    if (
      !applicantName.trim() ||
      !applicantPhone.trim() ||
      !residenceArea.trim()
    ) {
      setJobFormError("يرجى استكمال الاسم الثلاثي ورقم الهاتف ومنطقة السكن.");
      return;
    }

    try {
      await onSubmitJobApplication({
        jobTitle: selectedJobTitle,
        department: selectedJobDept,
        applicantName: applicantName.trim(),
        phone: applicantPhone.trim(),
        email: applicantEmail.trim() || "info@el7lm.com",
        experienceYears: experienceYears.trim(),
        residenceArea: residenceArea.trim(),
        summary:
          applicantSummary.trim() ||
          "متقدم للعمل ضمن فريق طلبات الحي الحكومي بالعاصمة الإدارية الجديدة.",
      });
    } catch (error) {
      setJobFormError(
        customerMessage(error, "تعذر إرسال الطلب."),
      );
      return;
    }

    setJobSubmittedSuccess(true);
    setApplicantName("");
    setApplicantPhone("");
    setApplicantEmail("");
    setResidenceArea("");
    setApplicantSummary("");
  };

  const navigateToSection = (page: WebsitePage) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      className="capital-site min-h-screen text-slate-900 flex flex-col"
      dir="rtl"
    >
      <header className="site-header">
        <button
          className="site-brand"
          onClick={() => navigateToSection("home")}
          aria-label="طلبات العاصمة — الرئيسية"
        >
          <img
            className="official-logo"
            src="/brand/capital-talabat-mascot-logo-256x256.png"
            alt="شعار طلبات العاصمة الرسمي"
            width="80"
            height="80"
          />
          <span>
            <span className="brand-accent">طلبات</span> العاصمة
            <small lang="en" dir="ltr">
              Capital Talabat
            </small>
          </span>
        </button>
        <nav aria-label="القائمة الرئيسية" className="site-nav">
          <button
            onClick={() => navigateToSection("home")}
            aria-current={activePage === "home" ? "page" : undefined}
          >
            الرئيسية
          </button>
          <button onClick={() => navigateToSection("partners")}>
            للمطاعم والمتاجر
          </button>
          <button onClick={() => navigateToSection("careers")}>
            انضم للفريق
          </button>
        </nav>
        <button
          className="site-button site-button-dark"
          onClick={onOpenMobileApp}
        >
          اطلب الآن <ArrowLeft size={17} />
        </button>
      </header>

      {activePage === "home" && (
        <main className="landing-main">
          <HeroShowcase onOpenApp={onOpenMobileApp} onOpenPartners={() => navigateToSection('partners')} />
          <div className="service-strip">
            <span>
              <StoreIcon /> مطاعم وكافيهات
            </span>
            <span>
              <MapPin /> توصيل لحد المكتب
            </span>
            <span>
              <Clock /> طلب فوري أو مجدول
            </span>
            <span>
              <ShoppingBag /> احتياجات يومك
            </span>
          </div>
          <section className="food-section" id="discover">
            <div className="section-heading">
              <div>
                <span className="eyebrow">على مزاجك</span>
                <h2>لكل بريك، طلبه.</h2>
              </div>
              <button className="quiet-link" onClick={onOpenMobileApp}>
                استكشف المنيو <ArrowLeft size={18} />
              </button>
            </div>
            <div className="food-grid">
              {[
                {
                  image: "breakfast.jpg",
                  title: "فطار يظبط يومك",
                  text: "مخبوزات ولقمة خفيفة",
                  tag: "صباحك ألذ",
                  position: "center",
                },
                {
                  image: "coffee.jpg",
                  title: "قهوتك على مزاجك",
                  text: "بداية هادية أو بريك سريع",
                  tag: "وقت القهوة",
                  position: "center",
                },
                {
                  image: "government-district-gardens.jpg",
                  title: "من الفود كورت لمكتبك",
                  text: "لخدمة موظفي الحي الحكومي",
                  tag: "في قلب العاصمة",
                  position: "center",
                },
              ].map((item) => (
                <button
                  className="food-card"
                  key={item.title}
                  onClick={onOpenMobileApp}
                >
                  <div className="food-photo">
                    <img
                      src={"/images/" + item.image}
                      alt={item.title}
                      loading="lazy"
                      style={{ objectPosition: item.position }}
                    />
                    <span>{item.tag}</span>
                  </div>
                  <div className="food-card-copy">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                    <span className="card-arrow">
                      <ArrowLeft size={20} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section className="how-section" id="how-it-works">
            <div className="how-intro">
              <span className="eyebrow">ببساطة كده</span>
              <h2>
                ٣ خطوات. <br />
                والطلب عندك.
              </h2>
            </div>
            <div className="how-steps">
              {[
                { title: "اختار طلبك", text: "تصفّح المنيو وضيف اللي بتحبه." },
                { title: "حدّد مكتبك", text: "المبنى، الدور، ورقم المكتب." },
                { title: "كمّل يومك", text: "تابع طلبك لحد ما يوصلك." },
              ].map((step, index) => (
                <div className="how-step" key={step.title}>
                  <span className="step-number">0{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="partner-banner">
            <div>
              <span className="eyebrow">نكبر سوا</span>
              <h2>مطعمك أقرب لموظفي العاصمة.</h2>
              <p>اعرض المنيو، واستقبل طلبات جديدة.</p>
            </div>
            <button
              className="site-button site-button-dark"
              onClick={() => navigateToSection("partners")}
            >
              انضم كشريك <ArrowLeft size={18} />
            </button>
          </section>
        </main>
      )}

      {activePage === "partners" && (
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
                سجّل بيانات مطعمك أو الكافيه أو السوبر ماركت الخاص بك ليتم
                إدراجه في التطبيق الرسمي لموظفي الـ 34 وزارة بالعاصمة الإدارية
                الجديدة. بمجرد إرسال النموذج ينتقل طلبك مباشرة إلى صفحة طلبات
                الشركاء في لوحة الإدارة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAdminCommittees("partners")}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 whitespace-nowrap shrink-0 cursor-pointer"
            >
              معاينة طلبات الشركاء في لوحة الإدارة ({partnerApplicationsCount})
            </button>
          </div>

          {partnerSubmittedSuccess && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-3xl p-6 space-y-3 text-emerald-950">
              <div className="flex items-center gap-2.5 text-base font-extrabold text-emerald-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <span>
                  تم إرسال طلب الانضمام كشريك إلى لوحة تحكم الإدارة بنجاح!
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-800">
                تم تسجيل بيانات نشاطك التجاري في قسم{" "}
                <strong>طلبات الشركاء</strong> بلوحة تحكم الإدارة، وسيتواصل معك
                فريق تطوير الأعمال بشركة ميسك للتكنولوجيا.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenAdminCommittees("partners")}
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
                    setPartnerType(
                      e.target.value as PartnerApplication["partnerType"],
                    )
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
                يتم إرسال هذا النموذج مباشرة إلى لوحة تحكم إدارة الحي الحكومي
                للمراجعة الفورية.
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
      {activePage === "careers" && (
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
                اختر الوظيفة المناسبة لخبراتك واملأ نموذج التقديم ليصل ملفك
                مباشرة إلى صفحة التوظيف في لوحة تحكم الإدارة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAdminCommittees("jobs")}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 whitespace-nowrap shrink-0 cursor-pointer"
            >
              معاينة طلبات التوظيف في لوحة الإدارة ({jobApplicationsCount})
            </button>
          </div>

          {jobSubmittedSuccess && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-3xl p-6 space-y-3 text-emerald-950">
              <div className="flex items-center gap-2.5 text-base font-extrabold text-emerald-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <span>
                  تم إرسال طلب التوظيف الخاص بك إلى لوحة الإدارة بنجاح!
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-800">
                وصلت بياناتك إلى قسم <strong>طلبات التوظيف</strong> في لوحة تحكم
                الإدارة، وسيقوم فريق الموارد البشرية بشركة ميسك للتكنولوجيا
                بالتواصل معك لتحديد موعد المقابلة.
              </p>
              <button
                type="button"
                onClick={() => onOpenAdminCommittees("jobs")}
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
                        ? "bg-emerald-50/70 border-emerald-600"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-bold text-emerald-700">
                        {job.department}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{job.type}</span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900">
                      {job.title}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {job.description}
                    </p>

                    <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700">
                        {job.location}
                      </span>
                      <span className="font-extrabold text-orange-600">
                        {isSelected
                          ? "✓ محددة للتقديم الآن"
                          : "اضغط لاختيار الوظيفة"}
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
                <span className="text-xs font-bold text-emerald-700">
                  نموذج التقديم الفوري
                </span>
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
                      const found = AVAILABLE_JOBS.find(
                        (j) => j.title === e.target.value,
                      );
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
      {activePage === "terms" && (
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
                الشروط والأحكام لمنصة وتطبيق طلبات الحي الحكومي بالعاصمة
                الإدارية
              </h1>
              <p className="text-xs text-slate-500">
                آخر تحديث: أكتوبر 2026 · البريد الرسمي: info@el7lm.com · واتساب:
                +01017799580
              </p>
            </div>

            <div className="space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  01. تعريف المنصة ونطاق الخدمة
                </h2>
                <p>
                  منصة وتطبيق{" "}
                  <strong>طلبات الحي الحكومي بالعاصمة الإدارية</strong> هي منصة
                  إلكترونية وتطبيق هاتف محمول من تنفيذ وتطوير{" "}
                  <strong>شركة ميسك للتكنولوجيا (Mesk Technology)</strong>، تهدف
                  إلى ربط موظفي الـ 34 وزارة وهيئة حكومية بالحي الحكومي بالعاصمة
                  الإدارية الجديدة بمطاعم الفود كورت والكافيهات والسوبر ماركت
                  المعتمدة، وتوصيل الطلبات مباشرة إلى الدور ورقم المكتب المحدد.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  02. شروط حساب الموظف وتحديد موقع التوصيل
                </h2>
                <p>
                  يلتزم المستخدم (الموظف أو الزائر) بتسجيل بيانات صحيحة ودقيقة
                  تشمل الاسم الثلاثي، رقم الهاتف الفعال، اسم الوزارة أو الهيئة،
                  رقم الدور، ورقم المكتب أو الغرفة، وذلك لضمان وصول مندوب
                  التوصيل الميداني في الوقت المحدد دون تأخير.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  03. الطلبات الفورية والطلبات المجدولة مسبقاً
                </h2>
                <p>
                  تتيح المنصة خيارين للتوصيل: <strong>التوصيل الفوري</strong>{" "}
                  (خلال 15 إلى 20 دقيقة من تجهيز المطعم) أو{" "}
                  <strong>جدولة الطلب لوقت محدد</strong> (مثل قبل موعد استراحة
                  الغداء بـ 30 دقيقة). يمكن للموظف إلغاء الطلب مجاناً طالما كانت
                  حالته تم الاستلام قبل بدء التحضير الفعلي في مطبخ المطعم.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  04. السياسة المالية وطرق الدفع المعتمدة
                </h2>
                <p>
                  تدعم المنصة ثلاث وسائل دفع رسمية: التحويل اللحظي عبر تطبيق{" "}
                  <strong>إنستا باي (InstaPay)</strong>، الدفع الإلكتروني
                  بالبطاقات البنكية (Visa / Meeza) عبر بوابة{" "}
                  <strong>Geidea</strong> الآمنة، أو الدفع النقدي (كاش) لمندوب
                  الدور عند الاستلام. جميع الأسعار المعروضة بالجنيه المصري شاملة
                  ضريبة القيمة المضافة المقررة.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  05. التزامات المطاعم والشركاء التجاريين
                </h2>
                <p>
                  يلتزم الشركاء من المطاعم والكافيهات والسوبر ماركت المسجلين عبر
                  بوابة انضم إلينا كشريك بمعايير سلامة وجودة الغذاء، وتغليف
                  الوجبات حرارياً، والالتزام بالأسعار الرسمية المعتمدة في لوحة
                  تحكم الإدارة.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  06. حقوق الملكية الفكرية والتواصل القانوني
                </h2>
                <p>
                  جميع حقوق التصميم، البرمجيات، قواعد البيانات، والشعارات الخاصة
                  بالتطبيق والموقع محفوظة لصالح المنصة و
                  <strong>شركة ميسك للتكنولوجيا</strong>. لأي استفسارات قانونية
                  أو تعاقدية يرجى التواصل عبر البريد الرسمي{" "}
                  <code>info@el7lm.com</code> أو عبر الواتساب الرسمي{" "}
                  <span dir="ltr" className="font-mono">
                    +01017799580
                  </span>
                  .
                </p>
              </section>
            </div>
          </div>
        </main>
      )}

      {/* PAGE 5: PRIVACY POLICY ('صفحة سياسة الخصوصية') */}
      {activePage === "privacy" && (
        <main className="flex-1 py-10 sm:py-14 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 space-y-6">
            <div className="border-b border-slate-200 pb-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
                <span>حماية بياناتك وخصوصيتك</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                سياسة الخصوصية وحماية البيانات (Privacy Policy)
              </h1>
              <p className="text-xs text-slate-500">
                معرف الحزمة الرسمي على Google Play:{" "}
                <span className="font-mono">eg.gov.capital.talabat</span> ·
                تنفيذ شركة ميسك للتكنولوجيا
              </p>
            </div>

            <div className="space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  01. البيانات التي نقوم بجمعها
                </h2>
                <p>
                  لتقديم خدمة توصيل دقيقة داخل مباني الوزارات الـ 34 بالحي
                  الحكومي، نجمع فقط البيانات الضرورية لإتمام الطلب وهي: الاسم،
                  البريد الإلكتروني (عند تسجيل الدخول عبر Google)، رقم الهاتف للتواصل مع المندوب، ومقر العمل
                  (الوزارة، الدور، ورقم المكتب).
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  02. كيفية استخدام البيانات وحمايتها
                </h2>
                <p>
                  تُحفظ بيانات المستخدمين والطلبات في قواعد بيانات{" "}
                  محمية بصلاحيات وصول
                  محددة بحيث لا يمكن لأي مستخدم الاطلاع إلا على ملفه وطلباته
                  الخاصة. لا نقوم ببيع أو مشاركة بيانات الموظفين مع أي جهات
                  إعلانية خارجية تحت أي ظرف.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  03. الأذونات المطلوبة في تطبيق الموبايل
                </h2>
                <ul className="list-disc pr-5 space-y-1">
                  <li>
                    <strong>الموقع الجغرافي (اختياري):</strong> لتحديد أقرب
                    بوابة وزارة ومطابقة الموقع عبر خرائط جوجل.
                  </li>
                  <li>
                    <strong>الميكروفون (اختياري):</strong> عند استخدام ميزة
                    البحث والطلب الصوتي الذكي فقط وبموافقة المستخدم.
                  </li>
                  <li>
                    <strong>الإشعارات:</strong> لتنبيه الموظف بوصول المندوب إلى
                    الدور والمكتب.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  04. حق المستخدم في تعديل أو حذف بياناته
                </h2>
                <p>
                  يحق لكل مستخدم تعديل بياناته ومقر وزارته في أي وقت من خلال
                  صفحة حسابي بالتطبيق، كما يمكنه طلب حذف حسابه وجميع بياناته
                  المسجلة نهائياً عبر مراسلة مسؤول حماية البيانات في{" "}
                  <strong>شركة ميسك للتكنولوجيا</strong> على البريد الرسمي:{" "}
                  <code>info@el7lm.com</code> أو عبر واتساب:{" "}
                  <span dir="ltr" className="font-mono">
                    +01017799580
                  </span>
                  .
                </p>
              </section>
            </div>
          </div>
        </main>
      )}

      {/* Quiet Corporate Footer with Mesk Technology, WhatsApp +01017799580, and Email info@el7lm.com */}
      <footer className="site-footer">
        <div className="footer-brand">
          <img
            className="official-logo"
            src="/brand/capital-talabat-mascot-logo-256x256.png"
            alt="شعار طلبات العاصمة الرسمي"
            width="80"
            height="80"
            loading="lazy"
          />
          <div>
            <strong>
              <span>طلبات</span> العاصمة
            </strong>
            <p>بريك يستاهل، من غير ما تسيب مكتبك.</p>
          </div>
        </div>
        <nav aria-label="روابط إضافية">
          <a href="/admin">دخول الإدارة</a>
          <button onClick={() => navigateToSection("terms")}>
            الشروط والأحكام
          </button>
          <button onClick={() => navigateToSection("privacy")}>الخصوصية</button>
          <a
            href="https://wa.me/201017799580"
            target="_blank"
            rel="noopener noreferrer"
          >
            تواصل معنا <ArrowLeft size={15} />
          </a>
        </nav>
        <small>
          © {new Date().getFullYear()} طلبات العاصمة · ميسك للتكنولوجيا
        </small>
      </footer>

      <a
        href="https://wa.me/201017799580"
        target="_blank"
        rel="noopener noreferrer"
        className="website-whatsapp"
        aria-label="تواصل معنا عبر واتساب"
      >
        <MessageCircle size={23} />
      </a>
    </div>
  );
};
