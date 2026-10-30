/** SDK-independent read contracts. Scope identifiers must come from verified server context. */
export type QueryScope='public'|'store'|'courier'|'customer'|'admin';
export interface QueryPlan {
 key:string;collection:string;scope:QueryScope;
 filters:ReadonlyArray<{field:string;op:'=='|'array-contains'|'in'|'>='|'<=';value:unknown}>;
 orders:ReadonlyArray<{field:string;direction:'asc'|'desc'}>;
 bounds?:{start:unknown[];end:unknown[]};take:number;
 index?:ReadonlyArray<{fieldPath:string;order?:'ASCENDING'|'DESCENDING';arrayConfig?:'CONTAINS'}>;
}
const id=(value:string)=>{if(typeof value!=='string'||!/^[A-Za-z0-9_.@+-]{1,128}$/.test(value))throw new Error('Invalid query scope identifier');return value;};
const byId=[{field:'__name__',direction:'asc' as const}];
function plan(key:string,collection:string,scope:QueryScope,take:number,filters:QueryPlan['filters']=[],orders:QueryPlan['orders']=byId):QueryPlan{return {key,collection,scope,take,filters,orders};}
export const queryPlans={
 catalog:(source:'catalogProducts'|'products',search=''):QueryPlan=>{
  if(!['catalogProducts','products'].includes(source)||typeof search!=='string'||search.length>120)throw new Error('Invalid catalog query');
  const p=plan('catalog.'+source,source,'public',51);
  const term=search.trim();
  return term?{...p,orders:[{field:'name',direction:'asc'},...byId],bounds:{start:[term],end:[term+'\uf8ff']}}:p;
 },
 merchantProducts:(storeId:string)=>plan('merchant.products','products','store',101,[{field:'storeId',op:'==',value:id(storeId)}]),
 merchantPayments:(storeId:string)=>plan('merchant.payments','merchantSettlements','store',51,[{field:'storeId',op:'==',value:id(storeId)}]),
 merchantCustomers:(storeId:string)=>plan('merchant.customers','orders','store',101,[{field:'storeIds',op:'array-contains',value:id(storeId)}]),
 homeProducts:()=>plan('home.products','products','public',60,[{field:'inStock',op:'==',value:true}]),
 homeStores:()=>plan('home.stores','stores','public',30),
 carouselProducts:()=>plan('carousel.products','products','public',24,[{field:'inStock',op:'==',value:true}]),
 carouselStores:()=>plan('carousel.stores','stores','public',12,[{field:'status',op:'==',value:'open'}]),
 publicStores:()=>plan('shop.stores','stores','public',30),
 publicStoreProducts:(storeId:string)=>plan('shop.products','products','public',25,[{field:'storeId',op:'==',value:id(storeId)}]),
 portalOrders:(scope:'store'|'courier',scopeId:string,statuses:string[],history:boolean):QueryPlan=>{
  if(!['store','courier'].includes(scope)||!Array.isArray(statuses)||!statuses.length||statuses.length>10||statuses.some(s=>!['received','preparing','ready','with_courier','delivered','cancelled'].includes(s)))throw new Error('Invalid order query');
  const field=scope==='store'?'storeIds':'courierId';
  return {...plan('portal.orders.'+scope,'orders',scope,history?21:51,[{field,op:scope==='store'?'array-contains':'==',value:id(scopeId)},{field:'orderStatus',op:'in',value:statuses}]),
   index:[scope==='store'?{fieldPath:field,arrayConfig:'CONTAINS'}:{fieldPath:field,order:'ASCENDING'},{fieldPath:'orderStatus',order:'ASCENDING'}]};
 },
 customerHistory:(uid:string)=>plan('customer.history',`customerOrderHistory/${id(uid)}/orders`,'customer',30,[],[{field:'createdAt',direction:'desc'},...byId.map(o=>({...o,direction:'desc' as const}))]),
 adminSettlements:()=>plan('admin.settlements','merchantSettlements','admin',100,[],[{field:'createdAt',direction:'desc'}]),
 notifications:()=>plan('admin.notifications','notifications','admin',50,[],[{field:'createdAt',direction:'desc'}]),
 audit:(filter?:{field:string;value:string},range?:{from?:unknown;to?:unknown}):QueryPlan=>{
  if(filter&&!['actorUid','actorEmail','action','entityType','status','entityId'].includes(filter.field))throw new Error('Invalid audit filter');
  const filters:QueryPlan['filters'][number][]=[];
  if(filter)filters.push({field:filter.field,op:'==',value:filter.value});
  if(range?.from!==undefined)filters.push({field:'createdAt',op:'>=',value:range.from});
  if(range?.to!==undefined)filters.push({field:'createdAt',op:'<=',value:range.to});
  return {...plan('admin.audit','auditLogs','admin',51,filters,[{field:'createdAt',direction:'desc'}]),
   ...(filter?{index:[{fieldPath:filter.field,order:'ASCENDING' as const},{fieldPath:'createdAt',order:'DESCENDING' as const}]}:{})};
 },
};
export function validateQueryPlan(p:QueryPlan){
 if(!Number.isInteger(p.take)||p.take<1||p.take>501||!p.orders.length)throw new Error('Unbounded or unordered read is not allowed');
 if(p.scope==='store'&&!p.filters.some(f=>(f.field==='storeId'&&f.op==='=='||f.field==='storeIds'&&f.op==='array-contains')&&typeof f.value==='string'&&f.value.length>0))throw new Error('Store-scoped read must bind its store');
 if(p.scope==='courier'&&!p.filters.some(f=>f.field==='courierId'&&f.op==='=='&&typeof f.value==='string'&&f.value.length>0))throw new Error('Courier-scoped read must bind its courier');
 if(p.bounds&&(p.bounds.start.length>p.orders.length||p.bounds.end.length>p.orders.length))throw new Error('Query bounds exceed ordered fields');
 return p;
}
