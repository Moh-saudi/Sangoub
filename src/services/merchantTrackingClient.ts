/** Merchant-only scoped server projection; no overlapping requests or work while hidden. */
export function listenMerchantTracking(orderId:string,next:(data:any,cached?:boolean)=>void,error:()=>void,deps:{request:(orderId:string,signal:AbortSignal)=>Promise<any>;hidden:()=>boolean;every?:(fn:()=>void,ms:number)=>any;clear?:(id:any)=>void}){
 let alive=true,busy=false,controller:AbortController|null=null;
 const load=async()=>{if(!alive||busy||deps.hidden())return;busy=true;controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),10000);
  try{const result=await deps.request(orderId,controller.signal);if(alive)next(result.orderStatus==='with_courier'?result.tracking:null);}catch{if(alive)error();}finally{clearTimeout(timer);busy=false;}
 };
 void load();const timer=(deps.every||setInterval)(()=>void load(),10000);
 return()=>{alive=false;controller?.abort();(deps.clear||clearInterval)(timer)};
}
