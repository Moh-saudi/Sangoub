import test from 'node:test';import assert from 'node:assert/strict';import {merchantTracking} from './merchantTracking.ts';
function fixture(){
  const rows:any={
    'orders/order-1':{id:'order-1',status:'assigned',store_id:'store-1',storeIds:['store-1','store-2'],store_ids:['store-1','store-2'],courierId:'courier',courier_id:'courier',orderStatus:'with_courier',profileId:'private',coordinates:{latitude:1,longitude:2},items:['secret']},
    'staff/merchant':{role:'restaurant',storeId:'store-1'},
    'tracking/order-1':{coordinates:{latitude:30,longitude:31.7},latitude:30,longitude:31.7,is_online:true,active:true,updatedAt:{seconds:123,nanoseconds:456},updated_at:{seconds:123,nanoseconds:456},secret:'hidden'}
  };
  const reads:string[]=[];
  const mockSupabase:any={
    from:(table:string)=>({
      select:()=>({
        eq:(col:string,val:string)=>({
          maybeSingle:async()=>{
            if(table==='orders'){
              reads.push(`orders/${val}`);
              return{data:rows[`orders/${val}`]||null,error:null};
            }
            if(table==='courier_locations'){
              reads.push(`tracking/order-1`);
              const t=rows['tracking/order-1'];
              return{data:t?{latitude:t.latitude??t.coordinates?.latitude,longitude:t.longitude??t.coordinates?.longitude,is_online:t.is_online??t.active,updated_at:t.updated_at??t.updatedAt}:null,error:null};
            }
            return{data:null,error:null};
          }
        })
      })
    })
  };
  const context:any={
    actor:{uid:'merchant',auth_time:100},
    role:'restaurant',
    verified:true,
    staff:{storeId:'store-1'},
    supabaseClient:mockSupabase,
    db:{doc:(path:string)=>({path}),runTransaction:async(fn:any)=>fn({get:async(ref:any)=>{reads.push(ref.path);return{data:()=>rows[ref.path]}}})}
  };
  return{rows,reads,context};
}
test('merchant receives only assigned-order GPS projection, no destination/customer/other products',async()=>{const f=fixture();const result=await merchantTracking({orderId:'order-1'},f.context);assert.deepEqual(result,{orderStatus:'with_courier',tracking:{coordinates:{latitude:30,longitude:31.7},active:true,updatedAt:{seconds:123,nanoseconds:456}}});});
test('other store, missing/unverified identity, revoked account and changed staff fail before reading GPS',async()=>{for(const change of ['other-store','unverified','disabled','locked','revoked','role','missing']){const f=fixture();if(change==='other-store'){f.rows['orders/order-1'].storeIds=['store-2'];f.rows['orders/order-1'].store_ids=['store-2'];f.rows['orders/order-1'].store_id='store-2';}if(change==='unverified')f.context.verified=false;if(change==='disabled'||change==='locked'||change==='revoked')f.context.verified=false;if(change==='role'){f.rows['staff/merchant'].role='courier';f.context.role='courier';}if(change==='missing')delete f.rows['orders/order-1'];await assert.rejects(()=>merchantTracking({orderId:'order-1'},f.context));assert(!f.reads.includes('tracking/order-1'),change);}});
test('terminal/unassigned orders never return tracking; invalid coordinates are discarded',async()=>{for(const status of ['received','ready','delivered','cancelled']){const f=fixture();f.rows['orders/order-1'].orderStatus=status;f.rows['orders/order-1'].status=status;assert.equal((await merchantTracking({orderId:'order-1'},f.context)).tracking,null);assert(!f.reads.includes('tracking/order-1'));}const f=fixture();f.rows['tracking/order-1'].coordinates.latitude=200;f.rows['tracking/order-1'].latitude=200;assert.equal((await merchantTracking({orderId:'order-1'},f.context)).tracking,null);await assert.rejects(()=>merchantTracking({orderId:'../bad'},f.context));});
