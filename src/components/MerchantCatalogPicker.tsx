import {useEffect,useRef,useState} from 'react';
import {operationsApi} from '../lib/operationsApi';
import type {Product} from '../types';
import {customerMessage} from '../utils/customerMessage';
type Definition=Pick<Product,'id'|'name'|'description'|'category'|'imageUrl'>;
export function MerchantCatalogPicker({products,onLink,onClose}:{products:Product[];onLink:(id:string,price:number,existingProductId?:string)=>Promise<void>;onClose:()=>void}){
 const [items,setItems]=useState<Definition[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [existingId,setExistingId]=useState('');
 const [query,setQuery]=useState(''),[selected,setSelected]=useState(''),[price,setPrice]=useState('');
 const generation=useRef(0);
 const linked=new Set(products.map(p=>p.catalogProductId).filter(Boolean));
 async function load(next?:string){const current=generation.current;setLoading(true);setError('');try{
  const result=await operationsApi('operations',{action:'shared-catalog',query:query.trim(),...(next?{cursor:next}:{})});
  if(current!==generation.current)return;
  setItems(previous=>[...new Map([...(next?previous:[]),...result.items].map(p=>[p.id,p])).values()]);setCursor(result.nextCursor);
 }catch(e){if(current===generation.current)setError(customerMessage(e,'تعذر تحميل الكتالوج العام.'));}finally{if(current===generation.current)setLoading(false);}}
 useEffect(()=>{setCursor(null);setItems([]);setLoading(true);const timer=setTimeout(()=>void load(),query.trim()?350:0);return()=>{generation.current++;clearTimeout(timer);}},[query]);
 async function submit(){if(busy||!selected||price==='')return;setBusy(true);setError('');setNotice('');try{await onLink(selected,Number(price),existingId||undefined);setNotice('المنتج مرتبط بمتجرك. راجع سعره وتوفره من قائمة منتجاتك.');setSelected('');setPrice('');setExistingId('');}catch(e){setError(customerMessage(e,'تعذر ربط المنتج.'));}finally{setBusy(false);}}
 return <section aria-label="اختيار من الكتالوج العام" className="p-4 border rounded-2xl bg-white space-y-3">
  <header className="flex justify-between gap-3"><h4 className="font-bold">اختر منتجًا من كتالوج سنجوب العام</h4><button type="button" disabled={busy} onClick={onClose}>إغلاق</button></header>
  <p className="text-xs text-slate-600">الاسم والوصف والصورة والخيارات من كتالوج سنجوب والمنتجات المنشورة القائمة. أنت تحدد سعر متجرك وتوفره؛ إعادة الاختيار لا تنشئ نسخة أخرى.</p>
  <input aria-label="البحث في الكتالوج العام" placeholder="ابحث ببداية اسم المنتج في الكتالوج" value={query} onChange={e=>setQuery(e.target.value)} className="w-full p-3 border rounded-xl"/>
  {error&&<p role="alert" className="text-red-700">{error}<button disabled={loading} onClick={()=>void load()}>إعادة المحاولة</button></p>}
  {notice&&<p role="status" className="text-emerald-700">{notice}</p>}
  {loading&&<p role="status">جارٍ تحميل الكتالوج…</p>}
  {!loading&&!items.length&&!error&&<p>لا توجد منتجات مطابقة في هذه الصفحة. جرّب البحث ببداية الاسم أو تحميل الصفحة التالية.</p>}
  <div className="grid sm:grid-cols-2 gap-3">{items.filter(p=>(p.name+' '+p.description).includes(query.trim())).map(p=><button type="button" key={p.id} disabled={busy||linked.has(p.id)} onClick={()=>{setSelected(p.id);setPrice('');setExistingId('');}} aria-pressed={selected===p.id} className={`text-right border rounded-xl p-3 ${selected===p.id?'border-orange-500 bg-orange-50':''}`}>
   <strong>{p.name}</strong><p className="text-xs">{p.description}</p><small>{linked.has(p.id)?'مرتبط بمتجرك بالفعل':p.category}</small>
  </button>)}</div>
  {cursor&&<button disabled={loading||busy} onClick={()=>void load(cursor)}>تحميل المزيد من الكتالوج</button>}
  {selected&&<form onSubmit={e=>{e.preventDefault();void submit();}} className="flex flex-wrap items-end gap-3">
   <label>ربط بسجل قائم في متجري
    <select aria-label="ربط بسجل قائم في متجري" value={existingId} onChange={e=>{setExistingId(e.target.value);setPrice(e.target.value?String(products.find(p=>p.id===e.target.value)?.price??''):'');}} className="block p-2 border rounded-xl">
     <option value="">عرض جديد — إذا لم يكن المنتج موجودًا في متجري</option>
     {products.filter(p=>!p.catalogProductId).map(p=><option key={p.id} value={p.id}>{p.name} — الاحتفاظ بمعرفه وسعره</option>)}
    </select>
   </label>
   {existingId&&<p className="text-xs">سيُربط السجل المختار بالتعريف المعتمد مع الاحتفاظ بمعرّفه وسعره وتوفره. اختر المنتج المطابق فعليًا.</p>}
   <label>سعر البيع في متجرك<input aria-label="سعر البيع في متجرك" disabled={Boolean(existingId)} type="number" min="0" max="100000" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)} className="block p-2 border rounded-xl"/></label>
   <button disabled={busy||price===''} type="submit" className="p-3 rounded-xl bg-orange-600 text-white">{busy?'جارٍ الربط…':'ربط المنتج بمتجري'}</button>
  </form>}
 </section>;
}
