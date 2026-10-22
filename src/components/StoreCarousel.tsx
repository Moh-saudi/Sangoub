import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, Store as StoreIcon } from 'lucide-react';
import type { Store } from '../types';
import type { AppSelection } from './AppPromotionDialog';

export function StoreCarousel({stores,onSelect}:{stores:Store[];onSelect:(item:AppSelection)=>void}){
 const track=useRef<HTMLDivElement>(null);
 const direction=useRef(1);
 const [auto,setAuto]=useState(true);
 const [paused,setPaused]=useState(false);
 const [bounds,setBounds]=useState({start:true,end:true});
 const measure=()=>{const el=track.current;if(el)setBounds({start:Math.abs(el.scrollLeft)<3,end:Math.abs(el.scrollLeft)>=el.scrollWidth-el.clientWidth-3});};
 function move(step:number){const el=track.current;if(!el)return;const width=(el.firstElementChild?.getBoundingClientRect().width||128)+10;el.scrollBy({left:-step*width,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 useEffect(()=>{const el=track.current;if(!el)return;measure();const resize=new ResizeObserver(measure);resize.observe(el);return()=>resize.disconnect();},[stores.length]);
 useEffect(()=>{const timer=setInterval(()=>{const el=track.current;if(!el||!auto||paused||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches||el.scrollWidth<=el.clientWidth+3)return;const position=Math.abs(el.scrollLeft),end=el.scrollWidth-el.clientWidth;if(position>=end-3)direction.current=-1;if(position<3)direction.current=1;move(direction.current);},4500);return()=>clearInterval(timer);},[auto,paused,stores.length]);
 return <div className="public-store-carousel" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}}>
  <div className="store-carousel-heading"><h3>مطاعم ومتاجر قريبة منك</h3><div aria-label="تحريك شريط المتاجر"><button aria-label={auto?"إيقاف حركة المتاجر":"تشغيل حركة المتاجر"} aria-pressed={auto} onClick={()=>setAuto(value=>!value)}>{auto?<Pause size={14}/>:<Play size={14}/>}</button><button aria-label="المتاجر السابقة" disabled={bounds.start} onClick={()=>move(-1)}><ChevronRight size={17}/></button><button aria-label="المتاجر التالية" disabled={bounds.end} onClick={()=>move(1)}><ChevronLeft size={17}/></button></div></div>
  <div ref={track} className="public-store-list" aria-label="المتاجر المفتوحة" onScroll={measure} onPointerDown={()=>setPaused(true)}>{stores.map(store=><button key={store.id} onClick={()=>onSelect({title:store.name,kind:'store'})}><span className="public-store-logo"><StoreIcon size={23}/>{store.logoUrl&&<img src={store.logoUrl} alt="" loading="lazy" onError={event=>{event.currentTarget.style.visibility='hidden';}}/>}</span><span>{store.name}<small>مفتوح الآن</small></span><ArrowLeft size={14}/></button>)}</div>
 </div>;
}
