import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { BRAND } from '../brand';

/** A real support link: never waits for animation and never opens a pretend chat. */
export function MascotSupport() {
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);

  return <a className="mascot-support" data-paused={hidden} href={BRAND.supportUrl}
    target="_blank" rel="noopener noreferrer" aria-label="تواصل مع الدعم عبر واتساب">
    <span className="mascot-support-label">محتاج مساعدة؟<small>تواصل عبر واتساب</small></span>
    <span className="mascot-support-portrait" aria-hidden="true">
      <img src={BRAND.logo} width="256" height="256" alt="" decoding="async" />
    </span>
    <span className="mascot-support-badge" aria-hidden="true"><MessageCircle size={15} /></span>
  </a>;
}
