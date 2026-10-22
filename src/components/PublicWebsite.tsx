import "../site-motion.css";
import { useSiteMotion } from "../utils/useSiteMotion";
import { DeploymentVersion } from "./DeploymentVersion";
import { lazy, Suspense, useRef, useState } from "react";
import { ArrowLeft, Bike, Building2, Coffee, MapPin, ShoppingBag, Smartphone } from "lucide-react";
import { AppPromotionDialog, type AppSelection } from "./AppPromotionDialog";
const PublicCatalog = lazy(() => import("./PublicCatalog"));
import { HeroShowcase } from "./HeroShowcase";

const logo = "/assets/aistudio/Capital_Talabat_App_Icon_7e80c871.png";
const whatsapp = "https://wa.me/201017799580";
const appUrl = (() => {
  try { const url = new URL(import.meta.env.VITE_MOBILE_APP_URL || ""); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
})();

export function PublicWebsite() {
  const site = useRef<HTMLDivElement>(null);
  useSiteMotion(site);
  const [showApp, setShowApp] = useState(false);
  const [selection, setSelection] = useState<AppSelection | undefined>();
  const openApp = () => { setSelection(undefined); setShowApp(true); };
  const selectItem = (item: AppSelection) => { setSelection(item); setShowApp(true); };
  const openPartners = () => document.getElementById("partners")?.scrollIntoView({ behavior: "smooth" });
  return <div ref={site} className="capital-site min-h-screen text-slate-900" dir="rtl">
    <DeploymentVersion publicSite />
    <header className="site-header">
      <a href="/" className="site-brand" aria-label="طلبات العاصمة — الرئيسية"><img className="official-logo" src={logo} alt="شعار طلبات العاصمة الرسمي" width="80" height="80" /><span><span className="brand-accent">طلبات</span> العاصمة<small lang="en" dir="ltr">Capital Talabat</small></span></a>
      <nav className="site-nav" aria-label="القائمة الرئيسية"><a href="#how-it-works">كيف تعمل؟</a><a href="#partners">للمطاعم والمتاجر</a><a href="#contact">تواصل معنا</a></nav>
      <button className="site-button site-button-dark" onClick={openApp}>تطبيق الموبايل <Smartphone size={17} /></button>
    </header>
    <main className="landing-main">
      <HeroShowcase onOpenApp={openApp} onOpenPartners={openPartners} />
      <div className="service-strip"><span><MapPin /> الحي الحكومي بالعاصمة الإدارية</span><span><ShoppingBag /> مطاعم وكافيهات ومتاجر</span><span><Building2 /> الوزارة · الدور · المكتب</span></div>
      <Suspense fallback={null}><PublicCatalog onSelect={selectItem} /></Suspense>
      <section className="food-section" id="discover"><div className="section-heading"><div><span className="eyebrow">على مزاجك</span><h2>لكل بريك، طلبه.</h2></div></div>
        <div className="food-grid">{[
          { image: "breakfast.jpg", title: "فطار يظبط يومك", text: "ابدأ يومك بلقمة حلوة." },
          { image: "coffee.jpg", title: "قهوتك من غير مشوار", text: "بريكك يستاهل تستمتع بيه." },
          { image: "cafe.jpg", title: "اختيارات من حواليك", text: "من مطاعم وكافيهات العاصمة." },
        ].map(item => <button type="button" onClick={() => selectItem({title:item.title,kind:"category"})} key={item.image} className="public-discovery-card relative overflow-hidden rounded-3xl bg-white border border-slate-100"><img src={`/images/${item.image}`} alt={item.title} loading="lazy" className="h-56 w-full object-cover" /><div className="p-6"><h3 className="font-black text-xl">{item.title}</h3><p className="mt-2 text-slate-500">{item.text}</p><span className="public-card-action">شوف الاختيارات في التطبيق <ArrowLeft size={15} /></span></div></button>)}</div>
        <p className="text-xs text-slate-500 mt-4">صور الطعام توضيحية؛ الأصناف والأسعار الفعلية تظهر في التطبيق.</p>
      </section>
      <section id="how-it-works" className="public-how max-w-6xl mx-auto px-6 py-16"><span className="eyebrow">من المنيو إلى مكتبك</span><h2 className="text-3xl font-black mt-3 mb-8">ثلاث خطوات. وبريكك عليك.</h2><div className="grid md:grid-cols-3 gap-6">{[
        { icon: Coffee, title: "اختار طلبك", text: "تصفح المتاجر والأصناف المتاحة في التطبيق." },
        { icon: Building2, title: "حدّد مكتبك", text: "اسم الوزارة والدور ورقم المكتب؛ العنوان يفرق." },
        { icon: Bike, title: "تابع التوصيل", text: "حالة طلبك من التجهيز حتى الاستلام." },
      ].map(({ icon: Icon, title, text }, index) => <article key={title} className="rounded-3xl bg-white border border-slate-200 p-7"><div className="flex justify-between text-orange-600 mb-5"><Icon size={28} /><span className="font-bold">0{index + 1}</span></div><h3 className="font-black text-xl">{title}</h3><p className="text-slate-600 mt-3 leading-7">{text}</p></article>)}</div></section>
      <section id="partners" className="public-partners max-w-6xl mx-auto px-6 pb-16"><div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 flex flex-wrap items-center justify-between gap-8"><div><span className="text-orange-400 font-bold text-sm">للمطاعم والكافيهات والمتاجر</span><h2 className="text-3xl font-black mt-4">مطعمك بالعاصمة؟ قرّب لعملائك.</h2><p className="mt-4 text-slate-300">تواصل مع فريقنا لعرض منتجاتك على طلبات العاصمة.</p></div><a className="site-button site-button-orange" href={`${whatsapp}?text=${encodeURIComponent("مرحبًا، أريد الانضمام كشريك إلى طلبات العاصمة")}`} target="_blank" rel="noopener noreferrer">انضم كشريك <ArrowLeft size={18} /></a></div></section>
    </main>
    <footer className="site-footer" id="contact"><div className="footer-brand"><img className="official-logo" src={logo} alt="طلبات العاصمة" width="80" height="80" loading="lazy" /><div><strong>طلبات العاصمة</strong><p>خدمة موظفي الحي الحكومي · العاصمة الإدارية</p></div></div><nav aria-label="روابط الموقع" className="flex flex-wrap gap-5 items-center"><a href={whatsapp} target="_blank" rel="noopener noreferrer">تواصل عبر واتساب</a><a href="mailto:info@el7lm.com">راسلنا</a><a href="/admin">دخول الإدارة</a></nav><small>© 2026 جميع الحقوق محفوظة لشركة ميسك للتكنولوجيا.</small></footer>
    <AppPromotionDialog open={showApp} selection={selection} appUrl={appUrl} onClose={() => setShowApp(false)} />
  </div>;
}
