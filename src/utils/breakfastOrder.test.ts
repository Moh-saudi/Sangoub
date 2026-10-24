import test from 'node:test';
import assert from 'node:assert/strict';
import { breakfastCount, breakfastLines, buildBreakfastMessage, parseBreakfastQuantity, type BreakfastDraft } from './breakfastOrder';
const draft: BreakfastDraft = {quantities:{foul:3,falafel:2,potatoes:1,eggplant:1,'koshari-small':2},name:'عميل اختبار',address:'وزارة اختبار',office:'الدور 2 مكتب 12',notes:'بدون شطة',payment:'cash'};
test('mixed breakfast retains sandwiches and meals in the WhatsApp request with exact quantities',()=>{
 const message=buildBreakfastMessage(draft);assert.equal(breakfastCount(draft.quantities),9);assert.equal(breakfastLines(draft.quantities).length,5);
 for(const line of ['ساندوتش فول × 3','ساندوتش طعمية × 2','ساندوتش بطاطس × 1','ساندوتش باذنجان × 1','كشري صغير × 2','إجمالي الكمية: 9','الاسم: عميل اختبار','الدور / المكتب: الدور 2 مكتب 12','كاش عند الاستلام'])assert.ok(message.includes(line),line);
 assert.ok(!message.includes('كشري كبير'));assert.ok(message.includes('تأكيد التوفر والأسعار'));
});
test('InstaPay is a requested payment method and never a paid confirmation',()=>{
 const message=buildBreakfastMessage({...draft,payment:'instapay'});assert.ok(message.includes('إنستا باي'));assert.ok(message.includes('بيانات التحويل من الفريق'));assert.ok(!message.includes('كاش عند الاستلام'));assert.ok(!message.includes('تم الدفع'));
});
test('incomplete customer details, invalid quantities and unknown menu items cannot produce a sendable request',()=>{
 for(const input of [{...draft,name:' '},{...draft,address:''},{...draft,payment:''},{...draft,quantities:{}},{...draft,quantities:{foul:-1}},{...draft,quantities:{foul:1.5}},{...draft,quantities:{unknown:2}},{...draft,quantities:{foul:99,falafel:99,potatoes:3}}])assert.throws(()=>buildBreakfastMessage(input as BreakfastDraft));
});
test('Arabic and Persian quantity digits are accepted while fractional quantities are rejected',()=>{
 assert.equal(parseBreakfastQuantity('٣'),3);assert.equal(parseBreakfastQuantity('۱۲'),12);assert.equal(parseBreakfastQuantity(''),0);assert.equal(parseBreakfastQuantity('1.5'),null);assert.equal(parseBreakfastQuantity('-1'),null);
});
