/** OSM-only gateway: fixed upstreams, bounded geography, no arbitrary URL forwarding. */
export class OsmError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status} }
type Point={latitude:number;longitude:number};
export interface OsmConfig { bbox:[number,number,number,number];routeUrl:string;searchUrl:string;userAgent:string;production?:boolean }
export function osmConfig():OsmConfig {
 const raw=(process.env.OSM_ALLOWED_BBOX||'31.50,29.85,31.95,30.20').split(',').map(Number);
 if(raw.length!==4||raw.some(n=>!Number.isFinite(n))||raw[0]>=raw[2]||raw[1]>=raw[3]||raw[0]<-180||raw[2]>180||raw[1]<-90||raw[3]>90)throw new OsmError(503,'إعداد نطاق الخريطة غير صالح.');
 const production=process.env.NODE_ENV==='production'||process.env.VERCEL_ENV==='production';
 if(production&&(!process.env.OSRM_URL||!process.env.NOMINATIM_URL||!process.env.NOMINATIM_USER_AGENT))throw new OsmError(503,'مزود الخرائط الإنتاجي يحتاج إعدادًا من الإدارة.');
 return {bbox:raw as OsmConfig['bbox'],routeUrl:process.env.OSRM_URL||'https://router.project-osrm.org/route/v1/driving',searchUrl:process.env.NOMINATIM_URL||'https://nominatim.openstreetmap.org',userAgent:process.env.NOMINATIM_USER_AGENT||'Sangoub-development/1.0',production};
}
export function createOsmService(config:OsmConfig,deps:{fetch?:typeof fetch;now?:()=>number}={}){
 const fetcher=deps.fetch||fetch,now=deps.now||Date.now;
 const cache=new Map<string,{until:number;value:any}>(),users=new Map<string,{until:number;count:number}>();let lastSearch=-Infinity;
 const base=(value:string)=>{const u=new URL(value);if(u.username||u.password||!['https:','http:'].includes(u.protocol)||(u.protocol==='http:'&&(!['localhost','127.0.0.1','::1','[::1]'].includes(u.hostname)||config.production)))throw new OsmError(503,'عنوان مزود الخرائط غير صالح.');return u.href.replace(/\/$/,'')};
 const routeBase=base(config.routeUrl),searchBase=base(config.searchUrl);
 const point=(p:any):Point=>{if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['latitude','longitude'].includes(k))||typeof p.latitude!=='number'||typeof p.longitude!=='number'||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||p.longitude<config.bbox[0]||p.longitude>config.bbox[2]||p.latitude<config.bbox[1]||p.latitude>config.bbox[3])throw new OsmError(400,'اختر إحداثيات رقمية داخل نطاق الخدمة.');return p};
 const upstream=async(url:string)=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new OsmError(504,'انتهت مهلة مزود الخرائط.'));},4000)});
  try{return await Promise.race([(async()=>{const r=await fetcher(url,{signal:controller.signal,headers:{'User-Agent':config.userAgent,'Accept':'application/json'}});if(!r.ok)throw new OsmError(502,'مزود الخرائط غير متاح مؤقتًا.');return await r.json()})(),timeout]);}finally{clearTimeout(timer!);}
 };
 const trim=()=>{for(const[k,v]of cache)if(v.until<=now())cache.delete(k);while(cache.size>500)cache.delete(cache.keys().next().value!);for(const[k,v]of users)if(v.until<=now())users.delete(k);};
 return async(kind:string,input:any,uid:string)=>{
  if(!['route','search'].includes(kind))throw new OsmError(404,'خدمة خريطة غير موجودة.');
  if(!input||typeof input!=='object'||Array.isArray(input))throw new OsmError(400,'طلب خريطة غير صالح.');
  trim();let budget=users.get(uid);if(!budget){if(users.size>=10000)throw new OsmError(429,'الخدمة مشغولة، حاول لاحقًا.');budget={until:now()+60000,count:0};users.set(uid,budget);}if(++budget.count>30)throw new OsmError(429,'طلبات كثيرة، انتظر دقيقة ثم حاول مجددًا.');
  let key:string,url:string;
  if(kind==='route'){
   if(Object.keys(input).some(k=>!['from','to'].includes(k)))throw new OsmError(400,'حقول المسار غير صالحة.');const a=point(input.from),b=point(input.to);
   key=`route:${a.latitude.toFixed(4)},${a.longitude.toFixed(4)}:${b.latitude.toFixed(4)},${b.longitude.toFixed(4)}`;
   url=`${routeBase}/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=full&geometries=geojson`;
  }else{
   if(Object.keys(input).some(k=>!['query','coordinates'].includes(k))||Boolean(input.query)===Boolean(input.coordinates))throw new OsmError(400,'اختر بحثًا نصيًا أو إحداثيات فقط.');
   if(input.coordinates){const p=point(input.coordinates);key=`reverse:${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;url=`${searchBase}/reverse?format=jsonv2&lat=${p.latitude}&lon=${p.longitude}&accept-language=ar`;}
   else{if(typeof input.query!=='string'||input.query.trim().length<3||input.query.length>120)throw new OsmError(400,'اكتب من 3 إلى120 حرفًا للبحث.');const text=input.query.trim();key='search:'+text.toLowerCase();const [w,s,e,n]=config.bbox;url=`${searchBase}/search?format=jsonv2&q=${encodeURIComponent(text)}&countrycodes=eg&bounded=1&viewbox=${w},${n},${e},${s}&limit=5&accept-language=ar`;}
  }
  const hit=cache.get(key);if(hit&&hit.until>now())return hit.value;
  if(kind==='search'){if(now()-lastSearch<1000)throw new OsmError(429,'انتظر ثانية بين طلبات البحث.');lastSearch=now();}
  const raw=await upstream(url);let value:any;
  if(kind==='route'){
   const r=raw?.routes?.[0],coords=r?.geometry?.coordinates;
   if(!r||!Number.isFinite(r.distance)||r.distance<0||!Number.isFinite(r.duration)||r.duration<0||!Array.isArray(coords)||coords.length<2||coords.length>10000||coords.some((p:any)=>!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90))throw new OsmError(502,'استجابة المسار غير صالحة.');
   const step=Math.max(1,Math.ceil(coords.length/2000));value={distanceMeters:Math.round(r.distance),durationSeconds:Math.round(r.duration),polyline:coords.filter((_:any,i:number)=>i%step===0||i===coords.length-1).map((p:number[])=>[p[1],p[0]]),calculatedAt:now()};
  }else{
   const rows=Array.isArray(raw)?raw:[raw];const results=rows.slice(0,5).flatMap((r:any)=>{try{const p=point({latitude:Number(r.lat),longitude:Number(r.lon)});return [{place_id:String(r.place_id||'').slice(0,80),display_name:String(r.display_name||'').slice(0,300),lat:String(p.latitude),lon:String(p.longitude),address:Object.fromEntries(['city','town','village','state','road','suburb','neighbourhood','building','house_number','country'].filter(k=>typeof r.address?.[k]==='string').map(k=>[k,r.address[k].slice(0,120)]))}]}catch{return []}});value={results};
  }
  cache.set(key,{until:now()+(kind==='route'?300000:30000),value});trim();return value;
 };
}
export function createOsmHandler(deps:{identify:(token:string)=>Promise<string>;lookup:(kind:string,input:any,uid:string)=>Promise<any>}){
 return async(req:any,res:any)=>{
  res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const token=req.headers?.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)return res.status(401).json({error:'سجل الدخول لاستخدام البحث والمسار.'});
  let uid:string;try{uid=await deps.identify(token);if(!uid)throw Error();}catch{return res.status(401).json({error:'جلسة الدخول غير صالحة، أعد تسجيل الدخول.'})}
  try{return res.status(200).json(await deps.lookup(req.query?.action||req.params?.action,req.body,uid));}catch(e){if(e instanceof OsmError){if(e.status===429)res.setHeader('Retry-After','1');return res.status(e.status).json({error:e.message})}return res.status(503).json({error:'خدمة الخرائط غير متاحة مؤقتًا.'})}
 };
}
