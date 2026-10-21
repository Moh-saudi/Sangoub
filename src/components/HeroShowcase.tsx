import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Asterisk,
  Coffee,
  Handshake,
  MapPin,
  Pause,
  Play,
  UtensilsCrossed,
} from "lucide-react";

const SLIDES = [
  {
    image: "/images/government-district-gardens.jpg",
    alt: "الساحات والممرات بين مباني الوزارات في الحي الحكومي بالعاصمة الإدارية",
    eyebrow: "طلبات العاصمة · لخدمة موظفي الحي الحكومي",
    title: "في الحي الحكومي؟",
    highlight: "طلبك لحد مكتبك.",
    description: "فطارك وقهوتك وطلبات يومك، من الفود كورت إلى مكتبك بالوزارة.",
    label: "من المنيو إلى مكتبك",
    detail: "الوزارة · الدور · رقم المكتب",
    tag: "هنا مكانك… وهنا خدمتك",
    icon: MapPin,
    action: "اطلب من مكانك",
    partner: false,
    position: "left top",
  },
  {
    image: "/images/government-district-ministries.jpg",
    alt: "مباني الوزارات وشوارع الحي الحكومي في العاصمة الإدارية الجديدة",
    eyebrow: "من الفود كورت إلى مبنى وزارتك",
    title: "بريكك قصير؟",
    highlight: "وفّر المشوار.",
    description: "اختار من المنيو وحدّد الوزارة والدور ورقم المكتب.",
    label: "عنوانك بالتفصيل",
    detail: "المبنى · الدور · المكتب",
    tag: "وسط مجمع الوزارات",
    icon: UtensilsCrossed,
    action: "شوف المنيو",
    partner: false,
    position: "left top",
  },
  {
    image: "/images/government-district-skyline.jpg",
    alt: "لقطة جوية لمباني الوزارات ومسجد مصر في خلفية الحي الحكومي",
    eyebrow: "يومك في العاصمة أسهل",
    title: "يومك مزدحم؟",
    highlight: "رتّب بريكك.",
    description: "فطار، مشروبات، واحتياجات يومك. كلّها تبدأ بطلب واحد.",
    label: "بريك صغير، فرق كبير",
    detail: "قهوة ومشروبات من الكافيهات",
    tag: "في قلب الحي الحكومي",
    icon: Coffee,
    action: "اكتشف المشروبات",
    partner: false,
    position: "left top",
  },
  {
    image: "/images/government-district-night.jpg",
    alt: "لقطة ليلية مضاءة لمجمع مباني الحي الحكومي بالعاصمة الإدارية",
    eyebrow: "للمطاعم والكافيهات في العاصمة",
    title: "مطعمك بالعاصمة؟",
    highlight: "قرّب لعملائك.",
    description: "انضم لطلبات العاصمة واعرض منتجاتك لموظفي الوزارات.",
    label: "مكانك مع شركاء العاصمة",
    detail: "مطاعم · كافيهات · متاجر",
    tag: "شراكة تبدأ بخطوة",
    icon: Handshake,
    action: "انضم كشريك",
    partner: true,
    position: "left top",
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
  const Icon = slide.icon;
  const move = (step: number) =>
    setActive((index) => (index + step + SLIDES.length) % SLIDES.length);
  return (
    <section
      className="landing-hero hero-showcase split-showcase"
      aria-label="مميزات طلبات العاصمة والشراكة"
      aria-roledescription="عرض شرائح"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLButtonElement) return;
        if (event.key === "ArrowLeft") move(1);
        if (event.key === "ArrowRight") move(-1);
      }}
    >
      <div className="hero-copy">
        <div
          className="showcase-copy"
          key={active}
          aria-live={paused ? "polite" : "off"}
          aria-atomic="true"
        >
          <span className="eyebrow">
            <span />
            {slide.eyebrow}
          </span>
          <h1>
            {slide.title}
            <br />
            <em>{slide.highlight}</em>
          </h1>
          <p>{slide.description}</p>
        </div>
        <div className="hero-actions">
          <button
            className="site-button site-button-orange"
            onClick={slide.partner ? onOpenPartners : onOpenApp}
          >
            {slide.action}
            <ArrowLeft size={19} />
          </button>
          <a className="quiet-link" href="#how-it-works">
            إزاي بتشتغل؟
            <ArrowLeft size={15} />
          </a>
        </div>
        <div className="showcase-controls">
          <div className="showcase-dots" aria-label="اختيار الميزة">
            {SLIDES.map((item, index) => (
              <button
                key={item.image}
                aria-label={`عرض الميزة ${index + 1}: ${item.title}`}
                aria-pressed={active === index}
                className={active === index ? "is-current" : ""}
                onClick={() => setActive(index)}
              >
                <span />
              </button>
            ))}
          </div>
          <span className="showcase-count" dir="ltr">
            0{active + 1}
            <span> / 04</span>
          </span>
          <div className="showcase-arrows">
            <button onClick={() => move(-1)} aria-label="الصورة السابقة">
              <ArrowRight size={17} />
            </button>
            <button onClick={() => move(1)} aria-label="الصورة التالية">
              <ArrowLeft size={17} />
            </button>
            <button
              onClick={() => setAutoplay((value) => !value)}
              aria-label={
                autoplay ? "إيقاف العرض التلقائي" : "تشغيل العرض التلقائي"
              }
              aria-pressed={autoplay}
            >
              {autoplay ? <Pause size={15} /> : <Play size={15} />}
            </button>
          </div>
        </div>
        <div className="hero-location">
          <MapPin size={16} />
          <span>العاصمة الإدارية الجديدة · الحي الحكومي</span>
        </div>
      </div>
      <div className="hero-photograph showcase-photograph">
        <div className="showcase-images">
          {SLIDES.map((item, index) => (
            <div
              className={`showcase-image ${index === active ? "is-active" : ""}`}
              key={item.image}
              aria-hidden={index !== active}
            >
              <img
                src={item.image}
                alt={item.alt}
                fetchPriority={index === 0 ? "high" : "auto"}
                style={{ objectPosition: item.position }}
              />
            </div>
          ))}
          <div className="showcase-image-shade" aria-hidden="true" />
          <span className="showcase-photo-tag">
            <span />
            {slide.tag}
          </span>
          <div className="showcase-photo-wordmark" aria-hidden="true">
            <span>GOVERNMENT DISTRICT</span>
            <strong>
              الحي الحكومي.
              <br />
              هنا بنخدمك.
            </strong>
          </div>
        </div>
        <span className="showcase-decoration" aria-hidden="true">
          <Asterisk />
        </span>
        <div className="delivery-note" aria-live="off">
          <span className="delivery-icon">
            <Icon size={23} />
          </span>
          <div>
            <strong>{slide.label}</strong>
            <small>{slide.detail}</small>
          </div>
          <span className="showcase-note-arrow">
            <ArrowLeft size={20} />
          </span>
        </div>
        <a
          className="hero-caption"
          href="https://github.com/sasagaming496/New-Capital-of-Egypt/blob/c0373373d8667d91dc2b2dae7514c858ac015948/%D8%A7%D9%84%D8%AD%D9%8A%20%D8%A7%D9%84%D8%AD%D9%83%D9%88%D9%85%D9%8A.mp4"
          target="_blank"
          rel="noopener noreferrer"
        >
          لقطات الحي الحكومي · المصدر: فيديو يحمل علامة ACUD ↗
        </a>
      </div>
    </section>
  );
}
