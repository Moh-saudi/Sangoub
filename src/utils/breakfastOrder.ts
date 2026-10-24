export const BREAKFAST_MENU = [
  { id: 'sandwiches', name: 'ساندوتشات', items: [
    { id: 'foul', name: 'ساندوتش فول' }, { id: 'falafel', name: 'ساندوتش طعمية' },
    { id: 'potatoes', name: 'ساندوتش بطاطس' }, { id: 'eggplant', name: 'ساندوتش باذنجان' },
    { id: 'foul-falafel', name: 'ساندوتش فول وطعمية' }, { id: 'foul-egg', name: 'ساندوتش فول بالبيض' },
    { id: 'boiled-egg', name: 'ساندوتش بيض مسلوق' }, { id: 'omelette', name: 'ساندوتش أومليت' },
    { id: 'white-cheese', name: 'ساندوتش جبنة بيضاء' }, { id: 'roumi', name: 'ساندوتش جبنة رومي' },
    { id: 'cheese-tomato', name: 'ساندوتش جبنة بالطماطم' }, { id: 'shakshuka', name: 'ساندوتش شكشوكة' },
  ] },
  { id: 'meals', name: 'وجبات وكشري', items: [
    { id: 'koshari-small', name: 'كشري صغير' }, { id: 'koshari-medium', name: 'كشري وسط' }, { id: 'koshari-large', name: 'كشري كبير' },
    { id: 'foul-plate', name: 'طبق فول' }, { id: 'falafel-plate', name: 'طبق طعمية' },
    { id: 'potato-plate', name: 'طبق بطاطس' }, { id: 'eggplant-plate', name: 'طبق باذنجان' },
    { id: 'omelette-plate', name: 'طبق أومليت' }, { id: 'shakshuka-plate', name: 'طبق شكشوكة' },
    { id: 'mixed-breakfast', name: 'وجبة فطار مشكلة' },
  ] },
] as const;
export type BreakfastCategory = typeof BREAKFAST_MENU[number]['id'];
export type BreakfastPayment = 'cash' | 'instapay';
export type BreakfastDraft = { quantities: Record<string, number>; name: string; address: string; office: string; notes: string; payment: BreakfastPayment | '' };
export const MAX_ITEM_QUANTITY = 99;
export const MAX_BREAKFAST_QUANTITY = 200;
export function breakfastLines(quantities: Record<string, number>) {
  return BREAKFAST_MENU.flatMap(category => category.items.filter(item => (quantities[item.id] || 0) > 0).map(item => ({ ...item, category: category.name, quantity: quantities[item.id] })));
}
export function breakfastCount(quantities: Record<string, number>) { return breakfastLines(quantities).reduce((sum, item) => sum + item.quantity, 0); }
export function parseBreakfastQuantity(value: string) {
  const normalized = value.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0));
  if (!/^\d{0,2}$/.test(normalized)) return null;
  return Number(normalized);
}
export function breakfastPaymentLabel(payment: BreakfastPayment) { return payment === 'cash' ? 'كاش عند الاستلام' : 'إنستا باي — المبلغ وبيانات التحويل من الفريق'; }
export function buildBreakfastMessage(draft: BreakfastDraft) {
  const known = new Set<string>(BREAKFAST_MENU.flatMap(category => category.items.map(item => item.id)));
  for (const [id, count] of Object.entries(draft.quantities)) {
    if (!known.has(id) || !Number.isInteger(count) || count < 0 || count > MAX_ITEM_QUANTITY) throw new Error('راجع كميات الأصناف.');
  }
  const lines = breakfastLines(draft.quantities), total = breakfastCount(draft.quantities);
  if (!total || total > MAX_BREAKFAST_QUANTITY) throw new Error('اختر أصنافًا بكمية إجمالية من 1 إلى 200.');
  if (draft.name.trim().length < 2 || draft.name.trim().length > 80) throw new Error('اكتب اسمك من حرفين إلى 80 حرفًا.');
  if (draft.address.trim().length < 3 || draft.address.trim().length > 240) throw new Error('اكتب الوزارة أو عنوان التوصيل بوضوح.');
  if (draft.office.length > 120 || draft.notes.length > 300) throw new Error('اختصر تفاصيل المكتب أو الملاحظات.');
  if (!['cash', 'instapay'].includes(draft.payment)) throw new Error('اختر الدفع كاش أو إنستا باي.');
  return ['مرحبًا، أريد طلب فطار من طلبات العاصمة.', '', ...BREAKFAST_MENU.flatMap(category => {
    const items = lines.filter(item => item.category === category.name);
    return items.length ? [category.name + ':', ...items.map(item => `• ${item.name} × ${item.quantity}`), ''] : [];
  }), `إجمالي الكمية: ${total}`, `الاسم: ${draft.name.trim()}`, `الوزارة / العنوان: ${draft.address.trim()}`,
  ...(draft.office.trim() ? [`الدور / المكتب: ${draft.office.trim()}`] : []), `طريقة الدفع المطلوبة: ${breakfastPaymentLabel(draft.payment as BreakfastPayment)}`,
  ...(draft.notes.trim() ? [`ملاحظات: ${draft.notes.trim()}`] : []), '', 'برجاء تأكيد التوفر والأسعار والإجمالي والتوصيل قبل اعتماد الطلب.'].join('\n');
}
