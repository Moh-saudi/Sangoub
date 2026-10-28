import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, isVerifiedIdentity, signOutFromFirebase } from './lib/firebase';
import { operationsApi } from './lib/operationsApi';
import { orderDelivery } from './lib/orderDelivery';
import { useActivePortalOrders } from './lib/useActivePortalOrders';
import { LoadingState, ErrorState, EmptyState, ConnectionState } from './components/ui/DataStates';
import { BRAND } from './brand';
import { customerMessage } from './utils/customerMessage';
import './courier.css';
const states: Record<string, string> = {
  received: 'تم استلام الطلب',
  preparing: 'جاري التحضير',
  ready: 'جاهز للاستلام',
  with_courier: 'في التوصيل',
  delivered: 'تم التسليم',
  cancelled: 'ملغي'
};
export default function CourierApp() {
  const [uid, setUid] = useState<string>(),
    [access, setAccess] = useState<'checking' | 'login' | 'denied' | 'courier'>('checking'),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [accessMessage, setAccessMessage] = useState(''),
    [revision, setRevision] = useState(0);
  const [history, setHistory] = useState<any[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [historyLoaded, setHistoryLoaded] = useState(false),
    [tab, setTab] = useState<'active' | 'history'>('active'),
    [historyBusy, setHistoryBusy] = useState(false);
  const [pending, setPending] = useState<string>(),
    [codes, setCodes] = useState<Record<string, string>>({}),
    [confirmed, setConfirmed] = useState<Record<string, boolean>>({}),
    [collected, setCollected] = useState<Record<string, boolean>>({});
  const mutation = useRef(false),
    generation = useRef(0);
  const feed = useActivePortalOrders(access === 'courier' ? uid : undefined);
  useEffect(() => onAuthStateChanged(auth, user => {
    generation.current++;
    setUid(user?.uid);
    setAccess(user ? 'checking' : 'login');
    setHistory([]);
    setCodes({});
    setConfirmed({});
    setCollected({});
    setHistoryLoaded(false);
    setHistoryBusy(false);
    setCursor(null);
    setTab('active');
    setPending(undefined);
    setError('');
    setNotice('');
  }), []);
  useEffect(() => {
    if (!uid) return;
    let active=true, version=0, inFlight=false, again=false;
    const deny=(message:string)=>{
      generation.current++;setHistory([]);setCodes({});setHistoryBusy(false);
      setAccessMessage(message);setAccess('denied');
    };
    const check=async()=>{
      const current=++version;
      if(inFlight){again=true;return;}
      inFlight=true;setAccess('checking');
      try{
        // The authenticated server is authoritative. A failed Firestore listener is not evidence of a missing role.
        const profile=await operationsApi('operations',{action:'profile'});
        if(!active||current!==version||auth.currentUser?.uid!==uid)return;
        if(profile.needsVerification){deny('أكد بريد الحساب أولاً، ثم اضغط إعادة التحقق.');return;}
        if(profile.uid!==uid||profile.role!=='courier'){
          deny('هذا الحساب ليس مسجلاً كمندوب. اطلب من الإدارة تعيين نوع الحساب إلى «مندوب توصيل» للبريد الظاهر أدناه.');return;
        }
        if(profile.courierApprovalError){deny(profile.courierApprovalError);return;}
        if(profile.courierStatus&&profile.courierStatus!=='active'){deny('ملفك قيد الفحص أو موقوف مؤقتًا. تواصل مع الإدارة لاستكمال اعتماد المندوب.');return;}
        setAccessMessage('');setName(profile.displayName);setAccess('courier');
      }catch(e){if(active&&current===version)deny(customerMessage(e,'تعذر الاتصال للتحقق من حساب المندوب. أعد المحاولة؛ لم يتم تأكيد أو رفض اعتماد الحساب.'));}
      finally{inFlight=false;if(again&&active){again=false;void check();}}
    };
    void check();
    const changed=()=>void check();
    const subscriptions=['staff','accountAccess'].map(collection=>onSnapshot(doc(db,collection,uid),{includeMetadataChanges:true},snapshot=>{
      if(!snapshot.metadata.fromCache)changed();
    },()=>{if(active)changed()}));
    return()=>{active=false;version++;subscriptions.forEach(stop=>stop());};
  },[uid,revision]);
  useEffect(() => {
    const tag = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!tag) return;
    const old = tag.getAttribute('href');
    tag.setAttribute('href', '/courier.webmanifest');
    return () => {
      if (old) tag.setAttribute('href', old);
    };
  }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch {
      setError('تعذر الدخول. راجع البريد وكلمة المرور واتصالك.');
    } finally {
      setBusy(false);
    }
  }
  async function historyPage(reset = false) {
    if (historyBusy) return;
    const current = generation.current;
    setHistoryBusy(true);
    setError('');
    try {
      const r = await operationsApi('operations', {
        action: 'portal-history',
        ...(!reset && cursor ? {
          cursor
        } : {})
      });
      if (current !== generation.current) return;
      setHistory(prev => reset ? r.items : [...new Map([...prev, ...r.items].map(o => [o.id, o])).values()]);
      setCursor(r.nextCursor);
      setHistoryLoaded(true);
    } catch {
      if (current === generation.current) setError('تعذر تحميل سجل التوصيل. أعد المحاولة.');
    } finally {
      if (current === generation.current) setHistoryBusy(false);
    }
  }
  async function act(order: any, action: string, storeId?: string) {
    if (mutation.current || !feed.online) return;
    mutation.current = true;
    setPending(order.id);
    setError('');
    const current = generation.current;
    try {
      if (action === 'deliver') await orderDelivery({
        action: 'deliver',
        orderId: order.id,
        otpCode: codes[order.id] || '',
        collectedAmount: order.amountToCollect
      });else await operationsApi('operations', {
        action,
        orderId: order.id,
        ...(storeId ? {
          storeId
        } : {}),
        confirmed: true
      });
      if (current !== generation.current) return;
      setCodes(v => ({
        ...v,
        [order.id]: ''
      }));
      await feed.refresh();
    } catch {
      if (current === generation.current) setError('لم يتم تأكيد الإجراء. حدّث المهام ثم راجع الحالة ورمز التسليم قبل إعادة المحاولة.');
    } finally {
      mutation.current = false;
      if (current === generation.current) setPending(undefined);
    }
  }
  const money = (n: number) => new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP'
  }).format(n || 0);
  if (access === 'checking') return <main className="courier-app"><LoadingState message="جارٍ التحقق من حساب المندوب…" /></main>;
  if (access === 'login' || access === 'denied') return <main className="courier-app courier-auth" dir="rtl"><section className="courier-panel"><a href="/"><img src={BRAND.logo} alt="سنجوب" width="64" height="64" /></a><h1>دخول مندوب سنجوب</h1><p>مهامك المسندة إليك، والاستلام والتسليم بالرمز.</p>{access === 'denied' ? <><ErrorState message={accessMessage||'لم تكتمل مراجعة صلاحية الحساب.'} /><p>البريد الحالي: <strong dir="ltr">{auth.currentUser?.email}</strong></p><p className="text-xs">معرّف الحساب: <span dir="ltr">{uid}</span></p>{auth.currentUser && !isVerifiedIdentity(auth.currentUser) && <button disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            await sendEmailVerification(auth.currentUser!);
            setNotice('أرسلت رسالة التأكيد.');
          } catch {
            setError('تعذر إرسال رسالة التأكيد.');
          } finally {
            setBusy(false);
          }
        }}>إرسال تأكيد البريد</button>}<button onClick={async () => {
          try {
            await auth.currentUser?.reload();
            await auth.currentUser?.getIdToken(true);
            setRevision(v => v + 1);
            setAccess('checking');
          } catch {
            setError('تعذر إعادة التحقق.');
          }
        }}>إعادة التحقق</button><button onClick={() => void signOutFromFirebase()}>تسجيل الخروج</button></> : <form onSubmit={login}><label>البريد الإلكتروني<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} dir="ltr" /></label><label>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} dir="ltr" /></label><button disabled={busy}>{busy ? 'جارٍ الدخول…' : 'دخول المندوب'}</button><button type="button" disabled={busy || !email} onClick={async () => {
          setBusy(true);
          try {
            await sendPasswordResetEmail(auth, email.trim());
            setNotice('إذا كان البريد مسجلاً فستصله تعليمات الاستعادة.');
          } catch {
            setError('تعذر إرسال تعليمات الاستعادة.');
          } finally {
            setBusy(false);
          }
        }}>نسيت كلمة المرور؟</button></form>}{error && <ErrorState message={error} />}<p role="status">{notice}</p><a href={BRAND.supportUrl}>التواصل مع الدعم</a></section></main>;
  return <main className="courier-app" dir="rtl"><header className="courier-header"><img src={BRAND.logo} alt="سنجوب" width="42" height="42" /><div><h1>مهام التوصيل</h1><p>{name}</p></div><button onClick={() => void signOutFromFirebase()}>خروج</button></header><ConnectionState online={feed.online} live={feed.live} updatedAt={feed.updatedAt} /><nav className="courier-tabs" aria-label="طلبات المندوب"><button aria-pressed={tab === 'active'} onClick={() => setTab('active')}>المهام النشطة ({feed.items.length})</button><button aria-pressed={tab === 'history'} onClick={() => {
        setTab('history');
        if (!historyLoaded) void historyPage(true);
      }}>سجل التوصيل</button></nav>{(error || feed.error) && <ErrorState message={error || feed.error} retry={() => {
      setError('');
      if (tab === 'history') void historyPage(true);else void feed.refresh();
    }} />}{tab === 'active' && <><button className="courier-refresh" onClick={() => void feed.refresh()}>تحديث المهام</button>{feed.loading ? <LoadingState message="جارٍ تحميل مهامك…" /> : !feed.items.length ? <EmptyState message="لا توجد مهام نشطة مسندة إليك. ستظهر هنا عند تكليفك من الإدارة." /> : feed.items.map(order => <article className="courier-panel" key={order.id}><header><h2>طلب {order.orderNumber}</h2><span>{states[order.orderStatus] || order.orderStatus}</span></header><p>{order.profileName} · {order.ministry}</p><p>الدور: {order.floorNumber} · المكتب: {order.roomNumber}</p>{order.phone && <a href={`tel:${String(order.phone).replace(/[^+0-9]/g, '')}`}>اتصال بالعميل</a>}{order.pickupPoints?.map((point: any) => <p key={point.storeId}><strong>{point.name}:</strong> {point.address}</p>)}<ul>{order.items.map((item: any, i: number) => <li key={item.id || i}>{item.quantity} × {item.product.name} — {item.product.storeName}{item.selectedOptions && <small>{Object.values(item.selectedOptions).join('، ')}</small>}{item.notes && <small>{item.notes}</small>}</li>)}</ul><p className="courier-payment">{order.paymentMethod === 'cash' ? `المطلوب تحصيله: ${money(order.amountToCollect)}` : 'دفع إلكتروني — لا تحصّل مبلغاً نقدياً'}</p>{order.orderStatus === 'ready' && <><label className="courier-check"><input type="checkbox" checked={!!confirmed[order.id]} onChange={e => setConfirmed(v => ({
              ...v,
              [order.id]: e.target.checked
            }))} />راجعت الأصناف والكميات عند الاستلام</label>{order.fulfillmentVersion === 2 ? (order.stops || []).map((stop: any) => <button key={stop.storeId} disabled={!feed.online || !!feed.error || !!pending || !confirmed[order.id] || stop.status !== 'ready' || stop.issueOpen} onClick={() => void act(order, 'pickup', stop.storeId)}>{stop.status === 'picked_up' ? 'تم الاستلام من' : 'استلام من'} {stop.storeName}</button>) : !order.received && <button disabled={!feed.online || !!feed.error || !!pending || !confirmed[order.id]} onClick={() => void act(order, 'courier-pickup')}>تأكيد استلام الطلب</button>}<button disabled={!feed.online || !!feed.error || !!pending || (order.fulfillmentVersion === 2 ? !(order.stops?.length && order.stops.every((s: any) => s.status === 'picked_up')) : !order.received)} onClick={() => void act(order, order.fulfillmentVersion === 2 ? 'depart' : 'courier-depart')}>بدء التوصيل للعميل</button></>}{order.orderStatus === 'with_courier' && <><label>رمز التسليم من العميل<input aria-label={`رمز تسليم ${order.orderNumber}`} inputMode="numeric" autoComplete="off" maxLength={4} value={codes[order.id] || ''} onChange={e => setCodes(v => ({
              ...v,
              [order.id]: e.target.value.replace(/[^0-9]/g, '')
            }))} /></label><label className="courier-check"><input type="checkbox" checked={!!collected[order.id]} onChange={e => setCollected(v => ({
              ...v,
              [order.id]: e.target.checked
            }))} />{order.paymentMethod === 'cash' ? 'حصّلت قيمة الطلب كاملة وسلّمت الأصناف' : 'سلّمت الأصناف دون تحصيل نقدي'}</label><button disabled={!feed.online || !!feed.error || !!pending || !collected[order.id] || !/^\d{4}$/.test(codes[order.id] || '')} onClick={() => void act(order, 'deliver')}>{pending === order.id ? 'جارٍ التحقق…' : 'تأكيد التسليم بالرمز'}</button></>}</article>)}{feed.truncated && <p role="status">تعرض أول 50 مهمة. تواصل مع الإدارة لمراجعة عدد التكليفات.</p>}</>}{tab === 'history' && <>{historyBusy && <LoadingState message="جارٍ تحميل سجل التوصيل…" />}{historyLoaded && !history.length && <EmptyState message="لا توجد مهام سابقة في سجلك." />}{history.map(o => <article className="courier-panel" key={o.id}><h2>طلب {o.orderNumber}</h2><p>{states[o.orderStatus]} · {money(o.total)}</p></article>)}{cursor && <button disabled={historyBusy} onClick={() => void historyPage()}>تحميل المزيد</button>}</>}<footer><a href={BRAND.supportUrl}>دعم سنجوب</a> · <a href="/">الموقع الرئيسي</a></footer></main>;
}
