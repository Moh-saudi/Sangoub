import React, { useEffect, useRef, useState } from "react";
import { BRAND } from "../brand";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";

const SLIDES = [
  {
    theme: "delivery",
    eyebrow: "صديق يومك في العاصمة",
    title: "معاك في يومك،",
    highlight: "لحد مكتبك.",
    description: "أكلك وقهوتك وطلباتك اليومية من متاجر الحي الحكومي.",
    action: "اطلب من مكانك",
    partner: false,
  },
  {
    theme: "morning",
    eyebrow: "فطارك وبريكك من مكانك",
    title: "بريكك قصير؟",
    highlight: "وفّر المشوار.",
    description: "اختار فطارك أو قهوتك، وحدّد الوزارة والدور والمكتب.",
    action: "شوف الاختيارات",
    partner: false,
  },
  {
    theme: "daily",
    eyebrow: "من المطعم والسوبر ماركت",
    title: "طلبات يومك،",
    highlight: "في مكان واحد.",
    description: "تصفح المنتجات والمتاجر المتاحة، وكمل طلبك من التطبيق.",
    action: "اكتشف المتاجر",
    partner: false,
  },
  {
    theme: "partners",
    eyebrow: "للمطاعم والكافيهات والمتاجر",
    title: "كبر شغلك،",
    highlight: "وقرّب لعملائك.",
    description: "اعرض منتجاتك لموظفي الحي الحكومي مع طلبات العاصمة.",
    action: "انضم كشريك",
    partner: true,
  },
];

export function HeroShowcase({
  onOpenApp,
  onOpenPartners,
}: {
  onOpenApp: () => void;
  onOpenPartners: () => void;
}) {
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const paused = !autoplay || hovered || focused || hidden;
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => {
      if (media.matches) setAutoplay(false);
    };
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", motion);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
    };
  }, []);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(
      () => setActive((index) => (index + 1) % SLIDES.length),
      5500,
    );
    return () => window.clearTimeout(timer);
  }, [active, paused]);
  const slide = SLIDES[active];
  const pointer = useRef<{x: number; y: number} | null>(null);
  const move = (step: number) =>
    setActive((index) => (index + step + SLIDES.length) % SLIDES.length);
  return (
    <section
      className="hero-showcase mascot-showcase"
      data-theme={slide.theme}
      aria-label="مميزات طلبات العاصمة والشراكة"
      aria-roledescription="عرض شرائح"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onPointerDown={(event) => {
        pointer.current = null;
        if ((event.target as Element).closest('a,button')) return;
        pointer.current = {x: event.clientX, y: event.clientY};
      }}
      onPointerCancel={() => { pointer.current = null; }}
      onPointerUp={(event) => {
        const start = pointer.current;
        pointer.current = null;
        if (!start) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) move(dx > 0 ? 1 : -1);
      }}
      onKeyDown={(event) => {
        if ((event.target as Element).closest('a,button')) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowLeft" ? 1 : -1);
        }
      }}
    >
      <div className="hero-layout">
        <div className="hero-copy showcase-copy" aria-live={paused ? "polite" : "off"} aria-atomic="true">
          <span className="eyebrow">{slide.eyebrow}</span>
          <h1>{slide.title}<em>{slide.highlight}</em></h1>
          <p>{slide.description}</p>
        </div>
        <div className="hero-photograph">
          <div className="showcase-images">
            <img src={BRAND.logoLarge} alt="سنجاب طلبات العاصمة، صديقك في كل خطوة" width="512" height="512" fetchPriority="high" />
          </div>
          <span className="hero-mascot-caption">طلبات العاصمة</span>
        </div>
        <div className="hero-actions">
          <button className="site-button site-button-orange btn btn-primary" onClick={slide.partner ? onOpenPartners : onOpenApp}>
            {slide.action}<ArrowLeft size={17} />
          </button>
          <a className="quiet-link" href="/offers">شوف العروض<ArrowLeft size={15} /></a>
        </div>
      </div>
      <div className="showcase-controls">
        <div className="showcase-dots" aria-label="اختيار الميزة">
          {SLIDES.map((item, index) => <button key={item.theme}
            aria-label={`عرض الميزة ${index + 1}: ${item.title}`} aria-pressed={active === index}
            className={active === index ? "is-current" : ""} onClick={() => setActive(index)}><span /></button>)}
        </div>
        <span className="showcase-count" dir="ltr">0{active + 1}<span> / 04</span></span>
        <div className="showcase-arrows">
          <button onClick={() => move(-1)} aria-label="الصورة السابقة"><ArrowRight size={17} /></button>
          <button onClick={() => move(1)} aria-label="الصورة التالية"><ArrowLeft size={17} /></button>
          <button onClick={() => setAutoplay(value => !value)} aria-label={autoplay ? "إيقاف العرض التلقائي" : "تشغيل العرض التلقائي"} aria-pressed={autoplay}>
            {autoplay ? <Pause size={15} /> : <Play size={15} />}
          </button>
        </div>
      </div>
    </section>
  );
}
