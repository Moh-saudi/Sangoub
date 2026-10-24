import { StoreCarousel } from "./StoreCarousel";
import { useEffect, useState } from 'react';
import { limit, where } from 'firebase/firestore';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { watchCollection } from '../lib/firebase';
import type { Product, Store } from '../types';
import { formatEGP } from '../utils/orderCalculations';
import type { AppSelection } from './AppPromotionDialog';
import { useHorizontalRail } from '../utils/useHorizontalRail';
import { RailControls } from './RailControls';

export default function PublicCatalog({ onSelect }: { onSelect: (item: AppSelection) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  useEffect(() => {
    const stopProducts=watchCollection<Product>('products', data => setProducts(data.filter(item => !item.archived && item.inStock && item.name && Number.isFinite(item.price)).slice(0,12)), () => setProducts([]), [where('inStock','==',true),limit(24)]);
    const stopStores=watchCollection<Store>('stores', data => setStores(data.filter(item => item.name)), () => setStores([]), [where('status','==','open'),limit(12)]);
    return () => {stopProducts();stopStores();};
  }, []);
  const availableProducts=products.filter(product => stores.some(store => store.id === product.storeId)).sort((a,b)=>a.name.localeCompare(b.name,'ar',{numeric:true}));
  const rail=useHorizontalRail(availableProducts.length);
  if(!availableProducts.length && !stores.length)return null;
  return <section className="public-catalog" aria-labelledby="public-catalog-title"><div className="section-heading"><div><span className="eyebrow">قريبين منك</span><h2 id="public-catalog-title">اختار متجرك</h2></div><span className="public-catalog-hint">الطلب من التطبيق</span></div>
    {stores.length>0 && <StoreCarousel stores={stores} onSelect={onSelect} />}
    {availableProducts.length>0 && <div className="public-product-carousel" {...rail.interaction}><div className="public-rail-heading"><h3 className="public-products-title">منتجات مختارة</h3><RailControls rail={rail} name="المنتجات" /></div><div ref={rail.track} className={`public-product-grid${availableProducts.length===1?' is-single':''}`} onScroll={rail.measure} onPointerDown={rail.stop}>{availableProducts.map(product=><button key={product.id} className="public-product-card" onClick={()=>onSelect({title:product.name,kind:'product'})}><span className="public-product-image"><ShoppingBag size={30}/>{product.imageUrl&&<img src={product.imageUrl} alt="" loading="lazy" onError={event=>{event.currentTarget.style.visibility='hidden';}}/>}</span><span className="public-product-copy"><strong>{product.name}</strong><small>{product.storeName}</small><span><b>{formatEGP(product.price)}</b><ArrowLeft size={17}/></span></span></button>)}</div></div>}
  </section>;
}
