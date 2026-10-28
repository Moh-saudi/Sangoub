import { useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { MapPin, Headphones, ArrowUpLeft, Store as StoreIcon, Truck, ChartNoAxesCombined } from 'lucide-react';
import { db } from '../lib/firebase';
import type { Store } from '../types';
import './merchant-login.css';

/** Public store branding is presentation only; membership still comes from Firebase. */
export function MerchantLoginLayout({ children, onSupport }: { children: ReactNode; onSupport: () => void }) {
  const [store, setStore] = useState<Store | null>(null);
  const [storeState, setStoreState] = useState<'general' | 'loading' | 'ready' | 'missing'>('general');
  useEffect(() => { document.title = 'دخول شركاء سنجوب | Sangoub Partners'; }, []);
  useEffect(() => {
    let id = new URLSearchParams(location.search).get('store');
    if (!id) { try { id = decodeURIComponent(location.pathname.match(/^\/merchant\/([^/]+)\/?$/)?.[1] || ''); } catch { id = ''; } }
    if (!id) return;
    if (!/^[\w-]{1,200}$/.test(id)) { setStoreState('missing'); return; }
    setStoreState('loading');
    return onSnapshot(doc(db, 'stores', id), snapshot => {
      setStore(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Store : null);
      setStoreState(snapshot.exists() ? 'ready' : 'missing');
    }, () => { setStore(null); setStoreState('missing'); });
  }, []);
  const logo = store?.logoUrl && /^https:\/\//i.test(store.logoUrl) ? store.logoUrl : null;
  return <div className="merchant-entry" dir="rtl">
    <main className="merchant-entry-card">
      <aside className="merchant-entry-scene" aria-label="هوية المتجر وسنجوب">

        <a className="merchant-entry-brand" href="/" aria-label="سنجوب، العودة إلى المتجر"><img src="/brand/sangoub-mark-white-128.png" alt="" /><span>سنجوب <small>Sangoub Partners</small></span></a>
        <div className="merchant-entry-story"><span className="merchant-entry-tag" /><h1>من متجرك<br />إلى عملائك</h1><p>انضم إلى شبكة سنجوب<br />للتوصيل الذكي في العاصمة الإدارية</p></div>
        <ul className="merchant-entry-benefits"><li><span><StoreIcon size={22} /></span><p>إدارة سهلة<small>لمتجرك</small></p></li><li><span><ChartNoAxesCombined size={22} /></span><p>اعرض منتجاتك<small>ووصلها لعملائك</small></p></li><li><span><Truck size={22} /></span><p>توصيل ومتابعة<small>مع فريق سنجوب</small></p></li></ul>
        <div className="merchant-entry-store" aria-live="polite">
          <img key={logo || 'default'} src={logo || '/brand/sangoub-mark-white-128.png'} alt={store ? `شعار ${store.name}` : 'شعار سنجوب'} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/brand/sangoub-mark-white-128.png'; }} />
          <div><strong>{store?.name || (storeState === 'loading' ? 'جارٍ تحميل بيانات المتجر…' : 'بوابة شركاء سنجوب')}</strong><p><MapPin size={14} aria-hidden="true" />{store?.locationInDistrict || (storeState === 'missing' ? 'تعذر تحميل المتجر من هذا الرابط' : 'العاصمة الإدارية الجديدة')}</p></div>
        </div>
      </aside>
      <section className="merchant-entry-login" aria-labelledby="merchant-entry-title">
        <div className="merchant-entry-eyebrow"><span>بوابة التجار</span><a href="/">العودة إلى سنجوب <ArrowUpLeft size={14} /></a></div>
        <header className="merchant-entry-heading"><StoreIcon className="merchant-entry-shop-icon" size={38} aria-hidden="true" /><h2 id="merchant-entry-title">تسجيل دخول التجار</h2><p>ادخل إلى حساب متجرك في سنجوب</p></header>
        {children}
        <button className="merchant-entry-support" type="button" onClick={onSupport}><Headphones size={18} aria-hidden="true" /><span>تحتاج مساعدة؟ تواصل مع دعم الشركاء</span><ArrowUpLeft size={16} aria-hidden="true" /></button>
        <footer className="merchant-entry-footer"><span>© {new Date().getFullYear()} سنجوب</span><span>بواسطة Mesk · Vlab</span></footer>
      </section>
    </main>
  </div>;
}
