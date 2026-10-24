import { Facebook, Instagram, Mail, MessageCircle } from 'lucide-react';
import { BRAND } from '../brand';

function socialUrl(value?: string) {
  try { const url = new URL(value || ''); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
function TikTokIcon({ size = 20 }: { size?: number }) {
  return <img src="/images/tiktok.svg" alt="" width={size} height={size} />;
}

export function PublicFooter() {
  const social = [
    { name: 'فيسبوك', Icon: Facebook, href: socialUrl(import.meta.env.VITE_SOCIAL_FACEBOOK_URL) },
    { name: 'إنستغرام', Icon: Instagram, href: socialUrl(import.meta.env.VITE_SOCIAL_INSTAGRAM_URL) },
    { name: 'تيك توك', Icon: TikTokIcon, href: socialUrl(import.meta.env.VITE_SOCIAL_TIKTOK_URL) },
  ];
  return <footer className="site-footer" id="contact">
    <div className="footer-brand"><img className="official-logo" src={BRAND.logoSmall} alt="طلبات العاصمة" width="80" height="80" loading="lazy" /><div><strong>طلبات العاصمة</strong><p>خدمة موظفي الحي الحكومي · العاصمة الإدارية</p></div></div>
    <div className="footer-social"><strong>تواصل معانا</strong><div className="footer-social-icons">
      <a className="social-icon" href={BRAND.supportUrl} target="_blank" rel="noopener noreferrer" aria-label="واتساب"><MessageCircle size={20} /></a>
      {social.map(({ name, Icon, href }) => href
        ? <a key={name} className="social-icon" href={href} target="_blank" rel="noopener noreferrer" aria-label={name}><Icon size={20} /></a>
        : <span key={name} className="social-icon social-pending" role="img" aria-label={name} title={name}><Icon size={20} aria-hidden="true" /></span>)}
      <a className="social-icon" href="mailto:info@el7lm.com" aria-label="البريد الإلكتروني"><Mail size={20} /></a>
    </div></div>
    <nav aria-label="روابط الموقع"><a href={BRAND.supportUrl} target="_blank" rel="noopener noreferrer">تواصل عبر واتساب</a><a href="mailto:info@el7lm.com">راسلنا</a><a href="/admin">دخول الإدارة</a></nav>
    <div className="footer-credit"><span>تصميم وتطوير</span><div className="executor-wordmark" dir="ltr" aria-label="Mesk - Vlab Ai"><b>Mesk</b><i aria-hidden="true" /><strong>vlab<span>Ai</span></strong></div><small dir="ltr">© 2026 Mesk – Vlab. All rights reserved.</small></div>
  </footer>;
}
