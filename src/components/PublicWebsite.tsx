import { useVisitorCounter } from "../utils/useVisitorCounter";
import CareersPage from "./CareersPage";
import "../site-motion.css";
import { useSiteMotion } from "../utils/useSiteMotion";
import { DeploymentVersion } from "./DeploymentVersion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bike, Building2, Coffee, MapPin, Menu, ShoppingBag, Smartphone, Tag, X } from "lucide-react";
import { AppPromotionDialog, type AppSelection } from "./AppPromotionDialog";
const PublicOffers = lazy(() => import("./PublicOffers"));
const PublicCatalog = lazy(() => import("./PublicCatalog"));
import { HeroShowcase } from "./HeroShowcase";
import { BRAND } from "../brand";
import { MascotSupport } from "./MascotSupport";
import { PublicFooter } from "./PublicFooter";

const logo = BRAND.logoSmall;
const whatsapp = BRAND.supportUrl;
const appUrl = (() => {
  try { const url = new URL(import.meta.env.VITE_MOBILE_APP_URL || ""); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
})();

export function PublicWebsite() {
  useVisitorCounter();
  const offers = /^\/offers\/?$/.test(window.location.pathname);
  const careers = /^\/careers\/?$/.test(window.location.pathname);
  const site = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  useSiteMotion(site);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) menu.current?.removeAttribute('open');
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);
  const [showApp, setShowApp] = useState(false);
  const [selection, setSelection] = useState<AppSelection | undefined>();
  const openApp = () => { setSelection(undefined); setShowApp(true); };
  const selectItem = (item: AppSelection) => { setSelection(item); setShowApp(true); };
  const openPartners = () => document.getElementById("partners")?.scrollIntoView({ behavior: "smooth" });
  const links = () => <><a href="/offers" aria-current={offers ? "page" : undefined}>العروض</a><a href="/#how-it-works">كيف تعمل؟</a><a href="/#partners">للمطاعم والمتاجر</a><a href="/careers">الوظائف</a><a href="#contact">تواصل معنا</a></>;
  return <div ref={site} data-careers={careers} className="capital-site min-h-screen text-slate-900" dir="rtl">
    <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
    <DeploymentVersion publicSite />
    <header className="site-header">
      <a href="/" className="site-brand" aria-label="سنجوب — الرئيسية"><img className="official-logo" src={logo} alt="شعار سنجوب الرسمي" width="80" height="80" /><span><span className="brand-accent">سنجوب</span><small lang="en" dir="ltr">Sangoub</small></span></a>
      <nav className="site-nav" aria-label="القائمة الرئيسية">{links()}</nav>
      <button className="site-button site-button-dark google-play-button" aria-label="تطبيق الموبايل" onClick={openApp}><img src="/images/google-play-badge.svg" alt="Google Play" width="135" height="40" /><Smartphone className="mobile-app-icon" size={21} /></button>
      <details ref={menu} className="site-mobile-menu"><summary aria-label="قائمة الموقع"><Menu className="site-menu-open" size={22} /><X className="site-menu-close" size={22} /></summary><nav aria-label="القائمة الرئيسية" onClick={() => menu.current?.removeAttribute('open')}>{links()}</nav></details>
    </header>
    <main id="main-content" tabIndex={-1} className="landing-main">
      {careers ? <CareersPage /> : offers ? <Suspense fallback={<p className="offers-state" role="status">جارٍ تحميل صفحة العروض…</p>}><PublicOffers onSelect={selectItem} /></Suspense> : <>
      <HeroShowcase onOpenApp={openApp} onOpenPartners={openPartners} />
      <div className="service-strip" role="region" aria-label="نطاق الخدمة" tabIndex={0}><span><MapPin /> الحي الحكومي</span><span><ShoppingBag /> مطاعم ومتاجر</span><span><Building2 /> لحد مكتبك</span></div>
      <Suspense fallback={null}><PublicCatalog onSelect={selectItem} /></Suspense>
      <a href="/offers" className="offers-entry"><Tag size={28}/><div><small>من متاجر العاصمة</small><h2>شوف عروض المنتجات</h2><p>المنتجات المخفّضة المتاحة في مكان واحد.</p></div><ArrowLeft size={22}/></a>
      <section className="food-section" id="discover"><div className="section-heading"><div><span className="eyebrow">على مزاجك</span><h2>لكل بريك، طلبه.</h2></div></div>
        <div className="food-grid">{[
          { image: "breakfast.jpg", title: "فطار يظبط يومك", text: "ابدأ يومك بلقمة حلوة." },
          { image: "coffee.jpg", title: "قهوتك من غير مشوار", text: "بريكك يستاهل تستمتع بيه." },
          { image: "cafe.jpg", title: "اختيارات من حواليك", text: "من مطاعم وكافيهات العاصمة." },
        ].map(item => <button type="button" onClick={() => selectItem({title:item.title,kind:"category"})} key={item.image} className="public-discovery-card relative overflow-hidden rounded-3xl bg-white border border-slate-100"><img src={`/images/${item.image}`} alt={item.title} loading="lazy" className="h-56 w-full object-cover" /><div className="p-6"><h3 className="font-black text-xl">{item.title}</h3><p className="mt-2 text-slate-500">{item.text}</p><span className="public-card-action">شوف في التطبيق <ArrowLeft size={15} /></span></div></button>)}</div>
        <p className="text-xs text-slate-500 mt-4">صور الطعام توضيحية؛ الأصناف والأسعار الفعلية تظهر في التطبيق.</p>
      </section>
      <section id="how-it-works" className="public-how max-w-6xl mx-auto px-6 py-16"><span className="eyebrow">من المنيو إلى مكتبك</span><h2 className="text-3xl font-black mt-3 mb-8">ثلاث خطوات. وبريكك عليك.</h2><div className="grid md:grid-cols-3 gap-6" role="region" aria-label="خطوات الطلب" tabIndex={0}>{[
        { icon: Coffee, title: "اختار طلبك", text: "تصفح المتاجر والأصناف المتاحة في التطبيق." },
        { icon: Building2, title: "حدّد مكتبك", text: "اسم الوزارة والدور ورقم المكتب؛ العنوان يفرق." },
        { icon: Bike, title: "تابع التوصيل", text: "حالة طلبك من التجهيز حتى الاستلام." },
      ].map(({ icon: Icon, title, text }, index) => <article key={title} className="rounded-3xl bg-white border border-slate-200 p-7"><div className="flex justify-between text-orange-600 mb-5"><Icon size={28} /><span className="font-bold">0{index + 1}</span></div><h3 className="font-black text-xl">{title}</h3><p className="text-slate-600 mt-3 leading-7">{text}</p></article>)}</div></section>
      <a href="/careers" className="careers-entry"><span role="img" aria-label="سكوتر توصيل">🛵</span><div><small>فرصتك مع سنجوب</small><h2>انضم لفريقنا</h2><p>التوصيل · المطبخ · التشغيل</p></div><ArrowLeft size={21}/></a>
      <section id="partners" className="public-partners max-w-6xl mx-auto px-6 pb-16"><div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 flex flex-wrap items-center justify-between gap-8"><div><span className="text-orange-400 font-bold text-sm">للمطاعم والكافيهات والمتاجر</span><h2 className="text-3xl font-black mt-4">مطعمك بالعاصمة؟ قرّب لعملائك.</h2><p className="mt-4 text-slate-300">تواصل مع فريقنا لعرض منتجاتك على سنجوب.</p></div><a className="site-button site-button-orange btn btn-primary" href={`${whatsapp}?text=${encodeURIComponent("مرحبًا، أريد الانضمام كشريك إلى سنجوب")}`} target="_blank" rel="noopener noreferrer">انضم كشريك <ArrowLeft size={18} /></a></div></section>
      </>}
    </main>
    <PublicFooter />
    {!showApp && <MascotSupport autoInvite={!offers && !careers} />}
    {!showApp && !careers && <div className="mobile-order-bar"><button onClick={openApp}>اطلب من التطبيق <ArrowLeft size={17} /></button></div>}
    <AppPromotionDialog open={showApp} selection={selection} appUrl={appUrl} onClose={() => setShowApp(false)} />
  </div>;
}
