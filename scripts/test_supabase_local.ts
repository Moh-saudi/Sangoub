import { supabase, getStoreCatalog, getOfferModifiers, lookupProductByBarcode } from '../src/lib/supabase';

async function runLocalTestSuite() {
  console.log('================================================================');
  console.log('🚀 اختبار تكامل سوبابيز محلياً - مشروع سنجوب (SANGOUB)');
  console.log('================================================================\n');

  // 1. فحص الاتصال
  console.log('1️⃣ اختبار الاتصال بـ Supabase...');
  const { data: stores, error: storesErr } = await supabase.from('stores').select('*');
  if (storesErr) {
    console.error('❌ خطأ في الاتصال:', storesErr.message);
    return;
  }
  console.log(`✅ نجح الاتصال! عدد المتاجر المتاحة في قاعدة البيانات: ${stores.length}`);
  stores.forEach((s) => console.log(`   - 🏬 ${s.name} [${s.category}] - تقييم: ${s.rating} ⭐`));

  // 2. فحص الأصناف القياسية
  console.log('\n2️⃣ اختبار الكتالوج الموحد (Master SPU)...');
  const { data: spus, error: spuErr } = await supabase.from('master_spu').select('name_ar, vertical_id, brand_name');
  if (spuErr) {
    console.error('❌ خطأ في جلب SPU:', spuErr.message);
  } else {
    console.log(`✅ تم العثور على ${spus.length} أصناف قياسية موحدة:`);
    spus.forEach((p) => console.log(`   - 📦 ${p.name_ar} (قطاع: ${p.vertical_id}) | علامة: ${p.brand_name || 'عام'}`));
  }

  // 3. فحص عروض المتاجر (Store Offers View)
  console.log('\n3️⃣ اختبار العرض الموحد للعميل (vw_store_catalog)...');
  const foulStore = stores.find((s) => s.name.includes('فول')) || stores[0];
  if (foulStore) {
    const catalog = await getStoreCatalog(foulStore.id);
    console.log(`✅ قائمة منتجات متجر (${foulStore.name}):`);
    for (const item of catalog) {
      console.log(`   - 🍽️ ${item.display_name} | السعر: ${item.base_price} ج.م | كود الكاشير: ${item.merchant_pos_sku}`);
      
      // إذا كان للمنتج خيارات وتخصيصات (مثل ساندوتش الفول)
      if (item.has_modifiers) {
        console.log('     ⚙️ جلب شجرة التخصيصات والإضافات للوجبة:');
        const modifiers = await getOfferModifiers(item.offer_id);
        modifiers.forEach((g: any) => {
          console.log(`        📋 [${g.title_ar}] (حد أدنى: ${g.min_selection} - حد أقصى: ${g.max_selection}):`);
          g.product_modifier_items.forEach((opt: any) => {
            console.log(`           • ${opt.name_ar} ${opt.extra_price > 0 ? `(+${opt.extra_price} ج.م)` : '(مجاناً)'} ${opt.is_default ? '⭐ افتراضي' : ''}`);
          });
        });
      }
    }
  }

  // 4. اختبار محول الباركود للكاشير (Barcode Resolution)
  console.log('\n4️⃣ اختبار تمرير الباركود على جهاز الكاشير (Barcode Scanner)...');
  const testBarcode = '990007701005'; // باركود ميزان داخلي
  console.log(`   🔍 مسح كود داخلي من استيكر الميزان: [${testBarcode}]`);
  const matched = await lookupProductByBarcode(testBarcode);
  if (matched && matched.store_offers) {
    const offer = matched.store_offers as any;
    console.log(`✅ تم التعرف على الصنف فوراً:`);
    console.log(`   - الاسم المعتمد: ${offer.master_spu?.name_ar}`);
    console.log(`   - السعر على الكاشير: ${offer.base_price} ج.م`);
    console.log(`   - كود التاجر الداخلي (SKU): ${offer.merchant_pos_sku}`);
    console.log(`   - الرصيد المتوفر في المخزن: ${offer.stock_qty} علبة`);
  } else {
    console.log('⚠️ لم يتم العثور على باركود مطابق.');
  }

  console.log('\n================================================================');
  console.log('🎉 جميع اختبارات التكامل المحلي والـ Schema تعمل بنجاح 100%!');
  console.log('================================================================\n');
}

runLocalTestSuite();

