import test from 'node:test';
import assert from 'node:assert/strict';
import {orderTaxSnapshots} from './orderTax';
const item=(storeId:string,price:number)=>({id:storeId,product:{id:storeId,storeId,price},quantity:1,extraPrice:0,selectedOptions:{}} as any);
const store=(id:string,patch:any={})=>({id,name:id,deliveryFee:10,...patch} as any);
test('inclusive and exclusive merchant tax are distinguished without charging inclusive VAT twice',()=>{
 const external=orderTaxSnapshots([item('s',100)],new Map([['s',store('s',{taxRate:14,taxRegistrationNumber:'123456789',pricesIncludeTax:false})]]),0);assert.equal(external.taxTotal,14);assert.equal(external.additionalTax,14);assert.equal(external.storeSnapshots[0].total,124);
 const inclusive=orderTaxSnapshots([item('s',114)],new Map([['s',store('s',{taxRate:14,taxRegistrationNumber:'123456789',pricesIncludeTax:true})]]),0);assert.equal(inclusive.taxTotal,14);assert.equal(inclusive.additionalTax,0);assert.equal(inclusive.storeSnapshots[0].total,124);
});
test('discount allocations never become negative and do not lose cents across stores',()=>{
 const ids=['a','b','c','d'];const result=orderTaxSnapshots(ids.map(id=>item(id,1)),new Map(ids.map(id=>[id,store(id,{deliveryFee:0})])),0.02);assert.ok(result.storeSnapshots.every(store=>store.discount>=0));assert.equal(result.storeSnapshots.reduce((sum,store)=>sum+store.discount,0),0.02);assert.equal(Math.round(result.storeSnapshots.reduce((sum,store)=>sum+store.total,0)*100),398);
});
test('tax is not invented and configured VAT requires a registration number',()=>{
 assert.equal(orderTaxSnapshots([item('s',100)],new Map([['s',store('s')]]),0).taxTotal,0);
 assert.throws(()=>orderTaxSnapshots([item('s',100)],new Map([['s',store('s',{taxRate:14})]]),0));
});
