import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpLeft, Coffee, MessageCircle, ShoppingBag, X } from 'lucide-react';
import { BRAND } from '../brand';
import { BreakfastOrder } from './BreakfastOrder';

const INVITATION_KEY = 'capital-sangoub-breakfast-invitation-v1';
let invitationSeenOnPage = false;
function invitationSeen() { try { return invitationSeenOnPage || sessionStorage.getItem(INVITATION_KEY) === '1'; } catch { return invitationSeenOnPage; } }
function markInvitationSeen() { invitationSeenOnPage = true; try { sessionStorage.setItem(INVITATION_KEY, '1'); } catch { /* In-memory fallback when storage is unavailable. */ } }

const actions = [
  { kind: 'support', title: 'التواصل مع الدعم', detail: 'اسألنا أو تابع طلبك', Icon: MessageCircle,
    message: 'مرحبًا، أحتاج مساعدة من دعم طلبات العاصمة.' },
  { kind: 'breakfast', title: 'طلب أوردر فطار', detail: 'اختار الأصناف وحدد العدد', Icon: Coffee,
    message: 'مرحبًا، أريد طلب فطار من طلبات العاصمة.\nالأصناف والكميات:\nالوزارة / العنوان:\nالدور ورقم المكتب:' },
  { kind: 'supermarket', title: 'طلب أوردر سوبر ماركت', detail: 'شاي وقهوة وسناكس ومياه للمكتب', Icon: ShoppingBag,
    message: 'مرحبًا، أريد طلب سوبر ماركت من طلبات العاصمة.\nالمنتجات والكميات:\nالوزارة / العنوان:\nالدور ورقم المكتب:' },
];

function whatsappLink(message: string) {
  const url = new URL(BRAND.supportUrl);
  url.searchParams.set('text', message);
  return url.href;
}

/** Choose a service before opening WhatsApp; this never submits an order itself. */
export function MascotSupport({ autoInvite = false }: { autoInvite?: boolean }) {
  const [hidden, setHidden] = useState(document.hidden);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'services'|'breakfast'|'supermarket'|'invite'>('services');
  const supermarketButton = useRef<HTMLButtonElement>(null);
  const breakfastButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (!autoInvite || hidden || open || invitationSeen()) return;
    const image = new Image();
    image.fetchPriority = 'low';
    image.src = BRAND.logoLarge;
    const timer = window.setTimeout(() => {
      if (document.hidden) return;
      const editing = document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
      markInvitationSeen();
      if (editing || document.querySelector('dialog[open],.site-mobile-menu[open]')) return;
      setView('invite'); setOpen(true);
    }, 2000);
    const engaged = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('a,button,input,textarea,select,summary,[contenteditable=true]')) {
        markInvitationSeen(); window.clearTimeout(timer);
      }
    };
    document.addEventListener('pointerdown', engaged);
    document.addEventListener('focusin', engaged);
    return () => { window.clearTimeout(timer); document.removeEventListener('pointerdown', engaged); document.removeEventListener('focusin', engaged); };
  }, [autoInvite, hidden, open]);
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
    <button type="button" className="mascot-support" data-paused={hidden} onClick={() => { markInvitationSeen(); setView('services'); setOpen(true); }}
      aria-label="افتح قائمة السنجاب" aria-haspopup="dialog" aria-expanded={open} aria-controls={id}>
      <span className="mascot-support-label">محتاج مساعدة؟<small>الدعم والطلبات</small></span>
      <span className="mascot-support-portrait" aria-hidden="true"><img src={BRAND.logo} width="256" height="256" alt="" decoding="async" /></span>
      <span className="mascot-support-badge" aria-hidden="true"><MessageCircle size={15} /></span>
    </button>
    <dialog ref={dialog} id={id} className={`mascot-actions${(view === 'breakfast' || view === 'supermarket') ? ' is-order' : view === 'invite' ? ' is-invite' : ''}`} dir="rtl" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={event => {
        if (event.target !== dialog.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false);
      }}>
      {view === 'invite' && <div className="sangoub-invite-art" aria-hidden="true"><div className="sangoub-invite-character"><img src={BRAND.logoLarge} width="512" height="512" alt="" decoding="async" /></div><span>سنجوب وصل!</span></div>}
      <header><div><h2 id={`${id}-title`}>{view === 'supermarket' ? 'طلب سوبر ماركت' : view === 'breakfast' ? 'طلب فطار' : view === 'invite' ? 'اطلب فطارك مع سنجوب' : 'نساعدك إزاي؟'}</h2><p id={`${id}-description`}>{(view === 'breakfast' || view === 'supermarket') ? 'جهز طلبك وراجعه قبل واتساب' : view === 'invite' ? 'ساندوتشات أو وجبات؟ اختار اللي تحبه وحدد العدد، وهنكمل معاك على واتساب.' : 'اختار الخدمة المناسبة ليك'}</p></div><button type="button" className="mascot-actions-close" aria-label="إغلاق قائمة السنجاب" onClick={() => setOpen(false)}><X size={20} /></button></header>
      {view === 'invite' && <div className="sangoub-invite-actions"><button type="button" className="breakfast-primary" onClick={() => setView('breakfast')}><Coffee size={19} />اطلب فطارك</button><button type="button" className="sangoub-invite-later" onClick={() => setOpen(false)}>هطلب بعدين</button><p>تقدر تطلب في أي وقت من زر سنجوب أسفل الصفحة.</p></div>}
      <div hidden={view !== 'services'}>
        <div className="mascot-action-list">{actions.map(({ kind, title, detail, Icon, message }) => {
          const content = <><span className="mascot-action-icon" aria-hidden="true"><Icon size={22} /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpLeft size={17} aria-hidden="true" /></>;
          return kind === 'breakfast' || kind === 'supermarket' ? <button key={title} ref={kind === 'breakfast' ? breakfastButton : supermarketButton} type="button" onClick={() => setView(kind)}>{content}</button>
            : <a key={title} href={whatsappLink(message)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>{content}</a>;
        })}</div>
        <p className="mascot-actions-note">هنكمل معاك على واتساب. تأكيد الطلب مع الفريق.</p>
      </div>
      <div className="breakfast-route" hidden={view !== 'breakfast'}><BreakfastOrder active={open && view === 'breakfast'} onBack={() => {setView('services'); requestAnimationFrame(() => breakfastButton.current?.focus());}} onSend={() => setOpen(false)} /></div>
      <div className="breakfast-route" hidden={view !== 'supermarket'}><BreakfastOrder kind="supermarket" active={open && view === 'supermarket'} onBack={() => {setView('services'); requestAnimationFrame(() => supermarketButton.current?.focus());}} onSend={() => setOpen(false)} /></div>
    </dialog>
  </>;
}
