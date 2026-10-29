import {useEffect,useRef,useState} from 'react';
import {Search,X,Check} from 'lucide-react';
import {operationsApi} from '../lib/operationsApi';
import type {Product} from '../types';
import {customerMessage} from '../utils/customerMessage';
import {MerchantProductImage} from './MerchantProductImage';
import './merchant-catalog.css';
type Definition=Pick<Product,'id'|'name'|'description'|'category'|'imageUrl'>;
export function MerchantCatalogPicker({products,onLink,onClose}:{products:Product[];onLink:(id:string,price:number,existingProductId?:string)=>Promise<void>;onClose:()=>void}){
 const [items,setItems]=useState<Definition[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [existingId,setExistingId]=useState('');
 const [query,setQuery]=useState(''),[selected,setSelected]=useState<Definition|null>(null),[price,setPrice]=useState('');
 const generation=useRef(0),dialog=useRef<HTMLDialogElement>(null),search=useRef<HTMLInputElement>(null),results=useRef<HTMLDivElement>(null),more=useRef<HTMLButtonElement>(null);
 const linked=new Set(products.map(p=>p.catalogProductId).filter(Boolean));
 const existingProducts=products.filter(p=>!p.catalogProductId);
 async function load(next?:string){const current=generation.current;setLoading(true);setError('');try{
  const result=await operationsApi('operations',{action:'shared-catalog',query:query.trim(),...(next?{cursor:next}:{})});
  if(current!==generation.current)return;
  setItems(previous=>[...new Map([...(next?previous:[]),...result.items].map(p=>[p.id,p])).values()]);setCursor(result.nextCursor);
 }catch(e){if(current===generation.current)setError(customerMessage(e,'تعذر تحميل المنتجات.'));}finally{if(current===generation.current)setLoading(false);}}
 useEffect(()=>{const element=dialog.current;element?.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';search.current?.focus();return()=>{element?.close();document.body.style.overflow=previous;};},[]);
 useEffect(()=>{setCursor(null);setItems([]);setLoading(true);const timer=setTimeout(()=>void load(),query.trim()?220:0);return()=>{generation.current++;clearTimeout(timer);}},[query]);
 useEffect(()=>{
  if(!cursor||loading||busy||!more.current||typeof IntersectionObserver==='undefined')return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))void load(cursor);},{root:results.current,rootMargin:'100px'});
  observer.observe(more.current);return()=>observer.disconnect();
 },[cursor,loading,busy,query]);
 async function submit(){if(busy||!selected||price==='')return;setBusy(true);setError('');setNotice('');try{await onLink(selected.id,Number(price),existingId||undefined);setNotice('تمت إضافة المنتج إلى متجرك.');setSelected(null);setPrice('');setExistingId('');}catch(e){setError(customerMessage(e,'تعذر حفظ المنتج.'));}finally{setBusy(false);}}
 return <dialog ref={dialog} className="merchant-catalog-dialog" aria-label="اختيار من الكتالوج العام" dir="rtl" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <div className="merchant-catalog-layout">
   <header className="merchant-catalog-heading"><div><h2>أضف منتجًا إلى متجرك</h2><p>ابحث بالاسم، اختر المنتج، ثم حدد سعر البيع.</p></div><button type="button" className="merchant-catalog-close" aria-label="إغلاق" disabled={busy} onClick={onClose}><X size={20}/></button></header>
   <label className="merchant-catalog-search"><Search size={20} aria-hidden="true"/><input ref={search} aria-label="البحث في الكتالوج العام" placeholder="اكتب اسم المنتج أو أول حرف…" value={query} disabled={busy} maxLength={120} onChange={e=>{setQuery(e.target.value);setSelected(null);setPrice('');setExistingId('');setNotice('');}}/></label>
   {error&&<p role="alert" className="merchant-catalog-status">{error} <button type="button" disabled={loading} onClick={()=>void load()}>إعادة المحاولة</button></p>}
   {notice&&<p role="status" className="merchant-catalog-status">{notice}</p>}
   {loading&&<p role="status" className="merchant-catalog-status">جارٍ البحث…</p>}
   <div ref={results} className="merchant-catalog-results">
    {!loading&&!items.length&&!error&&<p className="merchant-catalog-empty">لا توجد نتائج مطابقة. جرّب اسمًا آخر.</p>}
    <div className="merchant-catalog-grid">{items.map(p=><button type="button" key={p.id} disabled={busy||linked.has(p.id)} onClick={()=>{setSelected(p);setPrice('');setExistingId('');}} aria-pressed={selected?.id===p.id} className="merchant-catalog-card" title={p.name}>
      <span className="merchant-catalog-photo"><MerchantProductImage src={p.imageUrl} name={p.name}/></span>
      {linked.has(p.id)&&<span className="merchant-catalog-added"><Check size={12} className="inline"/> موجود بمتجرك</span>}
      <span className="merchant-catalog-card-copy"><strong>{p.name}</strong><small>{p.category}</small></span>
    </button>)}</div>
    {cursor&&<button ref={more} type="button" className="merchant-catalog-more" disabled={loading||busy} onClick={()=>void load(cursor)}>تحميل المزيد من الكتالوج</button>}
   </div>
   {selected&&<div className="merchant-catalog-selection"><form onSubmit={e=>{e.preventDefault();void submit();}}>
     <div className="merchant-catalog-selection-summary"><h3>{selected.name}</h3><p>{existingId?'سيُحفظ المنتج بمعرّفه وسعره الحاليين.':'حدد سعر البيع. يمكنك تفعيل توفره بعد الإضافة.'}</p>
      {existingProducts.length>0&&<details open={Boolean(existingId)}><summary>المنتج موجود عندي بالفعل</summary><label>ربط بسجل قائم في متجري<select aria-label="ربط بسجل قائم في متجري" value={existingId} onChange={e=>{setExistingId(e.target.value);setPrice(e.target.value?String(products.find(p=>p.id===e.target.value)?.price??''):'');}}><option value="">إضافة منتج إلى متجري</option>{existingProducts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></details>}
     </div>
     <label>سعر البيع — ج.م<input aria-label="سعر البيع في متجرك" disabled={Boolean(existingId)} type="number" min="0" max="100000" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00"/></label>
     <button className="merchant-catalog-submit" aria-label="ربط المنتج بمتجري" disabled={busy||price===''} type="submit">{busy?'جارٍ الحفظ…':'إضافة المنتج'}</button>
   </form></div>}
  </div>
 </dialog>;
}
