import {collection,query,where,orderBy,documentId,startAt,endAt,startAfter,limit,type Firestore,type QueryConstraint} from 'firebase/firestore';
import {validateQueryPlan,type QueryPlan} from './queryPlans';
/** Uses the same contracts and ordering as the server SDK adapter. */
export function clientQuery(db:Firestore,plan:QueryPlan,after?:unknown){
 validateQueryPlan(plan);const constraints:QueryConstraint[]=[];
 for(const f of plan.filters)constraints.push(where(f.field==='__name__'?documentId():f.field,f.op,f.value));
 for(const o of plan.orders)constraints.push(orderBy(o.field==='__name__'?documentId():o.field,o.direction));
 if(plan.bounds)constraints.push(startAt(...plan.bounds.start),endAt(...plan.bounds.end));
 if(after!==undefined)constraints.push(startAfter(after));
 constraints.push(limit(plan.take));return query(collection(db,plan.collection),...constraints);
}
