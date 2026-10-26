import { useEffect, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { BRAND } from '../brand';
export type AppSelection = { id?:string; storeId?:string; title: string; kind: 'product' | 'store' | 'category' };
export function AppPromotionDialog({ open, selection, appUrl, onClose }: {
  open: boolean; selection?: AppSelection; appUrl: string | null; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open) element?.showModal(); else element?.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <dialog ref={dialog} className="app-promotion" dir="rtl" aria-labelledby="mobile-app-title" aria-describedby="mobile-app-description" onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === dialog.current) { const rect=dialog.current.getBoundingClientRect(); if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)onClose(); } }}>
    <button className="app-promotion-close" aria-label="إغلاق" onClick={onClose}><X size={21} /></button>
    <div className="app-promotion-visual" aria-hidden="true"><img src={BRAND.logoLarge} alt="" loading="lazy" width="512" height="512" /></div>
    <div className="app-promotion-copy"><span className="eyebrow"><img className="app-promotion-avatar" src={BRAND.logoSmall} width="44" height="44" alt="" />سنجوب على موبايلك</span><h2 id="mobile-app-title">نكمل على التطبيق؟</h2>{selection && <p className="app-selection">{selection.title}</p>}<p id="mobile-app-description">اختار طلبك وحدّد مكتبك وتابع التوصيل، كلّه من التطبيق.</p>
      {appUrl ? <a className="site-button site-button-orange btn btn-primary" href={appUrl}>افتح التطبيق<ArrowLeft size={18} /></a> : <><p className="app-release-note">رابط التحميل الرسمي سيتاح قريبًا.</p><a className="site-button site-button-orange btn btn-primary" href="https://wa.me/201017799580" target="_blank" rel="noopener noreferrer">استفسر عن التطبيق<ArrowLeft size={18} /></a></>}
      <button className="app-promotion-later" onClick={onClose}>أكمل تصفح الموقع</button>
    </div>
  </dialog>;
}
