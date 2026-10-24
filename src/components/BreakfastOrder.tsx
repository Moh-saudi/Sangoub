import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Coffee, Minus, Plus, ShoppingBag } from 'lucide-react';
import { BRAND } from '../brand';
import { BREAKFAST_MENU, SUPERMARKET_MENU, MAX_ITEM_QUANTITY, MAX_BREAKFAST_QUANTITY, breakfastCount, breakfastLines, breakfastPaymentLabel, buildBreakfastMessage, parseBreakfastQuantity, type BreakfastDraft } from '../utils/breakfastOrder';

type Step = 'category' | 'items' | 'details' | 'review';
export function BreakfastOrder({ active, onBack, onSend, kind = 'breakfast' }: { kind?: 'breakfast' | 'supermarket'; active: boolean; onBack: () => void; onSend: () => void }) {
  const supermarket = kind === 'supermarket';
  const menu = supermarket ? SUPERMARKET_MENU : BREAKFAST_MENU;
  const orderName = supermarket ? 'سوبر ماركت' : 'فطار';
  const [step, setStep] = useState<Step>('category'), [category, setCategory] = useState<string>(menu[0].id);
  const [draft, setDraft] = useState<BreakfastDraft>({ quantities: {}, name: '', address: '', office: '', notes: '', payment: '' });
  const [error, setError] = useState('');
  const body = useRef<HTMLDivElement>(null), title = useRef<HTMLHeadingElement>(null), id = useId();
  const total = breakfastCount(draft.quantities, menu), selected = breakfastLines(draft.quantities, menu);
  const current = menu.find(item => item.id === category)!;
  useEffect(() => { if (active) { if(body.current) body.current.scrollTop=0; title.current?.focus({preventScroll:true}); } }, [active, step]);
  function go(next: Step) { setError(''); setStep(next); }
  function quantity(item: string, count: number) {
    const next = { ...draft.quantities, [item]: count };
    if (!Number.isInteger(count) || count < 0 || count > MAX_ITEM_QUANTITY || breakfastCount(next, menu) > MAX_BREAKFAST_QUANTITY) return;
    setDraft(value => ({ ...value, quantities: next })); setError('');
  }
  let message = '';
  if (step === 'review') { try { message = buildBreakfastMessage(draft, menu, orderName); } catch { /* Review is only entered after validation. */ } }
  const target = new URL(BRAND.supportUrl); target.searchParams.set('text', message);
  const headings = { category: 'تحب تطلب إيه؟', items: 'حدد عدد كل صنف', details: 'اسمك والتوصيل والدفع', review: 'راجع طلبك قبل واتساب' };
  return <form className={`breakfast-flow${supermarket ? ' supermarket-flow' : ''}`} onSubmit={event => { event.preventDefault(); if(step !== 'details')return; try { buildBreakfastMessage(draft, menu, orderName); go('review'); } catch(e) { setError((e as Error).message); } }}>
    <div className="breakfast-progress"><button type="button" className="breakfast-back" onClick={() => step === 'category' ? onBack() : go(step === 'items' ? 'category' : step === 'details' ? 'items' : 'details')}><ArrowRight size={16} />رجوع</button><span>{step === 'category' || step === 'items' ? '1 · الأصناف' : step === 'details' ? '2 · بياناتك' : '3 · المراجعة'}</span></div>
    <h3 ref={title} tabIndex={-1} className="breakfast-step-title">{headings[step]}</h3>
    {error && <p role="alert" className="breakfast-error">{error}</p>}
    <div ref={body} className="breakfast-body">
      {step === 'category' && <div className="breakfast-categories">{menu.map((item,index) => <button key={item.id} type="button" onClick={() => {setCategory(item.id); go('items');}}>{(!supermarket && index === 0) || item.id === 'tea-coffee' ? <Coffee size={26} /> : <ShoppingBag size={26} />}<strong>{item.name}</strong><small>{supermarket ? `${item.items.length} اختيارات · حدد عدد العبوات` : index === 0 ? 'فول، طعمية، بطاطس، باذنجان وأكثر' : 'كشري بأحجام مختلفة وأطباق فطار'}</small></button>)}</div>}
      {step === 'items' && <><div className="breakfast-tabs" role="group" aria-label={supermarket ? "أقسام السوبرماركت" : "أقسام الفطار"}>{menu.map(item => <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.name}</button>)}</div><p className="breakfast-hint">اختيارات مقترحة؛ الفريق يؤكد التوفر والسعر. تقدر تجمع من كل الأقسام. {supermarket && 'العدد للعبوة الموضحة. اكتب أي صنف إضافي أو حجم مفضل في الملاحظات؛ البدائل بعد موافقتك.'}</p><div className="breakfast-items">{current.items.map(item => <div key={item.id} className="breakfast-item"><label htmlFor={`${id}-${item.id}`}>{item.name}</label><div className="breakfast-counter"><button type="button" aria-label={`تقليل عدد ${item.name}`} disabled={!draft.quantities[item.id]} onClick={() => quantity(item.id, (draft.quantities[item.id] || 0)-1)}><Minus size={16} /></button><input id={`${id}-${item.id}`} aria-label={`عدد ${item.name}`} inputMode="numeric" pattern="[0-9٠-٩۰-۹]*" maxLength={2} value={draft.quantities[item.id] || ''} placeholder="0" onChange={event => {const value = parseBreakfastQuantity(event.target.value); if(value !== null)quantity(item.id,value);}} /><button type="button" aria-label={`زيادة عدد ${item.name}`} disabled={(draft.quantities[item.id] || 0) >= MAX_ITEM_QUANTITY || total >= MAX_BREAKFAST_QUANTITY} onClick={() => quantity(item.id,(draft.quantities[item.id] || 0)+1)}><Plus size={16} /></button></div></div>)}</div>{total>=MAX_BREAKFAST_QUANTITY&&<p className="breakfast-hint">الحد الأقصى للطلب 200 قطعة.</p>}</>}
      {step === 'details' && <div className="breakfast-fields"><label>الاسم<input aria-label={supermarket ? "اسم صاحب طلب السوبرماركت" : "اسم صاحب طلب الفطار"} autoComplete="name" required minLength={2} maxLength={80} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} /></label><label>الوزارة أو عنوان التوصيل<input aria-label={supermarket ? "عنوان توصيل السوبرماركت" : "عنوان توصيل الفطار"} autoComplete="street-address" required minLength={3} maxLength={240} value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})} /></label><label>الدور ورقم المكتب <small>اختياري</small><input maxLength={120} value={draft.office} onChange={e=>setDraft({...draft,office:e.target.value})} /></label><fieldset><legend>طريقة الدفع</legend><div className="breakfast-payments">{([['cash','كاش عند الاستلام'],['instapay','إنستا باي']] as const).map(([value,label])=><label key={value}><input type="radio" name={`${id}-payment`} required value={value} checked={draft.payment === value} onChange={()=>setDraft({...draft,payment:value})}/>{label}</label>)}</div>{draft.payment === 'instapay'&&<p className="breakfast-hint">الفريق يؤكد المبلغ وبيانات التحويل على واتساب.</p>}</fieldset><label>ملاحظات <small>اختياري</small><textarea placeholder={supermarket ? "صنف آخر، حجم الكيس، نوع المياه أو النكهة المطلوبة…" : undefined} rows={2} maxLength={300} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} /></label></div>}
      {step === 'review' && <div className="breakfast-review"><ul>{selected.map(item=><li key={item.id}><span>{item.name}</span><strong>× {item.quantity}</strong></li>)}</ul><dl><dt>الاسم</dt><dd>{draft.name}</dd><dt>التوصيل</dt><dd>{draft.address}{draft.office&&` — ${draft.office}`}</dd><dt>الدفع المطلوب</dt><dd>{breakfastPaymentLabel(draft.payment as 'cash'|'instapay')}</dd>{draft.notes&&<><dt>ملاحظات</dt><dd>{draft.notes}</dd></>}</dl><p className="breakfast-hint">سيؤكد الفريق الأسعار والإجمالي والتوفر على واتساب قبل اعتماد الطلب.</p></div>}
    </div>
    <footer className="breakfast-summary"><span>{total ? `العدد: ${total} · الأصناف: ${selected.length}` : 'اختر الصنف وحدد العدد'}</span>{step==='details'?<button type="submit" className="breakfast-primary">مراجعة الطلب</button>:step==='review'?<a className="breakfast-primary" href={target.href} target="_blank" rel="noopener noreferrer" aria-disabled={!message} onClick={e=>{if(!message)e.preventDefault();else onSend();}}>إرسال الطلب عبر واتساب</a>:<button type="button" className="breakfast-primary" disabled={!total} onClick={()=>go('details')}>متابعة الطلب</button>}</footer>
  </form>;
}
