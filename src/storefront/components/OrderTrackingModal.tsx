import {useEffect,useRef} from 'react';
import {OrderMap} from '../../components/OrderMap';
import {formatEGP} from '../../utils/orderCalculations';
export interface TrackableOrder {
  orderId: string;
  orderStatus?: import('../../types').Order['orderStatus'];
  coordinates?: import('../../types').Coordinates;
  itemsCount: number;
  total: number;
  destination: string;
  destinationCoords?: { lat: number; lng: number };
  time: string;
  paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'card' | 'wallet';
  instapayRef?: string;
  receiptUrl?: string;
  notes?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    imageUrl?: string;
  }>;
  createdAt?: string;
}

interface OrderTrackingModalProps {isOpen:boolean;onClose:()=>void;order:TrackableOrder|null}
export type TrackingStage='received'|'preparing'|'with_courier'|'delivered';
export function OrderTrackingModal({isOpen,onClose,order}:OrderTrackingModalProps){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(isOpen&&order)ref.current?.showModal();else ref.current?.close();},[isOpen,order?.orderId]);
 if(!isOpen||!order)return null;
 const coordinates=order.coordinates||(order.destinationCoords?{latitude:order.destinationCoords.lat,longitude:order.destinationCoords.lng}:undefined);
 return <dialog ref={ref} onCancel={onClose} onClose={onClose} dir="rtl" aria-labelledby="customer-tracking-title" style={{margin:'auto',padding:20,border:'1px solid #ddd',borderRadius:20,width:'min(520px,calc(100vw - 24px))',maxHeight:'90svh',overflow:'auto'}}>
  <header style={{display:'flex',justifyContent:'space-between',gap:12}}><h2 id="customer-tracking-title">متابعة طلبك</h2><button onClick={onClose} aria-label="إغلاق متابعة الطلب">×</button></header>
  <p>{order.orderId} · {order.destination}</p>
  <OrderMap order={{id:order.orderId,orderStatus:order.orderStatus||'received',coordinates}}/>
  {!order.orderStatus&&<p>حالة الطلب الفعلية غير متاحة في هذا السجل القديم. <a href="/my-orders">افتح طلباتك الفعلية</a></p>}
  <p>الإجمالي: {formatEGP(order.total)}</p>
  {order.items?.map((item,i)=><p key={i}>{item.quantity} × {item.name}</p>)}
 </dialog>;
}
