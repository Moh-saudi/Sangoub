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
export const SUPERMARKET_MENU = [
  { id: 'office', name: 'احتياجات المكتب', items: [
    { id: 'tissues-box', name: 'مناديل سحب — علبة' }, { id: 'tissues-pocket', name: 'مناديل جيب — باكو' },
    { id: 'wet-wipes', name: 'مناديل مبللة — عبوة' }, { id: 'paper-cups', name: 'أكواب ورقية — باكو' },
    { id: 'sugar', name: 'سكر أبيض — كيس 1 كجم' }, { id: 'sugar-sachets', name: 'سكر أظرف — علبة' },
  ] },
  { id: 'tea-coffee', name: 'شاي وقهوة', items: [
    { id: 'tea-loose', name: 'شاي العروسة ناعم — باكو 250 جم' }, { id: 'tea-bags', name: 'شاي ليبتون فتلة — علبة 25 كيس' },
    { id: 'coffee-plain', name: 'بن أبو عوف سادة — 125 جم (ثُمن كيلو)' }, { id: 'coffee-cardamom', name: 'بن أبو عوف محوج — 125 جم (ثُمن كيلو)' },
    { id: 'instant-coffee', name: 'نسكافيه كلاسيك — برطمان 50 جم' }, { id: 'coffee-mix', name: 'نسكافيه 3 في 1 — ظرف' },
    { id: 'milk', name: 'لبن جهينة كامل الدسم — عبوة 1 لتر' },
  ] },
  { id: 'snacks', name: 'بسكويت وسناكس', items: [
    { id: 'biscuit-marie', name: 'بسكويت ماري — باكو' }, { id: 'biscuit-oreo', name: 'بسكويت أوريو — باكو' },
    { id: 'biscuit-borio', name: 'بسكويت بوريو — باكو' }, { id: 'wafer', name: 'ويفر فريسكا — باكو' },
    { id: 'chips-salt', name: 'شيبسي ملح — كيس' }, { id: 'chips-cheese', name: 'شيبسي جبنة — كيس' },
    { id: 'chips-chilli', name: 'شيبسي شطة وليمون — كيس' }, { id: 'bake-rolz', name: 'بيك رولز — كيس' },
    { id: 'cake-todo', name: 'كيك تودو — قطعة' }, { id: 'cake-twinkies', name: 'كيك توينكيز — قطعة' },
    { id: 'croissant', name: 'كرواسون مولتو شوكولاتة — قطعة' },
  ] },
  { id: 'drinks', name: 'مياه ومشروبات باردة', items: [
    { id: 'water-small', name: 'مياه معدنية — زجاجة 600 مل' }, { id: 'water-large', name: 'مياه معدنية — زجاجة 1.5 لتر' },
    { id: 'cola', name: 'بيبسي — كانز 330 مل' }, { id: 'coca-cola', name: 'كوكاكولا — كانز 330 مل' },
    { id: 'lemon-soda', name: 'سفن أب — كانز 330 مل' }, { id: 'orange-soda', name: 'ميرندا برتقال — كانز 330 مل' },
    { id: 'juice-mango', name: 'عصير جهينة مانجو — عبوة 235 مل' }, { id: 'juice-guava', name: 'عصير جهينة جوافة — عبوة 235 مل' },
  ] },
] as const;
export type RequestMenu = readonly { readonly id: string; readonly name: string; readonly items: readonly { readonly id: string; readonly name: string }[] }[];
export function requestMenu(kind: 'breakfast' | 'supermarket') { return kind === 'supermarket' ? SUPERMARKET_MENU : BREAKFAST_MENU; }
export function normalizeRequestPhone(value: string) {
 const phone = value.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0)-0x660)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0)-0x6f0)).replace(/[\s()-]/g, '').replace(/^(\+20|0020|20)(1)/, '0$2');
 if (!/^01[0125]\d{8}$/.test(phone)) throw new Error('اكتب رقم موبايل مصري صحيحًا.');
 return phone;
}
export type BreakfastCategory = typeof BREAKFAST_MENU[number]['id'];
export type BreakfastPayment = 'cash' | 'instapay';
export type BreakfastDraft = { quantities: Record<string, number>; phone?: string; name: string; address: string; office: string; notes: string; payment: BreakfastPayment | '' };
export const MAX_ITEM_QUANTITY = 99;
export const MAX_BREAKFAST_QUANTITY = 200;
export function breakfastLines(quantities: Record<string, number>, menu: RequestMenu = BREAKFAST_MENU) {
  return menu.flatMap(category => category.items.filter(item => (quantities[item.id] || 0) > 0).map(item => ({ ...item, category: category.name, quantity: quantities[item.id] })));
}
export function breakfastCount(quantities: Record<string, number>, menu: RequestMenu = BREAKFAST_MENU) { return breakfastLines(quantities, menu).reduce((sum, item) => sum + item.quantity, 0); }
export function parseBreakfastQuantity(value: string) {
  const normalized = value.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0));
  if (!/^\d{0,2}$/.test(normalized)) return null;
  return Number(normalized);
}
export function breakfastPaymentLabel(payment: BreakfastPayment) { return payment === 'cash' ? 'كاش عند الاستلام' : 'إنستا باي — المبلغ وبيانات التحويل من الفريق'; }
export function buildBreakfastMessage(draft: BreakfastDraft, menu: RequestMenu = BREAKFAST_MENU, orderName = 'فطار') {
  const known = new Set<string>(menu.flatMap(category => category.items.map(item => item.id)));
  for (const [id, count] of Object.entries(draft.quantities)) {
    if (!known.has(id) || !Number.isInteger(count) || count < 0 || count > MAX_ITEM_QUANTITY) throw new Error('راجع كميات الأصناف.');
  }
  const lines = breakfastLines(draft.quantities, menu), total = breakfastCount(draft.quantities, menu);
  if (!total || total > MAX_BREAKFAST_QUANTITY) throw new Error('اختر أصنافًا بكمية إجمالية من 1 إلى 200.');
  if (draft.name.trim().length < 2 || draft.name.trim().length > 80) throw new Error('اكتب اسمك من حرفين إلى 80 حرفًا.');
  if (draft.address.trim().length < 3 || draft.address.trim().length > 240) throw new Error('اكتب الوزارة أو عنوان التوصيل بوضوح.');
  if (draft.office.length > 120 || draft.notes.length > 300) throw new Error('اختصر تفاصيل المكتب أو الملاحظات.');
  if (!['cash', 'instapay'].includes(draft.payment)) throw new Error('اختر الدفع كاش أو إنستا باي.');
  return [`مرحبًا، أريد طلب ${orderName} من سنجوب.`, '', ...menu.flatMap(category => {
    const items = lines.filter(item => item.category === category.name);
    return items.length ? [category.name + ':', ...items.map(item => `• ${item.name} × ${item.quantity}`), ''] : [];
  }), `إجمالي الكمية: ${total}`, `الاسم: ${draft.name.trim()}`, ...(draft.phone ? [`رقم التواصل: ${normalizeRequestPhone(draft.phone)}`] : []), `الوزارة / العنوان: ${draft.address.trim()}`,
  ...(draft.office.trim() ? [`الدور / المكتب: ${draft.office.trim()}`] : []), `طريقة الدفع المطلوبة: ${breakfastPaymentLabel(draft.payment as BreakfastPayment)}`,
  ...(draft.notes.trim() ? [`ملاحظات: ${draft.notes.trim()}`] : []), '', 'برجاء تأكيد التوفر والأسعار والإجمالي والتوصيل قبل اعتماد الطلب.'].join('\n');
}
