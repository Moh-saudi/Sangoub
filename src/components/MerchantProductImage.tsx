import {useState} from 'react';
import {Package} from 'lucide-react';
export function MerchantProductImage({src,name}:{src?:string;name:string}){
 const [failed,setFailed]=useState('');
 return src&&failed!==src?<img src={src} alt={name} loading="lazy" decoding="async" onError={()=>setFailed(src)} className="merchant-product-image"/>:
  <span className="merchant-product-no-image"><Package size={28} aria-hidden="true"/><span>الصورة غير متاحة</span></span>;
}
