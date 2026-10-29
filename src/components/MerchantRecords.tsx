import {useEffect,useState} from 'react';
import {operationsApi} from '../lib/operationsApi';
import {formatEGP} from '../utils/orderCalculations';
import {customerMessage} from '../utils/customerMessage';
export function MerchantRecords({kind,storeId}:{kind:'customers'|'payments';storeId:string}){
 const [items,setItems]=useState<any[]>([]),[cursor,setCursor]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[truncated,setTruncated]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);setError('');setItems([]);setCursor(null);
 operationsApi('operations',{action:'store-'+kind}).then(r=>{if(active){setItems(r.items);setCursor(r.nextCursor);setTruncated(Boolean(r.truncated));}}).catch(e=>{if(active)setError(customerMessage(e,'تعذر تحميل السجلات.'));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[kind,storeId,revision]);
 async function more(){if(!cursor||loading)return;setLoading(true);setError('');try{const r=await operationsApi('operations',{action:'store-'+kind,cursor});setItems(previous=>[...new Map([...previous,...r.items].map(v=>[v.id,v])).values()]);setCursor(r.nextCursor);}catch(e){setError(customerMessage(e,'تعذر تحميل المزيد.'));}finally{setLoading(false);}}
 return <section className="p-5 bg-white rounded-2xl border space-y-4" aria-label={kind==='customers'?'عملاء المتجر':'تسويات المتجر'}>
  <h2 className="font-bold text-xl">{kind==='customers'?'العملاء المرتبطون بطلبات المتجر':'سجل التسويات المسجلة'}</h2>
  <p className="text-sm text-slate-600">{kind==='customers'?'الأسماء ومراجع الطلبات من سجلات متجرك المحملة فقط؛ لا نعرض دفتر حسابات العملاء أو أرقام هواتفهم.':'هذه السجلات من التسويات المعتمدة في النظام، وتختلف عن تقديرات المبيعات. المرجع المسجل وحده لا يثبت اكتمال التحويل البنكي.'}</p>
  {loading&&<p role="status">جارٍ تحميل السجلات…</p>}
  {error&&<p role="alert">{error}<button onClick={()=>setRevision(v=>v+1)}>إعادة المحاولة</button></p>}
  {!loading&&!error&&!items.length&&<p>{kind==='customers'?'لا توجد طلبات عملاء مسجلة لهذا المتجر.':'لا توجد تسويات مسجلة لهذا المتجر بعد.'}</p>}
  {truncated&&<p>الملخص مبني على أول 100 طلب محمل؛ لا يمثل سجل العملاء كاملًا.</p>}
  <div className="grid sm:grid-cols-2 gap-3">{items.map(v=><article className="p-3 border rounded-xl" key={v.id}>{kind==='customers'?<><h3>{v.name}</h3><p>{v.orderIds.length} طلب في السجلات المحملة</p><p className="text-xs break-all">{v.orderIds.join('، ')}</p></>:<><h3>تسوية {v.id}</h3><p>إجمالي: {formatEGP(v.gross)} · عمولة: {formatEGP(v.commission)} · صافي مسجل: {formatEGP(v.net)}</p><p>المرجع: {v.reference||'غير مسجل'} · {v.orderCount} طلب</p>{v.createdAt&&<time>{new Date(v.createdAt).toLocaleDateString('ar-EG')}</time>}</>}</article>)}</div>
  {cursor&&<button disabled={loading} onClick={()=>void more()}>تحميل المزيد من التسويات</button>}
 </section>;
}
