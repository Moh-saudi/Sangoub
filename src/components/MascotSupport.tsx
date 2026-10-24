import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpLeft, Coffee, MessageCircle, ShoppingBag, X } from 'lucide-react';
import { BRAND } from '../brand';

const actions = [
  { title: 'التواصل مع الدعم', detail: 'اسألنا أو تابع طلبك', Icon: MessageCircle,
    message: 'مرحبًا، أحتاج مساعدة من دعم طلبات العاصمة.' },
  { title: 'طلب أوردر فطار', detail: 'اكتب الأصناف والكميات', Icon: Coffee,
    message: 'مرحبًا، أريد طلب فطار من طلبات العاصمة.\nالأصناف والكميات:\nالوزارة / العنوان:\nالدور ورقم المكتب:' },
  { title: 'طلب أوردر سوبر ماركت', detail: 'احتياجاتك اليومية من المتجر', Icon: ShoppingBag,
    message: 'مرحبًا، أريد طلب سوبر ماركت من طلبات العاصمة.\nالمنتجات والكميات:\nالوزارة / العنوان:\nالدور ورقم المكتب:' },
];

function whatsappLink(message: string) {
  const url = new URL(BRAND.supportUrl);
  url.searchParams.set('text', message);
  return url.href;
}

/** Choose a service before opening WhatsApp; this never submits an order itself. */
export function MascotSupport() {
  const [hidden, setHidden] = useState(document.hidden);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return <>
    <button type="button" className="mascot-support" data-paused={hidden} onClick={() => setOpen(true)}
      aria-label="افتح قائمة السنجاب" aria-haspopup="dialog" aria-expanded={open} aria-controls={id}>
      <span className="mascot-support-label">محتاج مساعدة؟<small>الدعم والطلبات</small></span>
      <span className="mascot-support-portrait" aria-hidden="true"><img src={BRAND.logo} width="256" height="256" alt="" decoding="async" /></span>
      <span className="mascot-support-badge" aria-hidden="true"><MessageCircle size={15} /></span>
    </button>
    <dialog ref={dialog} id={id} className="mascot-actions" dir="rtl" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={event => {
        if (event.target !== dialog.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false);
      }}>
      <header><div><h2 id={`${id}-title`}>نساعدك إزاي؟</h2><p id={`${id}-description`}>اختار الخدمة المناسبة ليك</p></div><button type="button" className="mascot-actions-close" aria-label="إغلاق قائمة السنجاب" onClick={() => setOpen(false)}><X size={20} /></button></header>
      <div className="mascot-action-list">{actions.map(({ title, detail, Icon, message }) => <a key={title} href={whatsappLink(message)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
        <span className="mascot-action-icon" aria-hidden="true"><Icon size={22} /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpLeft size={17} aria-hidden="true" />
      </a>)}</div>
      <p className="mascot-actions-note">هنكمل معاك على واتساب. تأكيد الطلب مع الفريق.</p>
    </dialog>
  </>;
}
