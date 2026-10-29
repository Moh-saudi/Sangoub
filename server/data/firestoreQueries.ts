import {FieldPath,type Query,type DocumentData} from 'firebase-admin/firestore';
import {validateQueryPlan,type QueryPlan} from '../../src/data/queryPlans.ts';
/** The only construction order: filters → all orderings → range → cursor → limit. */
export function adminQuery(db:any,plan:QueryPlan,after?:unknown){
 validateQueryPlan(plan);let q=db.collection(plan.collection);
 for(const f of plan.filters)q=q.where(f.field==='__name__'?FieldPath.documentId():f.field,f.op,f.value);
 for(const o of plan.orders)q=q.orderBy(o.field==='__name__'?FieldPath.documentId():o.field,o.direction);
 if(plan.bounds)q=q.startAt(...plan.bounds.start).endAt(...plan.bounds.end);
 if(after!==undefined)q=q.startAfter(after);
 return q.limit(plan.take) as Query<DocumentData>;
}

/** Error diagnostics deliberately exclude search text, cursor contents and customer identifiers. */
export async function readQuery(db:any,plan:QueryPlan,after?:unknown){
 const started=Date.now();
 try{return await adminQuery(db,plan,after).get();}
 catch(error){
  const code=String((error as any)?.code||'unknown').replace(/[^A-Za-z0-9_-]/g,'').slice(0,60);
  console.error('Firestore read failed',{queryKey:plan.key,scope:plan.scope,code,elapsedMs:Date.now()-started});
  throw error;
 }
}
