import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';

/** Native RTL scrolling, with optional reversible autoplay and no cloned content. */
export function useHorizontalRail(count: number) {
  const track = useRef<HTMLDivElement>(null);
  const direction = useRef(1);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const [bounds, setBounds] = useState({ start: true, end: true, overflow: false });
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setBounds({ start: Math.abs(el.scrollLeft) < 3, end: Math.abs(el.scrollLeft) >= max - 3, overflow: max > 3 });
  }, []);
  const scroll = useCallback((step: number) => {
    const el = track.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const distance = (el.firstElementChild?.getBoundingClientRect().width || 140) + (parseFloat(style.columnGap) || 0);
    el.scrollBy({ left: (style.direction === 'rtl' ? -1 : 1) * step * distance,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, []);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    return () => resize.disconnect();
  }, [count, measure]);
  useEffect(() => {
    if (!auto || paused) return;
    const timer = setInterval(() => {
      const el = track.current;
      if (!el || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const max = el.scrollWidth - el.clientWidth, position = Math.abs(el.scrollLeft);
      if (max <= 3) return;
      if (position >= max - 3) direction.current = -1;
      if (position < 3) direction.current = 1;
      scroll(direction.current);
    }, 4500);
    return () => clearInterval(timer);
  }, [auto, paused, count, scroll]);
  return { track, bounds, auto, measure,
    move: (step: number) => { setAuto(false); scroll(step); },
    toggle: () => setAuto(value => !value),
    interaction: {
      onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false),
      onFocusCapture: () => setPaused(true),
      onBlurCapture: (event: FocusEvent<HTMLDivElement>) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); },
    },
    stop: () => setAuto(false),
  };
}
