import {useEffect,useRef} from 'react';
import L from 'leaflet';import 'leaflet/dist/leaflet.css';
import {OSM_CONFIG,type Coordinates,type RouteResult} from '../services/osmRouting';
const valid=(p?:Coordinates|null)=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
const pin=(label:string,color:string)=>L.divIcon({className:'tracking-map-pin',html:`<span style="display:block;width:28px;height:28px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 2px 8px #0006;text-align:center;color:white">${label}</span>`,iconSize:[28,28],iconAnchor:[14,14]});
/** Read-only view. Coordinates update markers, never rebuild the Leaflet instance. No Firebase access. */
export function TrackingMap({mapKey,point,destination,route}:{mapKey:string;point?:Coordinates|null;destination?:Coordinates|null;route?:RouteResult|null}){
 const container=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),courier=useRef<L.Marker|null>(null),customer=useRef<L.Marker|null>(null),line=useRef<L.Polyline|null>(null),frame=useRef<number>(0),fitted=useRef(false);
 const hasCenter=!!(valid(destination)||valid(point));
 useEffect(()=>{
  if(!container.current||!hasCenter)return;const center=valid(destination)?destination!:point!;
  const instance=L.map(container.current,{attributionControl:true,scrollWheelZoom:false}).setView([center.latitude,center.longitude],15);map.current=instance;
  L.tileLayer(OSM_CONFIG.tileUrl,{attribution:OSM_CONFIG.attribution,maxZoom:19}).addTo(instance);
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>instance.invalidateSize()):null;observer?.observe(container.current);
  return()=>{cancelAnimationFrame(frame.current);observer?.disconnect();instance.remove();map.current=null;courier.current=null;customer.current=null;line.current=null;fitted.current=false};
 },[mapKey,hasCenter]);
 useEffect(()=>{
  const instance=map.current;if(!instance)return;
  if(valid(destination)){const location:L.LatLngExpression=[destination!.latitude,destination!.longitude];if(!customer.current)customer.current=L.marker(location,{icon:pin('●','#2D3142'),title:'موقع العميل'}).addTo(instance);else customer.current.setLatLng(location);}
  if(valid(point)){
   const target=L.latLng(point!.latitude,point!.longitude);
   if(!courier.current)courier.current=L.marker(target,{icon:pin('↗','#b83f00'),title:'آخر موقع للمندوب'}).addTo(instance);
   else{cancelAnimationFrame(frame.current);const marker=courier.current,start=marker.getLatLng(),at=performance.now();const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:800;const animate=(now:number)=>{const t=duration?Math.min(1,(now-at)/duration):1;marker.setLatLng([start.lat+(target.lat-start.lat)*t,start.lng+(target.lng-start.lng)*t]);if(t<1)frame.current=requestAnimationFrame(animate)};frame.current=requestAnimationFrame(animate);}
  }
  if(route?.polyline.length){if(!line.current)line.current=L.polyline(route.polyline,{color:route.isFallback?'#777':'#b83f00',weight:4,dashArray:route.isFallback?'6 6':undefined}).addTo(instance);else line.current.setLatLngs(route.polyline);}
  if(!fitted.current&&valid(point)&&valid(destination)){instance.fitBounds(L.latLngBounds([[point!.latitude,point!.longitude],[destination!.latitude,destination!.longitude]]),{padding:[30,30],maxZoom:17});fitted.current=true;}
 },[mapKey,hasCenter,point?.latitude,point?.longitude,destination?.latitude,destination?.longitude,route]);
 if(!hasCenter)return <p role="status">لا تتوفر إحداثيات للعرض بعد.</p>;
 return <div ref={container} role="img" aria-label="خريطة موقع المندوب والعميل" style={{height:280,width:'100%',borderRadius:12,overflow:'hidden',position:'relative',zIndex:0}}/>;
}
