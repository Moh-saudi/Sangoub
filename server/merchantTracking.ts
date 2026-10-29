import {AdminError,validId} from './adminRequest.ts';
import type {OperationIdentity} from './operations.ts';

/** Atomic ACL + projection. Merchant never receives customer destination/other stores' data. */
export async function merchantTracking(input:any,context:OperationIdentity){
 validId(input.orderId);
 if(!context.verified||context.role!=='restaurant'||!context.staff?.storeId)throw new AdminError(403,'هذه المتابعة لحساب المتجر المعتمد فقط.');
 const {db,actor}=context;
 return db.runTransaction(async tx=>{
  const [order,staff,access]=await Promise.all([tx.get(db.doc('orders/'+input.orderId)),tx.get(db.doc('staff/'+actor.uid)),tx.get(db.doc('accountAccess/'+actor.uid))]);
  const control=access.data(),current=staff.data(),data=order.data();
  if(control?.disabled||control?.operationLocked||actor.auth_time<=(control?.revokedBefore||0))throw new AdminError(403,'انتهت صلاحية الجلسة.');
  if(current?.role!=='restaurant'||!current.storeId||current.storeId!==context.staff!.storeId||!Array.isArray(data?.storeIds)||!data.storeIds.includes(current.storeId))throw new AdminError(404,'الطلب غير متاح لهذا المتجر.');
  if(data.orderStatus!=='with_courier'||!data.courierId)return {orderStatus:data.orderStatus,tracking:null};
  const location=(await tx.get(db.doc('tracking/'+input.orderId))).data(),point=location?.coordinates;
  const coordinates=point&&Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)&&Math.abs(point.latitude)<=90&&Math.abs(point.longitude)<=180?{latitude:point.latitude,longitude:point.longitude}:null;
  return {orderStatus:data.orderStatus,tracking:coordinates?{coordinates,active:location!.active===true,updatedAt:location!.updatedAt?{seconds:location!.updatedAt.seconds,nanoseconds:location!.updatedAt.nanoseconds}:null}:null};
 });
}
