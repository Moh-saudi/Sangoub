import { useEffect, useState } from 'react';
import { limit, where } from 'firebase/firestore';
import { ArrowLeft, ShoppingBag, Store as StoreIcon } from 'lucide-react';
import { watchCollection } from '../lib/firebase';
import type { Product, Store } from '../types';
import { formatEGP } from '../utils/orderCalculations';
import type { AppSelection } from './AppPromotionDialog';

export default function PublicCatalog({ onSelect }: { onSelect: (item: AppSelection) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  useEffect(() => {
    const stopProducts=watchCollection<Product>('products', data => setProducts(data.filter(item => !item.archived && item.inStock && item.name && Number.isFinite(item.price)).slice(0,12)), () => setProducts([]), [where('inStock','==',true),limit(24)]);
    const stopStores=watchCollection<Store>('stores', data => setStores(data.filter(item => item.name)), () => setStores([]), [where('status','==','open'),limit(12)]);
    return () => {stopProducts();stopStores();};
  }, []);
  const availableProducts=products.filter(product => stores.some(store => store.id === product.storeId));
  if(!availableProducts.length && !stores.length)return null;
  return <section className="public-catalog" aria-labelledby="public-catalog-title"><div className="section-heading"><div><span className="eyebrow">من متاجر العاصمة</span><h2 id="public-catalog-title">اختار اللي على مزاجك.</h2></div><span className="public-catalog-hint">اكمل طلبك في التطبيق</span></div>
    {stores.length>0 && <div className="public-store-list" aria-label="المتاجر المفتوحة">{stores.map(store => <button key={store.id} onClick={() => onSelect({title:store.name,kind:'store'})}><span className="public-store-logo"><StoreIcon size={23}/>{store.logoUrl && <img src={store.logoUrl} alt="" loading="lazy" onError={event=>{event.currentTarget.style.visibility='hidden';}}/>}</span><span>{store.name}<small>مفتوح الآن</small></span><ArrowLeft size={16}/></button>)}</div>}
    {availableProducts.length>0 && <div className="public-product-grid">{availableProducts.map(product=><button key={product.id} className="public-product-card" onClick={()=>onSelect({title:product.name,kind:'product'})}><span className="public-product-image"><ShoppingBag size={30}/>{product.imageUrl&&<img src={product.imageUrl} alt="" loading="lazy" onError={event=>{event.currentTarget.style.visibility='hidden';}}/>}</span><span className="public-product-copy"><strong>{product.name}</strong><small>{product.storeName}</small><span><b>{formatEGP(product.price)}</b><ArrowLeft size={17}/></span></span></button>)}</div>}
  </section>;
}
