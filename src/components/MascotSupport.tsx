import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpLeft, Coffee, MessageCircle, ShoppingBag, X } from 'lucide-react';
import { BRAND } from '../brand';
import { BreakfastOrder } from './BreakfastOrder';

const actions = [
  { kind: 'support', title: 'التواصل مع الدعم', detail: 'اسألنا أو تابع طلبك', Icon: MessageCircle,
    message: 'مرحبًا، أحتاج مساعدة من دعم طلبات العاصمة.' },
  { kind: 'breakfast', title: 'طلب أوردر فطار', detail: 'اختار الأصناف وحدد العدد', Icon: Coffee,
    message: 'مرحبًا، أريد طلب فطار من طلبات العاصمة.\nالأصناف والكميات:\nالوزارة / العنوان:\nالدور ورقم المكتب:' },
  { kind: 'supermarket', title: 'طلب أوردر سوبر ماركت', detail: 'احتياجاتك اليومية من المتجر', Icon: ShoppingBag,
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
  const [view, setView] = useState<'services'|'breakfast'>('services');
  const breakfastButton = useRef<HTMLButtonElement>(null);
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
    <button type="button" className="mascot-support" data-paused={hidden} onClick={() => { setView('services'); setOpen(true); }}
      aria-label="افتح قائمة السنجاب" aria-haspopup="dialog" aria-expanded={open} aria-controls={id}>
      <span className="mascot-support-label">محتاج مساعدة؟<small>الدعم والطلبات</small></span>
      <span className="mascot-support-portrait" aria-hidden="true"><img src={BRAND.logo} width="256" height="256" alt="" decoding="async" /></span>
      <span className="mascot-support-badge" aria-hidden="true"><MessageCircle size={15} /></span>
    </button>
    <dialog ref={dialog} id={id} className={`mascot-actions${view === 'breakfast' ? ' is-order' : ''}`} dir="rtl" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={event => {
        if (event.target !== dialog.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false);
      }}>
      <header><div><h2 id={`${id}-title`}>{view === 'breakfast' ? 'طلب فطار' : 'نساعدك إزاي؟'}</h2><p id={`${id}-description`}>{view === 'breakfast' ? 'جهز طلبك وراجعه قبل واتساب' : 'اختار الخدمة المناسبة ليك'}</p></div><button type="button" className="mascot-actions-close" aria-label="إغلاق قائمة السنجاب" onClick={() => setOpen(false)}><X size={20} /></button></header>
      <div hidden={view !== 'services'}>
        <div className="mascot-action-list">{actions.map(({ kind, title, detail, Icon, message }) => {
          const content = <><span className="mascot-action-icon" aria-hidden="true"><Icon size={22} /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpLeft size={17} aria-hidden="true" /></>;
          return kind === 'breakfast' ? <button key={title} ref={breakfastButton} type="button" onClick={() => setView('breakfast')}>{content}</button>
            : <a key={title} href={whatsappLink(message)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>{content}</a>;
        })}</div>
        <p className="mascot-actions-note">هنكمل معاك على واتساب. تأكيد الطلب مع الفريق.</p>
      </div>
      <div className="breakfast-route" hidden={view !== 'breakfast'}><BreakfastOrder active={open && view === 'breakfast'} onBack={() => {setView('services'); requestAnimationFrame(() => breakfastButton.current?.focus());}} onSend={() => setOpen(false)} /></div>
    </dialog>
  </>;
}
