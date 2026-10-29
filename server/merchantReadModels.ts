import {createHash} from 'node:crypto';
import {FieldPath} from 'firebase-admin/firestore';
import {AdminError,validId} from './adminRequest.ts';
export async function merchantReadModel(input:any,context:any){
 const {db,staff,actor}=context;const storeId=staff.storeId;validId(storeId);
 if((staff.duty||'manager')!=='manager')throw new AdminError(403,'هذه الصفحة لمدير المتجر فقط.');
 const [membership,access]=await Promise.all([db.doc('staff/'+actor.uid).get(),db.doc('accountAccess/'+actor.uid).get()]);
 const control=access.data();if(control?.disabled||control?.operationLocked||actor.auth_time<=(control?.revokedBefore||0))throw new AdminError(403,'انتهت صلاحية الحساب.');
 if(membership.data()?.role!=='restaurant'||membership.data()?.storeId!==storeId||(membership.data()?.duty||'manager')!=='manager')throw new AdminError(403,'تغيرت صلاحية المتجر.');
 if(input.action==='store-payments'){
  let query=db.collection('merchantSettlements').where('storeId','==',storeId).orderBy(FieldPath.documentId());
  if(input.cursor){validId(input.cursor);query=query.startAfter(input.cursor);}
  const snapshot=await query.limit(51).get();const docs=snapshot.docs.slice(0,50);
  return {items:docs.map((d:any)=>{const v=d.data();return {id:d.id,gross:v.gross,commission:v.commission,net:v.net,reference:v.reference||'',orderCount:Array.isArray(v.orderIds)?v.orderIds.length:0,createdAt:v.createdAt?.toDate?.().toISOString()||null};}),nextCursor:snapshot.docs.length>50?docs.at(-1)!.id:null};
 }
 const snapshot=await db.collection('orders').where('storeIds','array-contains',storeId).limit(101).get();
 const customers=new Map<string,any>();
 for(const d of snapshot.docs.slice(0,100)){
  const order=d.data();if(!order.profileId)continue;
  const id=createHash('sha256').update(storeId+'\0'+order.profileId).digest('hex');
  const row=customers.get(id)||{id,name:typeof order.profileName==='string'?order.profileName.slice(0,120):'عميل طلب',orderIds:[]};row.orderIds.push(d.id);customers.set(id,row);
 }
 return {items:[...customers.values()],truncated:snapshot.docs.length>100};
}
