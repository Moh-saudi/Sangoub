import {useEffect,useRef} from 'react';
import L from 'leaflet';import 'leaflet/dist/leaflet.css';
import {OSM_CONFIG,type Coordinates,type RouteResult} from '../services/osmRouting';
const valid=(p?:Coordinates|null)=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
const pin=(label:string,color:string)=>L.divIcon({className:'tracking-map-pin',html:`<span style="display:block;width:28px;height:28px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 2px 8px #0006;text-align:center;color:white">${label}</span>`,iconSize:[28,28],iconAnchor:[14,14]});
/** Read-only view. Coordinates update markers, never rebuild the Leaflet instance. No Firebase access. */
export interface TrackingPeer {id:string;point:Coordinates;label:string;stale?:boolean}
export function TrackingMap({mapKey,point,destination,route,peers=[],onSelectPeer}:{mapKey:string;point?:Coordinates|null;destination?:Coordinates|null;route?:RouteResult|null;peers?:TrackingPeer[];onSelectPeer?:(id:string)=>void}){
 const container=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),courier=useRef<L.Marker|null>(null),customer=useRef<L.Marker|null>(null),line=useRef<L.Polyline|null>(null),frame=useRef<number>(0),fitted=useRef(false);
 const peerMarkers=useRef(new Map<string,L.Marker>());
 const hasCenter=!!(valid(destination)||valid(point)||peers.some(p=>valid(p.point)));
 useEffect(()=>{
  if(!container.current||!hasCenter)return;const center=valid(destination)?destination!:valid(point)?point!:peers.find(p=>valid(p.point))!.point;
  const instance=L.map(container.current,{attributionControl:true,scrollWheelZoom:false}).setView([center.latitude,center.longitude],15);map.current=instance;
  L.tileLayer(OSM_CONFIG.tileUrl,{attribution:OSM_CONFIG.attribution,maxZoom:19}).addTo(instance);
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>instance.invalidateSize()):null;observer?.observe(container.current);
  return()=>{cancelAnimationFrame(frame.current);observer?.disconnect();instance.remove();map.current=null;courier.current=null;customer.current=null;line.current=null;fitted.current=false;peerMarkers.current.clear()};
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
  const visible=new Set(peers.filter(p=>valid(p.point)).map(p=>p.id));
  for(const [id,marker]of peerMarkers.current)if(!visible.has(id)){marker.remove();peerMarkers.current.delete(id)}
  for(const peer of peers){if(!valid(peer.point))continue;let marker=peerMarkers.current.get(peer.id);
    if(!marker){const label=document.createElement('span');label.textContent=peer.label;marker=L.marker([peer.point.latitude,peer.point.longitude],{icon:pin('●',peer.stale?'#777':'#08766b'),title:peer.label}).addTo(instance).bindTooltip(label);marker.on('click',()=>onSelectPeer?.(peer.id));peerMarkers.current.set(peer.id,marker);}else{marker.setLatLng([peer.point.latitude,peer.point.longitude]);marker.setOpacity(peer.stale?.45:1);}
  }
  if(!fitted.current&&valid(point)&&valid(destination)){instance.fitBounds(L.latLngBounds([[point!.latitude,point!.longitude],[destination!.latitude,destination!.longitude]]),{padding:[30,30],maxZoom:17});fitted.current=true;}
 },[mapKey,hasCenter,point?.latitude,point?.longitude,destination?.latitude,destination?.longitude,route,peers]);
 if(!hasCenter)return <p role="status">لا تتوفر إحداثيات للعرض بعد.</p>;
 return <div ref={container} role="img" aria-label="خريطة موقع المندوب والعميل" style={{height:280,width:'100%',borderRadius:12,overflow:'hidden',position:'relative',zIndex:0}}/>;
}
