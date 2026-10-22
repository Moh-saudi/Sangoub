import { useEffect, type RefObject } from 'react';

/** Animate visible content once; content remains readable without observers or motion. */
export function useSiteMotion(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const running = new Set<Animation>();
    const tracked = new WeakSet<Element>();
    const selector = '.site-header,.hero-photograph,.showcase-copy>*,.hero-actions,.showcase-controls,.hero-location,.service-strip>span,.section-heading,.public-discovery-card,.public-how>h2,.public-how article,.public-partners>div,.public-store-list>button,.public-product-card,.site-footer';
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (media.matches || document.hidden) continue;
        const target = entry.target as HTMLElement;
        const siblings = [...(target.parentElement?.children || [])];
        const index = Math.max(0, siblings.indexOf(target));
        const animation = target.animate([
          { opacity: 0, transform: 'translateY(18px) scale(.985)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ], { duration: 560, delay: Math.min(index, 4) * 65, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
        running.add(animation);
        animation.finished.then(() => running.delete(animation), () => running.delete(animation));
      }
    }, { threshold: .12 });
    const scan = () => {
      element.querySelectorAll(selector).forEach(target => {
        if (!tracked.has(target)) { tracked.add(target); observer.observe(target); }
      });
    };
    const mutations = new MutationObserver(scan);
    mutations.observe(element, { childList: true, subtree: true });
    const stop = () => { if (media.matches || document.hidden) running.forEach(animation => animation.finish()); };
    // Keyboard interaction never waits for an entrance animation to finish.
    const focus = (event: FocusEvent) => { running.forEach(animation => { const target=(animation.effect as KeyframeEffect)?.target; if(target instanceof Element && event.target instanceof Node && target.contains(event.target))animation.finish(); }); };
    media.addEventListener('change', stop);
    document.addEventListener('visibilitychange', stop);
    element.addEventListener('focusin', focus);
    scan();
    return () => {
      observer.disconnect(); mutations.disconnect(); running.forEach(animation => animation.cancel());
      media.removeEventListener('change', stop); document.removeEventListener('visibilitychange', stop); element.removeEventListener('focusin', focus);
    };
  }, [root]);
}
